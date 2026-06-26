# Arquitectura del Frontend — `predictmaint-web` (Next.js)

Documentación técnica de la aplicación web de **PredictMaint** (mantenimiento
predictivo industrial). El frontend está construido con **Next.js (App Router)**,
**React**, **TypeScript**, **SWR** (data fetching), **Zustand** (estado global con
persistencia), **next-themes** (tema claro/oscuro) y **Tailwind CSS** sobre un sistema
de variables CSS.

Todas las rutas de archivos en este documento son relativas a
`predictmaint-web/src`.

---

## 1. Arquitectura limpia por capas

El código se organiza siguiendo **Clean Architecture**. Las carpetas reflejan las
capas y existe una **regla de dependencia** estricta: cada capa solo puede importar
hacia capas más internas (más estables), nunca al revés.

```
  app           (rutas/páginas Next.js — punto de entrada)
   │  importa ↓
  components    (vistas y UI React)
   │  importa ↓
  presentation  (hooks SWR, stores Zustand, providers)
   │  importa ↓
  application   (services: orquestación de casos de uso)
   │  importa ↓
  infrastructure(repositories + HttpClient/apiClient: detalle técnico)
   │  importa ↓
  core          (entities, types, interfaces — sin dependencias)
```

### Responsabilidad de cada capa

| Capa | Carpeta | Contenido | Puede importar de |
|------|---------|-----------|-------------------|
| **Core** | `core/` | `entities/` (modelos de dominio: `User`, `Machine`, `Order`, `Alert`, `RagPlan`…), `types/` (enums: `RolUsuario`, `TipoFallo`, `NivelRiesgo`, `EstadoOrden`…) y `interfaces/` (contratos de repositorios: `IMachineRepository`, `IAuthRepository`…) | **Nada** (capa más interna y estable) |
| **Application** | `application/services/` | *Services* que orquestan casos de uso y exponen una API limpia a la presentación | `core` |
| **Infrastructure** | `infrastructure/http/`, `infrastructure/repositories/` | `HttpClient`, `apiClient` y los *repositories* que implementan las interfaces de `core` y hablan con la API REST | `core` |
| **Presentation** | `presentation/hooks/`, `presentation/stores/`, `presentation/providers/` | Hooks SWR, stores Zustand, providers de tema y SWR | `application`, `core` (e `infrastructure` solo para cablear el token) |
| **Components** | `components/` | Vistas React (`dashboard-view`, `monitoring-view`…) y UI reutilizable (`ui/`, `common/`) | `presentation`, `application`, `core` |
| **App** | `app/` | Rutas del App Router (`page.tsx`, `layout.tsx`). Cada `page.tsx` solo monta una vista de `components/` | `components` |

### Regla de dependencia (quién importa a quién)

- `core` **no importa nada** del proyecto. Es el centro estable.
- `application/services` solo conoce **interfaces/entities** de `core` y las
  instancias concretas de los *repositories* (inyección por composición).
- `infrastructure` implementa las interfaces de `core` y es el **único lugar** que
  conoce `axios`/`apiClient` y las rutas HTTP literales (`'/machines'`).
- `presentation` consume `application` (nunca `infrastructure` directamente para
  datos; la única excepción de cableado es `sessionStore`, que registra el getter del
  token con `setApiTokenGetter`).
- `components` y `app` son las capas más externas (UI) y dependen hacia adentro.

### Diagrama de flujo de un dato (página → API → render)

Ejemplo real: listado de máquinas en el dashboard.

```
  app/dashboard/page.tsx
        │ monta
        ▼
  components/dashboard/dashboard-view.tsx
        │ llama al hook
        ▼
  presentation/hooks/useMachines.ts          ── useSWR('/machines', …)
        │ fetcher invoca el service
        ▼
  application/services/machine.service.ts     ── machineService.findAll()
        │ delega al repository
        ▼
  infrastructure/repositories/machine.repository.ts
        │ apiClient.get('/machines', { params:{ limit:100 } })
        ▼
  infrastructure/http/clients/apiClient.ts    ── HttpClient (axios + Bearer)
        │ HTTP GET
        ▼
        API REST (NEXT_PUBLIC_API_URL)
        │ respuesta JSON
        ▲────────────────────────────────────── vuelve por la misma cadena
  SWR cachea por la clave '/machines' y React re-renderiza la vista
```

