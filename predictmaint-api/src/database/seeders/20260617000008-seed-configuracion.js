'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('configuracion', [
      {
        clave: 'umbral_ensemble_falla',
        valor: '0.50',
        vista: 'Config 1',
      },
      {
        clave: 'agreement_minimo_s3',
        valor: 'MEDIO (2/3)',
        vista: 'Config 1',
      },
      {
        clave: 'repetitivo_ocurrencias',
        valor: '2 en 7 días',
        vista: 'Config 5',
      },
      {
        clave: 'repetitivo_notificar_supervisor',
        valor: '3 en 7 días',
        vista: 'Config 5',
      },
      {
        clave: 'repetitivo_ventana_dias',
        valor: '7',
        vista: 'Config 5',
      },
      {
        clave: 'repetitivo_sin_resolucion_horas',
        valor: '48',
        vista: 'Config 5',
      },
      {
        clave: 'reintento_asignacion_critical_min',
        valor: '15',
        vista: 'Config 1',
      },
      {
        clave: 'reintento_asignacion_high_min',
        valor: '15',
        vista: 'Config 1',
      },
      {
        clave: 'reintento_asignacion_medium_min',
        valor: '30',
        vista: 'Config 1',
      },
      {
        clave: 'reintento_asignacion_low_min',
        valor: '60',
        vista: 'Config 1',
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('configuracion', {
      clave: [
        'umbral_ensemble_falla',
        'agreement_minimo_s3',
        'repetitivo_ocurrencias',
        'repetitivo_notificar_supervisor',
        'repetitivo_ventana_dias',
        'repetitivo_sin_resolucion_horas',
        'reintento_asignacion_critical_min',
        'reintento_asignacion_high_min',
        'reintento_asignacion_medium_min',
        'reintento_asignacion_low_min',
      ],
    });
  },
};
