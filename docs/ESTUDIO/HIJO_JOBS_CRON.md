# Tareas programadas (cron) del backend

Documentación técnica de los *jobs* (tareas programadas) del backend de PredictMaint.
Todos viven en `predictmaint-api/src/jobs` y se registran en el módulo `JobsModule`.
Usan el decorador `@Cron(...)` de `@nestjs/schedule` con expresiones de **6 campos**
(segundo, minuto, hora, día-del-mes, mes, día-de-semana).

## Registro de los jobs (`JobsModule`)

Ruta: `predictmaint-api/src/jobs/jobs.module.ts`

```ts
@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden, Alerta, EventoOrden, ClasificacionFallo,
      AnalisisFallo, TipoFallo, Maquina,
    ]),
    TechniciansModule,
    ConfigCatalogModule,
  ],
  providers: [AssignmentRetryService, EscalationService, AutoFaultService],
})
export class JobsModule {}
```

Los tres servicios (`AssignmentRetryService`, `EscalationService`, `AutoFaultService`)
se declaran como `providers`. NestJS los instancia al arrancar y `@nestjs/schedule`
descubre y activa sus métodos `@Cron`.

---

## 1. `AssignmentRetryService` — reintento de asignación de técnico

Ruta: `predictmaint-api/src/jobs/assignment-retry.service.ts`

### Qué hace
Reasigna técnico a las órdenes que quedaron **PENDIENTE sin técnico** (`idTecnico = null`)
y cuyo campo `proximoReintentoAsignacion` ya **venció** (`<= ahora`). Cuando se creó la
orden no había ningún técnico disponible/compatible, así que se programó un reintento; este
job es quien lo ejecuta de forma periódica.

### Expresión `@Cron`
```ts
@Cron('0 * * * * *')   // segundo 0 de cada minuto → una vez por minuto
async retryPendingAssignments(): Promise<void> { ... }
```

### Lógica
1. Busca órdenes con `idTecnico IS NULL`, `estado = PENDIENTE` y
   `proximoReintentoAsignacion <= now`, cargando `Maquina` y el árbol
   `AnalisisFallo → ClasificacionFallo → TipoFallo`.
   ```ts
   const pending = await this.ordenModel.findAll({
     where: {
       idTecnico: { [Op.is]: null },
       estado: EstadoOrden.PENDIENTE,
       proximoReintentoAsignacion: { [Op.lte]: now },
     },
     include: [ /* Maquina, AnalisisFallo → ClasificacionFallo → TipoFallo */ ],
   });
   ```
2. Si la orden **no tiene clasificaciones** (`s2Count === 0`) la salta (aún no hay análisis S2).
3. Toma la clasificación **líder** (`esLider`) para obtener el `tipoFallo.codigo` y pide un
   técnico a `techniciansService.assignForOrder(nivelRiesgo, tipoFallo)`.
4. **Caso con técnico:**
   - Actualiza la orden (`idTecnico`, `proximoReintentoAsignacion = null`).
   - Actualiza la `Alerta` asociada con el `idTecnico`.
   - Crea un `EventoOrden` etapa `respuesta_tecnico` (`actor: 'sistema'`).
   - **Emite el evento `ORDER_CREATED` (`order.created`)** con el payload de la orden.
   ```ts
   this.eventEmitter.emit(ORDER_CREATED_EVENT, payload);
   ```
5. **Caso sin técnico:** reprograma el próximo reintento sumando los minutos del nivel y
   registra un `EventoOrden` etapa `reintento_asignacion`:
   ```ts
   const minutos = await this.techniciansService.getReintentoMinutos(nivel);
   const intentos = (order.intentosAsignacion ?? 0) + 1;
   await order.update({
     proximoReintentoAsignacion: addMinutes(now, minutos),
     intentosAsignacion: intentos,
   });
   ```

### Evento emitido
`ORDER_CREATED_EVENT = 'order.created'`
(definido en `predictmaint-api/src/common/events/order.events.ts`).
Payload `OrderCreatedPayload`: `orderId`, `tecnicoId?`, `maquinaId`, `nivelRiesgo`.

