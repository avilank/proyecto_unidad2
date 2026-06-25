import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Usuario } from '../database/models/usuario.model';
import { Rol } from '../database/models/rol.model';
import { Tecnico } from '../database/models/tecnico.model';
import { Especialidad } from '../database/models/especialidad.model';
import { mapRolNombre } from '../common/utils/tecnico-display.util';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(Usuario) private readonly usuarioModel: typeof Usuario,
    @InjectModel(Tecnico) private readonly tecnicoModel: typeof Tecnico,
  ) {}

  async findAll() {
    const rows = await this.usuarioModel.findAll({
      include: [{ model: Rol }],
      order: [['idUsuario', 'ASC']],
    });
    return rows.map((u) => ({
      id: u.idUsuario,
      email: u.correo,
      rol: mapRolNombre(u.rol?.nombre ?? 'operador'),
      activo: u.estado === 'activo',
    }));
  }

  async findOne(id: number) {
    const u = await this.usuarioModel.findByPk(id, { include: [{ model: Rol }] });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return {
      id: u.idUsuario,
      email: u.correo,
      rol: mapRolNombre(u.rol?.nombre ?? 'operador'),
      activo: u.estado === 'activo',
    };
  }

  async getProfile(userId: number) {
    const u = await this.usuarioModel.findByPk(userId, { include: [{ model: Rol }] });
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const tecnico = await this.tecnicoModel.findOne({
      where: { idUsuario: userId },
      include: [{ model: Especialidad }],
    });

    return {
      id: u.idUsuario,
      nombre: `${u.nombres} ${u.apellidos}`.trim(),
      email: u.correo,
      telefono: u.telefono ?? '',
      rol: mapRolNombre(u.rol?.nombre ?? 'operador'),
      estado: u.estado,
      esTecnico: Boolean(tecnico),
      especialidad: tecnico?.especialidadRef?.nombre ?? null,
      turno: tecnico?.turno ?? null,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const u = await this.usuarioModel.findByPk(userId);
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const patch: Partial<Usuario> = {};
    if (dto.nombre?.trim()) {
      const [nombres, ...rest] = dto.nombre.trim().split(/\s+/);
      patch.nombres = nombres;
      patch.apellidos = rest.join(' ') || u.apellidos;
    }
    if (dto.telefono !== undefined) {
      patch.telefono = dto.telefono?.trim() || undefined;
    }
    await u.update(patch);

    return this.getProfile(userId);
  }
}
