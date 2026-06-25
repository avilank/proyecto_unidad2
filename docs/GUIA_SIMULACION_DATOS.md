# Guía — Simulación de datos para Monitoreo, MTTR/MTBF y Fallos Repetitivos

Cómo generar datos que **sí** alimenten las nuevas vistas (gráficos MTTR/MTBF y fallos
repetitivos), además del monitoreo en vivo. Incluye el diagnóstico de por qué el simulador
actual no alcanza y **opciones** con recomendación.

---

## 1. Diagnóstico: por qué el simulador actual no alcanza

El simulador (`scripts/simulate-sensor-stream.py`) envía lecturas y dispara el pipeline, pero
tiene 3 limitaciones para las nuevas métricas:

| Problema | Detalle | A qué afecta |
|---|---|---|
| **Las órdenes se sellan "ahora"** | Aunque la lectura usa `capturadoEn`, la **orden/análisis/alerta** se crean con `new Date()` (`sensor-readings.service.ts`). No se puede retro-fechar historial por el pipeline. | MTBF (necesita fallas espaciadas en el tiempo) |
| **No inicia ni finaliza órdenes** | El simulador solo **crea** la orden (queda `pendiente`). Nunca pone `fechaInicio` ni `fechaFin`. | **MTTR** (no tiene datos) |
| **Cooldown + exclusión de máquina** | `EVALUACION_COOLDOWN_MINUTOS` (15) y la lógica que excluye la máquina con pipeline activo / último fallo, impiden que **la misma máquina** falle repetidas veces seguidas. | Fallos repetitivos y MTBF (necesitan repetición por máquina) |

**Resumen:** una corrida produce un puñado de órdenes **pendientes, todas con fecha "ahora", de
máquinas distintas**. Eso sirve para ver el monitoreo en vivo, pero **no** para MTTR (sin
finalizar), MTBF (sin huecos temporales) ni repetitivos (sin repetición por máquina).

---

## 2. Qué necesita cada feature nueva

| Feature | Requisito de datos |
|---|---|
| **Monitoreo en vivo (SSE)** | Lecturas y órdenes recientes "ahora". ✅ Ya lo cubre el simulador. |
| **MTTR** | Órdenes **finalizadas** con `fechaInicio` y `fechaFin` (duración de reparación). |
| **MTBF** | **≥ 2 fallas de la misma máquina** dentro de la ventana, **espaciadas** en el tiempo. |
| **Fallos repetitivos** | **≥ umbral (2–3) fallas de la misma máquina + mismo tipo** en la ventana. |

---

## 3. Opciones

### 🅰️ Opción A — Script de *backfill* histórico (directo a BD) — **RECOMENDADA para demo/exposición**

Un script Node/Sequelize (gemelo de `reset-demo-day.js`) que **inserta órdenes históricas
directamente en la BD**, con timestamps **retro-fechados** y ya **completadas**.

**Qué genera:**
- Por máquina, varias fallas en los últimos N días, **espaciadas** (p. ej. cada 1–3 días) → MTBF.
- La mayoría del **mismo tipo de fallo** por máquina → fallos repetitivos.
- Cada orden **finalizada** con `fechaInicio` (detección + espera) y `fechaFin` (inicio + duración aleatoria) → MTTR.
- Deja unas pocas **pendientes/en progreso "ahora"** para que el tablero y el monitoreo tengan actividad viva.

**Pros:** datos ricos **al instante**, control total (defines cuántas fallas, qué tipo, qué máquinas, qué duraciones), **sin tocar el backend**, repetible y reseteable.
**Contras:** escribe directo a BD (hay que insertar en varias tablas: `analisis_fallos`, `clasificaciones_fallo`, `ordenes_mantenimiento`, `observacion_tecnica`, `soluciones_aplicadas`, `eventos_orden`).
**Esfuerzo:** medio. **Ideal para:** preparar la exposición en segundos.

