# PredictMaint — Documentación Técnica y Modelo de Datos

> **Sistema de Mantenimiento Predictivo Industrial con ML + RAG**
> Modelo relacional normalizado para PostgreSQL. Fecha: 2026-06-26.
> Este documento refleja el **estado ACTUAL** de los modelos Sequelize en
> `predictmaint-api/src/database/models/` (28 modelos registrados en `index.ts`).

---

## 1. Resumen del sistema

PredictMaint detecta fallos a partir de **lecturas simuladas** de sensores (`ai4i2020.csv`),
ejecuta predicción binaria (S-1), clasificación (S-2), recomendaciones RAG (S-3) y asigna
un técnico. El núcleo analítico es **`analisis_fallos`**: agrupa una lectura, sus predicciones,
clasificación y la orden de mantenimiento derivada.

### Flujo central

```
lecturas_sensor
      ↓ (regla RN-0x o umbral)
analisis_fallos  ←── prediccion_fallo (S-1, N modelos)
      ↓
clasificaciones_fallo (S-2, N modelos)
      ↓
recomendaciones_rag (S-3)
      ↓
ordenes_mantenimiento → observacion_tecnica / soluciones_aplicadas / respuesta_recomendacion
```

| Etapa | Tablas principales |
|-------|-------------------|
| S-1 | `analisis_fallos`, `prediccion_fallo`, `modelos_ml` |
| S-2 | `clasificaciones_fallo`, `tipos_fallo`, `modelos_ml` |
| S-3 | `recomendaciones_rag`, `recomendaciones_rag_fuente`, `fuentes_rag` |
| Operación | `ordenes_mantenimiento`, `alertas`, `eventos_orden`, `tecnicos`, `reglas_asignacion` |
| Notificación / escalado | `mensaje_enviado`, `regla_notificacion`, `fallo_repetitivo`, `accion_escalada` |
| Configuración / auditoría | `configuracion_alertas`, `audit_logs` |

> **Nota de convención:** Todos los modelos usan `underscored: true` y `timestamps: false`.
> Los nombres de columna en la BD están en `snake_case` (p. ej. `idRol` → `id_rol`,
> `airTemperature` → `air_temperature`). En este documento se listan los campos con su
> nombre físico en la base de datos.

---

## 2. Inventario de tablas (28 modelos registrados)

Modelos registrados en el array `models` de `src/database/models/index.ts`:

| # | Modelo (clase) | Tabla | Grupo |
|---|----------------|-------|-------|
| 1 | `Rol` | `roles` | Seguridad |
| 2 | `Especialidad` | `especialidades` | Seguridad |
| 3 | `Usuario` | `usuarios` | Seguridad |
| 4 | `Tecnico` | `tecnicos` | Seguridad |
| 5 | `Maquina` | `maquinas` | Activos |
| 6 | `LecturaSensor` | `lecturas_sensor` | Activos |
| 7 | `AnalisisFallo` | `analisis_fallos` | Pipeline ML |
| 8 | `PrediccionFallo` | `prediccion_fallo` | Pipeline ML (S-1) |
| 9 | `ModeloMl` | `modelos_ml` | Pipeline ML |
| 10 | `TipoFallo` | `tipos_fallo` | Pipeline ML |
| 11 | `ClasificacionFallo` | `clasificaciones_fallo` | Pipeline ML (S-2) |
| 12 | `FuenteRag` | `fuentes_rag` | RAG (S-3) |
| 13 | `RecomendacionRag` | `recomendaciones_rag` | RAG (S-3) |
| 14 | `RecomendacionRagFuente` | `recomendaciones_rag_fuente` | RAG (S-3, N:M) |
| 15 | `Orden` | `ordenes_mantenimiento` | Operación |
| 16 | `Alerta` | `alertas` | Operación |
| 17 | `EventoOrden` | `eventos_orden` | Operación |
| 18 | `ReglaAsignacion` | `reglas_asignacion` | Operación |
| 19 | `ReglaSensor` | `reglas_sensor` | Operación |
| 20 | `ConfiguracionAlertas` | `configuracion_alertas` | Configuración |
| 21 | `ObservacionTecnica` | `observacion_tecnica` | Operación |
| 22 | `SolucionAplicada` | `soluciones_aplicadas` | Operación |
| 23 | `RespuestaRecomendacion` | `respuesta_recomendacion` | Operación |
| 24 | `AuditLog` | `audit_logs` | Auditoría |
| 25 | `MensajeEnviado` | `mensaje_enviado` | Notificación |
| 26 | `ReglaNotificacion` | `regla_notificacion` | Notificación |
| 27 | `FalloRepetitivo` | `fallo_repetitivo` | Escalado |
| 28 | `AccionEscalada` | `accion_escalada` | Escalado |

