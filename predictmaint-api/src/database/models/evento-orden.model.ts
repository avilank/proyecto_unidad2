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

@Table({ tableName: 'eventos_orden', underscored: true, timestamps: false })
export class EventoOrden extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idEvento: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idOrden: number;

  @Column({ type: DataType.STRING(40), allowNull: false })
  declare etapa: string;

  @Column(DataType.TEXT)
  declare descripcion?: string;

  @Column({ type: DataType.STRING(80), defaultValue: 'sistema' })
  declare actor?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaEvento: Date;

  @BelongsTo(() => Orden)
  declare orden?: Orden;
}
