import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

@Table({ tableName: 'configuracion_alertas', underscored: true, timestamps: false })
export class ConfiguracionAlertas extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idConfigAlerta: number;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false, defaultValue: 0.4 })
  declare riesgoBajo: number;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false, defaultValue: 0.65 })
  declare riesgoMedio: number;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false, defaultValue: 0.85 })
  declare riesgoAlto: number;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false, defaultValue: 1.0 })
  declare riesgoCritico: number;

  @Column({ type: DataType.INTEGER, defaultValue: 30 })
  declare tiempoEscalamiento: number;

  @Column(DataType.TEXT)
  declare plantillaNotificacion?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaActualizacion: Date;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false, defaultValue: 0.5 })
  declare umbralEnsembleFalla: number;

  @Column({ type: DataType.STRING(10), allowNull: false, defaultValue: 'MEDIO' })
  declare agreementMinimoS3: string;

  @Column(DataType.TEXT)
  declare horariosEnvioJson?: string;

  /** Minutos de SLA por nivel de riesgo: { LOW, MEDIUM, HIGH, CRITICAL } (null = no aplica). */
  @Column(DataType.TEXT)
  declare tiemposAtencionJson?: string;

  /** Config de fallos repetitivos: umbrales (veces/días) + toggles de notificación. */
  @Column(DataType.TEXT)
  declare fallosRepetitivosJson?: string;
}
