import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, HasMany } from 'sequelize-typescript';
import { Usuario } from './usuario.model';

@Table({ tableName: 'roles', underscored: true, timestamps: false })
export class Rol extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idRol: number;

  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  declare nombre: string;

  @Column(DataType.TEXT)
  declare descripcion?: string;

  @HasMany(() => Usuario)
  declare usuarios?: Usuario[];
}
