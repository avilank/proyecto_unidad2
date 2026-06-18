import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  HasMany,
} from 'sequelize-typescript';
import { ReglaSensor } from './regla-sensor.model';
import { ClasificacionFallo } from './clasificacion-fallo.model';
import { ReglaAsignacion } from './regla-asignacion.model';
import { ObservacionTecnica } from './observacion-tecnica.model';

@Table({ tableName: 'tipos_fallo', underscored: true, timestamps: false })
export class TipoFallo extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idTipoFallo: number;

  @Column({ type: DataType.STRING(10), allowNull: false, unique: true })
  declare codigo: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare nombre: string;

  @Column(DataType.TEXT)
  declare descripcion?: string;

  @HasMany(() => ReglaSensor)
  declare reglasSensor?: ReglaSensor[];

  @HasMany(() => ClasificacionFallo)
  declare clasificaciones?: ClasificacionFallo[];

  @HasMany(() => ReglaAsignacion)
  declare reglasAsignacion?: ReglaAsignacion[];

  @HasMany(() => ObservacionTecnica)
  declare observaciones?: ObservacionTecnica[];
}
