'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'ordenes_mantenimiento';
    const columns = await queryInterface.describeTable(table);

    if (!columns.reasignado_motivo) {
      await queryInterface.addColumn(table, 'reasignado_motivo', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!columns.reasignado_en) {
      await queryInterface.addColumn(table, 'reasignado_en', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'ordenes_mantenimiento';
    const columns = await queryInterface.describeTable(table);

    if (columns.reasignado_motivo) {
      await queryInterface.removeColumn(table, 'reasignado_motivo');
    }
    if (columns.reasignado_en) {
      await queryInterface.removeColumn(table, 'reasignado_en');
    }
  },
};
