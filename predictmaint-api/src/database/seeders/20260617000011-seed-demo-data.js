'use strict';

const PASSWORD_HASH =
  '$2b$10$FCywzye.uD3YVdILNKo.te09gVSMP0clcaRciOpVXpnxjPuRaM7iS'; // password123

/** @param {number} torque @param {number} rpm */
function calcPowerW(torque, rpm) {
  return Math.round(((torque * rpm * 2 * Math.PI) / 60) * 100) / 100;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tecnico', [
      {
        id: 1,
        nombre: 'Henry Orbegoso',
        iniciales: 'HO',
        especialidad: 'mecanico',
        turno: 'mañana',
        estado: 'disponible',
        telefono: '+51 999 111 001',
        email: 'henry.orbegoso@planta.pe',
        nivel_experiencia: 3,
        ordenes_hoy: 1,
        activo: true,
      },
      {
        id: 2,
        nombre: 'Carlos Mendoza',
        iniciales: 'CM',
        especialidad: 'electrico',
        turno: 'tarde',
        estado: 'disponible',
        telefono: '+51 999 222 002',
        email: 'carlos.mendoza@planta.pe',
        nivel_experiencia: 2,
        ordenes_hoy: 0,
        activo: true,
      },
      {
        id: 3,
        nombre: 'Luis Torres',
        iniciales: 'LT',
        especialidad: 'general',
        turno: 'noche',
        estado: 'disponible',
        telefono: '+51 999 333 003',
        email: 'luis.torres@planta.pe',
        nivel_experiencia: 2,
        ordenes_hoy: 0,
        activo: true,
      },
      {
        id: 4,
        nombre: 'María Vargas',
        iniciales: 'MV',
        especialidad: 'hidraulico',
        turno: 'mañana',
        estado: 'disponible',
        telefono: '+51 999 444 004',
        email: 'maria.vargas@planta.pe',
        nivel_experiencia: 3,
        ordenes_hoy: 0,
        activo: true,
      },
    ]);

    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('tecnico', 'id'), 4, true);",
    );

    await queryInterface.bulkInsert('usuario', [
      {
        email: 'operador@planta.pe',
        password_hash: PASSWORD_HASH,
        rol: 'supervisor',
        tecnico_id: null,
        activo: true,
        creado_en: new Date('2026-06-01T08:00:00Z'),
      },
    ]);

    await queryInterface.bulkInsert('maquina', [
      {
        id: 'M-001',
        tipo: 'H',
        estado_operativo: 'operacion',
        horas_operacion: 1240,
        desgaste_actual: 185,
        ultimo_mantenimiento: '2026-04-15',
        proxima_revision: '2026-07-15',
        tecnico_asignado_id: 1,
      },
      {
        id: 'M-002',
        tipo: 'M',
        estado_operativo: 'operacion',
        horas_operacion: 980,
        desgaste_actual: 120,
        ultimo_mantenimiento: '2026-03-20',
        proxima_revision: '2026-06-20',
        tecnico_asignado_id: 2,
      },
      {
        id: 'M-003',
        tipo: 'L',
        estado_operativo: 'operacion',
        horas_operacion: 2100,
        desgaste_actual: 45,
        ultimo_mantenimiento: '2026-05-01',
        proxima_revision: '2026-08-01',
        tecnico_asignado_id: 3,
      },
      {
        id: 'M-004',
        tipo: 'H',
        estado_operativo: 'alerta',
        horas_operacion: 1560,
        desgaste_actual: 200,
        ultimo_mantenimiento: '2026-02-10',
        proxima_revision: '2026-06-10',
        tecnico_asignado_id: 1,
      },
      {
        id: 'M-005',
        tipo: 'M',
        estado_operativo: 'mantenimiento',
        horas_operacion: 890,
        desgaste_actual: 0,
        ultimo_mantenimiento: '2026-06-10',
        proxima_revision: '2026-09-10',
        tecnico_asignado_id: 2,
      },
    ]);

    const readings = [
      {
        maquina_id: 'M-001',
        product_id: 'M14860',
        tipo: 'H',
        air_temperature: 298.5,
        process_temperature: 304.7,
        rotational_speed: 1240,
        torque: 42.8,
        tool_wear: 185,
        capturado_en: new Date('2026-05-28T14:32:00Z'),
      },
      {
        maquina_id: 'M-001',
        product_id: 'M14860',
        tipo: 'H',
        air_temperature: 298.2,
        process_temperature: 309.1,
        rotational_speed: 1320,
        torque: 45.2,
        tool_wear: 188,
        capturado_en: new Date('2026-05-28T15:00:00Z'),
      },
      {
        maquina_id: 'M-002',
        product_id: 'M14865',
        tipo: 'M',
        air_temperature: 298.1,
        process_temperature: 308.6,
        rotational_speed: 1425,
        torque: 41.9,
        tool_wear: 120,
        capturado_en: new Date('2026-05-28T14:00:00Z'),
      },
      {
        maquina_id: 'M-003',
        product_id: 'L47181',
        tipo: 'L',
        air_temperature: 298.2,
        process_temperature: 308.7,
        rotational_speed: 1408,
        torque: 46.3,
        tool_wear: 45,
        capturado_en: new Date('2026-05-28T13:45:00Z'),
      },
      {
        maquina_id: 'M-004',
        product_id: 'M14868',
        tipo: 'H',
        air_temperature: 298.3,
        process_temperature: 310.2,
        rotational_speed: 1180,
        torque: 52.1,
        tool_wear: 200,
        capturado_en: new Date('2026-05-28T16:10:00Z'),
      },
      {
        maquina_id: 'M-005',
        product_id: 'L47184',
        tipo: 'M',
        air_temperature: 298.2,
        process_temperature: 308.7,
        rotational_speed: 1408,
        torque: 40.0,
        tool_wear: 0,
        capturado_en: new Date('2026-05-27T10:00:00Z'),
      },
    ].map((r) => ({
      ...r,
      power_w: calcPowerW(r.torque, r.rotational_speed),
    }));

    await queryInterface.bulkInsert('lectura_sensor', readings);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('lectura_sensor', {
      maquina_id: ['M-001', 'M-002', 'M-003', 'M-004', 'M-005'],
    });
    await queryInterface.bulkDelete('maquina', {
      id: ['M-001', 'M-002', 'M-003', 'M-004', 'M-005'],
    });
    await queryInterface.bulkDelete('usuario', {
      email: 'operador@planta.pe',
    });
    await queryInterface.bulkDelete('tecnico', {
      id: [1, 2, 3],
    });
  },
};
