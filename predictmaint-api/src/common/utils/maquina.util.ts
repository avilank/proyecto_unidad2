import { Maquina } from '../../database/models/maquina.model';

export async function findMaquinaByCodigo(codigo: string): Promise<Maquina | null> {
  return Maquina.findOne({ where: { codigo } });
}

export async function requireMaquinaByCodigo(codigo: string): Promise<Maquina> {
  const m = await findMaquinaByCodigo(codigo);
  if (!m) throw new Error(`Máquina no encontrada: ${codigo}`);
  return m;
}
