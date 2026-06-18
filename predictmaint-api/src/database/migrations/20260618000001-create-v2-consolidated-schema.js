'use strict';

/**
 * Modelo de datos v2 — DOCUMENTACION_MODELO_DE_DATOS.md (§2 + §7)
 * Coexiste con tablas legacy (usuario, orden, alerta…) hasta migrar el código.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id_rol: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      descripcion: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('especialidades', {
      id_especialidad: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      descripcion: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('tipos_fallo', {
      id_tipo_fallo: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      descripcion: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('modelos_ml', {
      id_modelo: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: { type: Sequelize.STRING(60), allowNull: false },
      tipo: { type: Sequelize.STRING(40) },
      version: { type: Sequelize.STRING(20) },
      accuracy: { type: Sequelize.DECIMAL(5, 2) },
      roc_auc: { type: Sequelize.DECIMAL(6, 3) },
      precision_score: { type: Sequelize.DECIMAL(5, 2) },
      recall_score: { type: Sequelize.DECIMAL(5, 2) },
      f1_score: { type: Sequelize.DECIMAL(5, 2) },
      es_prediccion: { type: Sequelize.BOOLEAN, defaultValue: false },
      es_clasificacion: { type: Sequelize.BOOLEAN, defaultValue: false },
      umbral: { type: Sequelize.DECIMAL(4, 3) },
      es_default: { type: Sequelize.BOOLEAN, defaultValue: false },
    });

    await queryInterface.createTable('fuentes_rag', {
      id_fuente: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      titulo: { type: Sequelize.STRING(200), allowNull: false },
      autor: { type: Sequelize.STRING(120) },
      url: { type: Sequelize.TEXT },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });

    await queryInterface.createTable('configuracion_alertas', {
      id_config_alerta: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      riesgo_bajo: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 0.4 },
      riesgo_medio: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 0.65 },
      riesgo_alto: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 0.85 },
      riesgo_critico: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 1.0 },
      tiempo_escalamiento: { type: Sequelize.INTEGER, defaultValue: 30 },
      plantilla_notificacion: { type: Sequelize.TEXT },
      fecha_actualizacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('reglas_sensor', {
      id_regla: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: { type: Sequelize.STRING(8), allowNull: false, unique: true },
      descripcion: { type: Sequelize.STRING(255), allowNull: false },
      id_tipo_fallo: {
        type: Sequelize.INTEGER,
        references: { model: 'tipos_fallo', key: 'id_tipo_fallo' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });

    await queryInterface.createTable('usuarios', {
      id_usuario: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      id_rol: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id_rol' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      nombres: { type: Sequelize.STRING(80), allowNull: false },
      apellidos: { type: Sequelize.STRING(80), allowNull: false },
      correo: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      telefono: { type: Sequelize.STRING(20) },
      estado: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'activo',
      },
    });

    await queryInterface.createTable('tecnicos', {
      id_tecnico: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'usuarios', key: 'id_usuario' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_especialidad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'especialidades', key: 'id_especialidad' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      disponibilidad: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'disponible',
      },
      enviar_wssp: { type: Sequelize.BOOLEAN, defaultValue: true },
      enviar_correo: { type: Sequelize.BOOLEAN, defaultValue: false },
      turno: { type: Sequelize.STRING(20), allowNull: false },
      nivel_experiencia: { type: Sequelize.SMALLINT, defaultValue: 1 },
    });

    await queryInterface.createTable('maquinas', {
      id_maquina: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      modelo: { type: Sequelize.STRING(80) },
      ubicacion: { type: Sequelize.STRING(120) },
      tipo_calidad: { type: Sequelize.CHAR(1), allowNull: false, defaultValue: 'M' },
      estado: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'operacion',
      },
      fecha_registro: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('reglas_asignacion', {
      id_regla: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      id_tipo_fallo: {
        type: Sequelize.INTEGER,
        references: { model: 'tipos_fallo', key: 'id_tipo_fallo' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      id_especialidad: {
        type: Sequelize.INTEGER,
        references: { model: 'especialidades', key: 'id_especialidad' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nivel_riesgo: { type: Sequelize.STRING(10), allowNull: false },
      prioridad: { type: Sequelize.SMALLINT, defaultValue: 1 },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });

    await queryInterface.createTable('lecturas_sensor', {
      id_lectura: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_maquina: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'maquinas', key: 'id_maquina' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo_maquina: { type: Sequelize.CHAR(1), allowNull: false },
      air_temperature: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      process_temperature: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      rotational_speed: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      torque: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      tool_wear: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      power_w: { type: Sequelize.DECIMAL(10, 2) },
      fecha_lectura: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('analisis_fallos', {
      id_analisis: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_maquina: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'maquinas', key: 'id_maquina' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_lectura: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'lecturas_sensor', key: 'id_lectura' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      prediccion: { type: Sequelize.STRING(20) },
      nivel_riesgo: { type: Sequelize.STRING(10) },
      ensemble_avg: { type: Sequelize.DECIMAL(6, 4) },
      agreement: { type: Sequelize.STRING(10) },
      regla_disparada: { type: Sequelize.STRING(8) },
      fecha_analisis: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('prediccion_fallo', {
      id_resultado: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_analisis: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'analisis_fallos', key: 'id_analisis' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_modelo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'modelos_ml', key: 'id_modelo' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      prediccion: { type: Sequelize.STRING(20), allowNull: false },
      confianza: { type: Sequelize.DECIMAL(5, 2) },
      probabilidad: { type: Sequelize.DECIMAL(5, 2) },
      es_lider: { type: Sequelize.BOOLEAN, defaultValue: false },
      tn: { type: Sequelize.INTEGER },
      fp: { type: Sequelize.INTEGER },
      fn: { type: Sequelize.INTEGER },
      tp: { type: Sequelize.INTEGER },
    });

    await queryInterface.createTable('clasificaciones_fallo', {
      id_clasificacion: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_analisis: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'analisis_fallos', key: 'id_analisis' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_tipo_fallo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tipos_fallo', key: 'id_tipo_fallo' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      id_modelo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'modelos_ml', key: 'id_modelo' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      confianza: { type: Sequelize.DECIMAL(5, 2) },
      prob_hdf: { type: Sequelize.DECIMAL(5, 2) },
      prob_pwf: { type: Sequelize.DECIMAL(5, 2) },
      prob_twf: { type: Sequelize.DECIMAL(5, 2) },
      prob_osf: { type: Sequelize.DECIMAL(5, 2) },
      prob_rnf: { type: Sequelize.DECIMAL(5, 2) },
      es_lider: { type: Sequelize.BOOLEAN, defaultValue: false },
      diverge: { type: Sequelize.BOOLEAN, defaultValue: false },
      fecha_clasificacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('ordenes_mantenimiento', {
      id_orden: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: { type: Sequelize.STRING(12), allowNull: false, unique: true },
      id_analisis: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'analisis_fallos', key: 'id_analisis' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_maquina: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'maquinas', key: 'id_maquina' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_tecnico: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnicos', key: 'id_tecnico' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      estado: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'pendiente',
      },
      proximo_reintento_asignacion: { type: Sequelize.DATE },
      intentos_asignacion: { type: Sequelize.SMALLINT, defaultValue: 0 },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      fecha_inicio: { type: Sequelize.DATE },
      fecha_fin: { type: Sequelize.DATE },
      observaciones: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('recomendaciones_rag', {
      id_recomendacion: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_clasificacion: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'clasificaciones_fallo', key: 'id_clasificacion' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_fuente: {
        type: Sequelize.INTEGER,
        references: { model: 'fuentes_rag', key: 'id_fuente' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      orden: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      prioridad: { type: Sequelize.STRING(20), allowNull: false },
      recomendacion: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('alertas', {
      id_alerta: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: { type: Sequelize.STRING(12), allowNull: false, unique: true },
      id_analisis: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'analisis_fallos', key: 'id_analisis' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_maquina: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'maquinas', key: 'id_maquina' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_orden: {
        type: Sequelize.BIGINT,
        references: { model: 'ordenes_mantenimiento', key: 'id_orden' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nivel_riesgo: { type: Sequelize.STRING(10), allowNull: false },
      estado: { type: Sequelize.STRING(30), allowNull: false },
      id_tecnico: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnicos', key: 'id_tecnico' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      regla_disparada: { type: Sequelize.STRING(8) },
      fecha_alerta: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('eventos_orden', {
      id_evento: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_orden: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'ordenes_mantenimiento', key: 'id_orden' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      etapa: { type: Sequelize.STRING(40), allowNull: false },
      descripcion: { type: Sequelize.TEXT },
      actor: { type: Sequelize.STRING(80), defaultValue: 'sistema' },
      fecha_evento: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('observacion_tecnica', {
      id_respuesta_tecnica: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_orden: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'ordenes_mantenimiento', key: 'id_orden' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      id_tipo_fallo: {
        type: Sequelize.INTEGER,
        references: { model: 'tipos_fallo', key: 'id_tipo_fallo' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      es_falla: { type: Sequelize.BOOLEAN },
      es_prediccion_correcta: { type: Sequelize.BOOLEAN },
      es_clasificacion_correcta: { type: Sequelize.BOOLEAN },
      comentario: { type: Sequelize.TEXT },
      fecha_registro: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('respuesta_recomendacion', {
      id_respuesta: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_orden: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'ordenes_mantenimiento', key: 'id_orden' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      decision: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      observacion: { type: Sequelize.TEXT },
      fecha_respuesta: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('soluciones_aplicadas', {
      id_solucion: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_orden: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'ordenes_mantenimiento', key: 'id_orden' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo_solucion: { type: Sequelize.STRING(40), allowNull: false },
      descripcion: { type: Sequelize.TEXT },
      fecha_registro: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      id_usuario: {
        type: Sequelize.INTEGER,
        references: { model: 'usuarios', key: 'id_usuario' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      modulo: { type: Sequelize.STRING(60), allowNull: false },
      accion: { type: Sequelize.STRING(60), allowNull: false },
      url: { type: Sequelize.STRING(255) },
      body: { type: Sequelize.TEXT },
      ip: { type: Sequelize.STRING(45) },
      fecha_registro: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('lecturas_sensor', ['id_maquina', 'fecha_lectura']);
    await queryInterface.addIndex('analisis_fallos', ['id_maquina', 'fecha_analisis']);
    await queryInterface.addIndex('alertas', ['estado', 'fecha_alerta']);
    await queryInterface.addIndex('ordenes_mantenimiento', ['estado', 'fecha_creacion']);
  },

  async down(queryInterface) {
    const tables = [
      'audit_logs',
      'soluciones_aplicadas',
      'respuesta_recomendacion',
      'observacion_tecnica',
      'eventos_orden',
      'alertas',
      'recomendaciones_rag',
      'ordenes_mantenimiento',
      'clasificaciones_fallo',
      'prediccion_fallo',
      'analisis_fallos',
      'lecturas_sensor',
      'reglas_asignacion',
      'maquinas',
      'tecnicos',
      'usuarios',
      'reglas_sensor',
      'configuracion_alertas',
      'fuentes_rag',
      'modelos_ml',
      'tipos_fallo',
      'especialidades',
      'roles',
    ];

    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  },
};
