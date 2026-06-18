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
import { AnalisisFallo } from './analisis-fallo.model';
import { Maquina } from './maquina.model';
import { Orden } from './orden.model';
import { Tecnico } from './tecnico.model';

@Table({ tableName: 'alertas', underscored: true, timestamps: false })
export class Alerta extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idAlerta: number;

  @Column({ type: DataType.STRING(12), allowNull: false, unique: true })
  declare codigo: string;

  @ForeignKey(() => AnalisisFallo)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idAnalisis: number;

  @ForeignKey(() => Maquina)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idMaquina: number;

  @ForeignKey(() => Orden)
  @Column(DataType.BIGINT)
  declare idOrden?: number;

  @Column({ type: DataType.STRING(10), allowNull: false })
  declare nivelRiesgo: string;

  @Column({ type: DataType.STRING(30), allowNull: false })
  declare estado: string;

  @ForeignKey(() => Tecnico)
  @Column(DataType.INTEGER)
  declare idTecnico?: number;

  @Column(DataType.STRING(8))
  declare reglaDisparada?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaAlerta: Date;

  @BelongsTo(() => AnalisisFallo)
  declare analisis?: AnalisisFallo;

  @BelongsTo(() => Maquina)
  declare maquina?: Maquina;

  @BelongsTo(() => Orden)
  declare orden?: Orden;

  @BelongsTo(() => Tecnico)
  declare tecnico?: Tecnico;
}
