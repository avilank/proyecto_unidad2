export enum NivelRiesgo {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TipoFallo {
  HDF = 'HDF',
  PWF = 'PWF',
  TWF = 'TWF',
  OSF = 'OSF',
  RNF = 'RNF',
}

export enum EstadoOrden {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  FINALIZADO = 'finalizado',
}

export enum EstadoAlerta {
  ANALIZANDO = 'analizando',
  CLASIFICANDO = 'clasificando',
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  FINALIZADO = 'finalizado',
}

export enum Especialidad {
  MECANICO = 'mecanico',
  ELECTRICO = 'electrico',
  HIDRAULICO = 'hidraulico',
  GENERAL = 'general',
}

export enum Turno {
  MANANA = 'mañana',
  TARDE = 'tarde',
  NOCHE = 'noche',
}

export enum EstadoTecnico {
  DISPONIBLE = 'disponible',
  EN_INTERVENCION = 'en_intervencion',
  FUERA_DE_TURNO = 'fuera_de_turno',
}

export enum RolUsuario {
  TECNICO = 'tecnico',
  TECNICO_SENIOR = 'tecnico_senior',
  SUPERVISOR = 'supervisor',
  JEFE_PLANTA = 'jefe_planta',
}

export enum ModeloBinario {
  REGRESION_LOGISTICA = 'regresion_logistica',
  RANDOM_FOREST = 'random_forest',
  XGBOOST = 'xgboost',
}

export enum ModeloMulticlase {
  DECISION_TREE = 'decision_tree',
  LIGHTGBM = 'lightgbm',
  SVM = 'svm',
}

export enum PrediccionBinaria {
  FALLA = 'FALLA',
  SIN_FALLA = 'SIN_FALLA',
}

export enum EtapaModelo {
  S1 = 'S1',
  S2 = 'S2',
}

export enum Canal {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  WHATSAPP_EMAIL = 'whatsapp_email',
}

export enum EstadoOperativo {
  OPERACION = 'operacion',
  ALERTA = 'alerta',
  FALLO = 'fallo',
  MANTENIMIENTO = 'mantenimiento',
}

export enum Agreement {
  BAJO = 'BAJO',
  MEDIO = 'MEDIO',
  ALTO = 'ALTO',
}

export enum SolucionTipo {
  CON_RAG = 'con_rag',
  PROPIA = 'propia',
  RECHAZADA_MANUAL = 'rechazada_manual',
}

export enum EtapaEventoOrden {
  DETECCION_S1 = 'deteccion_s1',
  CLASIFICACION_S2 = 'clasificacion_s2',
  RAG_S3 = 'rag_s3',
  RESPUESTA_TECNICO = 'respuesta_tecnico',
  EN_PROGRESO = 'en_progreso',
  FINALIZADO = 'finalizado',
  ESCALADO = 'escalado',
}

export enum EstadoPlanRag {
  PENDIENTE = 'pendiente',
  ACEPTADO = 'aceptado',
  RECHAZADO = 'rechazado',
}

export enum PrioridadAccion {
  CRITICO = 'CRITICO',
  BAJO = 'BAJO',
  MEDIO = 'MEDIO',
}

export enum EstadoFalloRepetitivo {
  EN_REVISION = 'en_revision',
  PROGRAMADO = 'programado',
  SEGUIMIENTO = 'seguimiento',
  RESUELTO = 'resuelto',
}

export enum NivelFalloRepetitivo {
  CRITICO = 'CRITICO',
  MODERADO = 'MODERADO',
  SEGUIMIENTO = 'SEGUIMIENTO',
}

export enum TipoEnvio {
  ALERTA_CRITICA = 'alerta_critica',
  INICIO_TURNO = 'inicio_turno',
  MITAD_TURNO = 'mitad_turno',
  FIN_TURNO = 'fin_turno',
  REPETITIVO = 'repetitivo',
}

export enum EstadoMensaje {
  ENTREGADO = 'entregado',
  PENDIENTE = 'pendiente',
  FALLIDO = 'fallido',
}
