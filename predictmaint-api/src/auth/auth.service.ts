import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/models/usuario.model';
import { Tecnico } from '../database/models/tecnico.model';
import { Rol } from '../database/models/rol.model';
import { Especialidad } from '../database/models/especialidad.model';
import { CaslAbilityFactory } from '../common/casl/casl-ability.factory';
import { mapRolNombre, tecnicoNombre } from '../common/utils/tecnico-display.util';
import { RolUsuario } from '../common/enums';
import { LoginDto } from './dto/login.dto';

export interface AuthUserPayload {
  id: number;
  email: string;
  rol: RolUsuario;
  tecnicoId?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Usuario) private readonly usuarioModel: typeof Usuario,
    @InjectModel(Tecnico) private readonly tecnicoModel: typeof Tecnico,
    private readonly jwtService: JwtService,
    private readonly caslFactory: CaslAbilityFactory,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuarioModel.findOne({
      where: { correo: dto.email, estado: 'activo' },
      include: [{ model: Rol }, { model: Tecnico, include: [Usuario, Especialidad] }],
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tecnico = await this.tecnicoModel.findOne({
      where: { idUsuario: usuario.idUsuario },
    });

    const rol = mapRolNombre(usuario.rol?.nombre ?? 'operador');

    const payload: AuthUserPayload = {
      id: usuario.idUsuario,
      email: usuario.correo,
      rol,
      tecnicoId: tecnico?.idTecnico,
    };

    const accessToken = this.jwtService.sign(payload);
    const nombre = tecnico
      ? tecnicoNombre(await this.tecnicoModel.findByPk(tecnico.idTecnico, {
          include: [{ model: Usuario }],
        }) as Tecnico)
      : `${usuario.nombres} ${usuario.apellidos}`.trim();

    return {
      accessToken,
      user: {
        id: usuario.idUsuario,
        nombre,
        rol,
        tecnicoId: tecnico?.idTecnico ?? null,
      },
    };
  }

  async me(user: AuthUserPayload) {
    const usuario = await this.usuarioModel.findByPk(user.id, {
      include: [{ model: Rol }],
    });
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const tecnico = await this.tecnicoModel.findOne({
      where: { idUsuario: usuario.idUsuario },
      include: [{ model: Usuario }, { model: Especialidad }],
    });

    const rol = mapRolNombre(usuario.rol?.nombre ?? user.rol);

    const ability = this.caslFactory.createForUser({ id: usuario.idUsuario, rol });
    const permisos = ability.rules.map((r) => {
      const action = Array.isArray(r.action) ? r.action.join(',') : r.action;
      return `${action}:${String(r.subject)}`;
    });

    return {
      id: usuario.idUsuario,
      email: usuario.correo,
      nombre: tecnico ? tecnicoNombre(tecnico) : `${usuario.nombres} ${usuario.apellidos}`.trim(),
      rol,
      tecnicoId: tecnico?.idTecnico ?? null,
      permisos,
    };
  }

  logout() {
    return { ok: true };
  }
}
