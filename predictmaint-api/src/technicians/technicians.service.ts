import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  defaultReintentoMinutos,
} from '../common/utils/assignment-retry.util';
import { getCurrentTurno } from '../common/utils/shift.util';
import {
  Especialidad,
  EstadoTecnico,
  NivelRiesgo,
} from '../common/enums';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { tecnicoToResponse } from '../common/utils/tecnico-display.util';
import { Especialidad as EspecialidadModel } from '../database/models/especialidad.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { ReglaAsignacion } from '../database/models/regla-asignacion.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto/technician.dto';

const FAULT_SPECIALTY: Record<string, Especialidad> = {
  HDF: Especialidad.MECANICO,
  PWF: Especialidad.ELECTRICO,
  TWF: Especialidad.MECANICO,
  OSF: Especialidad.MECANICO,
  RNF: Especialidad.GENERAL,
};

@Injectable()
export class TechniciansService {
  constructor(
    @InjectModel(Tecnico) private readonly tecnicoModel: typeof Tecnico,
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(ReglaAsignacion) private readonly reglaModel: typeof ReglaAsignacion,
    @InjectModel(TipoFallo) private readonly tipoFalloModel: typeof TipoFallo,
    @InjectModel(EspecialidadModel) private readonly especialidadModel: typeof EspecialidadModel,
    @InjectModel(Usuario) private readonly usuarioModel: typeof Usuario,
  ) {}

  toResponse(
    t: Tecnico,
    stats: { maquinas: string[]; ordenesHoy: number } = { maquinas: [], ordenesHoy: 0 },
  ) {
    return {
      ...tecnicoToResponse(t, stats.maquinas),
      ordenesHoy: stats.ordenesHoy,
    };
  }

