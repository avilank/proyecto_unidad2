# Seguridad: Autenticación, Autorización, Roles y Permisos (CASL)

Documentación técnica del subsistema de seguridad del backend `predictmaint-api`
(NestJS + Passport-JWT + Sequelize + CASL).

Todas las rutas de archivo son relativas a `predictmaint-api/src`.

---

## Índice

1. [Login: validación de credenciales, generación del JWT, payload y expiración](#1-login)
2. [Guard global `JwtAuthGuard`, `@Public()` y `@UserContext()`](#2-guard-global)
3. [`JwtStrategy`: extracción del bearer y validación contra BD](#3-jwtstrategy)
4. [SSE guard: token por query en el stream de monitoreo](#4-sse-guard)
5. [Roles y CASL: tabla de permisos por rol](#5-roles-y-casl)
6. [Flujo completo login → token → request autenticada](#6-flujo-completo)

---

## 1. Login

**Archivos:**
- `auth/auth.controller.ts`
- `auth/auth.service.ts`
- `auth/dto/login.dto.ts`
- `config/auth.config.ts`

### 1.1. Entrada y validación del DTO

El endpoint público `POST /auth/login` recibe un `LoginDto` validado por
`class-validator` (`auth/dto/login.dto.ts`):

```ts
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
```

- `email` debe ser un correo válido.
- `password` debe ser una cadena de al menos 6 caracteres.

El controlador (`auth/auth.controller.ts`) marca la ruta como pública y delega
en el servicio:

```ts
@Public()
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### 1.2. Validación de credenciales con bcrypt

En `auth/auth.service.ts`, el método `login()` busca al usuario por correo y
estado `activo`, incluyendo su rol y técnico asociado:

```ts
const usuario = await this.usuarioModel.findOne({
  where: { correo: dto.email, estado: 'activo' },
  include: [{ model: Rol }, { model: Tecnico, include: [Usuario, Especialidad] }],
});
if (!usuario) {
  throw new UnauthorizedException('Credenciales inválidas');
}
const valid = await bcrypt.compare(dto.password, usuario.passwordHash);
if (!valid) {
  throw new UnauthorizedException('Credenciales inválidas');
}
```

Puntos clave:

- La contraseña en claro **nunca** se almacena; se compara con `bcrypt.compare`
  contra `usuario.passwordHash`.
- Tanto el usuario inexistente/inactivo como la contraseña incorrecta devuelven
  el **mismo** error `401 Credenciales inválidas`, evitando filtrar si el correo
  existe.
- Solo se autentican usuarios con `estado: 'activo'`.

### 1.3. Generación del JWT y payload del token

Una vez validado, se resuelve el técnico asociado (si existe) y el rol se
normaliza con `mapRolNombre`. El payload del token es de tipo `AuthUserPayload`:

```ts
export interface AuthUserPayload {
  id: number;
  email: string;
  rol: RolUsuario;
  tecnicoId?: number;
}
```

```ts
const rol = mapRolNombre(usuario.rol?.nombre ?? 'operador');

const payload: AuthUserPayload = {
  id: usuario.idUsuario,
  email: usuario.correo,
  rol,
  tecnicoId: tecnico?.idTecnico,
};

const accessToken = this.jwtService.sign(payload);
```

**Contenido del payload del JWT:**

| Campo       | Tipo         | Descripción                                              |
|-------------|--------------|----------------------------------------------------------|
| `id`        | `number`     | ID del usuario (`idUsuario`). Clave para validar en BD.  |
| `email`     | `string`     | Correo del usuario.                                      |
| `rol`       | `RolUsuario` | Rol normalizado (`tecnico`, `tecnico_senior`, `supervisor`, `jefe_planta`). Determina los permisos CASL. |
| `tecnicoId` | `number?`    | ID del técnico asociado (opcional; solo si el usuario es técnico). |

Además, al firmar, `@nestjs/jwt` añade las claims estándar `iat` (emisión) y
`exp` (expiración).

### 1.4. Respuesta del login

```ts
return {
  accessToken,
  user: {
    id: usuario.idUsuario,
    nombre,
    rol,
    tecnicoId: tecnico?.idTecnico ?? null,
  },
};
```

El cliente recibe el `accessToken` (a usar como bearer) y un resumen del usuario
para la UI.

### 1.5. Expiración y secreto (`JWT_SECRET` / `JWT_EXPIRES_IN`)

La configuración del módulo JWT se centraliza en `config/auth.config.ts`:

```ts
export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
}));
```

- `JWT_SECRET`: secreto HMAC para firmar y verificar los tokens. **Debe**
  definirse en producción; el valor por defecto `change-me-in-production` es solo
  para desarrollo.
- `JWT_EXPIRES_IN`: tiempo de vida del token, por defecto `8h` (una jornada
  laboral). Tras ese plazo, el token caduca (`exp`) y la siguiente petición es
  rechazada con `401`.

> Nota: `logout()` en el servicio simplemente devuelve `{ ok: true }`; al ser
> JWT stateless, el cierre de sesión real consiste en que el cliente descarte el
> token.

---

## 2. Guard global

**Archivos:**
- `common/guards/jwt-auth.guard.ts`
- `common/decorators/public.decorator.ts`
- `common/decorators/user-context.decorator.ts`

### 2.1. `JwtAuthGuard` como guard global

`JwtAuthGuard` extiende el `AuthGuard('jwt')` de Passport y se registra como
guard global de la aplicación, por lo que **todas las rutas exigen un JWT válido
por defecto**.

```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
```

Funcionamiento:

1. El guard consulta vía `Reflector` la metadata `IS_PUBLIC_KEY` tanto en el
   handler (método) como en la clase (controlador).
2. Si la ruta está marcada como pública, devuelve `true` sin verificar token.
3. En caso contrario, delega en `super.canActivate()`, que dispara la
   `JwtStrategy` (extracción del bearer + validación). Si falta o es inválido el
   token, responde `401`.

### 2.2. Excepción con `@Public()`

El decorador `@Public()` (`common/decorators/public.decorator.ts`) marca rutas
que deben saltarse la autenticación:

```ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Aplicándolo sobre un método o controlador, el `JwtAuthGuard` detecta la metadata
y deja pasar la petición sin JWT.

**Endpoints públicos del sistema:**

| Endpoint                       | Motivo                                                              |
|--------------------------------|--------------------------------------------------------------------|
| `POST /auth/login`             | Punto de entrada para obtener el token; no puede requerir token.   |
| `sensor-readings` (ingesta)    | Ingesta de lecturas de sensores desde dispositivos/PLC sin sesión de usuario. |

> Las rutas `POST /auth/logout` y `GET /auth/me` **no** son públicas: requieren
> un token válido (`me` usa `@UserContext()` para identificar al usuario).

### 2.3. Extracción del usuario con `@UserContext()`

El decorador de parámetro `@UserContext()`
(`common/decorators/user-context.decorator.ts`) expone `req.user` (el payload
del JWT que dejó la estrategia) directamente en el método del controlador:

```ts
export const UserContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Uso típico (`auth/auth.controller.ts`):

```ts
@Get('me')
me(@UserContext() user: AuthUserPayload) {
  return this.authService.me(user);
}
```

El objeto inyectado es exactamente el `AuthUserPayload` (`id`, `email`, `rol`,
`tecnicoId`).

---

## 3. JwtStrategy

**Archivo:** `auth/jwt.strategy.ts`

`JwtStrategy` define cómo se extrae y valida el token cuando una ruta protegida
se evalúa.

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(Usuario) private readonly usuarioModel: typeof Usuario,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: AuthUserPayload): Promise<AuthUserPayload> {
    const usuario = await this.usuarioModel.findByPk(payload.id);
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
```

### 3.1. Extracción del bearer

- `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()` toma el token del
  header HTTP `Authorization: Bearer <token>`.
- `ignoreExpiration: false`: los tokens caducados (`exp` vencido) se rechazan
  automáticamente.
- `secretOrKey`: usa `auth.jwtSecret` (= `JWT_SECRET`) para verificar la firma.

### 3.2. Validación contra la base de datos

Tras verificar firma y expiración, Passport llama a `validate(payload)`. Aquí no
basta con que el token sea criptográficamente válido: se vuelve a comprobar
contra la BD que el usuario:

- **exista** (`findByPk(payload.id)`), y
- esté **activo** (`usuario.estado === 'activo'`).

Si el usuario fue eliminado o desactivado después de emitir el token, la petición
se rechaza con `401` aunque el token aún no haya caducado. El valor retornado por
`validate` se asigna a `req.user`, que luego consumen `@UserContext()` y CASL.

---

## 4. SSE guard

**Archivo:** `common/guards/sse-jwt-query.guard.ts`

El stream de monitoreo en tiempo real usa **Server-Sent Events (SSE)**. Los
clientes SSE (`EventSource` del navegador) **no permiten enviar headers
personalizados** como `Authorization: Bearer ...`. Por eso, para esas rutas el
token viaja como **parámetro de query** (`?token=...`) y se valida con un guard
específico, `SseJwtQueryGuard`, en lugar del `JwtAuthGuard` basado en header.

```ts
@Injectable()
export class SseJwtQueryGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.query?.token as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Token SSE requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('auth.jwtSecret'),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token SSE inválido');
    }
  }
}
```

Funcionamiento:

1. Lee el token de `request.query.token`. Si falta → `401 Token SSE requerido`.
2. Lo verifica con `jwtService.verifyAsync` usando el mismo secreto
   `auth.jwtSecret` (= `JWT_SECRET`), de modo que un mismo token de login sirve
   tanto para las rutas REST normales como para el stream SSE.
3. Si es válido, asigna el payload a `request.user` (consistente con
   `@UserContext()`) y autoriza.
4. Si la verificación falla (firma/expiración) → `401 Token SSE inválido`.

> Implicación de seguridad: al ir en la URL, el token puede aparecer en logs de
> servidor o historial. Se mitiga con la expiración corta del JWT (`8h`) y, en
> producción, con TLS.

---

## 5. Roles y CASL

**Archivos:**
- `common/enums/index.ts` (enum `RolUsuario`)
- `common/casl/casl-ability.factory.ts`

### 5.1. Roles del sistema

El enum `RolUsuario` define los cuatro roles (`common/enums/index.ts`):

```ts
export enum RolUsuario {
  TECNICO = 'tecnico',
  TECNICO_SENIOR = 'tecnico_senior',
  SUPERVISOR = 'supervisor',
  JEFE_PLANTA = 'jefe_planta',
}
```

### 5.2. Sujetos y acciones CASL

`common/casl/casl-ability.factory.ts` define las capacidades con `@casl/ability`:

```ts
export type AppSubjects = 'all' | 'Order' | 'Alert' | 'Technician' | 'Machine';
export type AppActions = 'manage' | 'create' | 'read' | 'update' | 'delete';
```

- **Sujetos (`AppSubjects`)**: `Order` (órdenes), `Alert` (alertas),
  `Technician` (técnicos), `Machine` (máquinas) y `all` (comodín = todos).
- **Acciones (`AppActions`)**: `manage` (comodín = todas las acciones),
  `create`, `read`, `update`, `delete`.

La fábrica construye la `Ability` según el rol:

```ts
switch (user.rol) {
  case RolUsuario.JEFE_PLANTA:
  case RolUsuario.SUPERVISOR:
    can('manage', 'all');
    break;
  case RolUsuario.TECNICO_SENIOR:
    can('read', 'all');
    can('update', 'Order');
    can('update', 'Alert');
    break;
  case RolUsuario.TECNICO:
    can('read', 'Order');
    can('read', 'Alert');
    can('read', 'Machine');
    break;
  default:
    can('read', 'all');
}
```

### 5.3. Tabla de permisos por rol

`manage` = todas las acciones; `all` = todos los sujetos.

| Rol               | Order               | Alert               | Technician     | Machine        | Resumen                          |
|-------------------|---------------------|---------------------|----------------|----------------|----------------------------------|
| **jefe_planta**   | manage              | manage              | manage         | manage         | `manage all` — control total     |
| **supervisor**    | manage              | manage              | manage         | manage         | `manage all` — control total     |
| **tecnico_senior**| read + update       | read + update       | read           | read           | lee todo; edita órdenes y alertas |
| **tecnico**       | read                | read                | —              | read           | solo lectura de órdenes, alertas y máquinas |

Notas:

- `jefe_planta` y `supervisor` comparten `can('manage', 'all')`: pueden crear,
  leer, actualizar y eliminar cualquier sujeto.
- `tecnico_senior` obtiene `read` sobre **todo** (`read all`) más `update` sobre
  `Order` y `Alert`. No puede crear ni eliminar.
- `tecnico` está limitado a **lectura** de `Order`, `Alert` y `Machine`; **no**
  tiene acceso a `Technician`.
- El `default` (rol no contemplado, p. ej. `operador`) cae en `read all`
  (solo lectura general).

### 5.4. Exposición de permisos en `/auth/me`

`auth.service.ts → me()` construye la `Ability` del usuario y serializa sus
reglas para que el frontend ajuste la UI:

```ts
const ability = this.caslFactory.createForUser({ id: usuario.idUsuario, rol });
const permisos = ability.rules.map((r) => {
  const action = Array.isArray(r.action) ? r.action.join(',') : r.action;
  return `${action}:${String(r.subject)}`;
});
```

Devuelve, por ejemplo, `["read:all", "update:Order", "update:Alert"]` para un
`tecnico_senior`.

---

## 6. Flujo completo

Login → emisión del token → petición autenticada.

```text
┌────────────┐                                  ┌──────────────────────────┐
│  Cliente   │                                  │   predictmaint-api       │
│ (frontend) │                                  │   (NestJS)               │
└─────┬──────┘                                  └────────────┬─────────────┘
      │                                                       │
      │  1) POST /auth/login  { email, password }             │
      │  (ruta @Public → JwtAuthGuard la deja pasar)          │
      ├──────────────────────────────────────────────────────►│
      │                                                       │
      │                          2) AuthService.login()       │
      │                             - findOne(correo, activo) │
      │                             - bcrypt.compare(pass)    │
      │                             - mapRolNombre(rol)       │
      │                             - jwtService.sign(payload)│
      │                                payload = {id, email,  │
      │                                  rol, tecnicoId}      │
      │                                                       │
      │  3) 200 { accessToken, user }                         │
      │◄──────────────────────────────────────────────────────┤
      │                                                       │
   (cliente guarda accessToken)                               │
      │                                                       │
      │  4a) REST:  GET /...  Authorization: Bearer <token>   │
      │  4b) SSE:   GET /monitor/stream?token=<token>         │
      ├──────────────────────────────────────────────────────►│
      │                                                       │
      │              5) Guard verifica el token:              │
      │                 REST → JwtAuthGuard → JwtStrategy      │
      │                       · extrae bearer del header      │
      │                       · verifica firma + exp          │
      │                       · validate(): usuario activo?   │
      │                 SSE  → SseJwtQueryGuard                │
      │                       · lee ?token, verifyAsync       │
      │                 → req.user = payload                  │
      │                                                       │
      │              6) Autorización CASL (por rol)           │
      │                 createForUser({id, rol}) → Ability     │
      │                 ¿can(acción, sujeto)? sí/no            │
      │                                                       │
      │  7) 200 datos   |   401 (token inválido/usuario       │
      │                 |        inactivo)                    │
      │◄──────────────────────────────────────────────────────┤
      │                                                       │
```

### Resumen del flujo

1. **Login** (`POST /auth/login`, público): se validan credenciales con bcrypt.
2. **Emisión**: se firma el JWT con `JWT_SECRET` y vida `JWT_EXPIRES_IN` (`8h`),
   con payload `{ id, email, rol, tecnicoId }`.
3. **Almacenamiento**: el cliente guarda el `accessToken`.
4. **Petición autenticada**:
   - REST: token en header `Authorization: Bearer`.
   - SSE: token en query `?token=` (porque `EventSource` no admite headers).
5. **Autenticación**: el guard correspondiente verifica firma y expiración, y
   `JwtStrategy.validate` re-comprueba contra BD que el usuario siga activo;
   coloca el payload en `req.user`.
6. **Autorización**: CASL construye la `Ability` del rol y decide si la acción
   sobre el sujeto está permitida.
7. **Respuesta**: `200` con datos, o `401` si el token es inválido, ha caducado
   o el usuario fue desactivado.
