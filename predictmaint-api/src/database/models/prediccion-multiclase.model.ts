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
import { ModeloMulticlase } from '../../common/enums';
import { enumValues } from '../../common/utils/enum-values.util';
import { Orden } from './orden.model';
import { TipoFallo } from './tipo-fallo.model';

@Table({ tableName: 'prediccion_multiclase', underscored: true, timestamps: false })
export class PrediccionMulticlase extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.STRING(10), allowNull: false, field: 'orden_id' })
  ordenId!: string;

  @Column({ type: DataType.ENUM(...enumValues(ModeloMulticlase)), allowNull: false })
  modelo!: ModeloMulticlase;

  @ForeignKey(() => TipoFallo)
  @Column({ type: DataType.CHAR(3), field: 'tipo_predicho' })
  tipoPredichoCodigo?: string;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'prob_hdf' })
  probHdf?: number;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'prob_pwf' })
  probPwf?: number;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'prob_twf' })
  probTwf?: number;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'prob_osf' })
  probOsf?: number;

  @Column({ type: DataType.DECIMAL(5, 2), field: 'prob_rnf' })
  probRnf?: number;

  @Column({ type: DataType.DECIMAL(4, 3), field: 'f1_macro' })
  f1Macro?: number;

  @Column({ type: DataType.DECIMAL(4, 3), field: 'f1_weighted' })
  f1Weighted?: number;

  @Column(DataType.DECIMAL(5, 2))
  accuracy?: number;

  @Column(DataType.INTEGER)
  tp?: number;

  @Column(DataType.INTEGER)
  fn?: number;

  @Column(DataType.INTEGER)
  fp?: number;

  @Column(DataType.INTEGER)
  tn?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'es_lider' })
  esLider!: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  diverge!: boolean;

  @BelongsTo(() => Orden)
  orden?: Orden;

  @BelongsTo(() => TipoFallo, { foreignKey: 'tipo_predicho', targetKey: 'codigo' })
  tipoPredicho?: TipoFallo;
}