> **Archivos no registrados (no generan tabla):** existen en la carpeta de modelos
> `nivel-riesgo.model.ts`, `horario-envio.model.ts`, `configuracion.model.ts`,
> `plan-rag.model.ts`, `plan-rag-fuente.model.ts`, `accion-rag.model.ts`,
> `prediccion-binaria.model.ts` y `prediccion-multiclase.model.ts`, pero **NO** están
> en el array `models`, por lo que Sequelize no crea esas tablas en el sync.

---

## 3. Diagrama entidad-relación (dbdiagram)

```dbml
Table roles {
  id_rol integer [primary key]
  nombre varchar(60) [unique, not null]
  descripcion text
}

Table especialidades {
  id_especialidad integer [primary key]
  nombre varchar(60) [unique, not null]
  descripcion text
}

Table usuarios {
  id_usuario integer [primary key]
  id_rol integer [not null]
  nombres varchar(80) [not null]
  apellidos varchar(80) [not null]
  correo varchar(120) [unique, not null]
  password_hash varchar(255) [not null]
  telefono varchar(20)
  estado varchar(20) [not null, default: 'activo']
}

Table tecnicos {
  id_tecnico integer [primary key]
  id_usuario integer [unique, not null]
  id_especialidad integer [not null]
  disponibilidad varchar(30) [not null, default: 'disponible']
  enviar_wssp boolean [default: true]
  enviar_correo boolean [default: false]
  turno varchar(20) [not null]
  nivel_experiencia smallint [default: 1]
}

Table maquinas {
  id_maquina integer [primary key]
  codigo varchar(10) [unique, not null]
  nombre varchar(120) [not null]
  modelo varchar(80)
  ubicacion varchar(120)
  tipo_calidad char(1) [not null, default: 'M']   // L / M / H — feature ML
  estado varchar(30) [not null, default: 'operacion']
  fecha_registro date [not null, default: `now()`]
}

Table lecturas_sensor {
  id_lectura bigint [primary key]
  id_maquina integer [not null]
  tipo_maquina char(1) [not null]                 // L / M / H — feature ML
  air_temperature decimal(6,2) [not null]
  process_temperature decimal(6,2) [not null]
  rotational_speed decimal(10,2) [not null]
  torque decimal(6,2) [not null]
  tool_wear decimal(10,2) [not null]
  power_w decimal(10,2)
  fecha_lectura date [not null, default: `now()`]
}

Table analisis_fallos {
  id_analisis bigint [primary key]
  id_maquina integer [not null]
  id_lectura bigint [not null]
  prediccion varchar(20)
  nivel_riesgo varchar(10)
  ensemble_avg decimal(6,4)
  agreement varchar(10)            // BAJO / MEDIO / ALTO
  regla_disparada varchar(8)
  fecha_analisis date [not null, default: `now()`]
}

Table prediccion_fallo {
  id_resultado bigint [primary key]
  id_analisis bigint [not null]
  id_modelo integer [not null]
  prediccion varchar(20) [not null]
  confianza decimal(5,2)
  probabilidad decimal(5,2)
  accuracy decimal(5,2)
  roc_auc decimal(6,3)
  precision_score decimal(5,2)
  recall_score decimal(5,2)
  f1_score decimal(5,2)
  es_lider boolean [default: false]
  tn integer
  fp integer
  fn integer
  tp integer
}

Table modelos_ml {
  id_modelo integer [primary key]
  nombre varchar(60) [not null]
  tipo varchar(40)
  version varchar(20)
  accuracy decimal(5,2)
  roc_auc decimal(6,3)
  precision_score decimal(5,2)
  recall_score decimal(5,2)
  f1_score decimal(5,2)
  f1_weighted decimal(5,3)
  tn integer
  fp integer
  fn integer
  tp integer
  es_prediccion boolean [default: false]
  es_clasificacion boolean [default: false]
  umbral decimal(4,3)
  es_default boolean [default: false]
}

Table tipos_fallo {
  id_tipo_fallo integer [primary key]
  codigo varchar(10) [unique, not null]
  nombre varchar(120) [not null]
  descripcion text
}

Table clasificaciones_fallo {
  id_clasificacion bigint [primary key]
  id_analisis bigint [not null]
  id_tipo_fallo integer [not null]
  id_modelo integer [not null]
  confianza decimal(5,2)
  prob_hdf decimal(5,2)
  prob_pwf decimal(5,2)
  prob_twf decimal(5,2)
  prob_osf decimal(5,2)
  prob_rnf decimal(5,2)
  es_lider boolean [default: false]
  diverge boolean [default: false]
  metric_accuracy decimal(5,2)
  metric_f1_macro decimal(5,3)
  metric_f1_weighted decimal(5,3)
  metric_tp integer
  metric_fn integer
  metric_fp integer
  metric_tn integer
  fecha_clasificacion date [not null, default: `now()`]
}

Table fuentes_rag {
  id_fuente integer [primary key]
  titulo varchar(200) [not null]
  autor varchar(120)
  url text
  activo boolean [default: true]
}

Table recomendaciones_rag {
  id_recomendacion bigint [primary key]
  id_clasificacion bigint [not null]
  id_fuente integer
  orden smallint [not null, default: 1]
  titulo varchar(160) [not null]
  prioridad varchar(20) [not null]
  recomendacion text
}

Table recomendaciones_rag_fuente {
  id_recomendacion bigint [primary key]   // PK compuesta
  id_fuente integer [primary key]         // PK compuesta
}

Table ordenes_mantenimiento {
  id_orden bigint [primary key]
  codigo varchar(12) [unique, not null]
  id_analisis bigint [not null]
  id_maquina integer [not null]
  id_tecnico integer
  estado varchar(30) [not null, default: 'pendiente']  // pendiente|en_progreso|finalizado|rechazada
  proximo_reintento_asignacion date
  intentos_asignacion smallint [default: 0]
  fecha_creacion date [not null, default: `now()`]
  fecha_inicio date
  fecha_fin date
  observaciones text
  reasignado_motivo text
  reasignado_en date
}

Table alertas {
  id_alerta bigint [primary key]
  codigo varchar(12) [unique, not null]
  id_analisis bigint [not null]
  id_maquina integer [not null]
  id_orden bigint
  nivel_riesgo varchar(10) [not null]
  estado varchar(30) [not null]
  id_tecnico integer
  regla_disparada varchar(8)
  fecha_alerta date [not null, default: `now()`]
}

Table eventos_orden {
  id_evento bigint [primary key]
  id_orden bigint [not null]
  etapa varchar(40) [not null]
  descripcion text
  actor varchar(80) [default: 'sistema']
  fecha_evento date [not null, default: `now()`]
}

Table reglas_asignacion {
  id_regla integer [primary key]
  id_tipo_fallo integer
  id_especialidad integer
  nivel_riesgo varchar(10) [not null]
  prioridad smallint [default: 1]
  activo boolean [default: true]
}

Table reglas_sensor {
  id_regla integer [primary key]
  codigo varchar(8) [unique, not null]
  descripcion varchar(255) [not null]
  id_tipo_fallo integer
  activo boolean [default: true]
}

Table configuracion_alertas {
  id_config_alerta integer [primary key]
  riesgo_bajo decimal(4,2) [not null, default: 0.40]
  riesgo_medio decimal(4,2) [not null, default: 0.65]
  riesgo_alto decimal(4,2) [not null, default: 0.85]
  riesgo_critico decimal(4,2) [not null, default: 1.00]
  tiempo_escalamiento integer [default: 30]
  plantilla_notificacion text
  fecha_actualizacion date [not null, default: `now()`]
  umbral_ensemble_falla decimal(4,2) [not null, default: 0.50]
  agreement_minimo_s3 varchar(10) [not null, default: 'MEDIO']
  horarios_envio_json text
  tiempos_atencion_json text          // SLA por nivel: { LOW, MEDIUM, HIGH, CRITICAL }
  fallos_repetitivos_json text        // umbrales (veces/días) + toggles notificación
}

Table observacion_tecnica {
  id_respuesta_tecnica bigint [primary key]
  id_orden bigint [not null]
  id_tipo_fallo integer
  es_falla boolean
  es_prediccion_correcta boolean
  es_clasificacion_correcta boolean
  decision varchar(12) [not null, default: 'aceptada']   // aceptada | rechazada
  comentario text
  fecha_registro date [not null, default: `now()`]
}

Table soluciones_aplicadas {
  id_solucion bigint [primary key]
  id_orden bigint [not null]
  tipo_solucion varchar(40) [not null]   // con_rag | propia | rechazada_manual
  descripcion text
  fecha_registro date [not null, default: `now()`]
}

Table respuesta_recomendacion {
  id_respuesta bigint [primary key]
  id_orden bigint [not null]
  decision varchar(20) [not null]        // aceptado | rechazado
  observacion text
  fecha_respuesta date [not null, default: `now()`]
}

Table audit_logs {
  id bigint [primary key]
  id_usuario integer
  modulo varchar(60) [not null]
  accion varchar(60) [not null]
  url varchar(255)
  body text
  ip varchar(45)
  fecha_registro date [not null, default: `now()`]
}

Table mensaje_enviado {
  id bigint [primary key]
  tecnico_id integer
  id_orden bigint
  maquinas varchar(120)
  motivo varchar(160)
  canal enum [not null]                  // whatsapp | email | whatsapp_email
  tipo_envio enum                        // alerta_critica | inicio_turno | mitad_turno | fin_turno | repetitivo
  estado enum [default: 'pendiente']     // entregado | pendiente | fallido
  enviado_en date [not null]
}

Table regla_notificacion {
  id integer [primary key]
  nivel varchar(10) [unique, not null]
  recibe varchar(120) [not null]
  canal varchar(40) [not null]
}

Table fallo_repetitivo {
  id bigint [primary key]
  id_maquina integer [not null]
  tipo_fallo char(3)                     // FK a tipos_fallo.codigo
  ocurrencias smallint [not null]
  ventana_dias smallint [default: 7]
  estado enum [not null]                 // en_revision | programado | seguimiento | resuelto
  ultima_accion varchar(160)
  nivel enum                             // CRITICO | MODERADO | SEGUIMIENTO
  supervisor_notificado boolean [default: false]
  ultima_ocurrencia_en date
}

Table accion_escalada {
  id integer [primary key]
  tipo_fallo char(3) [not null]          // FK a tipos_fallo.codigo
  acciones_adicionales text [not null]
}

Ref: usuarios.id_rol > roles.id_rol
Ref: tecnicos.id_usuario - usuarios.id_usuario
Ref: tecnicos.id_especialidad > especialidades.id_especialidad
Ref: lecturas_sensor.id_maquina > maquinas.id_maquina
Ref: analisis_fallos.id_maquina > maquinas.id_maquina
Ref: analisis_fallos.id_lectura > lecturas_sensor.id_lectura
Ref: prediccion_fallo.id_analisis > analisis_fallos.id_analisis
Ref: prediccion_fallo.id_modelo > modelos_ml.id_modelo
Ref: clasificaciones_fallo.id_analisis > analisis_fallos.id_analisis
Ref: clasificaciones_fallo.id_tipo_fallo > tipos_fallo.id_tipo_fallo
Ref: clasificaciones_fallo.id_modelo > modelos_ml.id_modelo
Ref: recomendaciones_rag.id_clasificacion > clasificaciones_fallo.id_clasificacion
Ref: recomendaciones_rag.id_fuente > fuentes_rag.id_fuente
Ref: recomendaciones_rag_fuente.id_recomendacion > recomendaciones_rag.id_recomendacion
Ref: recomendaciones_rag_fuente.id_fuente > fuentes_rag.id_fuente
Ref: ordenes_mantenimiento.id_analisis - analisis_fallos.id_analisis
Ref: ordenes_mantenimiento.id_maquina > maquinas.id_maquina
Ref: ordenes_mantenimiento.id_tecnico > tecnicos.id_tecnico
Ref: alertas.id_analisis > analisis_fallos.id_analisis
Ref: alertas.id_maquina > maquinas.id_maquina
Ref: alertas.id_orden > ordenes_mantenimiento.id_orden
Ref: alertas.id_tecnico > tecnicos.id_tecnico
Ref: eventos_orden.id_orden > ordenes_mantenimiento.id_orden
Ref: reglas_asignacion.id_tipo_fallo > tipos_fallo.id_tipo_fallo
Ref: reglas_asignacion.id_especialidad > especialidades.id_especialidad
Ref: reglas_sensor.id_tipo_fallo > tipos_fallo.id_tipo_fallo
Ref: observacion_tecnica.id_orden > ordenes_mantenimiento.id_orden
Ref: observacion_tecnica.id_tipo_fallo > tipos_fallo.id_tipo_fallo
Ref: soluciones_aplicadas.id_orden > ordenes_mantenimiento.id_orden
Ref: respuesta_recomendacion.id_orden > ordenes_mantenimiento.id_orden
Ref: audit_logs.id_usuario > usuarios.id_usuario
Ref: mensaje_enviado.tecnico_id > tecnicos.id_tecnico
Ref: mensaje_enviado.id_orden > ordenes_mantenimiento.id_orden
Ref: fallo_repetitivo.id_maquina > maquinas.id_maquina
Ref: fallo_repetitivo.tipo_fallo > tipos_fallo.codigo
Ref: accion_escalada.tipo_fallo > tipos_fallo.codigo
```

