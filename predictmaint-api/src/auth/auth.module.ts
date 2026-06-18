import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SequelizeModule } from '@nestjs/sequelize';
import authConfig from '../config/auth.config';
import { CaslAbilityFactory } from '../common/casl/casl-ability.factory';
import { Especialidad } from '../database/models/especialidad.model';
import { Rol } from '../database/models/rol.model';
import { Usuario } from '../database/models/usuario.model';
import { Tecnico } from '../database/models/tecnico.model';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: config.get<string>('auth.jwtExpiresIn'),
        },
      }),
    }),
    SequelizeModule.forFeature([Usuario, Tecnico, Rol, Especialidad]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CaslAbilityFactory],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
