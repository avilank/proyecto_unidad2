# Código de rutas — copiar y pegar con descripción

Bloques anotados por ruta: comentario general del flujo + código real del proyecto (frontend y backend). **Automatización y notificaciones:** sección [18](#18-automatización-y-envío-de-notificaciones).

---

## 1. `GET /` → redirección a login

```typescript
// DESCRIPCIÓN: Al abrir la raíz del sitio, Next.js redirige automáticamente a /login.
// No hay llamada al backend.

// predictmaint-web/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
```

---

## 2. `POST /auth/login` — Inicio de sesión

```typescript
// DESCRIPCIÓN: El usuario ingresa correo y contraseña. El frontend valida el formulario,
// envía POST /auth/login, guarda JWT + usuario en el store y redirige según rol
// (técnico → /dashboard/my-work, supervisor/jefe → /dashboard).

// ── FRONTEND: predictmaint-web/src/components/auth/login-page.tsx ──
const onSubmit = async (values: LoginFormValues) => {
  setSubmitError(null);
  try {
    const response = await authService.login(values);
    setSession(response.accessToken, {
      id: response.user.id,
      email: values.email,
      nombre: response.user.nombre,
      rol: response.user.rol,
      tecnicoId: response.user.tecnicoId,
      activo: true,
      creadoEn: new Date().toISOString(),
    });
    const isTechnician =
      response.user.rol === RolUsuario.TECNICO ||
      response.user.rol === RolUsuario.TECNICO_SENIOR;
    router.push(isTechnician ? '/dashboard/my-work' : '/dashboard');
  } catch {
    setSubmitError('Credenciales inválidas. Verifica email y contraseña.');
  }
};

// ── FRONTEND: predictmaint-web/src/infrastructure/repositories/auth.repository.ts ──
login(credentials: LoginCredentials): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login', credentials);
}

// ── BACKEND: predictmaint-api/src/auth/auth.controller.ts ──
@Public()
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

// ── BACKEND: predictmaint-api/src/auth/auth.service.ts ──
async login(dto: LoginDto) {
  const usuario = await this.usuarioModel.findOne({
    where: { correo: dto.email, estado: 'activo' },
    include: [{ model: Rol }, { model: Tecnico, include: [Usuario, Especialidad] }],
  });
  if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

  const valid = await bcrypt.compare(dto.password, usuario.passwordHash);
  if (!valid) throw new UnauthorizedException('Credenciales inválidas');

  const payload: AuthUserPayload = {
    id: usuario.idUsuario,
    email: usuario.correo,
    rol: mapRolNombre(usuario.rol?.nombre ?? 'operador'),
    tecnicoId: tecnico?.idTecnico,
  };

  return {
    accessToken: this.jwtService.sign(payload),
    user: { id: usuario.idUsuario, nombre, rol, tecnicoId: tecnico?.idTecnico ?? null },
  };
}
```

---

## 3. `GET /auth/me` · `POST /auth/logout`

```typescript
// DESCRIPCIÓN: /auth/me devuelve perfil + permisos CASL con JWT en cabecera.
// /auth/logout responde ok; el frontend borra token del store local.

// ── FRONTEND: auth.repository.ts ──
getProfile(): Promise<User> {
  return apiClient.get<User>('/auth/me');
}
logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
}

// ── BACKEND: auth.controller.ts ──
@Get('me')
me(@UserContext() user: AuthUserPayload) {
  return this.authService.me(user);
}

@Post('logout')
logout() {
  return this.authService.logout();
}
```

---

## 4. `GET /dashboard` — KPIs y estado de planta

```typescript
// DESCRIPCIÓN: Supervisor/jefe ve KPIs, máquinas, alertas y gráfico de sensores.
// La vista dispara varios GET en paralelo vía hooks SWR.

// ── FRONTEND: predictmaint-web/src/app/dashboard/page.tsx ──
import { DashboardView } from '@/components/dashboard/dashboard-view';
export default function Page() {
  return <DashboardView />;
}

// ── FRONTEND: dashboard-view.tsx (carga de datos) ──
export function DashboardView() {
  const dashboard = useDashboard();           // GET /analytics/dashboard
  const machines = useMachines();             // GET /machines
  const activeAlerts = useActiveAlerts();     // GET /alerts/active
  const trend = useSensorTrend(...);          // GET /analytics/sensor-trend
  // ... renderiza KPIs, tablas y gráficos
}

// ── FRONTEND: analytics.repository.ts ──
getDashboardKpis(): Promise<DashboardApiResponse> {
  return apiClient.get<DashboardApiResponse>('/analytics/dashboard');
}

// ── BACKEND: analytics.controller.ts ──
@Get('dashboard')
getDashboard() {
  return this.analyticsService.getDashboard();
}
```

---

## 5. `GET /dashboard/monitoring` + SSE `/monitoring/stream`

```typescript
// DESCRIPCIÓN: Monitoreo en tiempo real. REST carga máquinas/alertas; SSE recibe
// eventos cuando entra una lectura, alerta u orden nueva. Token JWT va en query (?token=).

// ── FRONTEND: predictmaint-web/src/presentation/hooks/useMonitoringStream.ts ──
const url = `${API_URL}/monitoring/stream?token=${encodeURIComponent(token)}`;
const es = new EventSource(url);

es.onmessage = (event) => {
  const parsed = JSON.parse(event.data);
  // type: 'reading' | 'alert' | 'order' | ...
  registerMachine(parsed.maquinaId);
  revalidate(); // refresca /machines, /alerts/active, /analytics/dashboard
};

// ── BACKEND: monitoring.controller.ts ──
@Public()
@UseGuards(SseJwtQueryGuard)
@Sse('stream')
stream(): Observable<MessageEvent> {
  return this.monitoringSseService.getStream();
}
```

---

## 6. `POST /sensor-readings` — Pipeline S-1 → S-2 → S-3 (automático)

```typescript
// DESCRIPCIÓN: Entrada del pipeline predictivo (público, sin JWT).
// Persiste lectura, evalúa reglas, llama ML binario/multiclase/RAG, crea alerta+orden,
// asigna técnico y emite SSE. En demo lo dispara AutoFaultService cada N minutos.

// ── BACKEND: sensor-readings.controller.ts ──
@Public()
@Post()
create(@Body() dto: CreateSensorReadingDto) {
  return this.sensorReadingsService.create(dto);
}

// ── BACKEND: sensor-readings.service.ts (inicio del pipeline) ──
async create(dto: CreateSensorReadingDto) {
  const maquina = await findMaquinaByCodigo(dto.maquinaId);
  const reading = await this.lecturaModel.create({ /* sensores */ });

  const triggered = evaluateSensorRules({ /* airTemp, torque, ... */ });
  if (!triggered) {
    this.emitMonitoringReading(dto.maquinaId, readingResp);
    return { reading: readingResp };
  }

  // Cooldown: si hay orden activa, no duplica pipeline
  const gate = await this.shouldSkipPipeline(maquina.idMaquina);
  if (gate.skip) return { reading, skipped: gate.reason };

  // Crea análisis → orden pendiente → alerta → llama ML S-1, S-2, S-3
  const order = await this.ordenModel.create({ estado: EstadoOrden.PENDIENTE, ... });
}

// ── BACKEND: jobs/auto-fault.service.ts (demo) ──
/**
 * Generador automático de fallas (demo): cada N minutos inyecta una falla
 * reusando el pipeline real (/sensor-readings). Se activa con DEMO_AUTOFAULT_ENABLED=true.
 */
@Cron('* * * * *')
async tick() {
  // POST interno a /sensor-readings con fila del dataset AI4I
}
```

---

## 7. `GET /dashboard/analysis/[machineId]` — Análisis ML por máquina

```typescript
// DESCRIPCIÓN: Muestra predicción binaria S-1, clasificación S-2 y plan RAG S-3
// de la orden asociada a esa máquina.

// ── FRONTEND: predictmaint-web/src/app/dashboard/analysis/[machineId]/page.tsx ──
// Renderiza AnalysisView con machineId de la URL

// ── FRONTEND: order.repository.ts ──
getBinaryPredictions(orderId: string) {
  return apiClient.get(`/predictions/binary/${orderId}`);
}
getMulticlassPredictions(orderId: string) {
  return apiClient.get(`/predictions/multiclass/${orderId}`);
}

// ── FRONTEND: rag.repository.ts ──
getByOrderId(orderId: string) {
  return apiClient.get(`/rag/plan/${orderId}`);
}

// ── BACKEND: predictions.controller.ts ──
@Get('binary/:orderId')
getBinary(@Param('orderId') orderId: string) { ... }

@Get('multiclass/:orderId')
getMulticlass(@Param('orderId') orderId: string) { ... }
```

---

## 8. `GET /dashboard/orders` — Historial de órdenes

```typescript
// DESCRIPCIÓN: Supervisor lista órdenes con filtros y paginación.
// Puede reasignar técnico desde la tabla.

// ── FRONTEND: orders-history-view.tsx ──
// useOrders() → orderService.findAll(query) → GET /orders

// ── FRONTEND: order.repository.ts ──
findAll(query?: OrderQuery): Promise<OrdersPaginatedResponse<Order>> {
  return apiClient.get('/orders', { params: query });
}

reassign(orderId: string, tecnicoId: number, motivo: string) {
  return apiClient.post(`/orders/${orderId}/reassign`, { tecnicoId, motivo });
}

// ── BACKEND: orders.controller.ts ──
@Get()
findAll(@Query() query, @UserContext() user) {
  return this.ordersService.findAll(query, user);
}

@Post(':id/reassign')
reassign(@Param('id') id, @Body() dto: ReassignOrderDto, @UserContext() user) {
  return this.ordersService.reassignOrder(id, dto, user);
}
```

---

## 9. `GET /dashboard/orders/[id]` — Detalle, RAG, iniciar y cerrar

```typescript
// DESCRIPCIÓN: Técnico ve orden, timeline y plan RAG. Flujo típico:
// 1) Aceptar RAG  2) Iniciar reparación  3) Registrar solución (finaliza).
// Aceptar RAG e iniciar son dos llamadas separadas.

// ── FRONTEND: order-detail-view.tsx ──
const handleAcceptRagAndStart = () =>
  runAction(async () => {
    await ragService.accept(orderId);      // POST /rag/plan/:id/accept
    await orderService.startOrder(orderId); // POST /orders/:id/start
  });

const handleRegisterSolution = () =>
  runAction(async () => {
    await orderService.registerSolution(orderId, {
      descripcion: solutionText.trim(),
      solucionTipo: solutionTipo,
      comentario: observaciones.trim() || undefined,
      esFalla,
      esPrediccionCorrecta,
      esClasificacionCorrecta,
    }); // POST /orders/:id/solution → estado finalizado
  });

// ── FRONTEND: order.repository.ts ──
findById(id: string) {
  return apiClient.get(`/orders/${id}`);
}
getTimeline(id: string) {
  return apiClient.get(`/orders/${id}/timeline`);
}
startOrder(orderId: string) {
  return apiClient.post(`/orders/${orderId}/start`);
}
registerSolution(orderId: string, payload) {
  return apiClient.post(`/orders/${orderId}/solution`, payload);
}

// ── FRONTEND: rag.repository.ts ──
accept(orderId: string) {
  return apiClient.post(`/rag/plan/${orderId}/accept`, {});
}
reject(orderId: string, motivo?: string) {
  return apiClient.post(`/rag/plan/${orderId}/reject`, { motivo });
}

// ── BACKEND: rag.service.ts — aceptar plan (NO inicia la orden) ──
async accept(orderCodigo: string) {
  await this.respuestaModel.create({ decision: 'aceptado', ... });
  await this.eventoModel.create({ etapa: 'rag_aceptado', ... });
  return this.toPlanResponse(orderCodigo);
}

// ── BACKEND: orders.controller.ts ──
@Post(':id/start')
startOrder(@Param('id') id, @UserContext() user) {
  return this.ordersService.startOrder(id, user); // → en_progreso + fechaInicio
}

@Post(':id/solution')
registerSolution(@Param('id') id, @Body() dto, @UserContext() user) {
  return this.ordersService.registerSolution(id, dto, user); // → finalizado + MTTR
}
```

---

## 10. `GET /dashboard/my-work` — Tablero del técnico

```typescript
// DESCRIPCIÓN: Técnico ve órdenes pendientes y completadas asignadas a él.

// ── FRONTEND: technician-board-view.tsx ──
// useTechnicianBoard() → GET /orders/my-board

// ── FRONTEND: order.repository.ts ──
getTechnicianBoard() {
  return apiClient.get('/orders/my-board');
}

// ── BACKEND: orders.controller.ts ──
@Get('my-board')
getTechnicianBoard(@UserContext() user: AuthUserPayload) {
  return this.ordersService.getTechnicianBoard(user);
}
```

---

## 11. `GET /dashboard/technicians` — CRUD técnicos

```typescript
// DESCRIPCIÓN: Supervisor lista, crea, edita o inactiva técnicos.

// ── FRONTEND: technician.repository.ts ──
findAll() {
  return apiClient.get('/technicians', { params: { limit: 100 } });
}
create(payload: CreateTechnicianPayload) {
  return apiClient.post('/technicians', payload);
}
update(id: number, payload: UpdateTechnicianPayload) {
  return apiClient.patch(`/technicians/${id}`, payload);
}
remove(id: number) {
  return apiClient.delete(`/technicians/${id}`);
}

// ── BACKEND: technicians.controller.ts ──
@Get() findAll() { ... }
@Post() create(@Body() dto) { ... }
@Patch(':id') update(@Param('id') id, @Body() dto) { ... }
@Delete(':id') remove(@Param('id') id) { ... }
```

---

## 12. `GET /dashboard/analytics` — Reportes y MTTR/MTBF

```typescript
// DESCRIPCIÓN: Pantalla analítica: efectividad, fallos por tipo, MTTR/MTBF,
// validación ML vs técnico, log de notificaciones.

// ── FRONTEND: analytics.repository.ts ──
getSummary(filters) {
  return apiClient.get('/analytics/summary', { params: analyticsFiltersToParams(filters) });
}
getReliability(filters) {
  return apiClient.get('/analytics/reliability', { params: analyticsFiltersToParams(filters) });
}
getPredictionValidation(filters) {
  return apiClient.get('/analytics/prediction-validation', { params: ... });
}
getNotificationLog(page, limit) {
  return apiClient.get('/notifications/log', { params: { page, limit } });
}

// ── BACKEND: analytics.controller.ts ──
@Get('summary') getSummary(@Query() query) { ... }
@Get('reliability') getReliability(@Query() query) { ... }
@Get('prediction-validation') getPredictionValidation(@Query() query) { ... }
```

---

## 13. `GET /dashboard/analytics/repetitive` — Fallos recurrentes

```typescript
// DESCRIPCIÓN: Máquinas con fallos repetidos; supervisor puede marcar resuelto.

// ── FRONTEND: config.repository.ts ──
getRepetitiveFaults() {
  return apiClient.get('/repetitive-faults');
}
resolveRepetitiveFault(id: number, nota: string) {
  return apiClient.post(`/repetitive-faults/${id}/resolve`, { nota });
}

// ── BACKEND: repetitive-faults.controller.ts ──
@Get() findAll() { ... }
@Post(':id/resolve') resolve(@Param('id') id, @Body() dto) { ... }
```

---

## 14. `GET /dashboard/settings` — Configuración del sistema

```typescript
// DESCRIPCIÓN: Umbrales ML, modelos activos, fuentes RAG, reglas de notificación,
// horarios de envío y acciones de escalamiento.

// ── FRONTEND: config.repository.ts ──
getConfig() {
  return apiClient.get('/config');
}
updateConfig(body) {
  return apiClient.patch('/config', body);
}
getRagSources() {
  return apiClient.get('/catalog/rag-sources');
}
patchRagSource(id: number, activa: boolean) {
  return apiClient.patch(`/catalog/rag-sources/${id}`, { activa });
}

// ── FRONTEND: ml-models.repository.ts ──
findAll(etapa: 'S1' | 'S2') {
  return apiClient.get('/ml-models', { params: { etapa } });
}
activate(id: number) {
  return apiClient.patch(`/ml-models/${id}/activate`);
}

// ── BACKEND: config-catalog.controller.ts + ml-models.controller.ts ──
@Get() getConfig() { ... }
@Patch() patchConfig(@Body() dto) { ... }
@Patch(':id/activate') activateModel(@Param('id') id) { ... }
```

---

## 15. `GET /dashboard/profile` — Perfil de usuario

```typescript
// DESCRIPCIÓN: Cualquier usuario autenticado edita nombre y teléfono.

// ── FRONTEND: profile.service.ts ──
getProfile(): Promise<UserProfile> {
  return apiClient.get('/users/me');
}
updateProfile(payload: { nombre?: string; telefono?: string }) {
  return apiClient.patch('/users/me', payload);
}

// ── BACKEND: users.controller.ts ──
@Get('me') getMe(@UserContext() user) { ... }
@Patch('me') patchMe(@UserContext() user, @Body() dto) { ... }
```

---

## 16. RAG — regenerar plan

```typescript
// DESCRIPCIÓN: Vuelve a llamar ML S-3 con tipo de fallo y fuentes; guarda nuevo plan.

// ── FRONTEND: rag.repository.ts ──
regenerate(orderId: string, payload?: { escalado?: boolean; fuenteIds?: number[] }) {
  return apiClient.post(`/rag/plan/${orderId}/regenerate`, payload ?? {});
}

// ── BACKEND: rag.controller.ts ──
@Post('plan/:orderId/regenerate')
regenerate(@Param('orderId') orderId, @Body() dto: RegenerateRagPlanDto) {
  return this.ragService.regenerate(orderId, dto.escalado, dto.fuenteIds);
}

// ── BACKEND: rag.service.ts ──
async regenerate(orderCodigo, escalado = false, fuenteIds?) {
  const ragResult = await this.mlGateway.rag({ tipoFallo, maquinaId, escalado, ... });
  // persiste nueva recomendacion_rag
}
```

---

## 17. ML FastAPI — inferencia (solo API → ML, no navegador)

```python
# DESCRIPCIÓN: NestJS llama a FastAPI vía MlGatewayService con cabecera X-API-Key.
# S-1 binario, S-2 multiclase, S-3 plan RAG.

# predictmaint-ml/main.py

@app.get("/health")
def health(): ...

@app.post("/predict", dependencies=[Depends(verify_api_key)])
def predict(body: PredictRequest):
    # 6 modelos binarios → consenso, nivel de riesgo
    ...

@app.post("/classify", dependencies=[Depends(verify_api_key)])
def classify(body: ClassifyRequest):
    # tipo de fallo HDF/PWF/TWF/OSF/RNF
    ...

@app.post("/rag", dependencies=[Depends(verify_api_key)])
def rag(body: RagRequest):
    # plan de acción + fuentes citadas (rag.py)
    ...
```

```typescript
// DESCRIPCIÓN: Puente HTTP del API hacia FastAPI.

// predictmaint-api/src/ml-gateway/ml-gateway.service.ts
async predict(features: MlPredictFeatures): Promise<MlPredictResponse> {
  const { data } = await this.client.post('/predict', features);
  return data;
}
async classify(features) { return this.client.post('/classify', features); }
async rag(payload) { return this.client.post('/rag', payload); }
```

---

## 18. Automatización y envío de notificaciones

```typescript
// DESCRIPCIÓN: Al asignar un técnico (pipeline o reintento), el API emite ORDER_CREATED_EVENT.
// OrderNotificationListener reacciona y envía email/WhatsApp según reglas de configuración.

// ── BACKEND: order-notification.listener.ts ──
@OnEvent(ORDER_CREATED_EVENT, { async: true })
async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
  if (!payload.tecnicoId) return;
  await this.notificationsService.notifyTechnicianAssignment(payload);
}

// ── BACKEND: sensor-readings.service.ts (emisión tras asignar) ──
this.eventEmitter.emit(ORDER_CREATED_EVENT, {
  orderId: order.codigo,
  tecnicoId: tecnico.idTecnico,
  maquinaId: maquina.codigo,
  nivelRiesgo,
});

// ── BACKEND: notifications.service.ts — lectura de reglas y envío ──
async notifyTechnicianAssignment(payload: OrderCreatedPayload) {
  const regla = await this.reglaModel.findOne({ where: { nivel } });
  const recipients = this.recipientsFromRecibe(regla?.recibe); // técnico / supervisor / nadie
  const allowEmail = regla?.canal?.includes('email');
  const allowWhatsapp = regla?.canal?.includes('whatsapp');

  if (recipients.tecnico) {
    await this.dispatchToTechnician(/* SMTP o webhook según config */);
  }
  if (recipients.supervisor) {
    await this.notifySupervisorsForAlert(/* ... */);
  }
}

// ── BACKEND: dispatchToTechnician — elección de canal ──
const smtpReady = this.smtpEmail.isConfigured();
if (sendEmailSmtp) {
  await this.smtpEmail.send({ to: email, subject, html: emailBody, text: emailText });
}
if (needsPhone || sendEmailWebhook) {
  await this.webhookNotifier.send({
    email,
    subject,
    phone,
    whatsappSummary,
    emailBody: sendEmailWebhook ? emailBody : undefined,
  });
}
await this.mensajeModel.create({ canal, estado: EstadoMensaje.ENTREGADO, ... });
```

```typescript
// DESCRIPCIÓN: Webhook n8n — POST multipart a SEND_EMAIL_WEBHOOK (WhatsApp + email si no hay SMTP).

// predictmaint-api/src/notifications/webhook-notifier.service.ts
async send(payload: WebhookNotificationPayload): Promise<void> {
  const webhookUrl = this.config.get('notifications.sendEmailWebhook');
  const form = new FormData();
  form.append('email', payload.email);
  form.append('subject', payload.subject);
  if (payload.phone) form.append('phone', payload.phone);
  if (payload.whatsappSummary) form.append('whatsappSummary', payload.whatsappSummary);
  if (payload.emailBody) form.append('emailBody', payload.emailBody);
  await fetch(webhookUrl, { method: 'POST', body: form });
}
```

```typescript
// DESCRIPCIÓN: Escalamiento automático — cron cada 30 s; si SLA vencido, notifica supervisores.

// predictmaint-api/src/jobs/escalation.service.ts
@Cron('30 * * * * *')
async escalateOverdueOrders() {
  // órdenes pendiente + técnico asignado + minutos > SLA
  await this.eventoModel.create({ etapa: 'escalado', ... });
  this.eventEmitter.emit(ORDER_ESCALATED_EVENT, payload);
}

// predictmaint-api/src/notifications/escalation-notification.listener.ts
@OnEvent(ORDER_ESCALATED_EVENT, { async: true })
async handleOrderEscalated(payload: OrderEscalatedPayload) {
  await this.notificationsService.notifyEscalation(payload);
}
```

```typescript
// DESCRIPCIÓN: Reintento de asignación — si encuentra técnico, vuelve a disparar notificación.

// predictmaint-api/src/jobs/assignment-retry.service.ts
@Cron('0 * * * * *')
async retryPendingAssignments() {
  const tecnico = await this.techniciansService.assignForOrder(nivelRiesgo, tipoFallo);
  if (tecnico) {
    await order.update({ idTecnico: tecnico.idTecnico });
    this.eventEmitter.emit(ORDER_CREATED_EVENT, { orderId, tecnicoId, ... });
  }
}
```

```typescript
// DESCRIPCIÓN: Frontend — configurar reglas de notificación por nivel de riesgo (Settings → Alertas).

// predictmaint-web/src/infrastructure/repositories/config.repository.ts
getNotificationRules() {
  return apiClient.get('/catalog/notification-rules');
}
patchNotificationRule(nivel: string, body: { canal?: string; recibe?: string }) {
  return apiClient.patch(`/catalog/notification-rules/${nivel}`, body);
}

// predictmaint-web/src/components/dashboard/settings/alerts-settings-tab.tsx
// Selects: canal (Email / WhatsApp / ambos / ninguno) y destinatario (técnico / supervisor / ...)
```

```typescript
// DESCRIPCIÓN: Log de mensajes enviados — panel en /dashboard/analytics.

// predictmaint-web/src/infrastructure/repositories/analytics.repository.ts
getNotificationLog(page = 1, limit = 20) {
  return apiClient.get('/notifications/log', { params: { page, limit } });
}

// predictmaint-api/src/notifications/notifications.controller.ts
@Get('log')
getLog(@Query() query) {
  return this.notificationsService.getLog(query);
}
```

**Variables `.env` (API):** `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS` · `SEND_EMAIL_WEBHOOK` · `FRONTEND_URL`

**Endpoints relacionados:** `GET /notifications/log` · `POST /notifications/send` · `GET/PATCH /catalog/notification-rules/:nivel` · `PATCH /config` (SLA)

---

## 19. Cliente HTTP compartido (todas las rutas frontend)

```typescript
// DESCRIPCIÓN: Axios inyecta Authorization: Bearer desde sessionStore en cada petición REST.

// predictmaint-web/src/infrastructure/http/clients/apiClient.ts
// NEXT_PUBLIC_API_URL → http://localhost:3004 (local)

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## Tabla rápida: pantalla → endpoints

| Pantalla | Métodos principales |
|----------|---------------------|
| `/login` | `POST /auth/login` |
| `/dashboard` | `GET /analytics/dashboard`, `/machines`, `/alerts/active` |
| `/dashboard/monitoring` | SSE `/monitoring/stream`, `/alerts/active` |
| `/dashboard/analysis/[id]` | `/predictions/binary/*`, `/multiclass/*`, `/rag/plan/*` |
| `/dashboard/orders` | `GET /orders`, `POST /orders/:id/reassign` |
| `/dashboard/orders/[id]` | `/orders/*`, `/rag/plan/*` |
| `/dashboard/my-work` | `GET /orders/my-board` |
| `/dashboard/technicians` | `/technicians/*` |
| `/dashboard/analytics` | `/analytics/*`, `/notifications/log` |
| `/dashboard/settings` | `/config`, `/catalog/*`, `/ml-models/*`, `/catalog/notification-rules` |
| `/dashboard/profile` | `GET/PATCH /users/me` |
| Automatización | Eventos + crons → `notifications.service.ts`, SMTP / webhook n8n |
| Pipeline demo | Cron → `POST /sensor-readings` → ML → `ORDER_CREATED_EVENT` → notificación |

---

*Complementa `docs/DESCRIPCION_RUTAS.md` (narrativa) y `docs/MANUAL_RUTAS.md` (tablas).*
