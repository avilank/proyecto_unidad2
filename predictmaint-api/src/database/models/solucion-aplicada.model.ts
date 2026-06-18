import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Orden } from './orden.model';

@Table({ tableName: 'soluciones_aplicadas', underscored: true, timestamps: false })
export class SolucionAplicada extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idSolucion: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idOrden: number;

  @Column({ type: DataType.STRING(40), allowNull: false })
  declare tipoSolucion: string;

  @Column(DataType.TEXT)
  declare descripcion?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaRegistro: Date;

  @BelongsTo(() => Orden)
  declare orden?: Orden;
}
