import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Usuario } from '../database/models/usuario.model';
import { Rol } from '../database/models/rol.model';
import { mapRolNombre } from '../common/utils/tecnico-display.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(Usuario) private readonly usuarioModel: typeof Usuario) {}

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
}
