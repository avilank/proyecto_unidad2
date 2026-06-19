# PredictMaint — Documentación Técnica y Modelo de Datos

> **Sistema de Mantenimiento Predictivo Industrial con ML + RAG**
> Modelo relacional normalizado para PostgreSQL. Fecha: 2026-06-18.
> Reemplaza la versión anterior basada en tablas `usuario`, `orden`, `alerta`, etc.

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
ordenes_mantenimiento → observacion_tecnica / soluciones_aplicadas
```

| Etapa | Tablas principales |
|-------|-------------------|
| S-1 | `analisis_fallos`, `prediccion_fallo`, `modelos_ml` |
| S-2 | `clasificaciones_fallo`, `tipos_fallo`, `modelos_ml` |
| S-3 | `recomendaciones_rag`, `fuentes_rag` |
| Operación | `ordenes_mantenimiento`, `tecnicos`, `reglas_asignacion` |

---

## 2. Diagrama entidad-relación (dbdiagram)

```dbml
Table roles {
  id_rol integer [primary key]
  nombre varchar
  descripcion text
}

Table usuarios {
  id_usuario integer [primary key]
  id_rol integer
  nombres varchar
  apellidos varchar
  correo varchar
  password varchar
  telefono varchar
  estado varchar
}

Table especialidades {
  id_especialidad integer [primary key]
  nombre varchar
  descripcion text
}

Table tecnicos {
  id_tecnico integer [primary key]
  id_usuario integer
  id_especialidad integer
  disponibilidad varchar
  enviar_wssp boolean
  enviar_correo boolean
  turno varchar
}

Table maquinas {
  id_maquina integer [primary key]
  codigo varchar
  nombre varchar
  modelo varchar
  ubicacion varchar
  estado varchar
  fecha_registro timestamp
}

Table lecturas_sensor {
  id_lectura bigint [primary key]
  id_maquina integer
  air_temperature decimal
  process_temperature decimal
  rotational_speed decimal
  torque decimal
  tool_wear decimal
  power_w decimal
  fecha_lectura timestamp
}

Table analisis_fallos {
  id_analisis bigint [primary key]
  id_maquina integer
  id_lectura bigint
  prediccion varchar
  nivel_riesgo varchar
  ensemble_avg decimal
  fecha_analisis timestamp
}

Table prediccion_fallo {
  id_resultado bigint [primary key]
  id_analisis bigint
  id_modelo integer
  prediccion varchar
  confianza decimal
  probabilidad decimal
  tn integer
  fp integer
  fn integer
  tp integer
}

Table modelos_ml {
  id_modelo integer [primary key]
  nombre varchar
  tipo varchar
  version varchar
  accuracy decimal
  roc_auc decimal
  precision_score decimal
  recall_score decimal
  f1_score decimal
  es_prediccion boolean
  es_clasificacion boolean
  umbral decimal
  es_default boolean
}

Table tipos_fallo {
  id_tipo_fallo integer [primary key]
  codigo varchar
  nombre varchar
  descripcion text
}

Table clasificaciones_fallo {
  id_clasificacion bigint [primary key]
  id_analisis bigint
  id_tipo_fallo integer
  id_modelo integer
  confianza decimal
  fecha_clasificacion timestamp
}

Table fuentes_rag {
  id_fuente integer [primary key]
  titulo varchar
  autor varchar
  url text
  activo boolean
}

Table recomendaciones_rag {
  id_recomendacion bigint [primary key]
  id_clasificacion bigint
  id_fuente integer
  prioridad varchar
  recomendacion text
}

Table ordenes_mantenimiento {
  id_orden bigint [primary key]
  id_analisis bigint
  id_maquina integer
  id_tecnico integer
  estado varchar
  fecha_creacion timestamp
  fecha_inicio timestamp
  fecha_fin timestamp
  observaciones text
}

Table observacion_tecnica {
  id_respuesta_tecnica bigint [primary key]
  id_orden bigint
  id_tipo_fallo integer
  es_falla boolean
  es_prediccion_correcta boolean
  es_clasificacion_correcta boolean
  comentario text
  fecha_registro timestamp
}

Table soluciones_aplicadas {
  id_solucion bigint [primary key]
  id_orden bigint
  tipo_solucion varchar
  descripcion text
  fecha_registro timestamp
}

