export type ParsedAnalyticsFilters = {
  range: string;
  desde?: string;
  hasta?: string;
  tecnicoId?: number;
  maquinaId?: string;
  tipoFallo?: string;
  respuestaRag?: 'aceptado' | 'rechazado' | 'pendiente';
  decision?: 'aceptada' | 'rechazada';
  estado?: string;
  tipoMaquina?: string;
};

export function parseAnalyticsFilters(
  query: Record<string, string | undefined>,
): ParsedAnalyticsFilters {
  const respuestaRag = query.respuestaRag?.trim();
  const decision = query.decision?.trim();
  const estado = query.estado?.trim();
  const tipoFallo = query.tipoFallo?.trim();
  const maquinaId = query.maquinaId?.trim();
  const tipoMaquina = query.tipoMaquina?.trim();

  return {
    range: query.range?.trim() || 'week',
    desde: query.desde?.trim() || undefined,
    hasta: query.hasta?.trim() || undefined,
    tecnicoId: query.tecnicoId ? Number(query.tecnicoId) : undefined,
    maquinaId: maquinaId && maquinaId !== 'todos' ? maquinaId : undefined,
    tipoFallo: tipoFallo && tipoFallo !== 'todos' ? tipoFallo : undefined,
    respuestaRag:
      respuestaRag && respuestaRag !== 'todos' && ['aceptado', 'rechazado', 'pendiente'].includes(respuestaRag)
        ? (respuestaRag as ParsedAnalyticsFilters['respuestaRag'])
        : undefined,
    decision:
      decision && decision !== 'todos' && ['aceptada', 'rechazada'].includes(decision)
        ? (decision as ParsedAnalyticsFilters['decision'])
        : undefined,
    estado: estado && estado !== 'todos' ? estado : undefined,
    tipoMaquina:
      tipoMaquina && ['H', 'M', 'L'].includes(tipoMaquina.toUpperCase())
        ? tipoMaquina.toUpperCase()
        : undefined,
  };
}

export function resolveDateRange(filters: ParsedAnalyticsFilters): { from: Date; to: Date } {
  const to = filters.hasta
    ? new Date(`${filters.hasta}T23:59:59.999`)
    : new Date();

  if (filters.desde) {
    return { from: new Date(`${filters.desde}T00:00:00.000`), to };
  }

  const days = filters.range === 'month' ? 30 : 7;
  return { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };
}
