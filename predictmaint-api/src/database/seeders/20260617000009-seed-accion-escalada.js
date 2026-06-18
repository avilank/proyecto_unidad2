'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('accion_escalada', [
      {
        tipo_fallo: 'HDF',
        acciones_adicionales:
          'Inspección profunda del sistema térmico + evaluar reemplazo',
      },
      {
        tipo_fallo: 'PWF',
        acciones_adicionales:
          'Revisión eléctrica completa + certificación del variador',
      },
      {
        tipo_fallo: 'TWF',
        acciones_adicionales:
          'Auditoría del ciclo de herramientas + cambio de proveedor',
      },
      {
        tipo_fallo: 'OSF',
        acciones_adicionales:
          'Análisis de carga mecánica + revisión de diseño operativo',
      },
      {
        tipo_fallo: 'RNF',
        acciones_adicionales:
          'Revisión con especialista externo obligatoria',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('accion_escalada', {
      tipo_fallo: ['HDF', 'PWF', 'TWF', 'OSF', 'RNF'],
    });
  },
};
