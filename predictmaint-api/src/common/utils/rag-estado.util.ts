export type RagEstadoRespuesta = 'pendiente' | 'aceptado' | 'rechazado';

type RagRespuestaRow = {
  decision: string;
  fechaRespuesta: Date | string;
};

export function latestRagEstado(
  respuestas?: RagRespuestaRow[] | null,
): RagEstadoRespuesta {
  if (!respuestas?.length) return 'pendiente';
  const latest = [...respuestas].sort(
    (a, b) =>
      new Date(b.fechaRespuesta).getTime() - new Date(a.fechaRespuesta).getTime(),
  )[0];
  if (latest.decision === 'aceptado') return 'aceptado';
  if (latest.decision === 'rechazado') return 'rechazado';
  return 'pendiente';
}
