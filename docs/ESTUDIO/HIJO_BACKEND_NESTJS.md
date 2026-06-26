# Backend NestJS (predictmaint-api): estructura y arranque

Documentación técnica del backend NestJS de PredictMaint. Cubre el ensamblado de
módulos, el setup global, el bootstrap de `main.ts`, la configuración por
variables de entorno, el arranque de la base de datos (sync/seed) y el patrón
estándar de un módulo de dominio.

Ruta raíz del código fuente: `predictmaint-api/src`

---

## 1. Mapa de módulos importados en `app.module.ts`

Archivo: `predictmaint-api/src/app.module.ts`

| Módulo | Qué hace |
|--------|----------|
| `DatabaseModule` | Bootstrap (sync) y seed programático de la base al arrancar. |
| `AuthModule` | Login / emisión y validación de JWT, estrategia de autenticación. |
| `UsersModule` | CRUD de usuarios y sus roles. |
| `TechniciansModule` | Gestión de técnicos, especialidades, turnos y disponibilidad. |
| `MachinesModule` | CRUD de máquinas y consulta de sus lecturas de sensor. |
| `SensorReadingsModule` | Ingesta y consulta de lecturas de sensores. |
| `OrdersModule` | Órdenes de mantenimiento y su ciclo de vida (eventos de orden). |
| `AlertsModule` | Generación, niveles y configuración de alertas. |
| `PredictionsModule` | Predicciones de fallo (S1) y su persistencia. |
| `RagModule` | Recomendaciones RAG y fuentes bibliográficas asociadas. |
| `RepetitiveFaultsModule` | Detección y gestión de fallos repetitivos. |
| `NotificationsModule` | Reglas y envío de notificaciones (WhatsApp / Email). |
| `MlModelsModule` | Catálogo de modelos ML (S1/S2) y sus métricas. |
| `ConfigCatalogModule` | Catálogos de configuración (tipos de fallo, reglas, etc.). |
| `AnalyticsModule` | Métricas y agregados analíticos para el dashboard. |
| `MlGatewayModule` | Cliente/puerta de enlace hacia el servicio ML externo. |
| `JobsModule` | Tareas programadas (cron) y trabajos en segundo plano. |
| `MonitoringModule` | Monitoreo / health y observabilidad del sistema. |

> Otros `*.module.ts` existentes que **no** se importan directamente en
> `app.module.ts` sino de forma anidada: `integrations/email/email.module.ts`
> (usado por `NotificationsModule`).

Lista completa de `*.module.ts` (Glob `src/**/*.module.ts`): `app`, `auth`,
`users`, `technicians`, `machines`, `sensor-readings`, `orders`, `alerts`,
`predictions`, `rag`, `repetitive-faults`, `notifications`, `ml-models`,
`config-catalog`, `analytics`, `ml-gateway`, `jobs`, `monitoring`, `database`,
`integrations/email`.

---

## 2. Setup global

Todo el cableado global vive en el decorador `@Module({ imports: [...] })` de
`app.module.ts`:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [databaseConfig, authConfig, mlConfig, notificationsConfig, emailConfig],
}),
EventEmitterModule.forRoot(),
ScheduleModule.forRoot(),
SequelizeModule.forRootAsync(sequelizeConfig),
```

| Pieza | Detalle |
|-------|---------|
| `ConfigModule` | `isGlobal: true` (disponible sin re-importar). Carga 5 namespaces: `database`, `auth`, `ml`, `notifications`, `email`. |
| `EventEmitterModule` | `forRoot()` — bus de eventos en memoria para desacoplar emisores/oyentes (p. ej. alertas → notificaciones). |
| `ScheduleModule` | `forRoot()` — habilita decoradores `@Cron`/`@Interval` usados por `JobsModule`. |
| `SequelizeModule` | `forRootAsync(sequelizeConfig)` — conexión asíncrona configurada vía `ConfigService`. |

### Carga de modelos desde `index.ts`

`sequelize.config.ts` importa el arreglo `models` y lo pasa a Sequelize:

```ts
// config/sequelize.config.ts
import { models } from '../database/models';
// ...
const base = {
  dialect: 'postgres' as Dialect,
  models,
  autoLoadModels: false,
  synchronize: false,
  define: { underscored: true, timestamps: false },
  timezone: 'UTC',
  pool: { max: 20, min: 0, acquire: 30000, idle: 10000 },
};
```

`database/models/index.ts` exporta `models` como lista explícita de 28 modelos
(`Rol`, `Especialidad`, `Usuario`, `Tecnico`, `Maquina`, `LecturaSensor`,
`AnalisisFallo`, `PrediccionFallo`, `ModeloMl`, `TipoFallo`,
`ClasificacionFallo`, `FuenteRag`, `RecomendacionRag`, `RecomendacionRagFuente`,
`Orden`, `Alerta`, `EventoOrden`, `ReglaAsignacion`, `ReglaSensor`,
`ConfiguracionAlertas`, `ObservacionTecnica`, `SolucionAplicada`,
`RespuestaRecomendacion`, `AuditLog`, `MensajeEnviado`, `ReglaNotificacion`,
`FalloRepetitivo`, `AccionEscalada`).

> Nota: `synchronize: false` y `autoLoadModels: false` en la conexión. El sync
> real lo dispara `DatabaseBootstrapService` (ver sección 5), no Sequelize al
> conectarse.

### Guard global `JwtAuthGuard`

Registrado como `APP_GUARD`, protege **todas** las rutas por defecto:

```ts
providers: [
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
],
```

Definido en `common/guards/jwt-auth.guard.ts`. Las rutas públicas (p. ej. login)
se marcan con un decorador `@Public()` que el guard reconoce.

---

## 3. `main.ts`: bootstrap de la aplicación

Archivo: `predictmaint-api/src/main.ts`

```ts
const app = await NestFactory.create(AppModule);

