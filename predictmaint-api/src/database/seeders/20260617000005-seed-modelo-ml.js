'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('modelo_ml', [
      {
        id: 1,
        etapa: 'S1',
        modelo: 'XGBoost',
        accuracy: 93.1,
        metrica_principal: 'AUC',
        valor_metrica: 0.961,
        activo: true,
        descripcion: 'Mayor precisión (recomendado)',
      },
      {
        id: 2,
        etapa: 'S1',
        modelo: 'Random Forest',
        accuracy: 91.8,
        metrica_principal: 'AUC',
        valor_metrica: 0.947,
        activo: false,
        descripcion: 'Robusto ante ruido/outliers',
      },
      {
        id: 3,
        etapa: 'S1',
        modelo: 'Regresión Logística',
        accuracy: 78.3,
        metrica_principal: 'AUC',
        valor_metrica: 0.831,
        activo: false,
        descripcion: 'Alta interpretabilidad',
      },
      {
        id: 4,
        etapa: 'S2',
        modelo: 'LightGBM',
        accuracy: 85.4,
        metrica_principal: 'F1-m',
        valor_metrica: 0.814,
        activo: true,
        descripcion: 'Óptimo para clases desbalanceadas',
      },
      {
        id: 5,
        etapa: 'S2',
        modelo: 'Decision Tree',
        accuracy: 79.1,
        metrica_principal: 'F1-m',
        valor_metrica: 0.763,
        activo: false,
        descripcion: 'Alta interpretabilidad visual',
      },
      {
        id: 6,
        etapa: 'S2',
        modelo: 'SVM',
        accuracy: 76.8,
        metrica_principal: 'F1-m',
        valor_metrica: 0.701,
        activo: false,
        descripcion: 'Efectivo en alta dimensionalidad',
      },
    ]);

    await queryInterface.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('modelo_ml', 'id'), 6, true);",
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('modelo_ml', {
      id: [1, 2, 3, 4, 5, 6],
    });
  },
};
