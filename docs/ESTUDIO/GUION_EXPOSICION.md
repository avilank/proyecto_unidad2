# Guión de Exposición — PredictMaint

> **Qué es esto:** un guión base (lo que vas a *decir*) para presentar el proyecto completo al docente.
> Está pensado para una exposición de **12–18 minutos** + preguntas. Cada bloque tiene:
> 🗣️ **lo que dices**, 🖥️ **lo que muestras**, ⏱️ **tiempo sugerido**.
>
> Consejo: no leas; usa los 🗣️ como apoyo. Lo importante es contar **el flujo** y **por qué** está hecho así.

---

## 0 · Apertura (30 s) ⏱️

🗣️
> "Buenos días. Les presento **PredictMaint**, un sistema de **mantenimiento predictivo** para máquinas CNC.
> En una frase: el sistema **lee los sensores de una máquina, detecta con Machine Learning si va a fallar, identifica qué tipo de falla es, genera un plan de acción, crea la orden de trabajo, asigna al técnico y lo notifica** — todo automático y registrado para analítica."

🖥️ Pantalla de **login** o el **dashboard** ya abierto.

---

## 1 · Arquitectura: 3 servicios (1.5 min) ⏱️

🗣️
> "El sistema son **tres servicios** que se comunican por HTTP:
> 1. **Web** — la interfaz, hecha en **Next.js + React**.
> 2. **API / Backend** — el cerebro del negocio, en **NestJS + PostgreSQL**. Orquesta todo.
> 3. **ML** — un servicio aparte en **FastAPI (Python)** que solo hace inferencia con los modelos.
>
> La **regla de oro**: el navegador **nunca** habla con el ML directamente. Siempre va **Web → API → ML**. El API es el único que llama al ML.
>
> ¿Por qué Python aparte? Porque los modelos están entrenados con **scikit-learn, XGBoost y LightGBM** y se guardan como `.joblib`. Node no los puede ejecutar; FastAPI los carga y los expone como endpoints."

🖥️ Muestra el diagrama (puedes tenerlo en una diapositiva):

```
┌─────────────┐   HTTP/JWT   ┌──────────────┐   HTTP/X-API-Key   ┌──────────────┐
│  Web (Next) │ ───────────▶ │  API (Nest)  │ ─────────────────▶ │  ML (FastAPI)│
│  :3000      │ ◀─────────── │  :3001       │ ◀───────────────── │  :8000       │
└─────────────┘              └──────┬───────┘                    └──────────────┘
                                    │ Sequelize
                              ┌─────▼──────┐
                              │ PostgreSQL │
                              └────────────┘
```

> 💡 Si preguntan por seguridad: "El Web se autentica con **JWT**; el API protege al ML con una **API-Key** (`X-API-Key`)."

---

## 2 · El pipeline de 3 etapas (2.5 min) — *el corazón del proyecto* ⏱️

🗣️
> "Cuando llega una lectura de sensor, el API ejecuta un **pipeline de 3 etapas**:
>
> - **S-1 — Predicción (binario):** ¿esta máquina va a **fallar o no**? Si dice 'sin falla', el pipeline se detiene aquí.
> - **S-2 — Clasificación (multiclase):** si hay falla, **¿de qué tipo es?** Hay 5 tipos del dataset AI4I 2020:
>   **HDF** (calor), **PWF** (potencia), **TWF** (desgaste de herramienta), **OSF** (sobreesfuerzo) y **RNF** (aleatoria).
> - **S-3 — RAG:** genera el **plan de acción** con recomendaciones para el técnico.
>
> En cada etapa no usamos un solo modelo, usamos un **ensemble de 3 modelos**. El de mayor confianza es el **líder**. Y medimos el **agreement**: cuántos de los 3 coinciden — eso nos da una idea de qué tan segura es la clasificación."

🖥️ Abre el **Monitoreo en tiempo real** y, si hay una alerta, su **detalle** (las pestañas S-1 → S-2 → S-3).

🗣️ (señalando el nivel de riesgo)
> "Con la probabilidad del modelo líder calculamos el **nivel de riesgo**: LOW, MEDIUM, HIGH o CRITICAL.
> Y algo importante: **ese nivel se calcula en el backend usando umbrales que el supervisor puede configurar**, no viene fijo del modelo."*

---

## 3 · De la predicción a la acción: orden + técnico + notificación (2 min) ⏱️

