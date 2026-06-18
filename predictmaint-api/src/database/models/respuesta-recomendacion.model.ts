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

@Table({ tableName: 'respuesta_recomendacion', underscored: true, timestamps: false })
export class RespuestaRecomendacion extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idRespuesta: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idOrden: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare decision: string;

  @Column(DataType.TEXT)
  declare observacion?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaRespuesta: Date;

  @BelongsTo(() => Orden)
  declare orden?: Orden;
}
