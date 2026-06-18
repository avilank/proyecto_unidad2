import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({ tableName: 'nivel_riesgo', underscored: true, timestamps: false })
export class NivelRiesgo extends Model {
  @PrimaryKey
  @Column(DataType.STRING(10))
  nivel!: string;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false })
  min!: number;

  @Column({ type: DataType.DECIMAL(4, 2), allowNull: false })
  max!: number;

  @Column({ type: DataType.STRING(160), allowNull: false })
  accion!: string;

  @Column({ type: DataType.STRING(40), field: 'tiempo_limite' })
  tiempoLimite?: string;

  @Column({ type: DataType.STRING(80), field: 'escala_a' })
  escalaA?: string;
}