Cada eslabón solo conoce al inmediatamente inferior: la vista no sabe que hay axios,
y el repository no sabe que hay SWR ni React.

---

## 2. Cliente HTTP + token (autenticación Bearer)

### `HttpClient` — `infrastructure/http/base/HttpClient.ts`

Wrapper genérico sobre **axios** que centraliza la configuración. En el constructor
recibe el `baseURL` y, opcionalmente, un `getToken: () => string | null`. Si se provee,
instala un **interceptor de request** que inyecta el header `Authorization: Bearer …`
en cada petición cuando hay token:

```ts
this.client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Expone métodos tipados `get/post/put/patch/delete<T>()` que ya devuelven `res.data`
(no el objeto axios completo), de modo que los repositories trabajan con el payload
directo.

### `apiClient` + `setApiTokenGetter` — `infrastructure/http/clients/apiClient.ts`

Instancia **singleton** de `HttpClient`. La `baseURL` viene de
`process.env.NEXT_PUBLIC_API_URL` (fallback `http://localhost:3001`).

El truco para evitar un acoplamiento circular (infraestructura → store de
presentación) es un **getter inyectable**:

```ts
let tokenGetter: (() => string | null) | undefined;

export function setApiTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

export const apiClient = new HttpClient(API_URL, () => tokenGetter?.() ?? null);
```

`apiClient` no importa el store; en su lugar, el **store registra su getter** al
cargarse (ver abajo). Así la infraestructura permanece independiente de la
presentación.

### `sessionStore` — `presentation/stores/sessionStore.ts`

Store de **Zustand con `persist`** que guarda el `token` (JWT) y el `user` en
`localStorage` bajo la clave `predictmaint-session`.

- **Estado:** `token: string | null`, `user: User | null`.
- **Acciones:** `setSession(token, user)`, `updateUser(partial)`, `clearSession()`.
- `updateUser` hace *merge parcial* del usuario sin perder los campos existentes
  (usado, p. ej., al editar el perfil):
  ```ts
  updateUser: (partial) =>
    set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),
  ```
- **`skipHydration: true`** + `partialize` (solo persiste `token` y `user`): la
  hidratación se controla manualmente desde `useSessionHydrated` (ver §5) para evitar
  desajustes SSR/cliente.
- El storage usa `localStorage` solo en cliente; en servidor devuelve un *no-op* para
  no romper el SSR.

Al final del módulo se conecta el token al `apiClient`:

```ts
setApiTokenGetter(() => useSessionStore.getState().token);
```

De esta forma **cada petición HTTP usa siempre el token vigente** del store sin que la
capa de infraestructura dependa de Zustand.

### `uiStore` — `presentation/stores/uiStore.ts`

Store Zustand (también con `persist`, clave `predictmaint-ui`) para el estado de UI:
`sidebarExpanded` (rail desktop expandido/colapsado, persistido) y `mobileNavOpen`
(drawer móvil, **no** persistido). Incluye `migrate`/`version: 1` para renombrar la
clave antigua `sidebarOpen → sidebarExpanded`.

---

## 3. Data fetching con SWR

El patrón es uniforme en todos los hooks de `presentation/hooks/`:

- **Clave SWR = ruta de la API** (string o tupla), lo que permite **revalidar desde
  cualquier punto** con `mutate('/machines')` (clave estable y predecible).
- El **fetcher invoca un service** de `application` — el hook nunca habla con axios.
- `refreshInterval` se usa para datos "vivos" (polling), normalmente **5 s**.

```ts
// presentation/hooks/useMachines.ts
const LIVE_REFRESH_MS = 5000;

export function useMachines(options?: { poll?: boolean }) {
  return useSWR('/machines', () => machineService.findAll(), {
    refreshInterval: options?.poll === false ? 0 : LIVE_REFRESH_MS,
  });
}

export function useMachine(id: string | null) {
  return useSWR(id ? `/machines/${id}` : null, () =>
    id ? machineService.findById(id) : null,
  );
}
```

Detalles del patrón:

- **Carga condicional:** si la clave es `null` (p. ej. `id` ausente), SWR **no
  dispara** la petición. Igual en `useAuth`: `useSWR(token ? '/auth/profile' : null, …)`.