**Uso previsto:**
```bash
node scripts/seed-history.js --dias 14 --por-maquina 4 --yes
node scripts/reset-demo-day.js --all --yes   # para limpiar y volver a sembrar
```

---

### 🅱️ Opción B — Que el pipeline honre `capturadoEn` + simulador que completa órdenes

Dos cambios para que el **flujo real** pueda generar historia:
1. **Backend (cambio pequeño):** en `sensor-readings.service.ts`, usar `dto.capturadoEn` (cuando venga) como base de tiempo del `analisis`/`orden`/`alerta`, en vez de `new Date()`.
2. **Simulador (mejora):** enviar lecturas **retro-fechadas** repartidas en N días y, tras crear cada orden, **iniciarla y finalizarla** llamando a `POST /orders/:id/start` y `POST /orders/:id/solution` con una duración simulada.

**Pros:** usa el **pipeline real** (más fiel: pasa por ML, RAG, asignación, notificaciones). Sirve también a futuro para correr "en vivo".
**Contras:** toca backend; hay que asegurar que retro-fechar no rompa el monitoreo en vivo (el SSE muestra "ahora"); más piezas que coordinar.
**Esfuerzo:** medio-alto. **Ideal para:** que las métricas se construyan por el flujo real, no por inserción directa.

---

### 🅲️ Opción C — Simulador continuo (daemon) + auto-completar

Dejar el simulador **corriendo en bucle** (cada pocos minutos), **bajar el cooldown** y un
companion que **inicia/finaliza** órdenes automáticamente.

**Pros:** sensación 100% "en vivo"; los datos se acumulan solos.
**Contras:** **lento** — MTBF necesita huecos de horas/días, así que tendrías que dejarlo
corriendo mucho tiempo para tener historia útil; no sirve para una demo inmediata.
**Esfuerzo:** bajo-medio. **Ideal para:** un entorno que queda encendido, no para exponer ya.

---

## 4. Recomendación

**Combina A (historia) + el simulador actual (vivo):**

1. **Backfill (Opción A)** una vez antes de exponer → llena **MTTR, MTBF y repetitivos** al instante con datos retro-fechados y completados.
2. **Simulador actual** corriendo para el **monitoreo en tiempo real** (SSE, tarjetas que se actualizan, KPIs del día).

Así, al abrir la app:
- **Monitoreo** se ve vivo (simulador).
- **Analítica → Confiabilidad (MTTR/MTBF)** tiene barras reales (backfill).
- **Fallos Repetitivos / banner de repetitivo** se activa (backfill con repeticiones).

> Si además quieres que el **flujo real** construya historia a futuro, implementa la **Opción B** después (es independiente del backfill).

---

## 5. Cómo se vería el monitoreo con todo

```
Monitoreo en Tiempo Real (SSE)         ← simulador actual (en vivo)
  · tarjetas de máquinas actualizándose
  · banner "FALLO REPETITIVO — M-00X"   ← se activa con el backfill (repeticiones)
  · badge "Riesgo Alto/Crítico"         ← ya implementado

Analítica y Reportes                    ← backfill (historia)
  · MTTR por máquina (barras)            ← órdenes finalizadas retro-fechadas
  · MTBF por máquina (barras)            ← fallas espaciadas por máquina
  · Máquinas recurrentes                 ← repeticiones por máquina+tipo
  · Validación de predicciones           ← observacion_tecnica del backfill
```

---

## 6. Sketch de implementación

### Opción A — `scripts/seed-history.js` (qué insertar por cada falla)
Reutiliza la conexión Sequelize de `reset-demo-day.js`. Para cada falla histórica:

