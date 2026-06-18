import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, HasMany } from 'sequelize-typescript';
import { PrediccionFallo } from './prediccion-fallo.model';
import { ClasificacionFallo } from './clasificacion-fallo.model';

@Table({ tableName: 'modelos_ml', underscored: true, timestamps: false })
export class ModeloMl extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idModelo: number;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare nombre: string;

  @Column(DataType.STRING(40))
  declare tipo?: string;

  @Column(DataType.STRING(20))
  declare version?: string;

  @Column(DataType.DECIMAL(5, 2))
  declare accuracy?: number;

  @Column(DataType.DECIMAL(6, 3))
  declare rocAuc?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare precisionScore?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare recallScore?: number;

  @Column(DataType.DECIMAL(5, 2))
  declare f1Score?: number;

  @Column(DataType.DECIMAL(5, 3))
  declare f1Weighted?: number;

  @Column(DataType.INTEGER)
  declare tn?: number;

  @Column(DataType.INTEGER)
  declare fp?: number;

  @Column(DataType.INTEGER)
  declare fn?: number;

  @Column(DataType.INTEGER)
  declare tp?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare esPrediccion: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare esClasificacion: boolean;

  @Column(DataType.DECIMAL(4, 3))
  declare umbral?: number;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare esDefault: boolean;

  @HasMany(() => PrediccionFallo)
  declare predicciones?: PrediccionFallo[];

  @HasMany(() => ClasificacionFallo)
  declare clasificaciones?: ClasificacionFallo[];
}
