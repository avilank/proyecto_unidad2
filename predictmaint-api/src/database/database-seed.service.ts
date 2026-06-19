import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  ConfiguracionAlertas,
  Especialidad,
  FuenteRag,
  Maquina,
  ModeloMl,
  ReglaAsignacion,
  ReglaNotificacion,
  ReglaSensor,
  Rol,
  Tecnico,
  TipoFallo,
  Usuario,
} from './models';

const PASSWORD_HASH =
  '$2b$10$FCywzye.uD3YVdILNKo.te09gVSMP0clcaRciOpVXpnxjPuRaM7iS';

const REGLAS_NOTIFICACION = [
  { nivel: 'LOW', recibe: 'Nadie', canal: '—' },
  { nivel: 'MEDIUM', recibe: 'Técnico asignado', canal: 'WhatsApp texto' },
  { nivel: 'HIGH', recibe: 'Técnico asignado', canal: 'WhatsApp inmediato' },
  { nivel: 'CRITICAL', recibe: 'Técnico + Supervisor', canal: 'WhatsApp + Email' },
] as const;

@Injectable()
export class DatabaseSeedService {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async ensureReglasNotificacion(): Promise<void> {
    const count = await ReglaNotificacion.count();
    if (count > 0) {
      return;
    }
    await ReglaNotificacion.bulkCreate([...REGLAS_NOTIFICACION]);
    this.logger.log('Reglas de notificación cargadas (4 niveles).');
  }