🗣️
> "Detectar la falla no sirve si nadie actúa. Por eso, cuando hay falla, el sistema **automáticamente**:
> 1. Crea una **orden de mantenimiento** (el 'ticket' de trabajo).
> 2. **Asigna un técnico** según reglas: especialidad para ese tipo de falla y disponibilidad por turno.
> 3. **Notifica** al técnico por **Email (SMTP)** y/o **WhatsApp** (vía un webhook de n8n).
>
> La orden pasa por estados: **pendiente → en progreso → finalizado**.
> El técnico ve sus órdenes en su tablero **'Mi trabajo'**, abre el plan de acción del RAG, ejecuta y registra la solución."

🖥️ Muestra **'Mi trabajo'** (vista del técnico) y una orden con su plan RAG.

🗣️ (mecanismos de control)
> - **Escalamiento por SLA:** si una orden pasa demasiado tiempo sin que el técnico la inicie, se **escala al supervisor** y se le notifica, indicando el técnico, el motivo y los tiempos."

---

## 4 · Funciones de supervisión: rechazo y reasignación (1.5 min) ⏱️

🗣️
> "El sistema confía en el ML, pero **el humano tiene la última palabra**. Por eso agregamos dos flujos de control:
>
> - **Rechazo de predicción:** si el técnico o supervisor considera que la predicción es un **falso positivo**, puede **rechazarla** con una justificación. La orden pasa a estado **'rechazada'**. Esto luego nos sirve para medir qué tan acertado es el modelo.
> - **Reasignación:** el supervisor puede **reasignar** una orden a otro técnico indicando un **motivo**, y eso queda registrado en el historial ('Reasignado a — Motivo')."

🖥️ Muestra el botón de **rechazar predicción** y, si está listo, el panel/flujo de **reasignación**.

> 💡 Conecta con analítica: "El rechazo alimenta el panel de **validación de predicción**, donde contrastamos lo que predijo el modelo contra lo que decidió el técnico."

---

## 5 · Analítica y reportes (2 min) ⏱️

🗣️
> "Todo lo que ocurre queda registrado, y la pestaña de **Analítica** lo convierte en indicadores:
> - **KPIs** generales del sistema.
> - **Fallas por tipo** y **órdenes sin atender**.
> - **Efectividad del RAG.**
> - **Validación de predicción:** predicción del modelo vs. decisión real del técnico (acertadas vs. rechazadas).
> - **Disponibilidad** de máquinas (operativas vs. en mantenimiento).
> - **Confiabilidad con MTTR y MTBF:**
>   - **MTTR** (Mean Time To Repair) = tiempo promedio de reparación.
>   - **MTBF** (Mean Time Between Failures) = tiempo promedio entre fallas.
>   - Son los dos indicadores clásicos de mantenimiento industrial.
> - **Máquinas con fallas repetitivas**, usando umbrales configurables.
>
> Todo se filtra por rango de fechas, técnico, etc."

🖥️ Recorre la vista de **Analítica**: KPIs → MTTR/MTBF → validación de predicción.

---

## 6 · Configuración: el sistema es parametrizable (1 min) ⏱️

🗣️
> "Algo que quisimos cuidar es que el sistema **no tenga valores 'quemados'**. Desde **Configuración**, el supervisor ajusta:
> - Los **umbrales de nivel de riesgo** (que sí cambian cómo se calcula el riesgo).
> - Las **reglas de notificación** por nivel: quién recibe y por qué canal.
> - El **tiempo límite de atención** (SLA) que dispara el escalamiento.
> - Los **umbrales de fallas repetitivas** y las **acciones de escalamiento**.
>
> Es decir, la configuración **realmente influye en el comportamiento**, no es decorativa."

🖥️ Pestañas **Alertas** y **Fallas Repetitivas** en Configuración.

---

## 7 · Detalles técnicos para defender (1.5 min) ⏱️

🗣️
> "Sobre la implementación:
> - El **frontend** sigue **arquitectura limpia** (entidades, casos de uso, repositorios, presentación) con **SWR** para datos y **Zustand** para sesión. Tiene **tema claro/oscuro** y diseño responsive.
> - El **backend** es **modular** (un módulo por dominio), usa **Sequelize** sobre PostgreSQL, **guards JWT** globales y **permisos por rol** con CASL. La comunicación en vivo es por **SSE** (Server-Sent Events).
> - El **ML** carga los **6 modelos** (`.joblib`) y los expone para inferencia.
> - Tenemos **procesos programados (cron)**: reintento de asignación, escalamiento por SLA y un generador de datos de demo.
> - Toda la API está documentada (ver `MANUAL_RUTAS.md`)."