### Minutos de reintento por nivel
Los **defaults** y las **claves de configuración** viven en
`predictmaint-api/src/common/utils/assignment-retry.util.ts`. `getReintentoMinutos(nivel)`
lee la configuración y, si no existe, usa estos valores por defecto:

| Nivel de riesgo | Minutos (default) | Clave de configuración |
|-----------------|-------------------|------------------------|
| `CRITICAL`      | 15                | `reintento_asignacion_critical_min` |
| `HIGH`          | 15                | `reintento_asignacion_high_min`     |
| `MEDIUM`        | 30 (fallback general) | `reintento_asignacion_medium_min` |
| `LOW`           | 60                | `reintento_asignacion_low_min`      |

```ts
const DEFAULT_MINUTES: Record<string, number> = {
  [NivelRiesgo.CRITICAL]: 15,
  [NivelRiesgo.HIGH]: 15,
  [NivelRiesgo.MEDIUM]: 30,
  [NivelRiesgo.LOW]: 60,
};
```

---

## 2. `EscalationService` — escalamiento por SLA vencido

Ruta: `predictmaint-api/src/jobs/escalation.service.ts`

### Qué hace
Detecta órdenes **ya asignadas** (tienen técnico) pero que siguen **PENDIENTE** —es decir, el
técnico **no respondió / no inició** la atención— y que **superaron su SLA** (tiempo de atención
permitido para su nivel de riesgo). Las **escala al supervisor**.

### Expresión `@Cron`
```ts
/** Cada minuto: escala al supervisor las órdenes asignadas que superaron su SLA sin atención. */
@Cron('30 * * * * *')   // segundo 30 de cada minuto (desfasado del retry, que corre en seg 0)
async escalateOverdueOrders(): Promise<void> { ... }
```

### Lógica
1. Lee los tiempos de atención (SLA por nivel) desde la configuración:
   ```ts
   const tiempos = await this.configCatalog.getTiemposAtencion();
   ```
   `getTiemposAtencion()` (en `config-catalog.service.ts`) devuelve un `TiemposAtencion`
   con minutos por nivel; `null` significa "sin SLA" (por defecto `LOW: null`, `MEDIUM: 120`).
2. Busca órdenes `estado = PENDIENTE` con `idTecnico != null`, incluyendo `Maquina.codigo`
   y `AnalisisFallo.nivelRiesgo`.
3. Para cada orden:
   - Obtiene el `sla` del nivel; si es `null` la salta (p. ej. `LOW`).
   - Calcula `minutosSinAtender` desde `fechaCreacion`; si `< sla`, aún no vence → salta.
     ```ts
     const minutosSinAtender = Math.floor(
       (now - new Date(orden.fechaCreacion).getTime()) / 60_000,
     );
     if (minutosSinAtender < sla) continue;
     ```
   - **Idempotencia:** cuenta eventos previos con etapa `escalado` para esa orden; si ya
     existe alguno, **no vuelve a escalar**:
     ```ts
     const yaEscalada = await this.eventoModel.count({
       where: { idOrden: orden.idOrden, etapa: ESCALADO_ETAPA }, // 'escalado'
     });
     if (yaEscalada > 0) continue;
     ```
   - Crea un `EventoOrden` etapa **`escalado`** (`actor: 'sistema'`) con la descripción del SLA
     superado.
   - **Emite el evento `ORDER_ESCALATED` (`order.escalated`).**
   ```ts
   this.eventEmitter.emit(ORDER_ESCALATED_EVENT, payload);
   ```

### Evento emitido
`ORDER_ESCALATED_EVENT = 'order.escalated'`
(definido en `predictmaint-api/src/common/events/order.events.ts`).
Payload `OrderEscalatedPayload`: `orderId`, `maquinaId`, `nivelRiesgo`, `minutosSinAtender`,
`slaMinutos`.

> **Fuente de los tiempos de atención (SLA):** `ConfigCatalogService.getTiemposAtencion()`,
> que parsea `tiemposAtencionJson` de la configuración (editable desde *Configuración → Niveles
> de riesgo*). Default: `LOW: null`, `MEDIUM: 120`, y los niveles superiores según config.

---

