# Arquitectura Limpia por Capas — Frontend (`predictmaint-web`)

El código del frontend se organiza siguiendo **Clean Architecture**. Las carpetas dentro
de `predictmaint-web/src/` reflejan las capas, y existe una **regla de dependencia**
estricta: cada capa solo puede importar hacia capas **más internas** (más estables),
nunca al revés.

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

---

## Descripción detallada de cada capa


| #   | Capa (carpeta)       | Qué contiene                                                                 | Responsabilidad                                                                                                                                                                                                   | Ejemplos reales en el proyecto                                                                                                | Depende de ↓   |
| --- | -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | `**app**`            | Rutas y páginas del App Router de Next.js (`page.tsx`, `layout.tsx`).        | **Punto de entrada / enrutamiento.** Define qué URL muestra qué vista. No tiene lógica de negocio: solo monta el componente que corresponde.                                                                      | `app/login/page.tsx`, `app/dashboard/analytics/page.tsx`, `app/dashboard/profile/page.tsx`, `app/dashboard/my-work/page.tsx`  | components     |
| 2   | `**components`**     | Vistas completas y UI de React (presentación visual).                        | **Lo que el usuario ve.** Renderiza datos y captura interacciones (clicks, formularios). Consume hooks de `presentation`, pero **no sabe** cómo se obtienen los datos.                                            | `analytics-view.tsx`, `technician-board-view.tsx`, `sidebar.tsx`, `settings/alerts-settings-tab.tsx`, paneles `analytics/*`   | presentation   |
| 3   | `**presentation`**   | Hooks de datos (SWR), stores de estado (Zustand) y providers (tema, sesión). | **Estado y reactividad de la UI.** Conecta los componentes con la lógica: expone hooks como `useAlerts()` que devuelven `{ data, isLoading, error }` y guardan la sesión/token.                                   | `hooks/useOrders.ts`, `hooks/useAnalytics.ts`, `stores/sessionStore.ts`, `stores/uiStore.ts`, `ThemeProvider`                 | application    |
| 4   | `**application`**    | *Services* — orquestación de casos de uso.                                   | **El "qué hacer" del negocio en el cliente.** Coordina pasos, valida y llama a los repositorios. Es la capa que un hook invoca cuando hay que ejecutar una acción (reasignar, rechazar, login).                   | `services/order.service.ts` (`reassign`, `reject`), `services/auth.service.ts`, `services/analytics.service.ts`               | infrastructure |
| 5   | `**infrastructure*`* | Repositories + `HttpClient`/`apiClient` (axios).                             | **El "cómo" técnico.** Detalle de implementación: arma las llamadas HTTP reales al backend, inyecta el token JWT, maneja URLs. Si mañana cambias axios por fetch, **solo tocas aquí**.                            | `repositories/order.repository.ts` (`POST /orders/:id/reassign`), `http/apiClient.ts`, `repositories/analytics.repository.ts` | core           |
| 6   | `**core`**           | Entities, types e interfaces puras.                                          | **El centro estable.** Define las *formas* de los datos del dominio (qué es una Orden, un Usuario, un Nivel de riesgo). **No importa nada** — ni React, ni axios, ni Next. Es la capa más interna y reutilizable. | `entities/index.ts` (`Order`, `Alert`), `types/index.ts` (`RolUsuario`, `NivelRiesgo`)                                        | — (nada)       |


---

## La regla de dependencia (lo clave para defender)

> **Cada capa solo importa hacia capas más internas, nunca al revés.**

- `components` puede usar `presentation`, pero `presentation` **jamás** importa un componente.
- Todas las capas conocen a `core`, pero `core` **no conoce a nadie**.
- Las flechas del diagrama **siempre apuntan hacia abajo** (hacia lo más estable).

**¿Por qué se hace así?** Lo interno (las entidades, las reglas) es lo que **menos
cambia**; lo externo (UI, librería HTTP) es lo que **más cambia**. Al hacer que lo
volátil dependa de lo estable —y no al revés— un cambio de diseño visual o de librería
**no rompe** el núcleo del negocio.

---

## Cómo fluye una acción real (ejemplo: reasignar una orden)

