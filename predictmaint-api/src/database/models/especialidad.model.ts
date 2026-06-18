import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, HasMany } from 'sequelize-typescript';
import { Tecnico } from './tecnico.model';

@Table({ tableName: 'especialidades', underscored: true, timestamps: false })
export class Especialidad extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idEspecialidad: number;

  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  declare nombre: string;

  @Column(DataType.TEXT)
  declare descripcion?: string;

  @HasMany(() => Tecnico)
  declare tecnicos?: Tecnico[];
}