## 3. `AutoFaultService` — generador automático de fallas (DEMO)

Ruta: `predictmaint-api/src/jobs/auto-fault.service.ts`

### Qué hace
Servicio **solo para demostración**. Cada N minutos inyecta una falla en una máquina **sin orden
activa**, reutilizando el pipeline real vía `POST /sensor-readings`. Sesga el tipo de falla por
máquina para que los **fallos repetitivos** aparezcan de forma confiable sin verse 100% artificial.
**No completa órdenes** (eso sigue siendo manual). Implementa `OnModuleInit`.

### Carga del dataset `ai4i2020.csv`
- En `onModuleInit()`, si `DEMO_AUTOFAULT_ENABLED` está activo, llama a `loadFailureRows()`.
- `csvPath()` busca el archivo en orden: `DEMO_DATASET_PATH`, luego rutas relativas a `cwd`
  (`../ai4i2020.csv`, `./ai4i2020.csv`, `../predictmaint-ml/ai4i2020.csv`). Si no lo encuentra,
  el job queda deshabilitado con un *warning*.
- Por cada fila del CSV:
  - Determina `isFailure` (columna 8 == `'1'`) y el `fault` por *one-hot* (`FAULT_COLS`:
    índices 9–13 → `TWF/HDF/PWF/OSF/RNF`; si ninguno marca, `RNF`).
  - **Filtra** filas con `triggersRule(row)`: solo conserva las que cruzarían algún umbral físico
    (diferencia de temperatura, RPM bajas, potencia fuera de rango, desgaste de herramienta, etc.).
  - Indexa la fila en tres mapas: por tipo (`rowsByFault`), y por severidad
    (`hardRowsByFault` si `isFailure`, `mildRowsByFault` si no).

### `@Cron` + control de intervalo
```ts
@Cron('15 * * * * *')   // segundo 15 de cada minuto
async tick(): Promise<void> {
  if (!this.enabled || this.allRows.length === 0) return;
  const now = Date.now();
  if (now - this.lastFire < this.intervalMin * 60_000) return; // throttle por intervalo
  ...
}
```
El cron dispara **cada minuto**, pero la inyección real está limitada por `lastFire` +
`DEMO_AUTOFAULT_MIN` minutos: solo inyecta cuando ha pasado el intervalo configurado.

### Búsqueda de máquinas LIBRES
```ts
const activas = await this.ordenModel.findAll({
  where: { estado: { [Op.in]: [EstadoOrden.PENDIENTE, EstadoOrden.EN_PROGRESO] } },
  attributes: ['idMaquina'],
});
const ocupadas = new Set(activas.map((o) => o.idMaquina));
const libres = maquinas.filter((m) => !ocupadas.has(m.idMaquina));
```
Una máquina con orden `PENDIENTE` o `EN_PROGRESO` está **ocupada** y se excluye. Si no hay
máquinas libres, no inyecta.

### Sesgo de tipo de falla por máquina (bias 70/30)
```ts
const tipoFalla =
  Math.random() < this.bias ? this.dominantFault(maquina.codigo) : this.pick(FAULT_TYPES);
```
- `dominantFault(codigo)` es **determinista**: hashea el código de la máquina y mapea a uno de
  los 5 tipos. Así cada máquina tiene un tipo de falla "dominante" estable.
- Con probabilidad `bias` (default **0.7 = 70%**) usa el tipo dominante; con `1 - bias`
  (**30%**) elige uno aleatorio. Esto genera **fallos repetitivos** reconocibles por máquina.
- Además, con `hardRate` (default 0.45) decide si toma una fila "hard" (fallo real) o "mild".

### Guardarraíl de órdenes activas (anti-saturación)
```ts
if (activas.length >= this.maxActivas) {
  this.logger.debug(`AutoFault: ${activas.length} órdenes activas ≥ máx ${this.maxActivas}; espera`);
  return; // NO actualiza lastFire → reintenta apenas se libere cupo
}
```
Si hay `>= DEMO_AUTOFAULT_MAX_ACTIVAS` órdenes activas, no genera nada y **no** marca `lastFire`,
de modo que reintenta en el siguiente tick cuando baje la carga.