🖥️ Opcional: muestra la estructura de carpetas o el `MANUAL_RUTAS.md`.

---

## 8 · Demo en vivo (sugerida, 2–3 min) 🖥️⏱️

Orden recomendado para la demostración:

1. **Login** → entras como supervisor.
2. **Monitoreo en tiempo real** → señalas una alerta entrando (S-1 → S-2 → S-3).
3. **Detalle de la alerta/orden** → muestras nivel de riesgo, tipo de falla y plan RAG.
4. **Mi trabajo** (técnico) → la orden asignada y su plan.
5. **Rechazar predicción** o **reasignar** → muestras el control humano.
6. **Analítica** → cierras con MTTR/MTBF y validación de predicción.

> 💡 Ten una lectura/simulación lista para disparar una alerta en vivo (script de simulación). Si no, ten una alerta ya generada de respaldo.

---

## 9 · Cierre (30 s) ⏱️

🗣️
> "En resumen, PredictMaint cubre el ciclo completo del mantenimiento predictivo: **datos → predicción ML → decisión → acción → analítica**, con el humano supervisando en los puntos críticos. Está construido sobre una arquitectura de tres servicios, parametrizable y con trazabilidad total. Gracias, quedo atento a sus preguntas."

---

## 10 · Preguntas probables del docente (prepáralas) 🎯

| Pregunta | Respuesta corta |
|---|---|
| **¿Por qué separar el ML en otro servicio?** | Los modelos son de Python (sklearn/XGBoost/LightGBM, `.joblib`); Node no los ejecuta. Además desacopla y permite escalar el ML aparte. |
| **¿Qué dataset usaron?** | **AI4I 2020** (máquinas CNC). De ahí salen las features de sensores y los 5 tipos de falla (HDF, PWF, TWF, OSF, RNF). |
| **¿Qué es el ensemble y el agreement?** | Usamos 3 modelos por etapa; el de mayor confianza es el **líder**. El **agreement** es cuántos coinciden — indica certeza. |
| **¿Cómo calculan el nivel de riesgo?** | Con la probabilidad del líder S-1 contra **umbrales configurables** en el backend (LOW/MEDIUM/HIGH/CRITICAL). |
| **¿Qué pasa si el modelo se equivoca?** | El técnico/supervisor puede **rechazar la predicción**; queda registrado y alimenta la **validación de predicción**. |
| **¿Cómo asignan al técnico?** | Por **especialidad** según el tipo de falla y **disponibilidad por turno**; con reintento si nadie está libre. |
| **¿Qué es MTTR y MTBF?** | MTTR = tiempo medio de reparación; MTBF = tiempo medio entre fallas. Indicadores estándar de mantenimiento. |
| **¿Cómo notifican?** | **Email (SMTP)** y **WhatsApp** vía webhook de **n8n**; las reglas (quién/qué canal) son configurables por nivel. |
| **¿Qué es el RAG aquí?** | La etapa que genera el **plan de acción/recomendaciones** para el técnico a partir del tipo de falla detectado. |
| **¿Seguridad?** | JWT en el Web→API, API-Key en API→ML, guards globales y permisos por rol (CASL). |
| **¿Qué harían a futuro?** | RAG dinámico con LLM (hoy es estático), más modelos, app móvil para el técnico. |

---

## 11 · Chuleta de 1 minuto (si te quedas en blanco) 🆘

> **Datos → ML → Decisión → Acción → Analítica.**
> Lee sensores → S-1 predice falla → S-2 clasifica tipo → S-3 da el plan → crea orden → asigna técnico → notifica → técnico resuelve (o rechaza/reasigna) → todo se mide en analítica (MTTR/MTBF, validación).
> Tres servicios: **Web (Next) → API (Nest) → ML (FastAPI)**. El humano supervisa en rechazo/reasignación. Configuración parametrizable.

---

### Documentos de apoyo
- `GUIA_ESTUDIO_EXPOSICION.md` — explicación profunda de cada parte (para estudiar a fondo).
- `MANUAL_RUTAS.md` — todas las rutas/endpoints del sistema.
- `GUIA_MODELOS_ML.md` — detalle de los modelos.
- `GUIA_MTTR_MTBF.md` — cómo se calculan los indicadores de confiabilidad.
- `DOCUMENTACION_ARQUITECTURA.md` — arquitectura completa actualizada.
