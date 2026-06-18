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
import {
  ModeloBinario,
  PrediccionBinaria as PrediccionBinariaEnum,
} from '../../common/enums';
import { enumValues } from '../../common/utils/enum-values.util';
import { Orden } from './orden.model';

@Table({ tableName: 'prediccion_binaria', underscored: true, timestamps: false })
export class PrediccionBinaria extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.STRING(10), allowNull: false, field: 'orden_id' })
  ordenId!: string;

  @Column({ type: DataType.ENUM(...enumValues(ModeloBinario)), allowNull: false })
  modelo!: ModeloBinario;

  @Column({ type: DataType.ENUM(...enumValues(PrediccionBinariaEnum)), allowNull: false })
  prediccion!: PrediccionBinariaEnum;

  @Column({ type: DataType.DECIMAL(5, 2), allowNull: false })
  probabilidad!: number;

  @Column(DataType.DECIMAL(5, 2))
  accuracy?: number;

  @Column({ type: DataType.DECIMAL(4, 3), field: 'roc_auc' })
  rocAuc?: number;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'precision' })
  precisionMetric?: number;

  @Column(DataType.DECIMAL(5, 2))
  recall?: number;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'f1_score' })
  f1Score?: number;

  @Column(DataType.INTEGER)
  tn?: number;

  @Column(DataType.INTEGER)
  fp?: number;

  @Column(DataType.INTEGER)
  fn?: number;

  @Column(DataType.INTEGER)
  tp?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'es_lider' })
  esLider!: boolean;

  @BelongsTo(() => Orden)
  orden?: Orden;
}