Table reglas_asignacion {
  id_regla integer [primary key]
  id_tipo_fallo integer
  id_especialidad integer
  nivel_riesgo varchar
  prioridad integer
  activo boolean
}

Table audit_logs {
  id bigint [primary key]
  id_usuario integer
  modulo varchar
  accion varchar
  url varchar
  body text
  ip varchar
  fecha_registro timestamp
}

Table configuracion_alertas {
  id_config_alerta integer [primary key]
  riesgo_bajo decimal
  riesgo_medio decimal
  riesgo_alto decimal
  riesgo_critico decimal
  tiempo_escalamiento integer
  plantilla_notificacion text
  fecha_actualizacion timestamp
}

Ref: usuarios.id_rol > roles.id_rol
Ref: tecnicos.id_usuario > usuarios.id_usuario
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
Ref: ordenes_mantenimiento.id_analisis > analisis_fallos.id_analisis
Ref: ordenes_mantenimiento.id_maquina > maquinas.id_maquina
Ref: ordenes_mantenimiento.id_tecnico > tecnicos.id_tecnico
Ref: soluciones_aplicadas.id_orden > ordenes_mantenimiento.id_orden
Ref: reglas_asignacion.id_tipo_fallo > tipos_fallo.id_tipo_fallo
Ref: reglas_asignacion.id_especialidad > especialidades.id_especialidad
Ref: observacion_tecnica.id_orden > ordenes_mantenimiento.id_orden
Ref: observacion_tecnica.id_tipo_fallo > tipos_fallo.id_tipo_fallo
```

---

## 3. Descripción de tablas

### 3.1 Seguridad y usuarios

| Tabla | Propósito |
|-------|-----------|
| `roles` | Catálogo: operador, supervisor, jefe_planta, admin |
| `usuarios` | Login (correo + password hash). Separado de ficha técnica |
| `especialidades` | mecánico, eléctrico, hidráulico, general |
| `tecnicos` | Extensión operativa: turno, disponibilidad, flags WhatsApp/email |

**Nota:** `password` debe almacenarse como hash (bcrypt), no texto plano.

### 3.2 Activos y sensores

| Tabla | Propósito |
|-------|-----------|
| `maquinas` | Activos monitoreados (`codigo` = `M-001` visible en UI) |
| `lecturas_sensor` | Eventos del simulador / CSV. `power_w` derivada en backend |

### 3.3 Pipeline ML (S-1 / S-2 / S-3)

| Tabla | Propósito |
|-------|-----------|
| `analisis_fallos` | **Hub** por evento: consenso S-1, `ensemble_avg`, `nivel_riesgo` |
| `prediccion_fallo` | Un registro por modelo binario por análisis |
| `clasificaciones_fallo` | Un registro por modelo multiclase por análisis |
| `modelos_ml` | Catálogo unificado (flags `es_prediccion` / `es_clasificacion`) |
| `tipos_fallo` | HDF, PWF, TWF, OSF, RNF |
| `recomendaciones_rag` | Acciones S-3 ligadas a la clasificación líder |
| `fuentes_rag` | Bibliografía / referencias |

### 3.4 Operación de mantenimiento

| Tabla | Propósito |
|-------|-----------|
| `ordenes_mantenimiento` | Orden de trabajo derivada de un análisis con falla confirmada |
| `observacion_tecnica` | Feedback del técnico + validación de predicción/clasificación |
| `soluciones_aplicadas` | Cierre: qué se hizo en planta |
| `reglas_asignacion` | Matriz tipo_fallo × especialidad × nivel_riesgo |

### 3.5 Configuración y auditoría

| Tabla | Propósito |
|-------|-----------|
| `configuracion_alertas` | Umbrales de riesgo, escalamiento, plantilla WA |
| `audit_logs` | Trazabilidad de acciones en API/UI |

---

## 4. Mapeo al flujo de monitoreo simulado

| Paso del pipeline | Tablas que escribe |
|-------------------|-------------------|
| Simulador envía lectura | `lecturas_sensor` |
| Regla RN-0x / umbral | *(ver §6 — falta `reglas_sensor`)* → crea `analisis_fallos` |
| S-1 (3 modelos) | `prediccion_fallo` × 3, actualiza `analisis_fallos` |
| S-1 = SIN FALLA | `analisis_fallos.prediccion = SIN_FALLA`, **sin** orden |
| S-1 = FALLA → S-2 | `clasificaciones_fallo` × 3 |
| S-2 → S-3 | `recomendaciones_rag` (3 filas por clasificación líder) |
| Asignación técnico | `ordenes_mantenimiento.id_tecnico` |
| Monitoreo en vivo | Requiere vista sobre análisis/órdenes **activas** (§6) |
| Historial | `ordenes_mantenimiento` + joins |
| Detalle orden | Timeline vía `audit_logs` o `eventos_orden` (§6) |

---

## 5. Mapeo al dataset `ai4i2020.csv`

| Columna CSV | Campo destino |
|-------------|---------------|
| UDI | `lecturas_sensor.id_lectura` (opcional) |
| Type | **⚠ ver §6.1** — feature ML L/M/H |
| Air / Process temperature | `air_temperature`, `process_temperature` |
| Rotational speed | `rotational_speed` |
| Torque | `torque` |
| Tool wear | `tool_wear` |
| Machine failure | etiqueta entrenamiento → `analisis_fallos.prediccion` |
| HDF/PWF/TWF/OSF/RNF | etiqueta entrenamiento → `tipos_fallo.codigo` |

---

## 6. ¿Es suficiente? — Análisis de brechas

### 6.1 Crítico — agregar o extender

| Brecha | Por qué importa | Recomendación |
|--------|-----------------|---------------|
| **`tipo` L/M/H en lecturas** | Feature obligatoria para los 6 modelos ML | Añadir `tipo_maquina char(1)` en `lecturas_sensor` **o** `tipo_calidad` en `maquinas` |
| **`alertas`** | Vista Monitoreo en tiempo real lista alertas activas, no órdenes | Tabla `alertas` con `id_analisis`, `estado`, `nivel_riesgo`, `id_tecnico`, `fecha_alerta` |
| **`reglas_sensor`** | Disparo RN-01..RN-04 antes del ML | Tabla catálogo + campo `regla_disparada` en `analisis_fallos` |
| **`eventos_orden`** | Timeline en detalle de orden (S-1→S-2→S-3→técnico) | Tabla `eventos_orden (id_orden, etapa, descripcion, fecha)` **o** usar `audit_logs` con módulo `orden` |
| **Probabilidades multiclase** | UI Tab 2 muestra prob HDF/PWF/TWF/OSF/RNF por modelo | Añadir en `clasificaciones_fallo`: `prob_hdf`, `prob_pwf`, `prob_twf`, `prob_osf`, `prob_rnf` **o** tabla `probabilidades_clasificacion` |
| **Flags `es_lider`, `diverge`** | Consenso y agreement entre modelos | Campos boolean en `prediccion_fallo` y `clasificaciones_fallo` |
| **`agreement` S-2** | ALTO/MEDIO/BAJO calculado o persistido | Campo `agreement varchar` en `analisis_fallos` o en clasificación líder |
| **Reintento de técnico** | Sin técnico → reintento 15/30/60 min | En `ordenes_mantenimiento`: `proximo_reintento_asignacion`, `intentos_asignacion` |
| **Respuesta a recomendaciones** | Aceptar/rechazar plan RAG → `en_progreso` | Descomentar / crear `respuesta_recomendacion (id_orden, decision, observacion, fecha)` |

### 6.2 Importante — fase 2 o catálogos

| Brecha | Uso en el sistema | Recomendación |
|--------|-------------------|---------------|
| **`mensajes_enviados`** | Log WhatsApp/Email, analítica Config 2 | Tabla log: `id_orden`, `id_tecnico`, `canal`, `estado`, `fecha_envio` |
| **`fallos_repetitivos`** | Banner monitoreo, escalado RAG | Tabla: `id_maquina`, `id_tipo_fallo`, `ocurrencias`, `ventana_dias`, `estado` |
| **`horarios_envio`** | CSV 06:00 / 14:00 / 22:00 | Catálogo de horarios y destinatarios |
| **`nivel_experiencia` en técnicos** | Asignación CRITICAL = mayor experiencia | Campo `nivel_experiencia smallint` en `tecnicos` |
| **`codigo_orden` visible** | UI muestra `ORD-001` | Campo `codigo varchar unique` en `ordenes_mantenimiento` además de `id_orden` |
| **Plan RAG agrupado** | 3 acciones ordenadas con título + detalle | Campos en `recomendaciones_rag`: `orden smallint`, `titulo varchar` **o** tabla `planes_rag` padre |
| **`mapa_fallo_recomendacion`** | RAG estático por tipo antes del LLM | Puede vivir en `tipos_fallo.descripcion` o tabla aparte |
| **`acciones_escaladas`** | Fallos repetitivos Config 5 | Catálogo por `id_tipo_fallo` |

### 6.3 Lo que tu esquema mejora respecto al anterior

| Aspecto | Mejora |
|---------|--------|
| Usuarios vs técnicos | Normalización correcta (`usuarios` + `tecnicos`) |
| Roles | Tabla `roles` explícita vs ENUM en usuario |
| Especialidades | Catálogo vs ENUM embebido |
| Hub analítico | `analisis_fallos` centraliza S-1/S-2 mejor que pegar todo a `orden` |
| Modelos ML | Un solo `modelos_ml` con flags vs tablas duplicadas |
| Feedback ML | `observacion_tecnica` con flags de acierto predicción/clasificación |
| Auditoría | `audit_logs` no existía antes |
| Reglas asignación | Más precisas: tipo_fallo + especialidad + nivel_riesgo |

### 6.4 Veredicto

**Para el MVP del flujo simulado (monitoreo → análisis 3 tabs → historial → técnico):**

- **Casi suficiente** con las tablas propuestas + **`alertas`**, **`reglas_sensor`**, **`tipo` ML**, **probabilidades S-2** y **reintento en orden**.
- **No suficiente aún** para notificaciones, fallos repetitivos, horarios CSV y timeline rico sin las tablas de §6.2.

---

## 7. Tablas recomendadas adicionales (mínimo viable)

```dbml
Table reglas_sensor {
  id_regla integer [primary key]
  codigo varchar
  descripcion text
  id_tipo_fallo integer
  activo boolean
}

