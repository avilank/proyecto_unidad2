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
  RECHAZADA = 'rechazada',
}

export enum DecisionPrediccion {
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
}

export enum Turno {
  MANANA = 'mañana',
  TARDE = 'tarde',
  NOCHE = 'noche',
}

export enum Canal {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  WHATSAPP_EMAIL = 'whatsapp_email',
}

export enum Especialidad {
  MECANICO = 'mecanico',
  ELECTRICO = 'electrico',
  HIDRAULICO = 'hidraulico',
  GENERAL = 'general',
}

export enum EtapaModelo {
  S1 = 'S1',
  S2 = 'S2',
}

export enum EstadoTecnico {
  DISPONIBLE = 'disponible',
  EN_INTERVENCION = 'en_intervencion',
  FUERA_DE_TURNO = 'fuera_de_turno',
}

export enum EstadoOperativo {
  OPERACION = 'operacion',
  ALERTA = 'alerta',
  FALLO = 'fallo',
  MANTENIMIENTO = 'mantenimiento',
}

export enum EstadoAlerta {
  ANALIZANDO = 'analizando',
  CLASIFICANDO = 'clasificando',
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  FINALIZADO = 'finalizado',
}

export enum RolUsuario {
  TECNICO = 'tecnico',
  TECNICO_SENIOR = 'tecnico_senior',
  SUPERVISOR = 'supervisor',
  JEFE_PLANTA = 'jefe_planta',
}

export enum SolucionTipo {
  CON_RAG = 'con_rag',
  PROPIA = 'propia',
  RECHAZADA_MANUAL = 'rechazada_manual',
}

export enum EtapaOrden {
  DETECCION_S1 = 'deteccion_s1',
  CLASIFICACION_S2 = 'clasificacion_s2',
  RAG_S3 = 'rag_s3',
  RESPUESTA_TECNICO = 'respuesta_tecnico',
  EN_PROGRESO = 'en_progreso',
  FINALIZADO = 'finalizado',
  ESCALADO = 'escalado',
}

export enum PrediccionBinariaResultado {
  FALLA = 'FALLA',
  SIN_FALLA = 'SIN_FALLA',
}

export enum ModeloS1 {
  REGRESION_LOGISTICA = 'regresion_logistica',
  RANDOM_FOREST = 'random_forest',
  XGBOOST = 'xgboost',
}

export enum ModeloS2 {
  DECISION_TREE = 'decision_tree',
  LIGHTGBM = 'lightgbm',
  SVM = 'svm',
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

export enum TipoCalidadMaquina {
  L = 'L',
  M = 'M',
  H = 'H',
}
