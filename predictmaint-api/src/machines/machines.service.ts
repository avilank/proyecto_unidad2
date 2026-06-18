import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { findMaquinaByCodigo } from '../common/utils/maquina.util';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { CreateMachineDto, UpdateMachineDto } from './dto/machine.dto';

@Injectable()
export class MachinesService {
  constructor(
    @InjectModel(Maquina) private readonly maquinaModel: typeof Maquina,
    @InjectModel(LecturaSensor) private readonly lecturaModel: typeof LecturaSensor,
  ) {}

  toResponse(m: Maquina, ultimaLectura?: LecturaSensor | null) {
    return {
      id: m.codigo,
      tipo: m.tipoCalidad,
      estadoOperativo: m.estado,
      horasOperacion: 0,
      desgasteActual: ultimaLectura?.toolWear ?? 0,
      ultimoMantenimiento: null,
      proximaRevision: null,
      tecnicoAsignadoId: null,
      nombre: m.nombre,
      ...(ultimaLectura && {
        ultimaLectura: this.readingToResponse(ultimaLectura),
        kpis: {
          powerW: Number(ultimaLectura.powerW),
          toolWear: ultimaLectura.toolWear,
          rotationalSpeed: ultimaLectura.rotationalSpeed,
          torque: Number(ultimaLectura.torque),
        },
      }),
    };
  }

  readingToResponse(r: LecturaSensor) {
    const maquinaCodigo = r.maquina?.codigo;
    return {
      id: Number(r.idLectura),
      maquinaId: maquinaCodigo ?? String(r.idMaquina),
      tipo: r.tipoMaquina,
      airTemperature: Number(r.airTemperature),
      processTemperature: Number(r.processTemperature),
      rotationalSpeed: r.rotationalSpeed,
      torque: Number(r.torque),
      toolWear: r.toolWear,
      powerW: r.powerW != null ? Number(r.powerW) : null,
      capturadoEn: r.fechaLectura,
    };
  }

  async findAll(
    query: PaginationQueryDto & { estado?: string; tipo?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.estado) where.estado = query.estado;
    if (query.tipo) where.tipoCalidad = query.tipo;

    const { rows, count } = await this.maquinaModel.findAndCountAll({
      where,
      offset: (page - 1) * limit,
      limit,
      order: [['codigo', 'ASC']],
    });

    const latestByMachine = await this.loadLatestReadingsByMachine(rows.map((m) => m.idMaquina));

    return paginate(
      rows.map((m) => this.toResponse(m, latestByMachine.get(m.idMaquina) ?? null)),
      count,
      page,
      limit,
    );
  }

  private async loadLatestReadingsByMachine(
    machineIds: number[],
  ): Promise<Map<number, LecturaSensor>> {
    const map = new Map<number, LecturaSensor>();
    if (!machineIds.length) return map;

    const readings = await this.lecturaModel.findAll({
      where: { idMaquina: { [Op.in]: machineIds } },
      include: [{ model: Maquina }],
      order: [['fechaLectura', 'DESC']],
    });

    for (const reading of readings) {
      if (!map.has(reading.idMaquina)) {
        map.set(reading.idMaquina, reading);
      }
    }
    return map;
  }

  async findOne(id: string) {
    const m = await findMaquinaByCodigo(id);
    if (!m) throw new NotFoundException('Máquina no encontrada');
    const ultima = await this.lecturaModel.findOne({
      where: { idMaquina: m.idMaquina },
      include: [{ model: Maquina }],
      order: [['fechaLectura', 'DESC']],
    });
    return this.toResponse(m, ultima);
  }

  async getReadings(
    id: string,
    query: { from?: string; to?: string; limit?: number },
  ) {
    const m = await findMaquinaByCodigo(id);
    if (!m) throw new NotFoundException('Máquina no encontrada');

    const where: Record<string, unknown> = { idMaquina: m.idMaquina };
    if (query.from || query.to) {
      where.fechaLectura = {
        ...(query.from && { [Op.gte]: new Date(query.from) }),
        ...(query.to && { [Op.lte]: new Date(query.to) }),
      };
    }

    const rows = await this.lecturaModel.findAll({
      where,
      include: [{ model: Maquina }],
      order: [['fechaLectura', 'DESC']],
      limit: query.limit ?? 100,
    });
    return rows.map((r) => this.readingToResponse(r));
  }

  async create(dto: CreateMachineDto) {
    const m = await this.maquinaModel.create({
      codigo: dto.id,
      nombre: dto.id,
      tipoCalidad: dto.tipo,
      estado: dto.estadoOperativo,
      fechaRegistro: new Date(),
    });
    return this.toResponse(m);
  }

  async update(id: string, dto: UpdateMachineDto) {
    const m = await findMaquinaByCodigo(id);
    if (!m) throw new NotFoundException('Máquina no encontrada');
    await m.update({
      ...(dto.tipo && { tipoCalidad: dto.tipo }),
      ...(dto.estadoOperativo && { estado: dto.estadoOperativo }),
    });
    return this.findOne(id);
  }
}