```
Usuario hace click "Reasignar"        → components/orders-history-view.tsx
   llama a un hook/handler             → presentation (estado del modal)
   que invoca el caso de uso           → application/services/order.service.ts  → reassign()
   que llama al repositorio            → infrastructure/repositories/order.repository.ts
   que hace el POST real al backend    → infrastructure/http/apiClient.ts  → POST /orders/:id/reassign
   usando los tipos de                 → core/entities (Order)
```

Cada paso baja una capa: la UI no sabe nada de HTTP, y el núcleo no sabe nada de la UI.

---

## Frase resumen para el docente

> *"La UI no sabe nada de HTTP, y el núcleo no sabe nada de la UI. Cada capa depende
> solo de la de adentro, así un cambio en la pantalla o en la librería de red no toca
> las reglas del negocio."*

---

### Documentos relacionados

- `DOCUMENTACION_ARQUITECTURA.md` — arquitectura completa de los 3 servicios.
- `HIJO_FRONTEND.md` — detalle profundo del frontend.
- `HIJO_BACKEND_NESTJS.md` — detalle profundo del backend.
- `GUION_EXPOSICION.md` — guión para la exposición.

---
---

# Arquitectura por Capas — Backend (`predictmaint-api`)

El backend usa **NestJS**, que impone una **arquitectura modular en capas**. La diferencia
con el frontend: aquí no se organiza por carpetas-capa globales, sino por **módulos de
dominio** (uno por área de negocio), y **dentro de cada módulo** se repite siempre el
mismo patrón de 3 capas: **Controller → Service → Model**.

```
  Petición HTTP (con JWT)
        │
        ▼
  ┌──────────────┐   valida token + permisos
  │ Guards       │   (JwtAuthGuard global + CASL por rol)
  └──────┬───────┘
        │  request ya autenticada
        ▼
  Controller   (define la ruta, recibe el DTO — NO tiene lógica)
        │  llama ↓
  Service      (la lógica de negocio: reglas, orquestación, validaciones)
        │  usa ↓
  Model        (Sequelize: lee/escribe en PostgreSQL)
        │
        ▼
   PostgreSQL
```

## Organización por módulos de dominio

Cada carpeta en `predictmaint-api/src/` es un **módulo** que agrupa todo lo de un área:
su `*.module.ts`, su `*.controller.ts`, su `*.service.ts` y sus `dto/`. Los **modelos**
(tablas) están centralizados aparte, en `database/models/`.

| Módulo (`src/…`) | Para qué es |
|---|---|
| `auth` | Login, emisión y validación de JWT, estrategia de Passport |
| `users` | Usuarios y edición de perfil propio |
| `orders` | Órdenes de mantenimiento: crear, asignar, iniciar, finalizar, rechazar, reasignar |
| `technicians` | Técnicos, especialidades, reglas de asignación y disponibilidad |
| `alerts` | Alertas del pipeline (estado visual del monitoreo) |
| `machines` | Máquinas CNC |
| `sensor-readings` | Endpoint público que recibe lecturas y dispara el pipeline |
| `ml-gateway` | **Único** punto que llama al servicio ML (con la API-Key) |
| `predictions` / `ml-models` | Resultados S-1/S-2 y metadatos de modelos |
| `rag` | Planes de acción (S-3) |
| `analytics` | KPIs, MTTR/MTBF, validación de predicción, disponibilidad |
| `notifications` | Envío por Email (SMTP) y WhatsApp (webhook n8n) |
| `config-catalog` | Configuración parametrizable (umbrales, SLA, reglas) |
| `repetitive-faults` | Detección de fallas repetitivas |
| `monitoring` | Stream en vivo por SSE |
| `jobs` | Procesos programados (cron): reintento, escalamiento, auto-fault |
| `integrations` | Adaptadores externos (email, webhooks) |
| `common` | Enums, eventos, utilidades, decoradores compartidos |
| `config` | Configuración de entorno (env, email config) |
| `database` | **Modelos Sequelize** (las tablas) + conexión |

> ⚠️ La carpeta `modules/` es scaffolding heredado y **no se importa** en `app.module.ts`.

## Las 3 capas dentro de un módulo