- **Claves compuestas:** cuando hay parámetros se usa tupla, p. ej.
  `useSWR(['/alerts/recent', limit], () => alertService.findRecent(limit), …)`
  (`presentation/hooks/useAlerts.ts`).
- **Polling configurable:** muchos hooks aceptan `{ poll?: boolean }` para apagar el
  `refreshInterval` (`refreshInterval: poll === false ? 0 : 5000`).

### `SwrProvider` — `presentation/providers/SwrProvider.tsx`

Configuración global de SWR (envuelve toda la app en el `RootLayout`):

```tsx
<SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
```

Se desactiva la revalidación al enfocar la ventana y el reintento automático en error,
para tener un comportamiento predecible (el refresco lo gobiernan los
`refreshInterval` y el stream SSE).

---

## 4. SSE en el front (monitoreo en tiempo real)

`presentation/hooks/useMonitoringStream.ts` consume el endpoint
**`/monitoring/stream`** mediante **`EventSource`** (Server-Sent Events).

Como `EventSource` **no permite cabeceras personalizadas**, el JWT se envía por
**query string** (`?token=`):

```ts
const url = `${API_URL}/monitoring/stream?token=${encodeURIComponent(token)}`;
const es = new EventSource(url);
```

Comportamiento del hook:

- **Activación:** el efecto solo corre si hay `token`; al cambiar el token se
  reconecta.
- **`onopen`:** marca `isConnected = true` y resetea el contador de reintentos.
- **`onmessage`:** parsea el `event.data` (JSON). Ignora `type === 'heartbeat'`.
  Para `monitoring:reading` / `monitoring:alert` registra la máquina simulada y
  actualiza `readingTick`/`lastEventAt`. **En cualquier evento llama a `revalidate()`.**
- **Refresco vía `mutate`:** la clave del hecho es que el stream **no** trae los datos
  completos; solo notifica que algo cambió. El hook invalida las cachés SWR para que
  los componentes vuelvan a leer de la API:
  ```ts
  const { mutate } = useSWRConfig();
  const revalidate = () => {
    void mutate('/machines');
    void mutate('/alerts/active');
    void mutate('/analytics/dashboard');
  };
  ```
- **Reconexión con backoff exponencial:** en `onerror` cierra el `EventSource` y
  reprograma `connect` con `Math.min(1000 * 2 ** retry, 10_000)` ms.
- **Polling de respaldo:** además del SSE, un `setInterval` revalida cada
  `MONITORING_REFRESH_MS` (**8 s**), garantizando datos frescos aunque el stream caiga.
- **Limpieza:** al desmontar cierra el `EventSource`, limpia timers y resetea el
  estado.

Resumen del modelo: **SSE = señal de "hay novedades" → `mutate` → SWR re-lee la API**.
Los datos siempre se leen ya persistidos en BD por los hooks SWR, no del propio evento.

---

## 5. Rutas / páginas (App Router)

Cada `page.tsx` es delgado: solo monta una vista de `components/`. El layout raíz
(`app/layout.tsx`) instala el `<html lang="es">`, la fuente Inter, el `ThemeProvider`
y el `SwrProvider`. El layout `app/dashboard/layout.tsx` envuelve todo el dashboard en
`DashboardShell` (sidebar + topbar + guardia de sesión y de rol).

| Ruta | Componente (vista) | Qué muestra | Rol |
|------|--------------------|-------------|-----|
| `/` | — (`redirect`) | Redirige a `/login` | Público |
| `/login` | `LoginPage` (`components/auth/login-page.tsx`) | Formulario de acceso (react-hook-form + zod) | Público |
| `/dashboard` | `DashboardView` | KPIs, alertas recientes, estado de planta | Supervisor / Jefe de planta |
| `/dashboard/monitoring` | `MonitoringView` | Monitoreo en tiempo real (SSE) | Supervisor |
| `/dashboard/analysis/[machineId]` | `AnalysisView` | Análisis de predicciones ML por máquina (recibe `?order=`) | Supervisor |
| `/dashboard/orders` | `OrdersHistoryView` | Historial de órdenes de trabajo | Supervisor |
| `/dashboard/orders/[id]` | `OrderDetailView` | Detalle de una orden (timeline, predicciones, RAG) | Supervisor y Técnico |
| `/dashboard/technicians` | `TechniciansView` | Gestión de técnicos (alta/edición/estado) | Supervisor |
| `/dashboard/analytics` | `AnalyticsView` | Analítica y reportes (KPIs, recurrencia, RAG, disponibilidad…) | Supervisor |
| `/dashboard/analytics/repetitive` | `RawJsonView` + `useRepetitiveFaults` | Volcado JSON de fallos repetitivos | Supervisor |
| `/dashboard/my-work` | `TechnicianBoardView` | Tablero de trabajo del técnico (sus órdenes) | Técnico / Técnico senior |
| `/dashboard/profile` | `ProfileView` | Perfil del usuario | Todos |
| `/dashboard/settings` | `SettingsView` | Configuración (ML, RAG, alertas, despacho, fallos repetitivos) | Supervisor |

