'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'recomendaciones_rag_fuente';
    const allTables = await queryInterface.showAllTables();
    const hasTable = allTables.some((t) => String(t).toLowerCase() === tableName);

    if (!hasTable) {
      await queryInterface.createTable(tableName, {
        id_recomendacion: {
          type: Sequelize.BIGINT,
          allowNull: false,
          primaryKey: true,
          references: { model: 'recomendaciones_rag', key: 'id_recomendacion' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        id_fuente: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          references: { model: 'fuentes_rag', key: 'id_fuente' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
      });
      await queryInterface.addIndex(tableName, ['id_fuente']);
    }

    const desc = await queryInterface.describeTable('recomendaciones_rag');
    if (desc.id_fuente) {
      await queryInterface.sequelize.query(`
        INSERT INTO recomendaciones_rag_fuente (id_recomendacion, id_fuente)
        SELECT DISTINCT id_recomendacion, id_fuente
        FROM recomendaciones_rag
        WHERE id_fuente IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recomendaciones_rag_fuente');
  },
};
