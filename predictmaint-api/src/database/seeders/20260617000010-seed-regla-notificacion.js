'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('regla_notificacion', [
      {
        nivel: 'LOW',
        recibe: 'Nadie',
        canal: '—',
      },
      {
        nivel: 'MEDIUM',
        recibe: 'Técnico asignado',
        canal: 'WhatsApp texto',
      },
      {
        nivel: 'HIGH',
        recibe: 'Técnico asignado',
        canal: 'WhatsApp inmediato',
      },
      {
        nivel: 'CRITICAL',
        recibe: 'Técnico + Supervisor',
        canal: 'WhatsApp + Email',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('regla_notificacion', {
      nivel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    });
  },
};