Table alertas {
  id_alerta bigint [primary key]
  codigo varchar
  id_analisis bigint
  id_maquina integer
  id_orden bigint
  nivel_riesgo varchar
  estado varchar
  id_tecnico integer
  regla_disparada varchar
  fecha_alerta timestamp
}

Table eventos_orden {
  id_evento bigint [primary key]
  id_orden bigint
  etapa varchar
  descripcion text
  actor varchar
  fecha_evento timestamp
}

Ref: reglas_sensor.id_tipo_fallo > tipos_fallo.id_tipo_fallo
Ref: alertas.id_analisis > analisis_fallos.id_analisis
Ref: alertas.id_maquina > maquinas.id_maquina
Ref: alertas.id_orden > ordenes_mantenimiento.id_orden
Ref: alertas.id_tecnico > tecnicos.id_tecnico
Ref: eventos_orden.id_orden > ordenes_mantenimiento.id_orden
```

### Campos a añadir en tablas existentes

```dbml
// lecturas_sensor
tipo_maquina char(1)   // L, M, H — feature ML

// maquinas
tipo_calidad char(1)   // alternativa si no va en lectura

// clasificaciones_fallo
prob_hdf decimal
prob_pwf decimal
prob_twf decimal
prob_osf decimal
prob_rnf decimal
es_lider boolean
diverge boolean

