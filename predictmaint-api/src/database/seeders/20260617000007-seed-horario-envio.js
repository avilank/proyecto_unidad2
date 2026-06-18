'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('horario_envio', [
      {
        evento: 'Inicio de turno siguiente',
        hora: '06:00',
        destinatario: 'Técnico entrante',
        contenido: 'Resumen turno anterior',
      },
      {
        evento: 'Mitad de turno',
        hora: '14:00',
        destinatario: 'Supervisor en turno',
        contenido: 'Estado parcial',
      },
      {
        evento: 'Fin de turno',
        hora: '22:00',
        destinatario: 'Todos',
        contenido: 'Resumen total',
      },
      {
        evento: 'Alerta CRITICAL',
        hora: 'inmediato',
        destinatario: 'Técnico + Supervisor',
        contenido: 'Instantáneo al detectar riesgo crítico',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('horario_envio', {
      evento: [
        'Inicio de turno siguiente',
        'Mitad de turno',
        'Fin de turno',
        'Alerta CRITICAL',
      ],
    });
  },
};
