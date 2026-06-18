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
import { Maquina } from './maquina.model';
import { AnalisisFallo } from './analisis-fallo.model';

@Table({ tableName: 'lecturas_sensor', underscored: true, timestamps: false })
export class LecturaSensor extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idLectura: number;

  @ForeignKey(() => Maquina)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idMaquina: number;

  @Column({ type: DataType.CHAR(1), allowNull: false })
  declare tipoMaquina: string;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: false })
  declare airTemperature: number;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: false })
  declare processTemperature: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare rotationalSpeed: number;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: false })
  declare torque: number;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false })
  declare toolWear: number;

  @Column(DataType.DECIMAL(10, 2))
  declare powerW?: number;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaLectura: Date;

  @BelongsTo(() => Maquina)
  declare maquina?: Maquina;

  @HasMany(() => AnalisisFallo)
  declare analisis?: AnalisisFallo[];
}
