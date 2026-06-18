import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { PlanRag } from './plan-rag.model';
import { FuenteRag } from './fuente-rag.model';

@Table({ tableName: 'plan_rag_fuente', underscored: true, timestamps: false })
export class PlanRagFuente extends Model {
  @ForeignKey(() => PlanRag)
  @PrimaryKey
  @Column({ type: DataType.BIGINT, field: 'plan_id' })
  planId!: number;

  @ForeignKey(() => FuenteRag)
  @PrimaryKey
  @Column({ type: DataType.INTEGER, field: 'fuente_id' })
  fuenteId!: number;

  @BelongsTo(() => PlanRag)
  plan?: PlanRag;

  @BelongsTo(() => FuenteRag)
  fuente?: FuenteRag;
}
