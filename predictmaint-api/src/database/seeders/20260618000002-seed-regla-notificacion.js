'use strict';

const REGLAS = require('./data/reglas-notificacion.data');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [[{ count }]] = await queryInterface.sequelize.query(
      'SELECT COUNT(*)::int AS count FROM regla_notificacion',
    );
    if (Number(count) > 0) {
      return;
    }
    await queryInterface.bulkInsert('regla_notificacion', REGLAS);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('regla_notificacion', {
      nivel: REGLAS.map((r) => r.nivel),
    });
  },
};
