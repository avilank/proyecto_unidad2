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
import { PrioridadAccion } from '../../common/enums';
import { enumValues } from '../../common/utils/enum-values.util';
import { PlanRag } from './plan-rag.model';

@Table({ tableName: 'accion_rag', underscored: true, timestamps: false })
export class AccionRag extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @ForeignKey(() => PlanRag)
  @Column({ type: DataType.BIGINT, allowNull: false, field: 'plan_id' })
  planId!: number;

  @Column({ type: DataType.SMALLINT, allowNull: false, field: 'orden' })
  ordenAccion!: number;

  @Column({ type: DataType.ENUM(...enumValues(PrioridadAccion)), allowNull: false })
  prioridad!: PrioridadAccion;

  @Column({ type: DataType.STRING(160), allowNull: false })
  titulo!: string;

  @Column(DataType.TEXT)
  detalle?: string;

  @BelongsTo(() => PlanRag)
  plan?: PlanRag;
}