  private async loadAssignmentStats(
    tecnicoIds: number[],
  ): Promise<Map<number, { maquinas: string[]; ordenesHoy: number }>> {
    const map = new Map<number, { maquinas: string[]; ordenesHoy: number }>();
    if (!tecnicoIds.length) return map;

    for (const id of tecnicoIds) {
      map.set(id, { maquinas: [], ordenesHoy: 0 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeOrders = await this.ordenModel.findAll({
      where: {
        idTecnico: { [Op.in]: tecnicoIds },
        estado: { [Op.in]: ['pendiente', 'en_progreso'] },
      },
      include: [{ model: Maquina }],
    });

    for (const order of activeOrders) {
      if (!order.idTecnico) continue;
      const entry = map.get(order.idTecnico);
      if (!entry) continue;
      const codigo = order.maquina?.codigo;
      if (codigo && !entry.maquinas.includes(codigo)) {
        entry.maquinas.push(codigo);
      }
    }

    const todayCounts = await this.ordenModel.findAll({
      where: {
        idTecnico: { [Op.in]: tecnicoIds },
        fechaCreacion: { [Op.gte]: todayStart },
      },
      attributes: ['idTecnico'],
    });

    for (const row of todayCounts) {
      if (!row.idTecnico) continue;
      const entry = map.get(row.idTecnico);
      if (entry) entry.ordenesHoy += 1;
    }

    return map;
  }

  async getReintentoMinutos(nivelRiesgo: NivelRiesgo): Promise<number> {
    return defaultReintentoMinutos(nivelRiesgo);
  }

  private async resolveSpecialty(tipoFallo?: string): Promise<Especialidad | null> {
    if (!tipoFallo) return null;
    const fault = await this.tipoFalloModel.findOne({ where: { codigo: tipoFallo } });
    if (!fault) return FAULT_SPECIALTY[tipoFallo] ?? Especialidad.GENERAL;

    const regla = await this.reglaModel.findOne({
      where: { idTipoFallo: fault.idTipoFallo, activo: true },
      include: [{ model: EspecialidadModel }],
    });
    if (regla?.especialidad?.nombre) {
      return regla.especialidad.nombre as Especialidad;
    }
    return FAULT_SPECIALTY[tipoFallo] ?? Especialidad.GENERAL;
  }

  private filterByActiveShift(tecnicos: Tecnico[]): Tecnico[] {
    const turno = getCurrentTurno();
    const inShift = tecnicos.filter(
      (t) => t.turno === turno && t.disponibilidad !== EstadoTecnico.FUERA_DE_TURNO,
    );
    return inShift.length
      ? inShift
      : tecnicos.filter((t) => t.disponibilidad !== EstadoTecnico.FUERA_DE_TURNO);
  }

  async findAll(
    query: PaginationQueryDto & {
      estado?: EstadoTecnico;
      especialidad?: Especialidad;
      turno?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.estado) where.disponibilidad = query.estado;
    if (query.turno) where.turno = query.turno;

    const { rows, count } = await this.tecnicoModel.findAndCountAll({
      where,
      include: [{ model: Usuario }, { model: EspecialidadModel }],
      offset: (page - 1) * limit,
      limit,
      order: [['idTecnico', 'ASC']],
    });

    let filtered = rows;
    if (query.especialidad) {
      filtered = rows.filter(
        (t) => t.especialidadRef?.nombre === query.especialidad,
      );
    }

    const statsMap = await this.loadAssignmentStats(filtered.map((t) => t.idTecnico));

    return paginate(
      filtered.map((t) =>
        this.toResponse(t, statsMap.get(t.idTecnico) ?? { maquinas: [], ordenesHoy: 0 }),
      ),
      query.especialidad ? filtered.length : count,
      page,
      limit,
    );
  }

  async findOne(id: number) {
    const t = await this.tecnicoModel.findByPk(id, {
      include: [{ model: Usuario }, { model: EspecialidadModel }],
    });
    if (!t) throw new NotFoundException('Técnico no encontrado');
    const statsMap = await this.loadAssignmentStats([t.idTecnico]);
    return this.toResponse(t, statsMap.get(t.idTecnico) ?? { maquinas: [], ordenesHoy: 0 });
  }

  async create(dto: CreateTechnicianDto) {
    const esp = await this.especialidadModel.findOne({
      where: { nombre: dto.especialidad },
    });
    if (!esp) throw new NotFoundException('Especialidad no encontrada');

    const [nombres, ...rest] = dto.nombre.split(' ');
    const usuario = await this.usuarioModel.create({
      idRol: 1,
      nombres: nombres ?? dto.nombre,
      apellidos: rest.join(' ') || '-',
      correo: dto.email ?? `${Date.now()}@planta.pe`,
      passwordHash: '$2b$10$FCywzye.uD3YVdILNKo.te09gVSMP0clcaRciOpVXpnxjPuRaM7iS',
      telefono: dto.telefono,
      estado: 'activo',
    });

    const t = await this.tecnicoModel.create({
      idUsuario: usuario.idUsuario,
      idEspecialidad: esp.idEspecialidad,
      turno: dto.turno,
      disponibilidad: EstadoTecnico.DISPONIBLE,
    });
    return this.findOne(t.idTecnico);
  }

  async update(id: number, dto: UpdateTechnicianDto) {
    const t = await this.tecnicoModel.findByPk(id, { include: [{ model: Usuario }] });
    if (!t) throw new NotFoundException('Técnico no encontrado');

    if (dto.nombre && t.usuario) {
      const [nombres, ...rest] = dto.nombre.split(' ');
      await t.usuario.update({
        nombres: nombres ?? dto.nombre,
        apellidos: rest.join(' ') || t.usuario.apellidos,
      });
    }
    if (dto.especialidad) {
      const esp = await this.especialidadModel.findOne({ where: { nombre: dto.especialidad } });
      if (esp) await t.update({ idEspecialidad: esp.idEspecialidad });
    }
    await t.update({
      ...(dto.turno && { turno: dto.turno }),
      ...(dto.estado && { disponibilidad: dto.estado }),
    });
    if (dto.telefono && t.usuario) {
      await t.usuario.update({ telefono: dto.telefono });
    }
    if (dto.email && t.usuario) {
      await t.usuario.update({ correo: dto.email });
    }
    return this.findOne(id);
  }

  async remove(id: number) {
    const t = await this.tecnicoModel.findByPk(id, { include: [{ model: Usuario }] });
    if (!t) throw new NotFoundException('Técnico no encontrado');
    if (t.usuario) await t.usuario.update({ estado: 'inactivo' });
    return { ok: true };
  }

  async findAvailable(nivelRiesgo?: string, tipoFallo?: string) {
    const disponibles = await this.tecnicoModel.findAll({
      where: { disponibilidad: EstadoTecnico.DISPONIBLE },
      include: [{ model: Usuario, where: { estado: 'activo' } }, { model: EspecialidadModel }],
    });
    if (!disponibles.length) return [];

    const inShift = this.filterByActiveShift(disponibles);
    if (!inShift.length) return [];

    const nivel = (nivelRiesgo ?? NivelRiesgo.MEDIUM).toUpperCase();
    await this.reglaModel.findOne({ where: { nivelRiesgo: nivel } });

    if (nivel === NivelRiesgo.CRITICAL || nivel === NivelRiesgo.HIGH) {
      if (nivel === NivelRiesgo.CRITICAL) {
        return inShift
          .sort((a, b) => b.nivelExperiencia - a.nivelExperiencia)
          .map((t) => this.toResponse(t));
      }

      const esp = await this.resolveSpecialty(tipoFallo);
      if (esp) {
        const matched = inShift.filter((t) => t.especialidadRef?.nombre === esp);
        if (matched.length) return matched.map((t) => this.toResponse(t));
        if (esp === Especialidad.HIDRAULICO) {
          const mecanicos = inShift.filter(
            (t) => t.especialidadRef?.nombre === Especialidad.MECANICO,
          );
          if (mecanicos.length) return mecanicos.map((t) => this.toResponse(t));
        }
      }
      return inShift.map((t) => this.toResponse(t));
    }

    const withLoad = await Promise.all(
      inShift.map(async (t) => {
        const activas = await this.ordenModel.count({
          where: {
            idTecnico: t.idTecnico,
            estado: { [Op.in]: ['pendiente', 'en_progreso'] },
          },
        });
        return { t, activas };
      }),
    );
    return withLoad
      .sort((a, b) => a.activas - b.activas)
      .map(({ t }) => this.toResponse(t));
  }

  async assignForOrder(
    nivelRiesgo: NivelRiesgo,
    tipoFallo?: string,
  ): Promise<Tecnico | null> {
    const candidates = await this.findAvailable(nivelRiesgo, tipoFallo);
    if (!candidates.length) return null;
    const tecnico = await this.tecnicoModel.findByPk(candidates[0].id, {
      include: [{ model: Usuario }, { model: EspecialidadModel }],
    });
    if (!tecnico) return null;
    if (tecnico.disponibilidad === EstadoTecnico.DISPONIBLE) {
      await tecnico.update({ disponibilidad: EstadoTecnico.EN_INTERVENCION });
    }
    return tecnico;
  }
}
