/** Tipos de fallo que cubre cada fuente RAG (catálogo fijo del sistema). */
export const RAG_SOURCE_FAULT_MAP: Record<string, string[]> = {
  'Theissler et al. (2021)': ['HDF', 'PWF'],
  'Pashmforoush et al. (2025)': ['TWF', 'OSF'],
  'Cai et al. (2023)': ['HDF', 'PWF', 'TWF', 'OSF'],
  'Araujo et al. (2025)': ['PWF', 'OSF'],
  'Hesser & Markert (2019)': ['TWF'],
  'Jakobs et al. (2026)': ['RNF'],
};

export function ragSourceAppliesToFault(titulo: string, tipoFallo: string): boolean {
  const fault = tipoFallo?.trim().toUpperCase();
  if (!fault) return true;
  const codes = RAG_SOURCE_FAULT_MAP[titulo];
  if (!codes) return true;
  return codes.includes(fault);
}

export function formatRagSourceFaultLabel(titulo: string): string {
  const codes = RAG_SOURCE_FAULT_MAP[titulo];
  if (!codes) return 'Todos';
  if (codes.length >= 4) return 'Todos';
  return codes.join(', ');
}
