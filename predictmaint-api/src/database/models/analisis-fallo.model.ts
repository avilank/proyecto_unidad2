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
  HasOne,
} from 'sequelize-typescript';
import { Maquina } from './maquina.model';
import { LecturaSensor } from './lectura-sensor.model';
import { PrediccionFallo } from './prediccion-fallo.model';
import { ClasificacionFallo } from './clasificacion-fallo.model';
import { Orden } from './orden.model';
import { Alerta } from './alerta.model';

@Table({ tableName: 'analisis_fallos', underscored: true, timestamps: false })
export class AnalisisFallo extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idAnalisis: number;

  @ForeignKey(() => Maquina)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idMaquina: number;

  @ForeignKey(() => LecturaSensor)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idLectura: number;

  @Column(DataType.STRING(20))
  declare prediccion?: string;

  @Column(DataType.STRING(10))
  declare nivelRiesgo?: string;

  @Column(DataType.DECIMAL(6, 4))
  declare ensembleAvg?: number;

  @Column(DataType.STRING(10))
  declare agreement?: string;

  @Column(DataType.STRING(8))
  declare reglaDisparada?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaAnalisis: Date;

  @BelongsTo(() => Maquina)
  declare maquina?: Maquina;

  @BelongsTo(() => LecturaSensor)
  declare lectura?: LecturaSensor;

  @HasMany(() => PrediccionFallo)
  declare predicciones?: PrediccionFallo[];

  @HasMany(() => ClasificacionFallo)
  declare clasificaciones?: ClasificacionFallo[];

  @HasOne(() => Orden)
  declare orden?: Orden;

  @HasMany(() => Alerta)
  declare alertas?: Alerta[];
}
