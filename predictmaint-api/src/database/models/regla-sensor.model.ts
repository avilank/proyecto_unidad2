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
import { TipoFallo } from './tipo-fallo.model';

@Table({ tableName: 'reglas_sensor', underscored: true, timestamps: false })
export class ReglaSensor extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idRegla: number;

  @Column({ type: DataType.STRING(8), allowNull: false, unique: true })
  declare codigo: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare descripcion: string;

  @ForeignKey(() => TipoFallo)
  @Column(DataType.INTEGER)
  declare idTipoFallo?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare activo: boolean;

  @BelongsTo(() => TipoFallo)
  declare tipoFallo?: TipoFallo;
}
