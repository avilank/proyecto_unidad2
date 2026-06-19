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
import { TipoFallo } from './tipo-fallo.model';

@Table({ tableName: 'observacion_tecnica', underscored: true, timestamps: false })
export class ObservacionTecnica extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idRespuestaTecnica: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idOrden: number;

  @ForeignKey(() => TipoFallo)
  @Column(DataType.INTEGER)
  declare idTipoFallo?: number;

  @Column(DataType.BOOLEAN)
  declare esFalla?: boolean;

  @Column(DataType.BOOLEAN)
  declare esPrediccionCorrecta?: boolean;

  @Column(DataType.BOOLEAN)
  declare esClasificacionCorrecta?: boolean;

  /** Decisión del técnico sobre la predicción: 'aceptada' | 'rechazada'. */
  @Column({ type: DataType.STRING(12), allowNull: false, defaultValue: 'aceptada' })
  declare decision: string;

  @Column(DataType.TEXT)
  declare comentario?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaRegistro: Date;

  @BelongsTo(() => Orden)
  declare orden?: Orden;

  @BelongsTo(() => TipoFallo)
  declare tipoFallo?: TipoFallo;
}
