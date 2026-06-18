import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';

@Module({
  imports: [SequelizeModule.forFeature([Maquina, LecturaSensor])],
  controllers: [MachinesController],
  providers: [MachinesService],
  exports: [MachinesService],
})
export class MachinesModule {}
