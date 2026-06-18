import { Agreement } from '../enums';

const AGREEMENT_RANK: Record<Agreement, number> = {
  [Agreement.BAJO]: 0,
  [Agreement.MEDIO]: 1,
  [Agreement.ALTO]: 2,
};

export function parseAgreementMinimo(valor: string): Agreement {
  const upper = valor.toUpperCase();
  if (upper.includes('ALTO')) return Agreement.ALTO;
  if (upper.includes('MEDIO')) return Agreement.MEDIO;
  return Agreement.BAJO;
}

export function meetsAgreementMinimo(actual: Agreement, minimo: Agreement): boolean {
  return AGREEMENT_RANK[actual] >= AGREEMENT_RANK[minimo];
}
