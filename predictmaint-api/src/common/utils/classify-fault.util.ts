import { Agreement } from '../enums';
import { parseAgreementMinimo } from './agreement.util';

export function minVotesForAgreement(minimo: Agreement): number {
  switch (minimo) {
    case Agreement.ALTO:
      return 3;
    case Agreement.MEDIO:
      return 2;
    default:
      return 1;
  }
}

export function agreementLabelFromVotes(count: number): Agreement {
  if (count >= 3) return Agreement.ALTO;
  if (count >= 2) return Agreement.MEDIO;
  return Agreement.BAJO;
}

export function resolveTipoFalloByMinAgreement(
  votes: string[],
  agreementMinimoRaw: string,
): { tipo: string | null; agreement: Agreement; winnerVotes: number } {
  if (!votes.length) {
    return { tipo: null, agreement: Agreement.BAJO, winnerVotes: 0 };
  }
  const winner = votes.reduce((best, cur) => {
    const curCount = votes.filter((v) => v === cur).length;
    const bestCount = votes.filter((v) => v === best).length;
    return curCount > bestCount ? cur : best;
  }, votes[0]);
  const winnerVotes = votes.filter((v) => v === winner).length;
  const agreement = agreementLabelFromVotes(winnerVotes);
  const minimo = parseAgreementMinimo(agreementMinimoRaw);
  const minRequired = minVotesForAgreement(minimo);
  return {
    tipo: winnerVotes >= minRequired ? winner : null,
    agreement,
    winnerVotes,
  };
}