```
fechaDeteccion = ahora − (días aleatorios dentro de la ventana)
fechaInicio    = fechaDeteccion + (5–30 min de espera)
fechaFin       = fechaInicio + (20–180 min de reparación)   // → MTTR

1) analisis_fallos   (id_maquina, id_lectura?, prediccion='FALLA', nivel_riesgo, agreement, fecha_analisis=fechaDeteccion)
2) clasificaciones_fallo (id_analisis, id_tipo_fallo=<tipo de la máquina>, id_modelo, es_lider=true, fecha_clasificacion=fechaDeteccion)
3) ordenes_mantenimiento (codigo, id_analisis, id_maquina, id_tecnico=<asignado>,
                          estado='finalizado', fecha_creacion=fechaDeteccion,
                          fecha_inicio=fechaInicio, fecha_fin=fechaFin)
4) observacion_tecnica (id_orden, id_tipo_fallo, es_falla=true, es_prediccion_correcta=true, decision='aceptada', fecha_registro=fechaFin)
5) soluciones_aplicadas (id_orden, tipo_solucion='con_rag'|'propia', descripcion, fecha_registro=fechaFin)
6) eventos_orden (deteccion_s1 @fechaDeteccion, en_progreso @fechaInicio, finalizado @fechaFin)
```

Parámetros sugeridos: `--dias` (ventana), `--por-maquina` (nº de fallas, ≥2 para MTBF), `--tipo-fijo` (mismo tipo por máquina → repetitivos), `--yes`.
Necesita leer de BD: ids de `maquinas`, `tipo_fallo`, `modelos_ml`, `tecnicos`.

### Opción B — cambios concretos
- **Backend:** en `sensor-readings.service.ts`, `const now = dto.capturadoEn ? new Date(dto.capturadoEn) : new Date();` y usar ese `now` en `analisis_fallos.fechaAnalisis`, `ordenes.fechaCreacion`, etc. (verificar que no rompa el filtro "de hoy" del monitoreo).
- **Simulador:** añadir flags `--backdate-dias N` (reparte `capturadoEn` en N días) y `--auto-finalizar` (tras crear la orden, llama `POST /orders/:codigo/start` y `POST /orders/:codigo/solution`).

### Opción C — cambios concretos
- Ejecutar el simulador con `/loop` o un `while` cada X minutos.
- Bajar `EVALUACION_COOLDOWN_MINUTOS` en `.env` (p. ej. 1) y reiniciar API.
- Companion que liste órdenes `pendiente/en_progreso` y las finalice tras un delay.

---

## 7. Tabla comparativa rápida

| | A · Backfill BD | B · Pipeline + auto-completar | C · Daemon continuo |
|---|---|---|---|
| Datos al instante | ✅ Sí | ⚠️ Parcial | ❌ No (horas/días) |
| MTTR | ✅ | ✅ | ✅ (lento) |
| MTBF | ✅ | ✅ | ✅ (muy lento) |
| Repetitivos | ✅ | ✅ | ⚠️ (depende del cooldown) |
| Toca backend | ❌ No | ✅ Sí | ❌ No (solo `.env`) |
| Fidelidad al flujo real | ⚠️ Inserta directo | ✅ Alta | ✅ Alta |
| Para exponer ya | ✅ **Mejor** | ⚠️ | ❌ |

---

## 8. Siguiente paso
Mi recomendación: **implementar la Opción A** (script `seed-history.js`) para tener datos ricos
ya, y dejar el simulador actual para el monitoreo en vivo. Si quieres, lo construyo: un script
parametrizable (`--dias`, `--por-maquina`, `--tipo-fijo`) que siembra historia completada y
repetida, reusable con `reset-demo-day.js` para limpiar.

---

## 9. IMPLEMENTADO — Generador automático en máquinas libres (cron en el backend) ✅

En vez del backfill, se implementó la **generación recurrente automática**: el sistema, mientras
el API está encendido, inyecta cada N minutos una falla en una **máquina que no tenga orden
activa**. A medida que **tú** completas órdenes, esas máquinas se liberan y vuelven a fallar →
se construye historial, fallos repetitivos y MTBF. **El sistema NO completa órdenes** (manual).

