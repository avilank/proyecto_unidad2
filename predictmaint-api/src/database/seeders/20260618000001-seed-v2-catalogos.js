'use strict';

const REGLAS_NOTIFICACION = require('./data/reglas-notificacion.data');

const PASSWORD_HASH =
  '$2b$10$FCywzye.uD3YVdILNKo.te09gVSMP0clcaRciOpVXpnxjPuRaM7iS'; // password123

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('roles', [
      { id_rol: 1, nombre: 'operador', descripcion: 'Operador de planta' },
      { id_rol: 2, nombre: 'supervisor', descripcion: 'Supervisor de mantenimiento' },
      { id_rol: 3, nombre: 'jefe_planta', descripcion: 'Jefe de planta' },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('roles', 'id_rol'), 3, true);",
    );

    await queryInterface.bulkInsert('especialidades', [
      { id_especialidad: 1, nombre: 'mecanico', descripcion: 'Mecánico / térmico' },
      { id_especialidad: 2, nombre: 'electrico', descripcion: 'Eléctrico' },
      { id_especialidad: 3, nombre: 'hidraulico', descripcion: 'Hidráulico' },
      { id_especialidad: 4, nombre: 'general', descripcion: 'Mantenimiento general' },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('especialidades', 'id_especialidad'), 4, true);",
    );

    await queryInterface.bulkInsert('tipos_fallo', [
      {
        id_tipo_fallo: 1,
        codigo: 'HDF',
        nombre: 'Heat Dissipation Failure',
        descripcion: 'Falla por disipación térmica insuficiente',
      },
      {
        id_tipo_fallo: 2,
        codigo: 'PWF',
        nombre: 'Power Failure',
        descripcion: 'Falla eléctrica / de potencia',
      },
      {
        id_tipo_fallo: 3,
        codigo: 'TWF',
        nombre: 'Tool Wear Failure',
        descripcion: 'Desgaste de herramienta',
      },
      {
        id_tipo_fallo: 4,
        codigo: 'OSF',
        nombre: 'Overstrain Failure',
        descripcion: 'Sobreesfuerzo mecánico',
      },
      {
        id_tipo_fallo: 5,
        codigo: 'RNF',
        nombre: 'Random Failure',
        descripcion: 'Falla aleatoria — inspección manual',
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('tipos_fallo', 'id_tipo_fallo'), 5, true);",
    );

    await queryInterface.bulkInsert('modelos_ml', [
      {
        id_modelo: 1,
        nombre: 'XGBoost',
        tipo: 'S1',
        version: '1.0',
        accuracy: 93.1,
        roc_auc: 0.961,
        precision_score: null,
        recall_score: null,
        f1_score: null,
        es_prediccion: true,
        es_clasificacion: false,
        umbral: 0.5,
        es_default: true,
      },
      {
        id_modelo: 2,
        nombre: 'Random Forest',
        tipo: 'S1',
        version: '1.0',
        accuracy: 91.8,
        roc_auc: 0.947,
        es_prediccion: true,
        es_clasificacion: false,
        umbral: 0.5,
        es_default: false,
      },
      {
        id_modelo: 3,
        nombre: 'Regresión Logística',
        tipo: 'S1',
        version: '1.0',
        accuracy: 78.3,
        roc_auc: 0.831,
        es_prediccion: true,
        es_clasificacion: false,
        umbral: 0.5,
        es_default: false,
      },
      {
        id_modelo: 4,
        nombre: 'LightGBM',
        tipo: 'S2',
        version: '1.0',
        accuracy: 85.4,
        f1_score: 0.814,
        es_prediccion: false,
        es_clasificacion: true,
        es_default: true,
      },
      {
        id_modelo: 5,
        nombre: 'Decision Tree',
        tipo: 'S2',
        version: '1.0',
        accuracy: 79.1,
        f1_score: 0.763,
        es_prediccion: false,
        es_clasificacion: true,
        es_default: false,
      },
      {
        id_modelo: 6,
        nombre: 'SVM',
        tipo: 'S2',
        version: '1.0',
        accuracy: 76.8,
        f1_score: 0.701,
        es_prediccion: false,
        es_clasificacion: true,
        es_default: false,
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('modelos_ml', 'id_modelo'), 6, true);",
    );

    await queryInterface.bulkInsert('fuentes_rag', [
      {
        id_fuente: 1,
        titulo: 'Theissler et al. (2021)',
        autor: 'Theissler et al.',
        url: null,
        activo: true,
      },
      {
        id_fuente: 2,
        titulo: 'Pashmforoush et al. (2025)',
        autor: 'Pashmforoush et al.',
        activo: true,
      },
      {
        id_fuente: 3,
        titulo: 'Cai et al. (2023)',
        autor: 'Cai et al.',
        activo: true,
      },
      {
        id_fuente: 4,
        titulo: 'Araujo et al. (2025)',
        autor: 'Araujo et al.',
        activo: true,
      },
      {
        id_fuente: 5,
        titulo: 'Hesser & Markert (2019)',
        autor: 'Hesser & Markert',
        activo: true,
      },
      {
        id_fuente: 6,
        titulo: 'Jakobs et al. (2026)',
        autor: 'Jakobs et al.',
        activo: true,
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('fuentes_rag', 'id_fuente'), 6, true);",
    );

    await queryInterface.bulkInsert('configuracion_alertas', [
      {
        id_config_alerta: 1,
        riesgo_bajo: 0.4,
        riesgo_medio: 0.65,
        riesgo_alto: 0.85,
        riesgo_critico: 1.0,
        tiempo_escalamiento: 30,
        plantilla_notificacion:
          'Alerta {{nivel}} en {{maquina}} — técnico {{tecnico}}',
        fecha_actualizacion: new Date(),
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('configuracion_alertas', 'id_config_alerta'), 1, true);",
    );

    await queryInterface.bulkInsert('reglas_sensor', [
      { id_regla: 1, codigo: 'RN-01', descripcion: 'Umbral disparado → HDF', id_tipo_fallo: 1, activo: true },
      { id_regla: 2, codigo: 'RN-02', descripcion: 'Umbral disparado → PWF', id_tipo_fallo: 2, activo: true },
      { id_regla: 3, codigo: 'RN-03', descripcion: 'Umbral disparado → TWF', id_tipo_fallo: 3, activo: true },
      { id_regla: 4, codigo: 'RN-04', descripcion: 'Umbral disparado → OSF', id_tipo_fallo: 4, activo: true },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('reglas_sensor', 'id_regla'), 4, true);",
    );

    await queryInterface.bulkInsert('regla_notificacion', REGLAS_NOTIFICACION, {
      ignoreDuplicates: true,
    });

    await queryInterface.bulkInsert('usuarios', [
      {
        id_usuario: 1,
        id_rol: 2,
        nombres: 'Operador',
        apellidos: 'Demo',
        correo: 'operador@planta.pe',
        password_hash: PASSWORD_HASH,
        telefono: '+51 999 000 000',
        estado: 'activo',
      },
      {
        id_usuario: 2,
        id_rol: 1,
        nombres: 'Henry',
        apellidos: 'Orbegoso',
        correo: 'henry.orbegoso@planta.pe',
        password_hash: PASSWORD_HASH,
        telefono: '+51 999 111 001',
        estado: 'activo',
      },
      {
        id_usuario: 3,
        id_rol: 1,
        nombres: 'Carlos',
        apellidos: 'Mendoza',
        correo: 'carlos.mendoza@planta.pe',
        password_hash: PASSWORD_HASH,
        telefono: '+51 999 222 002',
        estado: 'activo',
      },
      {
        id_usuario: 4,
        id_rol: 1,
        nombres: 'Luis',
        apellidos: 'Torres',
        correo: 'luis.torres@planta.pe',
        password_hash: PASSWORD_HASH,
        telefono: '+51 999 333 003',
        estado: 'activo',
      },
      {
        id_usuario: 5,
        id_rol: 1,
        nombres: 'María',
        apellidos: 'Vargas',
        correo: 'maria.vargas@planta.pe',
        password_hash: PASSWORD_HASH,
        telefono: '+51 999 444 004',
        estado: 'activo',
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'), 5, true);",
    );

    await queryInterface.bulkInsert('tecnicos', [
      {
        id_tecnico: 1,
        id_usuario: 2,
        id_especialidad: 1,
        disponibilidad: 'disponible',
        enviar_wssp: true,
        enviar_correo: false,
        turno: 'mañana',
        nivel_experiencia: 3,
      },
      {
        id_tecnico: 2,
        id_usuario: 3,
        id_especialidad: 2,
        disponibilidad: 'disponible',
        enviar_wssp: true,
        enviar_correo: false,
        turno: 'tarde',
        nivel_experiencia: 2,
      },
      {
        id_tecnico: 3,
        id_usuario: 4,
        id_especialidad: 4,
        disponibilidad: 'disponible',
        enviar_wssp: true,
        enviar_correo: false,
        turno: 'noche',
        nivel_experiencia: 2,
      },
      {
        id_tecnico: 4,
        id_usuario: 5,
        id_especialidad: 3,
        disponibilidad: 'disponible',
        enviar_wssp: true,
        enviar_correo: false,
        turno: 'mañana',
        nivel_experiencia: 3,
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('tecnicos', 'id_tecnico'), 4, true);",
    );

    await queryInterface.bulkInsert('maquinas', [
      {
        id_maquina: 1,
        codigo: 'M-001',
        nombre: 'Torno CNC A',
        modelo: 'CNC-2000',
        ubicacion: 'Línea 1',
        tipo_calidad: 'H',
        estado: 'operacion',
        fecha_registro: new Date('2026-01-15'),
      },
      {
        id_maquina: 2,
        codigo: 'M-002',
        nombre: 'Fresadora B',
        modelo: 'FR-850',
        ubicacion: 'Línea 2',
        tipo_calidad: 'M',
        estado: 'operacion',
        fecha_registro: new Date('2026-01-15'),
      },
      {
        id_maquina: 3,
        codigo: 'M-003',
        nombre: 'Prensa hidráulica C',
        modelo: 'PH-500',
        ubicacion: 'Línea 3',
        tipo_calidad: 'L',
        estado: 'operacion',
        fecha_registro: new Date('2026-01-15'),
      },
      {
        id_maquina: 4,
        codigo: 'M-004',
        nombre: 'Torno CNC D',
        modelo: 'CNC-1800',
        ubicacion: 'Línea 1',
        tipo_calidad: 'H',
        estado: 'alerta',
        fecha_registro: new Date('2026-01-20'),
      },
      {
        id_maquina: 5,
        codigo: 'M-005',
        nombre: 'Centro mecanizado E',
        modelo: 'CM-1200',
        ubicacion: 'Línea 4',
        tipo_calidad: 'M',
        estado: 'operacion',
        fecha_registro: new Date('2026-02-01'),
      },
    ]);
    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('maquinas', 'id_maquina'), 5, true);",
    );

    await queryInterface.bulkInsert('reglas_asignacion', [
      { id_tipo_fallo: 1, id_especialidad: 1, nivel_riesgo: 'HIGH', prioridad: 1, activo: true },
      { id_tipo_fallo: 2, id_especialidad: 2, nivel_riesgo: 'HIGH', prioridad: 1, activo: true },
      { id_tipo_fallo: 3, id_especialidad: 1, nivel_riesgo: 'HIGH', prioridad: 1, activo: true },
      { id_tipo_fallo: 4, id_especialidad: 1, nivel_riesgo: 'HIGH', prioridad: 1, activo: true },
      { id_tipo_fallo: 5, id_especialidad: 4, nivel_riesgo: 'HIGH', prioridad: 1, activo: true },
      { id_tipo_fallo: null, id_especialidad: 1, nivel_riesgo: 'CRITICAL', prioridad: 1, activo: true },
      { id_tipo_fallo: null, id_especialidad: 2, nivel_riesgo: 'CRITICAL', prioridad: 1, activo: true },
      { id_tipo_fallo: null, id_especialidad: 3, nivel_riesgo: 'CRITICAL', prioridad: 1, activo: true },
      { id_tipo_fallo: null, id_especialidad: 4, nivel_riesgo: 'CRITICAL', prioridad: 1, activo: true },
      { id_tipo_fallo: null, id_especialidad: 1, nivel_riesgo: 'MEDIUM', prioridad: 2, activo: true },
      { id_tipo_fallo: null, id_especialidad: 2, nivel_riesgo: 'MEDIUM', prioridad: 2, activo: true },
      { id_tipo_fallo: null, id_especialidad: 4, nivel_riesgo: 'MEDIUM', prioridad: 2, activo: true },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('regla_notificacion', null, {});
    await queryInterface.bulkDelete('reglas_asignacion', null, {});
    await queryInterface.bulkDelete('maquinas', null, {});
    await queryInterface.bulkDelete('tecnicos', null, {});
    await queryInterface.bulkDelete('usuarios', null, {});
    await queryInterface.bulkDelete('reglas_sensor', null, {});
    await queryInterface.bulkDelete('configuracion_alertas', null, {});
    await queryInterface.bulkDelete('fuentes_rag', null, {});
    await queryInterface.bulkDelete('modelos_ml', null, {});
    await queryInterface.bulkDelete('tipos_fallo', null, {});
    await queryInterface.bulkDelete('especialidades', null, {});
    await queryInterface.bulkDelete('roles', null, {});
  },
};
