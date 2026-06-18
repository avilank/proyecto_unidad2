import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { AnalisisFallo } from './analisis-fallo.model';
import { Maquina } from './maquina.model';
import { Tecnico } from './tecnico.model';
import { EventoOrden } from './evento-orden.model';
import { Alerta } from './alerta.model';
import { ObservacionTecnica } from './observacion-tecnica.model';
import { SolucionAplicada } from './solucion-aplicada.model';
import { RespuestaRecomendacion } from './respuesta-recomendacion.model';

@Table({ tableName: 'ordenes_mantenimiento', underscored: true, timestamps: false })
export class Orden extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idOrden: number;

  @Column({ type: DataType.STRING(12), allowNull: false, unique: true })
  declare codigo: string;

  @ForeignKey(() => AnalisisFallo)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idAnalisis: number;

  @ForeignKey(() => Maquina)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idMaquina: number;

  @ForeignKey(() => Tecnico)
  @Column(DataType.INTEGER)
  declare idTecnico?: number;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'pendiente' })
  declare estado: string;

  @Column(DataType.DATE)
  declare proximoReintentoAsignacion?: Date;

  @Column({ type: DataType.SMALLINT, defaultValue: 0 })
  declare intentosAsignacion: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaCreacion: Date;

  @Column(DataType.DATE)
  declare fechaInicio?: Date;

  @Column(DataType.DATE)
  declare fechaFin?: Date;

  @Column(DataType.TEXT)
  declare observaciones?: string;

  @BelongsTo(() => AnalisisFallo)
  declare analisis?: AnalisisFallo;

  @BelongsTo(() => Maquina)
  declare maquina?: Maquina;

  @BelongsTo(() => Tecnico)
  declare tecnico?: Tecnico;

  @HasMany(() => EventoOrden)
  declare eventos?: EventoOrden[];

  @HasMany(() => Alerta)
  declare alertas?: Alerta[];

  @HasMany(() => ObservacionTecnica)
  declare observacionesTecnica?: ObservacionTecnica[];

  @HasMany(() => SolucionAplicada)
  declare soluciones?: SolucionAplicada[];

  @HasMany(() => RespuestaRecomendacion)
  declare respuestasRag?: RespuestaRecomendacion[];
}