### Qué se agregó
- **`jobs/auto-fault.service.ts`** (`AutoFaultService`): un `@Cron` que cada minuto evalúa si pasó
  el intervalo; si sí, busca máquinas libres, elige una al azar e inyecta una **lectura de falla
  real** (del dataset `ai4i2020.csv`) por el endpoint público `POST /sensor-readings` → corre el
  pipeline completo (ML, RAG, asignación, notificación).
- Registrado en `jobs/jobs.module.ts`.
- **Tipo de falla sesgado por máquina (70/30):** cada máquina tiene un **tipo dominante** (determinista por su código) que se usa con probabilidad `DEMO_AUTOFAULT_BIAS`; el resto del tiempo, un tipo al azar. Así los **fallos repetitivos aparecen de forma confiable** sin verse 100% artificial.
- **Guardarraíl anti-saturación:** solo genera si hay **menos de `DEMO_AUTOFAULT_MAX_ACTIVAS` órdenes activas**. Si te demoras en completar, deja de generar hasta que se liberen.

### Cómo se controla (`.env`)
```
DEMO_AUTOFAULT_ENABLED=true       # activa/desactiva el generador
DEMO_AUTOFAULT_MIN=10             # cada cuántos minutos genera una falla
DEMO_AUTOFAULT_BIAS=0.7           # prob. de usar el tipo dominante de la máquina (0–1)
DEMO_AUTOFAULT_MAX_ACTIVAS=3      # tope de órdenes activas (no satura)
# DEMO_DATASET_PATH=...           # opcional: ruta al ai4i2020.csv si no se encuentra solo
```
> El generador **solo corre si `DEMO_AUTOFAULT_ENABLED=true`**. Para apagarlo, ponlo en `false` y reinicia.

### Recomendación de intervalo (para tu demo)
- **Día a día / dejarlo corriendo:** `DEMO_AUTOFAULT_MIN=20`–`30`. Acumula historial sin saturar y respeta el cooldown (15 min).
- **Demostración EN VIVO ante el evaluador:** baja a `DEMO_AUTOFAULT_MIN=2` y baja el cooldown `EVALUACION_COOLDOWN_MINUTOS=2` → así, durante la presentación, el evaluador **ve** cómo el sistema genera fallas solo cada par de minutos en máquinas libres. Después súbelo de nuevo.
- **Tip:** corre el generador un rato **antes** de exponer (o deja el simulador manual unas veces) para que ya haya repeticiones cuando muestres los fallos repetitivos y MTBF.

### Cómo funciona el ciclo
```
cron (cada DEMO_AUTOFAULT_MIN min)
  → busca máquinas SIN orden pendiente/en_progreso
  → elige una libre al azar
  → POST /sensor-readings con una fila de falla del dataset
  → pipeline: ML confirma falla → orden + alerta + asignación + notificación
  (tú completas la orden cuando quieras → la máquina se libera → puede fallar otra vez)
```

### Notas
- **Repetitivos:** con el sesgo 70/30, cada máquina repite mayormente su tipo dominante → los repetitivos (máquina + mismo tipo) aparecen en pocas corridas. Sube `DEMO_AUTOFAULT_BIAS` a `0.9` si quieres que repitan aún más; bájalo para más variedad.
- **Guardarraíl:** si llegas al tope de órdenes activas, el generador pausa (no actualiza su reloj) y reanuda en cuanto completas y se liberan. Sube `DEMO_AUTOFAULT_MAX_ACTIVAS` si quieres más fallas simultáneas.
- **Cooldown:** una máquina recién analizada no vuelve a dispararse por `EVALUACION_COOLDOWN_MINUTOS`; por eso el intervalo del generador debería ser ≥ al cooldown (o baja ambos para la demo).
- **MTTR:** sale de las órdenes que **tú** finalizas (con `fechaInicio`/`fechaFin`).
</content>
