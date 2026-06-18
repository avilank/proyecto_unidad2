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
import { TipoFallo } from './tipo-fallo.model';
import { ModeloMl } from './modelo-ml.model';
import { RecomendacionRag } from './recomendacion-rag.model';

@Table({ tableName: 'clasificaciones_fallo', underscored: true, timestamps: false })
export class ClasificacionFallo extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idClasificacion: number;

  @ForeignKey(() => AnalisisFallo)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idAnalisis: number;

  @ForeignKey(() => TipoFallo)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idTipoFallo: number;

  @ForeignKey(() => ModeloMl)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idModelo: number;

  @Column(DataType.DECIMAL(5, 2))
  declare confianza?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare probHdf?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare probPwf?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare probTwf?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare probOsf?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare probRnf?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare esLider: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare diverge: boolean;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaClasificacion: Date;

  @BelongsTo(() => AnalisisFallo)
  declare analisis?: AnalisisFallo;

  @BelongsTo(() => TipoFallo)
  declare tipoFallo?: TipoFallo;

  @BelongsTo(() => ModeloMl)
  declare modeloMl?: ModeloMl;

  @HasMany(() => RecomendacionRag)
  declare recomendaciones?: RecomendacionRag[];
}
