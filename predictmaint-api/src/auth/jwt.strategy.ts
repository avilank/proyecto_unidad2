import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/sequelize';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Usuario } from '../database/models/usuario.model';
import { AuthUserPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(Usuario) private readonly usuarioModel: typeof Usuario,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: AuthUserPayload): Promise<AuthUserPayload> {
    const usuario = await this.usuarioModel.findByPk(payload.id);
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
