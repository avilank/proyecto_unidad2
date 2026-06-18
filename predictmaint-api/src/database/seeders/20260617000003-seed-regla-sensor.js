'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('regla_sensor', [
      {
        codigo: 'RN-01',
        descripcion: 'Umbral disparado → HDF',
        tipo_fallo: 'HDF',
      },
      {
        codigo: 'RN-02',
        descripcion: 'Umbral disparado → PWF',
        tipo_fallo: 'PWF',
      },
      {
        codigo: 'RN-03',
        descripcion: 'Umbral disparado → TWF',
        tipo_fallo: 'TWF',
      },
      {
        codigo: 'RN-04',
        descripcion: 'Umbral disparado → OSF',
        tipo_fallo: 'OSF',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('regla_sensor', {
      codigo: ['RN-01', 'RN-02', 'RN-03', 'RN-04'],
    });
  },
};
