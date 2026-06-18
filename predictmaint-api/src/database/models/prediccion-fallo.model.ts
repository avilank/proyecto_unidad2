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
import { AnalisisFallo } from './analisis-fallo.model';
import { ModeloMl } from './modelo-ml.model';

@Table({ tableName: 'prediccion_fallo', underscored: true, timestamps: false })
export class PrediccionFallo extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare idResultado: number;

  @ForeignKey(() => AnalisisFallo)
  @Column({ type: DataType.BIGINT, allowNull: false })
  declare idAnalisis: number;

  @ForeignKey(() => ModeloMl)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idModelo: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare prediccion: string;

  @Column(DataType.DECIMAL(5, 2))
  declare confianza?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare probabilidad?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare esLider: boolean;

  @Column(DataType.INTEGER)
  declare tn?: number;

  @Column(DataType.INTEGER)
  declare fp?: number;

  @Column(DataType.INTEGER)
  declare fn?: number;

  @Column(DataType.INTEGER)
  declare tp?: number;

  @BelongsTo(() => AnalisisFallo)
  declare analisis?: AnalisisFallo;

  @BelongsTo(() => ModeloMl)
  declare modeloMl?: ModeloMl;
}