---

## 4. Descripción de tablas

### 4.1 Seguridad y usuarios

| Tabla | Propósito | Notas de columnas |
|-------|-----------|-------------------|
| `roles` | Catálogo de roles | `nombre` único. (Roles de negocio: tecnico, tecnico_senior, supervisor, jefe_planta) |
| `usuarios` | Login (correo + hash). Separado de la ficha técnica | `password_hash` (bcrypt), `estado` default `activo`; getter `activo` derivado |
| `especialidades` | mecánico, eléctrico, hidráulico, general | `nombre` único |
| `tecnicos` | Extensión operativa del usuario | `nivel_experiencia` smallint (default 1) usado en asignación; flags `enviar_wssp`/`enviar_correo`; `id_usuario` único (1:1 con usuario) |

### 4.2 Activos y sensores

| Tabla | Propósito | Notas de columnas |
|-------|-----------|-------------------|
| `maquinas` | Activos monitoreados (`codigo` = `M-001`) | `tipo_calidad` char(1) L/M/H (feature ML), `estado` default `operacion` |
| `lecturas_sensor` | Eventos del simulador / CSV | `tipo_maquina` char(1) L/M/H (feature ML), `power_w` derivada en backend |

### 4.3 Pipeline ML (S-1 / S-2 / S-3)

