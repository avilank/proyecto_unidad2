'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_usuario_rol AS ENUM ('tecnico','tecnico_senior','supervisor','jefe_planta');
      CREATE TYPE enum_tecnico_especialidad AS ENUM ('mecanico','electrico','hidraulico','general');
      CREATE TYPE enum_tecnico_turno AS ENUM ('mañana','tarde','noche');
      CREATE TYPE enum_tecnico_estado AS ENUM ('disponible','en_intervencion','fuera_de_turno');
      CREATE TYPE enum_maquina_estado AS ENUM ('operacion','alerta','fallo','mantenimiento');
      CREATE TYPE enum_orden_nivel AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
      CREATE TYPE enum_orden_estado AS ENUM ('pendiente','en_progreso','finalizado');
      CREATE TYPE enum_orden_solucion AS ENUM ('con_rag','propia','rechazada_manual');
      CREATE TYPE enum_evento_etapa AS ENUM ('deteccion_s1','clasificacion_s2','rag_s3','respuesta_tecnico','en_progreso','finalizado','escalado');
      CREATE TYPE enum_alerta_estado AS ENUM ('analizando','clasificando','pendiente','en_progreso','finalizado');
      CREATE TYPE enum_pred_bin_modelo AS ENUM ('regresion_logistica','random_forest','xgboost');
      CREATE TYPE enum_pred_bin_result AS ENUM ('FALLA','SIN_FALLA');
      CREATE TYPE enum_pred_multi_modelo AS ENUM ('decision_tree','lightgbm','svm');
      CREATE TYPE enum_plan_estado AS ENUM ('pendiente','aceptado','rechazado');
      CREATE TYPE enum_accion_prioridad AS ENUM ('CRITICO','ALTO','MEDIO');
      CREATE TYPE enum_fallo_estado AS ENUM ('en_revision','programado','seguimiento','resuelto');
      CREATE TYPE enum_fallo_nivel AS ENUM ('CRITICO','MODERADO','SEGUIMIENTO');
      CREATE TYPE enum_mensaje_canal AS ENUM ('whatsapp','email','whatsapp_email');
      CREATE TYPE enum_mensaje_tipo AS ENUM ('alerta_critica','inicio_turno','mitad_turno','fin_turno','repetitivo');
      CREATE TYPE enum_mensaje_estado AS ENUM ('entregado','pendiente','fallido');
      CREATE TYPE enum_modelo_etapa AS ENUM ('S1','S2');
    `);

    await queryInterface.createTable('tipo_fallo', {
      codigo: { type: Sequelize.CHAR(3), primaryKey: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      especialidad_requerida: { type: Sequelize.STRING(80), allowNull: false },
      recomendaciones_base: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('nivel_riesgo', {
      nivel: { type: Sequelize.STRING(10), primaryKey: true },
      min: { type: Sequelize.DECIMAL(4, 2), allowNull: false },
      max: { type: Sequelize.DECIMAL(4, 2), allowNull: false },
      accion: { type: Sequelize.STRING(160), allowNull: false },
      tiempo_limite: { type: Sequelize.STRING(40) },
      escala_a: { type: Sequelize.STRING(80) },
    });

    await queryInterface.createTable('regla_sensor', {
      codigo: { type: Sequelize.STRING(8), primaryKey: true },
      descripcion: { type: Sequelize.STRING(255), allowNull: false },
      tipo_fallo: {
        type: Sequelize.CHAR(3),
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
    });

    await queryInterface.createTable('regla_asignacion', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      nivel_riesgo: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      criterio: { type: Sequelize.STRING(255), allowNull: false },
      fallback: { type: Sequelize.STRING(120), allowNull: false },
    });

    await queryInterface.createTable('modelo_ml', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      etapa: { type: 'enum_modelo_etapa', allowNull: false },
      modelo: { type: Sequelize.STRING(60), allowNull: false },
      accuracy: { type: Sequelize.DECIMAL(5, 2) },
      metrica_principal: { type: Sequelize.STRING(20) },
      valor_metrica: { type: Sequelize.DECIMAL(6, 3) },
      activo: { type: Sequelize.BOOLEAN, defaultValue: false },
      descripcion: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('fuente_rag', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      fuente: { type: Sequelize.STRING(200), allowNull: false },
      tipo_fallo: { type: Sequelize.STRING(40) },
      descripcion: { type: Sequelize.TEXT },
      activa: { type: Sequelize.BOOLEAN, defaultValue: true },
    });

    await queryInterface.createTable('horario_envio', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      evento: { type: Sequelize.STRING(80), allowNull: false },
      hora: { type: Sequelize.STRING(20), allowNull: false },
      destinatario: { type: Sequelize.STRING(80), allowNull: false },
      contenido: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('configuracion', {
      clave: { type: Sequelize.STRING(80), primaryKey: true },
      valor: { type: Sequelize.STRING(255), allowNull: false },
      vista: { type: Sequelize.STRING(40) },
    });

    await queryInterface.createTable('accion_escalada', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tipo_fallo: {
        type: Sequelize.CHAR(3),
        allowNull: false,
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
      acciones_adicionales: { type: Sequelize.TEXT, allowNull: false },
    });

    await queryInterface.createTable('regla_notificacion', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      nivel: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      recibe: { type: Sequelize.STRING(120), allowNull: false },
      canal: { type: Sequelize.STRING(40), allowNull: false },
    });

    await queryInterface.createTable('tecnico', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      iniciales: { type: Sequelize.STRING(4), allowNull: false },
      especialidad: { type: 'enum_tecnico_especialidad', allowNull: false },
      turno: { type: 'enum_tecnico_turno', allowNull: false },
      estado: { type: 'enum_tecnico_estado', allowNull: false, defaultValue: 'disponible' },
      telefono: { type: Sequelize.STRING(20), allowNull: false },
      email: { type: Sequelize.STRING(120) },
      nivel_experiencia: { type: Sequelize.SMALLINT, defaultValue: 1 },
      ordenes_hoy: { type: Sequelize.SMALLINT, defaultValue: 0 },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
    });

    await queryInterface.createTable('usuario', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      rol: { type: 'enum_usuario_rol', allowNull: false },
      tecnico_id: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnico', key: 'id' },
      },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
      creado_en: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.createTable('maquina', {
      id: { type: Sequelize.STRING(10), primaryKey: true },
      tipo: { type: Sequelize.CHAR(1), allowNull: false },
      estado_operativo: { type: 'enum_maquina_estado', defaultValue: 'operacion' },
      horas_operacion: { type: Sequelize.INTEGER, defaultValue: 0 },
      desgaste_actual: { type: Sequelize.SMALLINT, defaultValue: 0 },
      ultimo_mantenimiento: { type: Sequelize.DATEONLY },
      proxima_revision: { type: Sequelize.DATEONLY },
      tecnico_asignado_id: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnico', key: 'id' },
      },
    });

    await queryInterface.createTable('lectura_sensor', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      maquina_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'maquina', key: 'id' },
      },
      product_id: { type: Sequelize.STRING(12) },
      tipo: { type: Sequelize.CHAR(1), allowNull: false },
      air_temperature: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      process_temperature: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      rotational_speed: { type: Sequelize.INTEGER, allowNull: false },
      torque: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      tool_wear: { type: Sequelize.SMALLINT, allowNull: false },
      power_w: { type: Sequelize.DECIMAL(8, 2) },
      capturado_en: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('orden', {
      id: { type: Sequelize.STRING(10), primaryKey: true },
      maquina_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'maquina', key: 'id' },
      },
      lectura_id: {
        type: Sequelize.BIGINT,
        references: { model: 'lectura_sensor', key: 'id' },
      },
      tipo_fallo: {
        type: Sequelize.CHAR(3),
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
      algoritmo_clasificador: { type: Sequelize.STRING(30) },
      confianza: { type: Sequelize.DECIMAL(5, 2) },
      ensemble_avg: { type: Sequelize.DECIMAL(4, 3) },
      nivel_riesgo: { type: 'enum_orden_nivel', allowNull: false },
      tecnico_id: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnico', key: 'id' },
      },
      estado: { type: 'enum_orden_estado', defaultValue: 'pendiente' },
      solucion_descripcion: { type: Sequelize.TEXT },
      solucion_tipo: { type: 'enum_orden_solucion' },
      detectado_en: { type: Sequelize.DATE, allowNull: false },
      finalizado_en: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('evento_orden', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      orden_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'orden', key: 'id' },
      },
      etapa: { type: 'enum_evento_etapa', allowNull: false },
      descripcion: { type: Sequelize.STRING(255) },
      actor: { type: Sequelize.STRING(120) },
      ocurrido_en: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('alerta', {
      id: { type: Sequelize.STRING(12), primaryKey: true },
      orden_id: {
        type: Sequelize.STRING(10),
        references: { model: 'orden', key: 'id' },
      },
      maquina_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'maquina', key: 'id' },
      },
      nivel: { type: 'enum_orden_nivel', allowNull: false },
      regla_codigo: {
        type: Sequelize.STRING(8),
        references: { model: 'regla_sensor', key: 'codigo' },
      },
      tipo_fallo: {
        type: Sequelize.CHAR(3),
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
      ensemble_avg: { type: Sequelize.DECIMAL(4, 3) },
      tecnico_id: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnico', key: 'id' },
      },
      estado: { type: 'enum_alerta_estado', allowNull: false },
      notificacion_enviada: { type: Sequelize.BOOLEAN, defaultValue: false },
      creado_en: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('prediccion_binaria', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      orden_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'orden', key: 'id' },
      },
      modelo: { type: 'enum_pred_bin_modelo', allowNull: false },
      prediccion: { type: 'enum_pred_bin_result', allowNull: false },
      probabilidad: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      accuracy: { type: Sequelize.DECIMAL(5, 2) },
      roc_auc: { type: Sequelize.DECIMAL(4, 3) },
      precision: { type: Sequelize.DECIMAL(5, 2) },
      recall: { type: Sequelize.DECIMAL(5, 2) },
      f1_score: { type: Sequelize.DECIMAL(5, 2) },
      tn: { type: Sequelize.INTEGER },
      fp: { type: Sequelize.INTEGER },
      fn: { type: Sequelize.INTEGER },
      tp: { type: Sequelize.INTEGER },
      es_lider: { type: Sequelize.BOOLEAN, defaultValue: false },
    });

    await queryInterface.createTable('prediccion_multiclase', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      orden_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'orden', key: 'id' },
      },
      modelo: { type: 'enum_pred_multi_modelo', allowNull: false },
      tipo_predicho: {
        type: Sequelize.CHAR(3),
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
      prob_hdf: { type: Sequelize.DECIMAL(5, 2) },
      prob_pwf: { type: Sequelize.DECIMAL(5, 2) },
      prob_twf: { type: Sequelize.DECIMAL(5, 2) },
      prob_osf: { type: Sequelize.DECIMAL(5, 2) },
      prob_rnf: { type: Sequelize.DECIMAL(5, 2) },
      f1_macro: { type: Sequelize.DECIMAL(4, 3) },
      f1_weighted: { type: Sequelize.DECIMAL(4, 3) },
      accuracy: { type: Sequelize.DECIMAL(5, 2) },
      tp: { type: Sequelize.INTEGER },
      fn: { type: Sequelize.INTEGER },
      fp: { type: Sequelize.INTEGER },
      tn: { type: Sequelize.INTEGER },
      es_lider: { type: Sequelize.BOOLEAN, defaultValue: false },
      diverge: { type: Sequelize.BOOLEAN, defaultValue: false },
    });

    await queryInterface.createTable('plan_rag', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      orden_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'orden', key: 'id' },
      },
      tipo_fallo: {
        type: Sequelize.CHAR(3),
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
      modelo_origen: { type: Sequelize.STRING(30) },
      escalado: { type: Sequelize.BOOLEAN, defaultValue: false },
      estado: { type: 'enum_plan_estado', defaultValue: 'pendiente' },
      generado_en: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('accion_rag', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      plan_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'plan_rag', key: 'id' },
      },
      orden: { type: Sequelize.SMALLINT, allowNull: false },
      prioridad: { type: 'enum_accion_prioridad', allowNull: false },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      detalle: { type: Sequelize.TEXT },
    });

    await queryInterface.createTable('plan_rag_fuente', {
      plan_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        references: { model: 'plan_rag', key: 'id' },
      },
      fuente_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'fuente_rag', key: 'id' },
      },
    });

    await queryInterface.createTable('fallo_repetitivo', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      maquina_id: {
        type: Sequelize.STRING(10),
        allowNull: false,
        references: { model: 'maquina', key: 'id' },
      },
      tipo_fallo: {
        type: Sequelize.CHAR(3),
        references: { model: 'tipo_fallo', key: 'codigo' },
      },
      ocurrencias: { type: Sequelize.SMALLINT, allowNull: false },
      ventana_dias: { type: Sequelize.SMALLINT, defaultValue: 7 },
      estado: { type: 'enum_fallo_estado', allowNull: false },
      ultima_accion: { type: Sequelize.STRING(160) },
      nivel: { type: 'enum_fallo_nivel' },
      supervisor_notificado: { type: Sequelize.BOOLEAN, defaultValue: false },
      ultima_ocurrencia_en: { type: Sequelize.DATE },
    });

    await queryInterface.createTable('mensaje_enviado', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      tecnico_id: {
        type: Sequelize.INTEGER,
        references: { model: 'tecnico', key: 'id' },
      },
      orden_id: {
        type: Sequelize.STRING(10),
        references: { model: 'orden', key: 'id' },
      },
      maquinas: { type: Sequelize.STRING(120) },
      motivo: { type: Sequelize.STRING(160) },
      canal: { type: 'enum_mensaje_canal', allowNull: false },
      tipo_envio: { type: 'enum_mensaje_tipo' },
      estado: { type: 'enum_mensaje_estado', defaultValue: 'pendiente' },
      enviado_en: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    const tables = [
      'mensaje_enviado', 'fallo_repetitivo', 'plan_rag_fuente', 'accion_rag',
      'plan_rag', 'prediccion_multiclase', 'prediccion_binaria', 'alerta',
      'evento_orden', 'orden', 'lectura_sensor', 'maquina', 'usuario', 'tecnico',
      'regla_notificacion', 'accion_escalada', 'configuracion', 'horario_envio',
      'fuente_rag', 'modelo_ml', 'regla_asignacion', 'regla_sensor',
      'nivel_riesgo', 'tipo_fallo',
    ];
    for (const t of tables) {
      await queryInterface.dropTable(t);
    }
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_mensaje_estado, enum_mensaje_tipo, enum_mensaje_canal,
        enum_fallo_nivel, enum_fallo_estado, enum_accion_prioridad, enum_plan_estado,
        enum_pred_multi_modelo, enum_pred_bin_result, enum_pred_bin_modelo,
        enum_alerta_estado, enum_evento_etapa, enum_orden_solucion, enum_orden_estado,
        enum_orden_nivel, enum_maquina_estado, enum_tecnico_estado, enum_tecnico_turno,
        enum_tecnico_especialidad, enum_usuario_rol, enum_modelo_etapa;
    `);
  },
};