### `POST /sensor-readings`
Arma el payload con los valores de sensor de la fila elegida y lo envía al propio backend,
reutilizando el pipeline real de evaluación:
```ts
const port = this.config.get<number>('PORT') ?? process.env.PORT ?? 3001;
const res = await fetch(`http://localhost:${port}/sensor-readings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
this.lastFire = now;
```
Solo aquí se marca `lastFire`, reiniciando el conteo del intervalo.

### Variables de entorno (`.env`)

| Variable | Default | Tipo | Descripción |
|----------|---------|------|-------------|
| `DEMO_AUTOFAULT_ENABLED` | `false` | bool | Activa/desactiva el generador. Si no es `true`, ni siquiera carga el dataset. |
| `DEMO_AUTOFAULT_MIN` | `30` | minutos | Intervalo mínimo entre inyecciones reales (controla `lastFire`). El cron sigue corriendo cada minuto, pero solo inyecta cada N min. |
| `DEMO_AUTOFAULT_BIAS` | `0.7` | 0–1 | Probabilidad de usar el tipo de falla **dominante** de la máquina (sesgo 70/30 para fallos repetitivos). |
| `DEMO_AUTOFAULT_MAX_ACTIVAS` | `3` | entero | Máximo de órdenes activas simultáneas; si se alcanza, no genera (guardarraíl anti-saturación). |
| `DEMO_DATASET_PATH` | — (autodetecta) | ruta | Ruta explícita al `ai4i2020.csv`. Si falta, busca en rutas relativas a `cwd`. |
| `DEMO_AUTOFAULT_HARD_RATE` | `0.45` | 0–1 | (Auxiliar) Probabilidad de inyectar una fila "fuerte" (fallo real) vs una "suave". |

#### Relación con `EVALUACION_COOLDOWN_MINUTOS`
`EVALUACION_COOLDOWN_MINUTOS` **no** pertenece a este job; lo consume
`SensorReadingsService.getCooldownMinutos()`
(`predictmaint-api/src/sensor-readings/sensor-readings.service.ts`). Es el **cooldown del
pipeline de evaluación**: tras evaluar una máquina, las lecturas siguientes dentro de esa ventana
se ignoran (`reason: 'cooldown'`).

**Implicación práctica:** aunque AutoFault inyecte una lectura al endpoint, si la máquina está
en *cooldown* o tiene pipeline activo, la lectura se descarta antes de generar una nueva orden.
Por eso **conviene que `DEMO_AUTOFAULT_MIN` sea coherente con `EVALUACION_COOLDOWN_MINUTOS`**:
si el intervalo de inyección es mucho menor que el cooldown, muchas inyecciones se desperdiciarán.

---

## 4. Tabla resumen

| Job (servicio) | Cron / frecuencia | Qué hace | Efecto / salida |
|----------------|-------------------|----------|-----------------|
| `AssignmentRetryService` | `0 * * * * *` — seg 0, **cada minuto** | Reasigna técnico a órdenes PENDIENTE sin técnico cuyo `proximoReintentoAsignacion` venció. | Si encuentra técnico: actualiza orden/alerta, registra evento `respuesta_tecnico` y **emite `ORDER_CREATED`**. Si no: reprograma reintento (15/15/30/60 min por nivel) y registra `reintento_asignacion`. |
| `EscalationService` | `30 * * * * *` — seg 30, **cada minuto** | Escala órdenes asignadas (con técnico) que siguen PENDIENTE y superaron su SLA por nivel, con idempotencia. | Crea evento etapa `escalado` (una sola vez por orden) y **emite `ORDER_ESCALATED`** hacia el supervisor. |
| `AutoFaultService` (DEMO) | `15 * * * * *` — seg 15, cada minuto, pero **inyecta cada `DEMO_AUTOFAULT_MIN` min** | Inyecta fallas del dataset `ai4i2020.csv` en máquinas LIBRES, con sesgo de tipo por máquina (bias 70/30) y guardarraíl de órdenes activas. | Hace `POST /sensor-readings` reutilizando el pipeline real; puede derivar (sujeto a cooldown) en una nueva orden. No completa órdenes. |