| # | Capa | Qué contiene | Responsabilidad | Ejemplo real (`orders`) |
|---|---|---|---|---|
| 1 | **Controller** | Clase con decoradores de ruta (`@Get`, `@Post`, `@Param`, `@Body`). | **Define la API.** Recibe la petición, valida el cuerpo con un **DTO**, y delega TODO al service. **No tiene lógica de negocio.** | `orders.controller.ts` → `POST /orders/:id/reassign` |
| 2 | **DTO** | Clases con validadores (`class-validator`: `@IsInt`, `@IsString`). | **Contrato de entrada.** Define y valida qué datos acepta el endpoint antes de que entren al service. | `dto/order.dto.ts` → `ReassignOrderDto { tecnicoId, motivo }` |
| 3 | **Service** | Clase `@Injectable` con la lógica. | **El cerebro.** Aplica reglas de negocio, valida permisos, orquesta varios modelos, emite eventos. Es lo único que un controller invoca. | `orders.service.ts` → `reassignOrder()` (valida rol, actualiza orden, registra evento, notifica) |
| 4 | **Model** | Clase Sequelize (`@Table`, `@Column`). | **Acceso a datos.** Representa una tabla y es por donde el service lee/escribe en PostgreSQL. | `database/models/orden.model.ts` → tabla `orden` |
| 5 | **Module** | Clase `@Module` que declara providers e imports. | **El ensamblador.** Une controller + service + modelos y los expone/inyecta. NestJS arma el grafo de dependencias con esto. | `orders.module.ts` |

## Capas transversales (atraviesan todos los módulos)

| Pieza | Dónde | Qué hace |
|---|---|---|
| **Guards** | `auth/`, `common/` | `JwtAuthGuard` global valida el token en **toda** petición (salvo `@Public`); CASL autoriza por rol. |
| **EventEmitter2** | `common/events/` | Comunicación interna desacoplada: un service **emite** un evento (`ORDER_CREATED_EVENT`) y otro lo **escucha** (notificaciones). Quien crea la orden no conoce a quien notifica. |
| **Jobs (cron)** | `jobs/` | Tareas programadas independientes de las peticiones: reintento de asignación, escalamiento por SLA, generación de datos demo. |
| **ml-gateway** | `ml-gateway/` | El **único** módulo autorizado a llamar al servicio ML, añadiendo la `X-API-Key`. |

## Cómo fluye una petición real (ejemplo: reasignar una orden)

```
POST /orders/PM-123/reassign  { tecnicoId, motivo }
   │
   ▼ JwtAuthGuard valida el token  →  CASL valida que sea supervisor
   ▼ OrdersController.reassign()   →  valida el cuerpo con ReassignOrderDto
   ▼ OrdersService.reassignOrder() →  reglas: orden no cerrada, motivo obligatorio,
   │                                   reasigna técnico, registra evento "reasignacion"
   ▼ Orden (modelo Sequelize)      →  UPDATE orden SET id_tecnico=…, reasignado_motivo=…
   ▼ eventEmitter.emit(ORDER_CREATED_EVENT)  →  NotificationsService notifica al nuevo técnico
   ▼ PostgreSQL
```

## Frase resumen para el docente (backend)

> *"El backend está organizado por módulos de dominio. Dentro de cada módulo siempre
> hay la misma división: el **controller** define la ruta y valida la entrada con un DTO,
> el **service** tiene la lógica de negocio, y el **modelo** Sequelize habla con la base.
> Por encima, guards JWT y permisos CASL protegen todo, y los módulos se comunican entre
> sí con eventos para no acoplarse."*

---

## Frontend vs. Backend — comparación rápida

| Aspecto | Frontend (Next.js) | Backend (NestJS) |
|---|---|---|
| Cómo se organiza | Por **capas globales** (app → components → … → core) | Por **módulos de dominio** (auth, orders, analytics…) |
| Regla central | Cada capa importa solo hacia adentro | Cada módulo separa Controller → Service → Model |
| Punto de entrada | Rutas en `app/` | Endpoints en `*.controller.ts` |
| Lógica de negocio | `application/services` | `*.service.ts` |
| Acceso a datos | `infrastructure/repositories` (HTTP al API) | `database/models` (Sequelize a PostgreSQL) |
| Tipos / contratos | `core/entities`, `core/types` | `dto/`, `common/enums` |
| Seguridad | Token JWT guardado en `sessionStore` | Guards JWT globales + CASL por rol |

