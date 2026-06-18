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
import { ClasificacionFallo } from './clasificacion-fallo.model';
import { FuenteRag } from './fuente-rag.model';

@Table({ tableName: 'recomendaciones_rag', underscored: true, timestamps: false })
export class RecomendacionRag extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idRecomendacion: number;

  @ForeignKey(() => ClasificacionFallo)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idClasificacion: number;

  @ForeignKey(() => FuenteRag)
  @Column(DataType.INTEGER)
  declare idFuente?: number;

  @Column({ type: DataType.SMALLINT, allowNull: false, defaultValue: 1 })
  declare orden: number;

  @Column({ type: DataType.STRING(160), allowNull: false })
  declare titulo: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare prioridad: string;

  @Column(DataType.TEXT)
  declare recomendacion?: string;

  @BelongsTo(() => ClasificacionFallo)
  declare clasificacion?: ClasificacionFallo;

  @BelongsTo(() => FuenteRag)
  declare fuente?: FuenteRag;
}
