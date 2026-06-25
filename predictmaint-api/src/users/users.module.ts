import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Rol } from '../database/models/rol.model';
import { Usuario } from '../database/models/usuario.model';
import { Tecnico } from '../database/models/tecnico.model';
import { Especialidad } from '../database/models/especialidad.model';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SequelizeModule.forFeature([Usuario, Rol, Tecnico, Especialidad])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