// prediccion_fallo
es_lider boolean

// analisis_fallos
agreement varchar      // ALTO, MEDIO, BAJO
regla_disparada varchar

// ordenes_mantenimiento
codigo varchar         // ORD-001
proximo_reintento_asignacion timestamp
intentos_asignacion integer

// tecnicos
nivel_experiencia integer

// recomendaciones_rag
orden smallint         // 1, 2, 3
titulo varchar
```

---

## 8. Reglas de negocio (sin cambios funcionales)

### 8.1 Pipeline automático

1. Lectura supera `reglas_sensor` → crea `analisis_fallos` + `alertas`.
2. S-1 → `prediccion_fallo` (3 filas) → actualiza `ensemble_avg`, `nivel_riesgo`.
3. Si FALLA → S-2 → `clasificaciones_fallo` (3 filas).
4. Si FALLA → S-3 → `recomendaciones_rag` (3 filas).
5. Crea `ordenes_mantenimiento` + asigna `tecnicos` según `reglas_asignacion`.
6. Sin técnico → `proximo_reintento_asignacion` según `configuracion_alertas`.

### 8.2 Umbrales de riesgo

Configurados en `configuracion_alertas`:

| Nivel | Rango `ensemble_avg` |
|-------|----------------------|
| LOW | 0.00 – 0.40 |
| MEDIUM | 0.40 – 0.65 |
| HIGH | 0.65 – 0.85 |
| CRITICAL | 0.85 – 1.00 |

### 8.3 Asignación de técnico

Desde `reglas_asignacion`: filtrar por `id_tipo_fallo`, `id_especialidad`, `nivel_riesgo`, `turno` y `disponibilidad` del técnico.

---

## 9. Datos semilla mínimos

| Tabla | Registros iniciales |
|-------|---------------------|
| `roles` | operador, supervisor, jefe_planta |
| `tipos_fallo` | HDF, PWF, TWF, OSF, RNF |
| `especialidades` | mecanico, electrico, hidraulico, general |
| `modelos_ml` | 3 binarios + 3 multiclase (ver modelo anterior §4.5) |
| `reglas_sensor` | RN-01..RN-04 |
| `reglas_asignacion` | CRITICAL/HIGH/MEDIUM × especialidades |
| `configuracion_alertas` | 1 fila con umbrales 0.40 / 0.65 / 0.85 |
| `maquinas` | M-001..M-005 |
| `fuentes_rag` | Theissler, Cai, Pashmforoush, etc. |

---

## 10. Diagrama de relaciones (resumen)

```
roles ──< usuarios ──< tecnicos >── especialidades
                           │