### Guardia de sesión y de rol — `DashboardShell` (`components/common/dashboard-shell.tsx`)

- Espera a la **hidratación** del store (`useSessionHydrated`, en
  `presentation/hooks/useAuth.ts`, que controla la rehidratación manual por el
  `skipHydration` del store) antes de decidir; mientras tanto muestra
  "Cargando sesión…".
- Si **no hay token**, redirige a `/login`.
- Si el usuario es **técnico** y entra a una ruta no permitida, lo redirige a
  `/dashboard/my-work`. Rutas permitidas para técnico:
  `/dashboard/my-work`, `/dashboard/profile` y `/dashboard/orders/*`.

`useAuth` (mismo archivo) expone además el perfil vía SWR (`'/auth/profile'`),
combinándolo con el `user` persistido (`profile ?? user`).

---

## 6. UI por rol (sidebar)

`components/common/sidebar.tsx` define **dos menús de navegación** según el rol del
usuario:

```ts
const SUPERVISOR_NAV = [
  { href: '/dashboard',            label: 'Dashboard',                icon: LayoutDashboard },
  { href: '/dashboard/monitoring', label: 'Monitoreo en Tiempo Real', icon: Radio },
  { href: '/dashboard/orders',     label: 'Historial',                icon: History },
  { href: '/dashboard/technicians',label: 'Gestión de Técnicos',      icon: Users },
  { href: '/dashboard/analytics',  label: 'Analítica y Reportes',     icon: BarChart3 },
  { href: '/dashboard/settings',   label: 'Configuración',            icon: Settings },
];

const TECHNICIAN_NAV = [
  { href: '/dashboard/my-work', label: 'Mi trabajo', icon: ClipboardList },
];
```

La selección se hace con `isTechnicianRole(user?.rol)` (rol `TECNICO` o
`TECNICO_SENIOR`):

```ts
const nav = isTechnicianRole(user?.rol) ? TECHNICIAN_NAV : SUPERVISOR_NAV;
```

### Footer del sidebar: perfil + logout

En el pie se muestran el **avatar** (iniciales del email), el **nombre y rol** del
usuario (`user?.nombre ?? user?.email`, `user?.rol`) y un botón de **cerrar sesión**:

```ts
const handleLogout = async () => {
  try { await authService.logout(); }
  catch { /* limpia la sesión local aunque falle el endpoint */ }
  finally { clearSession(); router.replace('/login'); }
};
```

Justo encima del footer está el enlace a **Perfil** y el `ThemeToggle`.

### Sidebar colapsable y responsive

- **Desktop:** rail que alterna entre `SIDEBAR_WIDTH_EXPANDED` (220 px) y
  `SIDEBAR_WIDTH_COLLAPSED` (64 px, solo iconos), gobernado por
  `uiStore.sidebarExpanded` y `toggleSidebarExpanded`. En modo colapsado los items
  muestran solo el icono (con `title`) y el `ThemeToggle` se renderiza como `iconOnly`.
- **Móvil (`< 1024px`):** `MobileNavBar` (barra superior con hamburguesa) abre un
  **drawer** lateral con overlay, controlado por `uiStore.mobileNavOpen`. El drawer se
  cierra al navegar (`closeMobileNav` en cambio de `pathname`) y al pasar a desktop.
- El detector de viewport es `useMediaQuery('(min-width: 1024px)')`.
- `isActive(href)` resalta el item activo, incluyendo casos derivados (p. ej.
  `/dashboard/analysis/*` resalta "Monitoreo", `/dashboard/orders/*` resalta
  "Mi trabajo" para técnicos).

