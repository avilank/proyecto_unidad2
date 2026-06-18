'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tipo_fallo', [
      {
        codigo: 'HDF',
        nombre: 'Heat Dissipation Failure',
        especialidad_requerida: 'Mecánico / Térmico',
        recomendaciones_base:
          'Verificar enfriamiento; calibrar variador; dif. térmica > 8.6 K',
      },
      {
        codigo: 'PWF',
        nombre: 'Power Failure',
        especialidad_requerida: 'Eléctrico',
        recomendaciones_base:
          'Potencia en 3500–9000 W; conexiones eléctricas; variador',
      },
      {
        codigo: 'TWF',
        nombre: 'Tool Wear Failure',
        especialidad_requerida: 'Mecánico',
        recomendaciones_base:
          'Reemplazar herramienta; verificar desgaste; registrar ciclo',
      },
      {
        codigo: 'OSF',
        nombre: 'Overstrain Failure',
        especialidad_requerida: 'Mecánico / General',
        recomendaciones_base:
          'Reducir carga del eje; torque×desgaste; rodamientos',
      },
      {
        codigo: 'RNF',
        nombre: 'Random Failure',
        especialidad_requerida: 'General → inspección manual',
        recomendaciones_base:
          'Inspección manual obligatoria; sin plan RAG automático',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tipo_fallo', {
      codigo: ['HDF', 'PWF', 'TWF', 'OSF', 'RNF'],
    });
  },
};
