import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  HasMany,
} from 'sequelize-typescript';
import { LecturaSensor } from './lectura-sensor.model';
import { AnalisisFallo } from './analisis-fallo.model';
import { Orden } from './orden.model';
import { Alerta } from './alerta.model';

@Table({ tableName: 'maquinas', underscored: true, timestamps: false })
export class Maquina extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idMaquina: number;

  @Column({ type: DataType.STRING(10), allowNull: false, unique: true })
  declare codigo: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare nombre: string;

  @Column(DataType.STRING(80))
  declare modelo?: string;

  @Column(DataType.STRING(120))
  declare ubicacion?: string;

  @Column({ type: DataType.CHAR(1), allowNull: false, defaultValue: 'M' })
  declare tipoCalidad: string;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'operacion' })
  declare estado: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaRegistro: Date;

  @HasMany(() => LecturaSensor)
  declare lecturas?: LecturaSensor[];

  @HasMany(() => AnalisisFallo)
  declare analisis?: AnalisisFallo[];

  @HasMany(() => Orden)
  declare ordenes?: Orden[];

  @HasMany(() => Alerta)
  declare alertas?: Alerta[];
}
