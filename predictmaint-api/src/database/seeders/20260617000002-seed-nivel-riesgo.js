'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('nivel_riesgo', [
      {
        nivel: 'LOW',
        min: 0.0,
        max: 0.4,
        accion: 'Monitorear, sin alerta',
        tiempo_limite: 'No aplica',
        escala_a: null,
      },
      {
        nivel: 'MEDIUM',
        min: 0.4,
        max: 0.65,
        accion: 'Notificar al técnico',
        tiempo_limite: '2 horas',
        escala_a: 'Supervisor',
      },
      {
        nivel: 'HIGH',
        min: 0.65,
        max: 0.85,
        accion: 'Notificación inmediata',
        tiempo_limite: '30 min',
        escala_a: 'Supervisor + Jefe de planta',
      },
      {
        nivel: 'CRITICAL',
        min: 0.85,
        max: 1.0,
        accion: 'Parada controlada < 30 min',
        tiempo_limite: '15 min',
        escala_a: 'Supervisor + Jefe de planta',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('nivel_riesgo', {
      nivel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    });
  },
};
