# Manual — Rutas del sistema PredictMaint

Listado **completo** de rutas del sistema: páginas del frontend (Next.js) y endpoints del
backend (API REST), más el servicio ML interno.

## Direcciones base
| Servicio | URL base | Notas |
|---|---|---|
| **Web** (Next.js) | `http://localhost:3000` | Interfaz de usuario |
| **API** (NestJS) | `http://localhost:3001` | Sin prefijo global |
| **ML** (FastAPI) | `http://localhost:8000` | Interno; solo lo llama el API |
| **Swagger (API)** | `http://localhost:3001/api/docs` | Documentación interactiva de endpoints |

**Autenticación:** todos los endpoints requieren `Authorization: Bearer <JWT>` **excepto** los
marcados como *Público*. El SSE de monitoreo recibe el token por query (`?token=`).

---

# 1. Rutas del Frontend (páginas)

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/` | `app/page.tsx` | Redirección inicial (a login o dashboard) | Todos |
| `/login` | `app/(auth)/login/page.tsx` | Inicio de sesión | Público |
| `/dashboard` | `app/dashboard/page.tsx` | Panel principal: KPIs, estado de máquinas, alertas recientes | Supervisor / Jefe |
| `/dashboard/monitoring` | `app/dashboard/monitoring/page.tsx` | Monitoreo en tiempo real (SSE), tarjetas de máquinas, flujo de asignación | Supervisor / Jefe |
| `/dashboard/analysis/[machineId]` | `app/dashboard/analysis/[machineId]/page.tsx` | Análisis ML de una máquina: S-1 predicción, S-2 clasificación, S-3 RAG | Supervisor / Jefe |
| `/dashboard/orders` | `app/dashboard/orders/page.tsx` | Historial de mantenimiento (lista/filtros/CSV, reasignación) | Supervisor / Jefe |
| `/dashboard/orders/[id]` | `app/dashboard/orders/[id]/page.tsx` | Detalle completo de una orden + timeline | Supervisor / Jefe / Técnico (su orden) |
| `/dashboard/technicians` | `app/dashboard/technicians/page.tsx` | Gestión de técnicos (CRUD) | Supervisor / Jefe |
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Analítica y reportes (efectividad, recurrencia, MTTR/MTBF, validación) | Supervisor / Jefe |
| `/dashboard/analytics/repetitive` | `app/dashboard/analytics/repetitive/page.tsx` | Detalle de máquinas con fallos recurrentes | Supervisor / Jefe |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Configuración (Modelos ML, Envíos, RAG, Alertas, Fallos Repetitivos) | Supervisor / Jefe |
| `/dashboard/profile` | `app/dashboard/profile/page.tsx` | Mi perfil (editar nombre y teléfono) | Todos |
| `/dashboard/my-work` | `app/dashboard/my-work/page.tsx` | Tablero del técnico (pendientes / completadas) | Técnico / Técnico senior |

**Layouts:** `app/layout.tsx` (raíz, tema claro/oscuro) · `app/dashboard/layout.tsx` (sidebar + protección).

---

# 2. Endpoints del Backend (API REST)

> Base: `http://localhost:3001`. Método · Ruta · Descripción · Acceso.

## 2.1 Autenticación — `/auth`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/auth/login` | Iniciar sesión (devuelve JWT + usuario) | **Público** |
| GET | `/auth/me` | Usuario autenticado + permisos | JWT |
| POST | `/auth/logout` | Cerrar sesión | JWT |

## 2.2 Raíz — `/`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Estado/raíz del API | JWT |

## 2.3 Usuarios y perfil — `/users`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/users` | Listar usuarios | JWT |
| GET | `/users/me` | Perfil del usuario autenticado | JWT |
| PATCH | `/users/me` | Actualizar perfil (nombre y teléfono) | JWT |

## 2.4 Máquinas — `/machines`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/machines` | Listar máquinas | JWT |
| GET | `/machines/:id` | Obtener una máquina | JWT |
| GET | `/machines/:id/readings` | Lecturas de una máquina | JWT |
| POST | `/machines` | Crear máquina | JWT |
| PATCH | `/machines/:id` | Actualizar máquina | JWT |

## 2.5 Lecturas de sensor — `/sensor-readings`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/sensor-readings` | Registrar lectura y ejecutar pipeline (simulador/sensores) | **Público** |
| GET | `/sensor-readings` | Listar lecturas | JWT |
| GET | `/sensor-readings/:id` | Obtener una lectura | JWT |

## 2.6 Predicciones (inferencia ML) — `/predictions`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/predictions/binary/:orderId` | Predicciones binarias S-1 de la orden | JWT |
| GET | `/predictions/multiclass/:orderId` | Clasificación multiclase S-2 de la orden | JWT |
| POST | `/predictions/run/:orderId` | Re-ejecutar inferencia (body `{ etapa: S1\|S2 }`) | JWT |

## 2.7 Órdenes — `/orders`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/orders` | Listar órdenes (filtros/paginación) | JWT |
| GET | `/orders/my-board` | Tablero del técnico (sus órdenes) | Técnico |
| GET | `/orders/:id` | Obtener una orden | JWT |
| GET | `/orders/:id/timeline` | Timeline de eventos de la orden | JWT |
| POST | `/orders` | Crear orden | JWT |
| POST | `/orders/:id/start` | Iniciar orden | Técnico |
| PATCH | `/orders/:id/status` | Actualizar estado | JWT |
| POST | `/orders/:id/solution` | Registrar solución (finaliza la orden) | Técnico |
| POST | `/orders/:id/reject-prediction` | Rechazar predicción (con justificación) | Técnico |
| POST | `/orders/:id/reassign` | Reasignar a otro técnico (con motivo) | Supervisor / Jefe |
| POST | `/orders/:id/escalate` | Escalar orden (con motivo) | JWT |

