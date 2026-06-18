import { Op } from 'sequelize';
import { Alerta } from '../../database/models/alerta.model';
import { Orden } from '../../database/models/orden.model';

function nextSequentialId(prefix: string, lastCodigo: string | null | undefined): string {
  const num = lastCodigo ? parseInt(lastCodigo.replace(`${prefix}-`, ''), 10) : 0;
  return `${prefix}-${String(num + 1).padStart(3, '0')}`;
}

export async function generateOrderCodigo(): Promise<string> {
  const last = await Orden.findOne({
    where: { codigo: { [Op.like]: 'ORD-%' } },
    order: [['codigo', 'DESC']],
  });
  return nextSequentialId('ORD', last?.codigo);
}

export async function generateAlertCodigo(): Promise<string> {
  const last = await Alerta.findOne({
    where: { codigo: { [Op.like]: 'ALERT-%' } },
    order: [['codigo', 'DESC']],
  });
  return nextSequentialId('ALERT', last?.codigo);
}

/** @deprecated use generateOrderCodigo */
export const generateOrderId = generateOrderCodigo;

/** @deprecated use generateAlertCodigo */
export const generateAlertId = generateAlertCodigo;
