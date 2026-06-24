'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('configuracion_alertas', 'umbral_ensemble_falla', {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.5,
    });
    await queryInterface.addColumn('configuracion_alertas', 'agreement_minimo_s3', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'MEDIO',
    });
    await queryInterface.addColumn('configuracion_alertas', 'horarios_envio_json', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('configuracion_alertas', 'umbral_ensemble_falla');
    await queryInterface.removeColumn('configuracion_alertas', 'agreement_minimo_s3');
    await queryInterface.removeColumn('configuracion_alertas', 'horarios_envio_json');
  },
};
