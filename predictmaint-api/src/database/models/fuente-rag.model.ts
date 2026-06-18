import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, HasMany } from 'sequelize-typescript';
import { RecomendacionRag } from './recomendacion-rag.model';

@Table({ tableName: 'fuentes_rag', underscored: true, timestamps: false })
export class FuenteRag extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idFuente: number;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare titulo: string;

  @Column(DataType.STRING(120))
  declare autor?: string;

  @Column(DataType.TEXT)
  declare url?: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare activo: boolean;

  @HasMany(() => RecomendacionRag)
  declare recomendaciones?: RecomendacionRag[];
}
