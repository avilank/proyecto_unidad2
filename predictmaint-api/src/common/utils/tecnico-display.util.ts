import { Tecnico } from '../../database/models/tecnico.model';
import { RolUsuario } from '../enums';

export function tecnicoNombre(t: Tecnico): string {
  const u = t.usuario;
  if (!u) return 'Técnico';
  return `${u.nombres} ${u.apellidos}`.trim();
}

export function tecnicoIniciales(t: Tecnico): string {
  return tecnicoNombre(t)
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

export function tecnicoEmail(t: Tecnico): string | null {
  return t.usuario?.correo ?? null;
}

export function tecnicoEspecialidad(t: Tecnico): string {
  return t.especialidadRef?.nombre ?? 'general';
}

export function mapRolNombre(nombre: string): RolUsuario {
  const map: Record<string, RolUsuario> = {
    operador: RolUsuario.TECNICO,
    supervisor: RolUsuario.SUPERVISOR,
    jefe_planta: RolUsuario.JEFE_PLANTA,
  };
  return map[nombre] ?? RolUsuario.TECNICO;
}

export function tecnicoToResponse(t: Tecnico, maquinas: string[] = []) {
  return {
    id: t.idTecnico,
    nombre: tecnicoNombre(t),
    iniciales: tecnicoIniciales(t),
    especialidad: tecnicoEspecialidad(t),
    turno: t.turno,
    estado: t.disponibilidad,
    telefono: t.usuario?.telefono ?? null,
    email: tecnicoEmail(t),
    nivelExperiencia: t.nivelExperiencia,
    ordenesHoy: 0,
    maquinas,
  };
}
