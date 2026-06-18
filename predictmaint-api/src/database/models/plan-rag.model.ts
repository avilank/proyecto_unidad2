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
import { EstadoPlanRag } from '../../common/enums';
import { enumValues } from '../../common/utils/enum-values.util';
import { Orden } from './orden.model';
import { TipoFallo } from './tipo-fallo.model';
import { AccionRag } from './accion-rag.model';
import { PlanRagFuente } from './plan-rag-fuente.model';

@Table({ tableName: 'plan_rag', underscored: true, timestamps: false })
export class PlanRag extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.STRING(10), allowNull: false, field: 'orden_id' })
  ordenId!: string;

  @ForeignKey(() => TipoFallo)
  @Column({ type: DataType.CHAR(3), field: 'tipo_fallo' })
  tipoFalloCodigo?: string;

  @Column({ type: DataType.STRING(30), field: 'modelo_origen' })
  modeloOrigen?: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  escalado!: boolean;

  @Column({ type: DataType.ENUM(...enumValues(EstadoPlanRag)), defaultValue: 'pendiente' })
  estado!: EstadoPlanRag;

  @Column({ type: DataType.DATE, allowNull: false, field: 'generado_en' })
  generadoEn!: Date;

  @BelongsTo(() => Orden)
  orden?: Orden;

  @BelongsTo(() => TipoFallo, { foreignKey: 'tipo_fallo', targetKey: 'codigo' })
  tipoFallo?: TipoFallo;

  @HasMany(() => AccionRag)
  acciones?: AccionRag[];

  @HasMany(() => PlanRagFuente)
  fuentes?: PlanRagFuente[];
}
