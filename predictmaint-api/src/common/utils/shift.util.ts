import { Turno } from '../enums';

/** Turno activo según hora local del servidor (Peru: mañana 06–14, tarde 14–22, noche 22–06). */
export function getCurrentTurno(date = new Date()): Turno {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return Turno.MANANA;
  if (hour >= 14 && hour < 22) return Turno.TARDE;
  return Turno.NOCHE;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