  async seedIfEmpty(): Promise<void> {
    await this.ensureReglasNotificacion();

    const count = await Usuario.count();
    if (count > 0) {
      this.logger.log('Base ya poblada; seed omitido.');
      return;
    }

    this.logger.log('Poblando catálogos v2…');
    await this.sequelize.transaction(async (t) => {
      const tx = { transaction: t };

      await Rol.bulkCreate(
        [
          { nombre: 'operador', descripcion: 'Operador de planta' },
          { nombre: 'supervisor', descripcion: 'Supervisor de mantenimiento' },
          { nombre: 'jefe_planta', descripcion: 'Jefe de planta' },
        ],
        tx,
      );

      await Especialidad.bulkCreate(
        [
          { nombre: 'mecanico', descripcion: 'Mecánico / térmico' },
          { nombre: 'electrico', descripcion: 'Eléctrico' },
          { nombre: 'hidraulico', descripcion: 'Hidráulico' },
          { nombre: 'general', descripcion: 'Mantenimiento general' },
        ],
        tx,
      );

      await TipoFallo.bulkCreate(
        [
          { codigo: 'HDF', nombre: 'Heat Dissipation Failure', descripcion: 'Falla térmica' },
          { codigo: 'PWF', nombre: 'Power Failure', descripcion: 'Falla eléctrica' },
          { codigo: 'TWF', nombre: 'Tool Wear Failure', descripcion: 'Desgaste herramienta' },
          { codigo: 'OSF', nombre: 'Overstrain Failure', descripcion: 'Sobreesfuerzo' },
          { codigo: 'RNF', nombre: 'Random Failure', descripcion: 'Falla aleatoria' },
        ],
        tx,
      );

      await ModeloMl.bulkCreate(
        [
          { nombre: 'XGBoost', tipo: 'S1', esPrediccion: true, esDefault: true, accuracy: 93.1, rocAuc: 0.961, umbral: 0.5 },
          { nombre: 'Random Forest', tipo: 'S1', esPrediccion: true, accuracy: 91.8, rocAuc: 0.947, umbral: 0.5 },
          { nombre: 'Regresión Logística', tipo: 'S1', esPrediccion: true, accuracy: 78.3, rocAuc: 0.831, umbral: 0.5 },
          { nombre: 'LightGBM', tipo: 'S2', esClasificacion: true, esDefault: true, accuracy: 85.4, f1Score: 0.814 },
          { nombre: 'Decision Tree', tipo: 'S2', esClasificacion: true, accuracy: 79.1, f1Score: 0.763 },
          { nombre: 'SVM', tipo: 'S2', esClasificacion: true, accuracy: 76.8, f1Score: 0.701 },
        ],
        tx,
      );

      await FuenteRag.bulkCreate(
        [
          { titulo: 'Theissler et al. (2021)', autor: 'Theissler et al.', activo: true },
          { titulo: 'Pashmforoush et al. (2025)', autor: 'Pashmforoush et al.', activo: true },
          { titulo: 'Cai et al. (2023)', autor: 'Cai et al.', activo: true },
          { titulo: 'Araujo et al. (2025)', autor: 'Araujo et al.', activo: true },
          { titulo: 'Hesser & Markert (2019)', autor: 'Hesser & Markert', activo: true },
          { titulo: 'Jakobs et al. (2026)', autor: 'Jakobs et al.', activo: true },
        ],
        tx,
      );

      await ConfiguracionAlertas.create(
        {
          riesgoBajo: 0.4,
          riesgoMedio: 0.65,
          riesgoAlto: 0.85,
          riesgoCritico: 1.0,
          tiempoEscalamiento: 30,
          plantillaNotificacion: 'Alerta {{nivel}} en {{maquina}}',
          fechaActualizacion: new Date(),
        },
        tx,
      );

      const tipos = await TipoFallo.findAll(tx);
      const byCodigo = Object.fromEntries(tipos.map((t) => [t.codigo, t.idTipoFallo]));

      await ReglaSensor.bulkCreate(
        [
          { codigo: 'RN-01', descripcion: 'Umbral → HDF', idTipoFallo: byCodigo.HDF, activo: true },
          { codigo: 'RN-02', descripcion: 'Umbral → PWF', idTipoFallo: byCodigo.PWF, activo: true },
          { codigo: 'RN-03', descripcion: 'Umbral → TWF', idTipoFallo: byCodigo.TWF, activo: true },
          { codigo: 'RN-04', descripcion: 'Umbral → OSF', idTipoFallo: byCodigo.OSF, activo: true },
        ],
        tx,
      );

      const roles = await Rol.findAll(tx);
      const rolSupervisor = roles.find((r) => r.nombre === 'supervisor')!.idRol;
      const rolOperador = roles.find((r) => r.nombre === 'operador')!.idRol;

      const esp = await Especialidad.findAll(tx);
      const espByName = Object.fromEntries(esp.map((e) => [e.nombre, e.idEspecialidad]));

      await Usuario.bulkCreate(
        [
          {
            idRol: rolSupervisor,
            nombres: 'Operador',
            apellidos: 'Demo',
            correo: 'operador@planta.pe',
            passwordHash: PASSWORD_HASH,
            telefono: '+51 999 000 000',
            estado: 'activo',
          },
          {
            idRol: rolOperador,
            nombres: 'Henry',
            apellidos: 'Orbegoso',
            correo: 'henry.orbegoso@planta.pe',
            passwordHash: PASSWORD_HASH,
            telefono: '+51 999 111 001',
            estado: 'activo',
          },
          {
            idRol: rolOperador,
            nombres: 'Carlos',
            apellidos: 'Mendoza',
            correo: 'carlos.mendoza@planta.pe',
            passwordHash: PASSWORD_HASH,
            telefono: '+51 999 222 002',
            estado: 'activo',
          },
          {
            idRol: rolOperador,
            nombres: 'Luis',
            apellidos: 'Torres',
            correo: 'luis.torres@planta.pe',
            passwordHash: PASSWORD_HASH,
            telefono: '+51 999 333 003',
            estado: 'activo',
          },
          {
            idRol: rolOperador,
            nombres: 'María',
            apellidos: 'Vargas',
            correo: 'maria.vargas@planta.pe',
            passwordHash: PASSWORD_HASH,
            telefono: '+51 999 444 004',
            estado: 'activo',
          },
        ],
        tx,
      );

      const usuarios = await Usuario.findAll({ order: [['idUsuario', 'ASC']], ...tx });

      await Tecnico.bulkCreate(
        [
          {
            idUsuario: usuarios[1].idUsuario,
            idEspecialidad: espByName.mecanico,
            turno: 'mañana',
            nivelExperiencia: 3,
            disponibilidad: 'disponible',
            enviarWssp: true,
            enviarCorreo: false,
          },
          {
            idUsuario: usuarios[2].idUsuario,
            idEspecialidad: espByName.electrico,
            turno: 'tarde',
            nivelExperiencia: 2,
            disponibilidad: 'disponible',
            enviarWssp: true,
            enviarCorreo: false,
          },
          {
            idUsuario: usuarios[3].idUsuario,
            idEspecialidad: espByName.general,
            turno: 'noche',
            nivelExperiencia: 2,
            disponibilidad: 'disponible',
            enviarWssp: true,
            enviarCorreo: false,
          },
          {
            idUsuario: usuarios[4].idUsuario,
            idEspecialidad: espByName.hidraulico,
            turno: 'mañana',
            nivelExperiencia: 3,
            disponibilidad: 'disponible',
            enviarWssp: true,
            enviarCorreo: false,
          },
        ],
        tx,
      );

      await Maquina.bulkCreate(
        [
          { codigo: 'M-001', nombre: 'Torno CNC A', modelo: 'CNC-2000', ubicacion: 'Línea 1', tipoCalidad: 'H', estado: 'operacion', fechaRegistro: new Date('2026-01-15') },
          { codigo: 'M-002', nombre: 'Fresadora B', modelo: 'FR-850', ubicacion: 'Línea 2', tipoCalidad: 'M', estado: 'operacion', fechaRegistro: new Date('2026-01-15') },
          { codigo: 'M-003', nombre: 'Prensa hidráulica C', modelo: 'PH-500', ubicacion: 'Línea 3', tipoCalidad: 'L', estado: 'operacion', fechaRegistro: new Date('2026-01-15') },
          { codigo: 'M-004', nombre: 'Torno CNC D', modelo: 'CNC-1800', ubicacion: 'Línea 1', tipoCalidad: 'H', estado: 'alerta', fechaRegistro: new Date('2026-01-20') },
          { codigo: 'M-005', nombre: 'Centro mecanizado E', modelo: 'CM-1200', ubicacion: 'Línea 4', tipoCalidad: 'M', estado: 'operacion', fechaRegistro: new Date('2026-02-01') },
        ],
        tx,
      );

      await ReglaAsignacion.bulkCreate(
        [
          { idTipoFallo: byCodigo.HDF, idEspecialidad: espByName.mecanico, nivelRiesgo: 'HIGH', prioridad: 1, activo: true },
          { idTipoFallo: byCodigo.PWF, idEspecialidad: espByName.electrico, nivelRiesgo: 'HIGH', prioridad: 1, activo: true },
          { idTipoFallo: byCodigo.TWF, idEspecialidad: espByName.mecanico, nivelRiesgo: 'HIGH', prioridad: 1, activo: true },
          { idTipoFallo: byCodigo.OSF, idEspecialidad: espByName.mecanico, nivelRiesgo: 'HIGH', prioridad: 1, activo: true },
          { idTipoFallo: byCodigo.RNF, idEspecialidad: espByName.general, nivelRiesgo: 'HIGH', prioridad: 1, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.mecanico, nivelRiesgo: 'CRITICAL', prioridad: 1, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.electrico, nivelRiesgo: 'CRITICAL', prioridad: 1, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.hidraulico, nivelRiesgo: 'CRITICAL', prioridad: 1, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.general, nivelRiesgo: 'CRITICAL', prioridad: 1, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.mecanico, nivelRiesgo: 'MEDIUM', prioridad: 2, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.electrico, nivelRiesgo: 'MEDIUM', prioridad: 2, activo: true },
          { idTipoFallo: null, idEspecialidad: espByName.general, nivelRiesgo: 'MEDIUM', prioridad: 2, activo: true },
        ],
        tx,
      );
    });

    this.logger.log('Seed v2 completado.');
  }
}
