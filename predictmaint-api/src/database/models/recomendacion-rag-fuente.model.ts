import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { RecomendacionRag } from './recomendacion-rag.model';
import { FuenteRag } from './fuente-rag.model';

@Table({ tableName: 'recomendaciones_rag_fuente', underscored: true, timestamps: false })
export class RecomendacionRagFuente extends Model {
  @ForeignKey(() => RecomendacionRag)
  @PrimaryKey
  @Column({ type: DataType.BIGINT, field: 'id_recomendacion' })
  declare idRecomendacion: number;

  @ForeignKey(() => FuenteRag)
  @PrimaryKey
  @Column({ type: DataType.INTEGER, field: 'id_fuente' })
  declare idFuente: number;

  @BelongsTo(() => RecomendacionRag)
  declare recomendacion?: RecomendacionRag;

  @BelongsTo(() => FuenteRag)
  declare fuente?: FuenteRag;
}