app.enableCors();
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
);

const swaggerConfig = new DocumentBuilder()
  .setTitle('PredictMaint API')
  .setDescription('Contrato REST predictmaint-api ↔ predictmaint-web')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api/docs', app, document);

await app.listen(process.env.PORT ?? 3001);
```

| Aspecto | Configuración |
|---------|---------------|
| CORS | `app.enableCors()` — habilitado para todos los orígenes (sin restricción). |
| ValidationPipe | `whitelist: true` (descarta props no declaradas en DTO), `transform: true` (convierte tipos), `forbidNonWhitelisted: true` (rechaza con error props extra). |
| Swagger | UI en **`/api/docs`**; título "PredictMaint API", versión 1.0, con `addBearerAuth()` (autenticación Bearer JWT en la doc). |
| Puerto | `process.env.PORT ?? 3001` (por defecto **3001**). |

---

## 4. Configuración por variables de entorno

Cada archivo `config/*.config.ts` usa `registerAs('<namespace>', () => ({...}))`.

### `auth.config.ts` — namespace `auth`

| Variable | Default |
|----------|---------|
| `JWT_SECRET` | `change-me-in-production` |
| `JWT_EXPIRES_IN` | `8h` |

### `database.config.ts` — namespace `database`

Acepta o bien `DATABASE_URL`, o bien variables sueltas (`DATABASE_HOST`/`DATABASE_USER` activan el modo "split").

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgres://predictmaint:predictmaint@localhost:5432/predictmaint` |
| `DATABASE_HOST` | `localhost` (o host parseado de la URL) |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `predictmaint` |
| `DATABASE_PASSWORD` | `predictmaint` |
| `DATABASE_NAME` | `predictmaint` |
| `DATABASE_SYNC` | `true` |
| `DATABASE_ALTER` | `false` |
| `DATABASE_FORCE` | `false` |
| `DATABASE_LOGGING` | `false` |
| `DATABASE_SEED` | `true` |

### `ml.config.ts` — namespace `ml`

| Variable | Default |
|----------|---------|
| `ML_SERVICE_URL` | `http://localhost:8000` |
| `ML_API_KEY` | `ml-secret-key` |

### `notifications.config.ts` — namespace `notifications`

| Variable | Default |
|----------|---------|
| `SEND_EMAIL_WEBHOOK` | `''` |
| `FRONTEND_URL` | `http://localhost:3000` (se le quita la `/` final) |
| `WHATSAPP_TOKEN` | `''` |
| `SMTP_HOST` | `''` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `''` |
| `SMTP_PASS` | `''` |

### `email.config.ts` — namespace `email`

(También cargado en `app.module.ts`.) Usa fallback `MAIL_*` → `SMTP_*`.

| Variable | Default |
|----------|---------|
| `MAIL_HOST` (→ `SMTP_HOST`) | `''` |
| `MAIL_PORT` (→ `SMTP_PORT`) | `587` |
| `MAIL_USER` (→ `SMTP_USER`) | `''` |
| `MAIL_PASS` (→ `SMTP_PASS`) | `''` |
| `MAIL_FROM_NAME` | `PredictMaint` |
| `MAIL_FROM_ADDRESS` (→ `MAIL_USER`/`SMTP_USER`) | `''` |
| `MAIL_SECURE` | `false` |

### `constants.config.ts` — constantes (no leen env)

No usa `registerAs`; expone constantes de dominio reutilizables:

| Constante | Valor |
|-----------|-------|
| `UMBRAL_ENSEMBLE_FALLA_DEFAULT` | `0.5` |
| `AGREEMENT_MINIMO_DEFAULT` | `'MEDIO'` |
| `COOLDOWN_EVALUACION_MINUTOS_DEFAULT` | `30` |
| `TYPE_ENCODING` | `{ L: 0, M: 1, H: 2 }` |

---

## 5. Arranque de la base de datos

### `database-bootstrap.service.ts` (sync + disparo de seed)

Implementa `OnApplicationBootstrap`: se ejecuta una vez tras inicializar la app.

```ts
async onApplicationBootstrap(): Promise<void> {
  if (this.config.get<string>('database.sync') === 'true') {
    this.logger.log('Sincronizando tablas v2…');
    await this.sequelize.sync({
      force: this.config.get<string>('database.force') === 'true',
      alter: this.config.get<string>('database.alter') === 'true',
    });
    this.logger.log('Tablas listas.');
  }
  if (this.config.get<string>('database.seed') === 'true') {
    await this.seedService.seedIfEmpty();
  }
}
```

| Flag | Efecto |
|------|--------|
| `DATABASE_SYNC=true` | Ejecuta `sequelize.sync()` (crea/actualiza tablas). Solo desarrollo. |
| `DATABASE_FORCE=true` | `sync({ force: true })` — **borra y recrea** todas las tablas. |
| `DATABASE_ALTER=true` | `sync({ alter: true })` — ajusta columnas a los modelos. |
| `DATABASE_SEED=true` | Llama `seedService.seedIfEmpty()` tras el sync. |

### `database-seed.service.ts` (siembra idempotente)

Archivo: `predictmaint-api/src/database/database-seed.service.ts`

- `ensureReglasNotificacion()`: siembra las **4 reglas de notificación**
  (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) solo si la tabla está vacía.
- `seedIfEmpty()`: si ya hay usuarios, omite todo ("Base ya poblada; seed
  omitido."). En caso contrario, puebla los catálogos dentro de **una sola
  transacción**.

Catálogos/datos sembrados:

| Entidad | Cantidad | Contenido |
|---------|----------|-----------|
| `ReglaNotificacion` | 4 | Niveles LOW / MEDIUM / HIGH / CRITICAL con receptor y canal. |
| `Rol` | 3 | `operador`, `supervisor`, `jefe_planta`. |
| `Especialidad` | 4 | `mecanico`, `electrico`, `hidraulico`, `general`. |
| `TipoFallo` | 5 | HDF, PWF, TWF, OSF, RNF. |
| `ModeloMl` | 6 | S1: XGBoost (default), Random Forest, Reg. Logística. S2: LightGBM (default), Decision Tree, SVM. |
| `FuenteRag` | 6 | Referencias bibliográficas (Theissler, Pashmforoush, Cai, Araujo, Hesser & Markert, Jakobs). |
| `ConfiguracionAlertas` | 1 | Umbrales de riesgo (bajo 0.4 / medio 0.65 / alto 0.85 / crítico 1.0), escalamiento 30 min. |
| `ReglaSensor` | 4 | RN-01..RN-04 ligadas a HDF/PWF/TWF/OSF. |
| `Usuario` | 5 | 1 supervisor (operador@planta.pe) + 4 operadores. Password hash compartido (bcrypt). |
| `Tecnico` | 4 | Asociados a los 4 últimos usuarios, con especialidad, turno y nivel. |
| `Maquina` | 5 | M-001..M-005 (tornos, fresadora, prensa, centro mecanizado). |
| `ReglaAsignacion` | 12 | Reglas fallo→especialidad por nivel de riesgo (HIGH/CRITICAL/MEDIUM). |

> El seed es **idempotente** a nivel de poblamiento global: usa
> `Usuario.count() > 0` como guardia y `ReglaNotificacion.count()` por separado.

---

## 6. Patrón de un módulo de dominio

Cada módulo de dominio sigue el mismo patrón: `*.module.ts` + `*.controller.ts`
+ `*.service.ts`, registrando sus modelos con `SequelizeModule.forFeature([...])`.

Ejemplo real — `MachinesModule`:

### `machines/machines.module.ts`

```ts
@Module({
  imports: [SequelizeModule.forFeature([Maquina, LecturaSensor])],
  controllers: [MachinesController],
  providers: [MachinesService],
  exports: [MachinesService],
})
export class MachinesModule {}
```

- `forFeature([...])` inyecta los repositorios de esos modelos en el scope del módulo.
- `exports: [MachinesService]` permite reutilizar el service en otros módulos.

### `machines/machines.controller.ts` (extracto)

```ts
@ApiTags('machines')
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar máquinas' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.machinesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener máquina' })
  findOne(@Param('id') id: string) {
    return this.machinesService.findOne(id);
  }
}
```

- `@ApiTags`/`@ApiOperation` documentan el endpoint en Swagger (`/api/docs`).
- El controller delega toda la lógica al `MachinesService`.
- DTOs (`CreateMachineDto`, `UpdateMachineDto`, `PaginationQueryDto`) son
  validados por el `ValidationPipe` global de `main.ts`.

Resumen del flujo de una petición:

```
HTTP → JwtAuthGuard (global) → Controller (@Controller) → ValidationPipe (DTO)
     → Service (lógica) → Modelo Sequelize (forFeature) → PostgreSQL
```
