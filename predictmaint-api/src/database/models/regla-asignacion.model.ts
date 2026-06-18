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
import { Especialidad } from './especialidad.model';

@Table({ tableName: 'reglas_asignacion', underscored: true, timestamps: false })
export class ReglaAsignacion extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idRegla: number;

  @ForeignKey(() => TipoFallo)
  @Column(DataType.INTEGER)
  declare idTipoFallo?: number;

  @ForeignKey(() => Especialidad)
  @Column(DataType.INTEGER)
  declare idEspecialidad?: number;

  @Column({ type: DataType.STRING(10), allowNull: false })
  declare nivelRiesgo: string;

  @Column({ type: DataType.SMALLINT, defaultValue: 1 })
  declare prioridad: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare activo: boolean;

  @BelongsTo(() => TipoFallo)
  declare tipoFallo?: TipoFallo;

  @BelongsTo(() => Especialidad)
  declare especialidad?: Especialidad;
}