| Tabla | Propósito | Notas de columnas |
|-------|-----------|-------------------|
| `analisis_fallos` | **Hub** por evento: consenso S-1 | `ensemble_avg`, `nivel_riesgo`, `agreement` (BAJO/MEDIO/ALTO), `regla_disparada` |
| `prediccion_fallo` | Un registro por modelo binario por análisis | Métricas por modelo (`accuracy`, `roc_auc`, `precision_score`, `recall_score`, `f1_score`), matriz de confusión (`tn/fp/fn/tp`), flag `es_lider` |
| `clasificaciones_fallo` | Un registro por modelo multiclase por análisis | Probabilidades por clase (`prob_hdf/pwf/twf/osf/rnf`), flags `es_lider`/`diverge`, métricas (`metric_accuracy`, `metric_f1_macro`, `metric_f1_weighted`, `metric_tp/fn/fp/tn`) |
| `modelos_ml` | Catálogo unificado | Flags `es_prediccion`/`es_clasificacion`/`es_default`, `umbral`, métricas y matriz de confusión, `f1_weighted` |
| `tipos_fallo` | HDF, PWF, TWF, OSF, RNF | `codigo` único |
| `fuentes_rag` | Bibliografía / referencias | `activo` boolean |
| `recomendaciones_rag` | Acciones S-3 ligadas a la clasificación líder | `orden` (1,2,3), `titulo`, `prioridad`, `recomendacion`; FK opcional a `fuentes_rag` |
| `recomendaciones_rag_fuente` | Tabla puente N:M recomendación ↔ fuente | PK compuesta (`id_recomendacion`, `id_fuente`) |

