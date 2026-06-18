'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('regla_asignacion', [
      {
        nivel_riesgo: 'CRITICAL',
        criterio:
          'Técnico disponible de mayor experiencia en turno',
        fallback: 'Escala a supervisor',
      },
      {
        nivel_riesgo: 'HIGH',
        criterio:
          'Técnico disponible cuya especialidad coincida con el tipo de fallo',
        fallback: 'Escala a supervisor',
      },
      {
        nivel_riesgo: 'MEDIUM',
        criterio:
          'Técnico con menor carga de órdenes activas',
        fallback: 'Escala a supervisor',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('regla_asignacion', {
      nivel_riesgo: ['CRITICAL', 'HIGH', 'MEDIUM'],
    });
  },
};
