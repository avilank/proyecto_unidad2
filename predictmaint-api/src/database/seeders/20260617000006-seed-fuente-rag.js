'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('fuente_rag', [
      {
        id: 1,
        fuente: 'Theissler et al. (2021)',
        tipo_fallo: 'HDF, PWF',
        descripcion: 'Predictive maintenance ML — automotive',
        activa: true,
      },
      {
        id: 2,
        fuente: 'Pashmforoush et al. (2025)',
        tipo_fallo: 'TWF, OSF',
        descripcion: 'Tool wear prediction — milling',
        activa: true,
      },
      {
        id: 3,
        fuente: 'Cai et al. (2023)',
        tipo_fallo: 'Todos',
        descripcion: 'Condition-based maintenance optimization',
        activa: true,
      },
      {
        id: 4,
        fuente: 'Araujo et al. (2025)',
        tipo_fallo: 'PWF, OSF',
        descripcion: 'Data analytics — metal-mechanical',
        activa: true,
      },
      {
        id: 5,
        fuente: 'Hesser & Markert (2019)',
        tipo_fallo: 'TWF',
        descripcion: 'Tool wear monitoring CNC milling',
        activa: true,
      },
      {
        id: 6,
        fuente: 'Jakobs et al. (2026)',
        tipo_fallo: 'RNF',
        descripcion: 'Interpretable rules for failure prediction',
        activa: true,
      },
    ]);

    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('fuente_rag', 'id'), 6, true);",
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('fuente_rag', {
      id: [1, 2, 3, 4, 5, 6],
    });
  },
};