### 4.4 Operación de mantenimiento

| Tabla | Propósito | Notas de columnas |
|-------|-----------|-------------------|
| `ordenes_mantenimiento` | Orden derivada de un análisis con falla | `codigo` único (`ORD-001`), `estado` (pendiente/en_progreso/finalizado/**rechazada**), reintento de asignación (`proximo_reintento_asignacion`, `intentos_asignacion`), reasignación (`reasignado_motivo` TEXT, `reasignado_en` DATE) |
| `alertas` | Alerta activa para el monitoreo en vivo | `codigo` único, `estado`, `nivel_riesgo`, `regla_disparada`, FK opcionales a orden y técnico |
| `eventos_orden` | Timeline de la orden (S-1→S-2→S-3→técnico) | `etapa`, `descripcion`, `actor` (default `sistema`) |
| `observacion_tecnica` | Feedback del técnico + validación ML | Flags `es_falla`/`es_prediccion_correcta`/`es_clasificacion_correcta`, **`decision`** varchar(12) default `aceptada` (aceptada/rechazada), `comentario` |
| `soluciones_aplicadas` | Cierre: qué se hizo en planta | `tipo_solucion` (con_rag/propia/rechazada_manual) |
| `respuesta_recomendacion` | Aceptar/rechazar el plan RAG | `decision` (aceptado/rechazado), `observacion` |
| `reglas_asignacion` | Matriz tipo_fallo × especialidad × nivel_riesgo | `prioridad`, `activo`; FKs opcionales a tipo_fallo y especialidad |
| `reglas_sensor` | Disparo RN-01..RN-04 antes del ML | `codigo` único, FK opcional a tipo_fallo |

### 4.5 Notificaciones y escalado

| Tabla | Propósito | Notas de columnas |
|-------|-----------|-------------------|
| `mensaje_enviado` | Log de envíos WhatsApp/Email | ENUM `canal` (whatsapp/email/whatsapp_email), ENUM `tipo_envio` (alerta_critica/inicio_turno/mitad_turno/fin_turno/repetitivo), ENUM `estado` (entregado/pendiente/fallido), FKs a técnico y orden |
| `regla_notificacion` | Quién recibe notificación por nivel | `nivel` único, `recibe`, `canal` |
| `fallo_repetitivo` | Detección de fallos recurrentes por máquina | `ocurrencias`, `ventana_dias` (default 7), ENUM `estado` (en_revision/programado/seguimiento/resuelto), ENUM `nivel` (CRITICO/MODERADO/SEGUIMIENTO), `supervisor_notificado`, FK `tipo_fallo` a `tipos_fallo.codigo` |
| `accion_escalada` | Acciones adicionales por tipo de fallo recurrente | `acciones_adicionales` TEXT, FK `tipo_fallo` a `tipos_fallo.codigo` |

### 4.6 Configuración y auditoría

| Tabla | Propósito | Notas de columnas |
|-------|-----------|-------------------|
| `configuracion_alertas` | Umbrales de riesgo, escalamiento, SLA, fallos repetitivos | Umbrales `riesgo_bajo/medio/alto/critico`, `umbral_ensemble_falla`, `agreement_minimo_s3`, `tiempo_escalamiento`, `plantilla_notificacion`, **`horarios_envio_json`**, **`tiempos_atencion_json`** (SLA por nivel), **`fallos_repetitivos_json`** (umbrales + toggles) |
| `audit_logs` | Trazabilidad de acciones en API/UI | `modulo`, `accion`, `url`, `body`, `ip`; FK opcional a usuario |

---

## 5. Enums del backend (`src/common/enums/index.ts`)

Algunos campos se persisten como `varchar`/`char` con validación en código, y otros como
`ENUM` de PostgreSQL (ver `mensaje_enviado` y `fallo_repetitivo`). Catálogo de enums:

| Enum | Valores |
|------|---------|
| `NivelRiesgo` | LOW, MEDIUM, HIGH, CRITICAL |
| `TipoFallo` | HDF, PWF, TWF, OSF, RNF |
| `EstadoOrden` | pendiente, en_progreso, finalizado, **rechazada** |
| `DecisionPrediccion` | aceptada, rechazada |
| `EstadoAlerta` | analizando, clasificando, pendiente, en_progreso, finalizado |
| `Especialidad` | mecanico, electrico, hidraulico, general |
| `Turno` | mañana, tarde, noche |
| `EstadoTecnico` | disponible, en_intervencion, fuera_de_turno |
| `RolUsuario` | tecnico, tecnico_senior, supervisor, jefe_planta |
| `ModeloBinario` | regresion_logistica, random_forest, xgboost |
| `ModeloMulticlase` | decision_tree, lightgbm, svm |
| `PrediccionBinaria` | FALLA, SIN_FALLA |
| `EtapaModelo` | S1, S2 |
| `Canal` | whatsapp, email, whatsapp_email |
| `EstadoOperativo` | operacion, alerta, fallo, mantenimiento |
| `Agreement` | BAJO, MEDIO, ALTO |
| `SolucionTipo` | con_rag, propia, rechazada_manual |
| `EtapaEventoOrden` | deteccion_s1, clasificacion_s2, rag_s3, respuesta_tecnico, en_progreso, finalizado, escalado |
| `EstadoPlanRag` | pendiente, aceptado, rechazado |
| `PrioridadAccion` | CRITICO, BAJO, MEDIO |
| `EstadoFalloRepetitivo` | en_revision, programado, seguimiento, resuelto |
| `NivelFalloRepetitivo` | CRITICO, MODERADO, SEGUIMIENTO |
| `TipoEnvio` | alerta_critica, inicio_turno, mitad_turno, fin_turno, repetitivo |
| `EstadoMensaje` | entregado, pendiente, fallido |

---

## 6. Mapeo al flujo de monitoreo simulado

| Paso del pipeline | Tablas que escribe |
|-------------------|-------------------|
| Simulador envía lectura | `lecturas_sensor` |
| Regla `reglas_sensor` / umbral | crea `analisis_fallos` + `alertas` |
| S-1 (3 modelos) | `prediccion_fallo` × 3, actualiza `analisis_fallos` (`ensemble_avg`, `nivel_riesgo`, `agreement`) |
| S-1 = SIN FALLA | `analisis_fallos.prediccion = SIN_FALLA`, **sin** orden |
| S-1 = FALLA → S-2 | `clasificaciones_fallo` × 3 (con `prob_*`, `es_lider`, `diverge`) |
| S-2 → S-3 | `recomendaciones_rag` (+ `recomendaciones_rag_fuente`) |
| Crea orden + asigna técnico | `ordenes_mantenimiento` (+ `eventos_orden`) |
| Sin técnico → reintento | `ordenes_mantenimiento.proximo_reintento_asignacion`, `intentos_asignacion` |
| Reasignación (supervisor) | `ordenes_mantenimiento.reasignado_motivo`, `reasignado_en` |
| Técnico responde predicción | `observacion_tecnica.decision` (aceptada/rechazada) |
| Acepta/rechaza plan RAG | `respuesta_recomendacion` |
| Cierre | `soluciones_aplicadas` |
| Notificaciones | `mensaje_enviado` (según `regla_notificacion`) |
| Fallos recurrentes | `fallo_repetitivo` + `accion_escalada` |
| Historial / detalle | `ordenes_mantenimiento` + `eventos_orden` + joins |

---

## 7. Mapeo al dataset `ai4i2020.csv`

| Columna CSV | Campo destino |
|-------------|---------------|
| UDI | `lecturas_sensor.id_lectura` (opcional) |
| Type | `lecturas_sensor.tipo_maquina` / `maquinas.tipo_calidad` (L/M/H) |
| Air / Process temperature | `lecturas_sensor.air_temperature`, `process_temperature` |
| Rotational speed | `lecturas_sensor.rotational_speed` |
| Torque | `lecturas_sensor.torque` |
| Tool wear | `lecturas_sensor.tool_wear` |
| Machine failure | etiqueta entrenamiento → `analisis_fallos.prediccion` |
| HDF/PWF/TWF/OSF/RNF | etiqueta entrenamiento → `tipos_fallo.codigo` |

---

## 8. Reglas de negocio (pipeline)

### 8.1 Pipeline automático

1. Lectura supera `reglas_sensor` → crea `analisis_fallos` + `alertas`.
2. S-1 → `prediccion_fallo` (3 filas) → actualiza `ensemble_avg`, `nivel_riesgo`, `agreement`.
3. Si FALLA → S-2 → `clasificaciones_fallo` (3 filas con `prob_*`, `es_lider`, `diverge`).
4. Si FALLA → S-3 → `recomendaciones_rag` (3 filas por clasificación líder).
5. Crea `ordenes_mantenimiento` (`codigo` `ORD-xxx`) + asigna `tecnicos` según `reglas_asignacion`.
6. Sin técnico → `proximo_reintento_asignacion` según `configuracion_alertas`.
7. El técnico registra `observacion_tecnica.decision` (aceptada/rechazada). Si rechaza,
   la orden pasa a estado `rechazada` y se libera el técnico.

### 8.2 Umbrales de riesgo

Configurados en `configuracion_alertas` (`riesgo_bajo`, `riesgo_medio`, `riesgo_alto`,
`riesgo_critico`) y `umbral_ensemble_falla` para decidir FALLA/SIN_FALLA:

| Nivel | Rango `ensemble_avg` (defaults) |
|-------|----------------------|
| LOW | 0.00 – 0.40 |
| MEDIUM | 0.40 – 0.65 |
| HIGH | 0.65 – 0.85 |
| CRITICAL | 0.85 – 1.00 |

### 8.3 Asignación de técnico

Desde `reglas_asignacion`: filtrar por `id_tipo_fallo`, `id_especialidad`, `nivel_riesgo`,
`turno`, `disponibilidad` y `nivel_experiencia` del técnico.

### 8.4 SLA y fallos repetitivos

- `configuracion_alertas.tiempos_atencion_json`: minutos de SLA por nivel de riesgo
  (`{ LOW, MEDIUM, HIGH, CRITICAL }`, `null` = no aplica).
- `configuracion_alertas.fallos_repetitivos_json`: umbrales (veces/días) y toggles de
  notificación que alimentan la detección en `fallo_repetitivo` y las acciones de
  `accion_escalada`.

---

## 9. Datos semilla mínimos

| Tabla | Registros iniciales |
|-------|---------------------|
| `roles` | tecnico, tecnico_senior, supervisor, jefe_planta |
| `tipos_fallo` | HDF, PWF, TWF, OSF, RNF |
| `especialidades` | mecanico, electrico, hidraulico, general |
| `modelos_ml` | 3 binarios + 3 multiclase |
| `reglas_sensor` | RN-01..RN-04 |
| `reglas_asignacion` | CRITICAL/HIGH/MEDIUM × especialidades |
| `configuracion_alertas` | 1 fila con umbrales 0.40 / 0.65 / 0.85 / 1.00 |
| `maquinas` | M-001..M-005 |
| `fuentes_rag` | Theissler, Cai, Pashmforoush, etc. |
| `regla_notificacion` | reglas por nivel de riesgo |
| `accion_escalada` | acciones por tipo de fallo |

---

## 10. Base de datos desde modelos Sequelize (sin migraciones)

El backend crea y actualiza las tablas al arrancar con **`DATABASE_SYNC=true`**.
Los catálogos iniciales se cargan con **`DATABASE_SEED=true`** si `usuarios` está vacío.

### Nueva BD desde cero

1. Crear base en PostgreSQL:
   ```sql
   CREATE DATABASE mantto_bd_v2;
   ```
2. Configurar `.env`:
   ```env
   DATABASE_NAME=mantto_bd_v2
   DATABASE_SYNC=true
   DATABASE_ALTER=true
   DATABASE_FORCE=false   # true solo la primera vez = borra y recrea todo
   DATABASE_SEED=true
   ```
3. Arrancar el API:
   ```bash
   cd predictmaint-api
   npm run start:dev
   ```

Se crean automáticamente las tablas y el seed programático (`DatabaseSeedService`).

> **No uses** `sequelize-cli db:migrate` con este enfoque. Las migraciones en
> `src/database/migrations/` quedan obsoletas frente a los modelos.

### Tablas creadas por sync (28)

`roles`, `especialidades`, `usuarios`, `tecnicos`, `maquinas`, `lecturas_sensor`,
`analisis_fallos`, `prediccion_fallo`, `modelos_ml`, `tipos_fallo`, `clasificaciones_fallo`,
`fuentes_rag`, `recomendaciones_rag`, `recomendaciones_rag_fuente`, `ordenes_mantenimiento`,
`alertas`, `eventos_orden`, `reglas_asignacion`, `reglas_sensor`, `configuracion_alertas`,
`observacion_tecnica`, `soluciones_aplicadas`, `respuesta_recomendacion`, `audit_logs`,
`mensaje_enviado`, `regla_notificacion`, `fallo_repetitivo`, `accion_escalada`

---

## 11. Estado del backend

El API (`predictmaint-api`) usa estos modelos vía Sequelize sync. Los modelos están en
`src/database/models/` y se registran en `src/database/models/index.ts` (array `models`).
Este documento debe regenerarse cuando se agreguen, eliminen o modifiquen columnas/modelos.