---

## 7. Tema claro/oscuro

### `ThemeProvider` — `presentation/providers/ThemeProvider.tsx` + `app/layout.tsx`

Wrapper sobre **next-themes** (`@teispace/next-themes`). Se configura en el
`RootLayout`:

```tsx
<ThemeProvider
  attribute="class"        // aplica la clase en <html>
  defaultTheme="dark"      // tema por defecto: oscuro
  enableSystem={false}     // ignora la preferencia del SO
  themes={['light', 'dark']}
  value={{ light: '', dark: 'dark' }}  // 'light' = sin clase; 'dark' = clase .dark
>
```

- `attribute="class"`: el tema se aplica como **clase CSS** en `<html>`.
- `value={{ light: '', dark: 'dark' }}`: el modo claro **no añade clase** (usa el
  `:root` base) y el oscuro añade la clase **`.dark`**.
- `defaultTheme="dark"` + `enableSystem={false}`: la app arranca en **oscuro** y no
  sigue al sistema.
- `<html … suppressHydrationWarning>` evita el warning por la clase inyectada antes de
  la hidratación.

### `theme.css` — `styles/theme.css`

Define los tokens de color como **variables CSS**. El modo claro vive en `:root` (base)
y el oscuro las sobreescribe bajo `.dark`:

```css
/* Modo claro (por defecto del :root) */
:root {
  --color-bg: #f5f7fb;
  --color-surface: #ffffff;
  --color-ink: #1b2433;
  --color-accent: #1f8fd6;
  /* … riesgos, sombras, radios … */
}

/* Modo oscuro (tema por defecto de la app) */
.dark {
  --color-bg: #0c0e15;
  --color-surface: #151822;
  --color-ink: #e4e4f0;
  --color-accent: #309ce4;
  /* … */
}
```

Las clases de Tailwind (`bg-bg`, `text-ink`, `text-accent`, `border-border`,
`text-danger`…) se mapean a estas variables, por lo que **cambiar la clase `.dark`
recolorea toda la app** sin tocar el markup. Incluye tokens semánticos para riesgos
(`--color-risk-low/medium/high/critical`), estados (`success/warning/danger/info`),
radios y sombras.

### `ThemeToggle` — `components/common/theme-toggle.tsx`

Botón que alterna entre claro y oscuro con **next-themes**:

```tsx
const { theme, setTheme } = useTheme();
const isDark = theme === 'dark';
// icono Sun cuando está oscuro (para ir a claro), Moon cuando está claro
onClick={() => setTheme(isDark ? 'light' : 'dark')}
```

- Usa un flag `mounted` (`useEffect(() => setMounted(true), [])`) para **evitar
  mismatch de hidratación** (el tema real solo se conoce en cliente).
- Tiene **dos variantes**:
  - **Normal** (con texto "Modo claro"/"Modo oscuro"): usada en el sidebar expandido.
  - **`iconOnly`** (solo icono, con borde): usada en el sidebar colapsado
    (`<ThemeToggle iconOnly />`) y en la **esquina superior derecha del login**
    (`login-page.tsx`).

---

## Apéndice — Resumen de carpetas clave

| Carpeta | Rol |
|---------|-----|
| `core/entities`, `core/types`, `core/interfaces` | Dominio: modelos, enums y contratos de repositorio |
| `application/services` | Casos de uso (delegan en repositories) |
| `infrastructure/http` | `HttpClient` (axios + Bearer) y `apiClient` (singleton + `setApiTokenGetter`) |
| `infrastructure/repositories` | Implementaciones concretas que llaman a la API REST |
| `presentation/hooks` | Hooks SWR (`useMachines`, `useAlerts`, `useMonitoringStream`, `useAuth`…) |
| `presentation/stores` | `sessionStore` (JWT + user) y `uiStore` (sidebar/drawer) |
| `presentation/providers` | `ThemeProvider` (next-themes) y `SwrProvider` |
| `components/common` | `sidebar`, `dashboard-shell`, `theme-toggle`, `topbar`, `logo` |
| `components/dashboard`, `components/ui` | Vistas de cada ruta y librería de UI |
| `app` | Rutas del App Router (`page.tsx` + `layout.tsx`) |
| `styles/theme.css` | Variables de color claro (`:root`) y oscuro (`.dark`) |