## 2.8 Alertas — `/alerts`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/alerts/active` | Alertas activas | JWT |
| GET | `/alerts` | Listar alertas (filtros/paginación) | JWT |
| GET | `/alerts/:id` | Obtener una alerta | JWT |
| PATCH | `/alerts/:id/status` | Actualizar estado de alerta | JWT |

## 2.9 RAG (recomendaciones) — `/rag`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/rag/plan/:orderId` | Obtener plan RAG de la orden | JWT |
| POST | `/rag/plan/:orderId/accept` | Aceptar plan RAG | JWT |
| POST | `/rag/plan/:orderId/reject` | Rechazar plan RAG (con motivo) | JWT |
| POST | `/rag/plan/:orderId/regenerate` | Regenerar plan RAG | JWT |

## 2.10 Técnicos — `/technicians`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/technicians` | Listar técnicos | JWT |
| GET | `/technicians/available` | Técnicos disponibles según estrategia | JWT |
| GET | `/technicians/:id` | Obtener un técnico | JWT |
| POST | `/technicians` | Crear técnico | JWT |
| PATCH | `/technicians/:id` | Actualizar técnico | JWT |
| DELETE | `/technicians/:id` | Eliminar (inactivar) técnico | JWT |

## 2.11 Notificaciones — `/notifications`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/notifications/log` | Log de mensajes enviados | JWT |
| POST | `/notifications/send` | Enviar notificación al técnico asignado | JWT |
| GET | `/notifications/next-dispatch` | Próximo envío programado | JWT |

## 2.12 Fallos repetitivos — `/repetitive-faults`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/repetitive-faults` | Listar fallos repetitivos | JWT |
| GET | `/repetitive-faults/:maquinaId/history` | Historial de intervenciones de una máquina | JWT |
| POST | `/repetitive-faults/:id/resolve` | Resolver un fallo repetitivo (con nota) | JWT |

## 2.13 Modelos ML (catálogo) — `/ml-models`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/ml-models` | Listar modelos ML (`?etapa=S1\|S2`) | JWT |
| PATCH | `/ml-models/:id/activate` | Activar un modelo de su etapa | JWT |

## 2.14 Configuración — `/config`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/config` | Obtener configuración del sistema | JWT |
| PATCH | `/config` | Actualizar configuración (umbrales, SLA, fallos repetitivos, etc.) | JWT |

## 2.15 Catálogos — `/catalog`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/catalog/fault-types` | Catálogo de tipos de fallo | JWT |
| GET | `/catalog/risk-levels` | Catálogo de niveles de riesgo (con SLA) | JWT |
| GET | `/catalog/rag-sources` | Catálogo de fuentes RAG | JWT |
| PATCH | `/catalog/rag-sources/:id` | Activar/desactivar una fuente RAG | JWT |
| GET | `/catalog/notification-rules` | Reglas de notificación por nivel | JWT |
| PATCH | `/catalog/notification-rules/:nivel` | Actualizar regla (canal / destinatario) | JWT |
| GET | `/catalog/escalation-actions` | Acciones escaladas por tipo de fallo | JWT |
| PATCH | `/catalog/escalation-actions/:tipoFallo` | Actualizar acción escalada de un tipo | JWT |
| GET | `/catalog/dispatch-schedule` | Horarios de envío | JWT |
| PATCH | `/catalog/dispatch-schedule` | Actualizar horarios de envío | JWT |

## 2.16 Analítica — `/analytics`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/analytics/dashboard` | KPIs del dashboard | JWT |
| GET | `/analytics/summary` | Resumen de efectividad | JWT |
| GET | `/analytics/faults-by-type` | Fallos por tipo | JWT |
| GET | `/analytics/unattended` | Órdenes sin atender | JWT |
| GET | `/analytics/recurrent-machines` | Máquinas con fallos recurrentes | JWT |
| GET | `/analytics/machine-recurrence` | Ranking de máquinas por fallos en ventana | JWT |
| GET | `/analytics/availability` | Disponibilidad de máquinas | JWT |
| GET | `/analytics/prediction-validation` | Historial: predicción vs. decisión del técnico | JWT |
| GET | `/analytics/reliability` | **MTTR y MTBF** por máquina y global | JWT |
| GET | `/analytics/sensor-trend` | Serie temporal de sensores | JWT |
| GET | `/analytics/export` | Exportar CSV (stub) | JWT |

## 2.17 Monitoreo (tiempo real) — `/monitoring`
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET (SSE) | `/monitoring/stream` | Stream de eventos en vivo (Server-Sent Events) | Token por query `?token=` |

## 2.18 Documentación
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/docs` | Swagger UI (todos los endpoints) |

---

# 3. Servicio ML (FastAPI) — interno

> Base `http://localhost:8000`. **No** lo llama el navegador; solo el API (cabecera `X-API-Key`).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado + nº de modelos cargados |
| POST | `/predict` | S-1: predicción binaria (FALLA / SIN_FALLA) |
| POST | `/classify` | S-2: clasificación de tipo de fallo |
| POST | `/rag` | S-3: generación del plan de acción |

---

# 4. Resumen por números
- **Frontend:** 13 páginas (12 bajo `/dashboard` + login) + 2 layouts.
- **Backend:** 17 controllers · ~62 endpoints REST + 1 SSE.
- **ML:** 4 endpoints internos.
- **Públicos (sin JWT):** `POST /auth/login`, `POST /sensor-readings`. SSE con token en query.
</content>
