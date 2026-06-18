import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Especialidad } from '../database/models/especialidad.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { ReglaAsignacion } from '../database/models/regla-asignacion.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Tecnico,
      Maquina,
      Orden,
      ReglaAsignacion,
      TipoFallo,
      Especialidad,
      Usuario,
    ]),
  ],
  controllers: [TechniciansController],
  providers: [TechniciansService],
  exports: [TechniciansService],
})
export class TechniciansModule {}