maquinas ──< lecturas_sensor ──< analisis_fallos ──< prediccion_fallo >── modelos_ml
     │              │                │
     │              │                ├──< clasificaciones_fallo >── tipos_fallo
     │              │                │         │
     │              │                │         └──< recomendaciones_rag >── fuentes_rag
     │              │                │
     │              └── (alertas) ────┴──< ordenes_mantenimiento
     │                                      ├──< observacion_tecnica
     │                                      ├──< soluciones_aplicadas
     │                                      └──< eventos_orden
     │
reglas_sensor >── tipos_fallo
reglas_asignacion >── tipos_fallo + especialidades
configuracion_alertas / audit_logs
```

---

## 11. Migración desde el modelo anterior (código actual)

El código en `predictmaint-api` aún usa tablas legacy (`usuario`, `orden`, `alerta`,
`prediccion_binaria`, etc.). Para alinearlo a este modelo:

1. Crear migraciones con las tablas de §2 + §7.
2. Mapear endpoints:
   - `POST /sensor-readings` → `lecturas_sensor` + pipeline → `analisis_fallos`…
   - `GET /alerts/active` → `alertas`
   - `GET /orders` → `ordenes_mantenimiento`
   - `GET /predictions/binary/:orderId` → join `prediccion_fallo` vía `id_analisis`
3. Deprecar tablas legacy tras migración de datos.

---

## 12. Base de datos desde modelos Sequelize (sin migraciones)

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

Se crean automáticamente las tablas v2 y el seed programático (`DatabaseSeedService`).

> **No uses** `sequelize-cli db:migrate` con este enfoque. Las migraciones en `src/database/migrations/` quedan obsoletas.

### Tablas creadas por sync

`roles`, `usuarios`, `especialidades`, `tecnicos`, `maquinas`, `lecturas_sensor`, `analisis_fallos`, `prediccion_fallo`, `modelos_ml`, `tipos_fallo`, `clasificaciones_fallo`, `fuentes_rag`, `recomendaciones_rag`, `ordenes_mantenimiento`, `alertas`, `eventos_orden`, `observacion_tecnica`, `soluciones_aplicadas`, `reglas_asignacion`, `reglas_sensor`, `configuracion_alertas`, `respuesta_recomendacion`, `audit_logs`

---

## 13. Estado del backend

El API (`predictmaint-api`) ya usa el modelo v2 vía Sequelize sync. Los modelos están en `src/database/models/`.
