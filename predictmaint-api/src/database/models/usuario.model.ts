import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasOne,
} from 'sequelize-typescript';
import { Rol } from './rol.model';
import { Tecnico } from './tecnico.model';

@Table({ tableName: 'usuarios', underscored: true, timestamps: false })
export class Usuario extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idUsuario: number;

  @ForeignKey(() => Rol)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idRol: number;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare nombres: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare apellidos: string;

  @Column({ type: DataType.STRING(120), allowNull: false, unique: true })
  declare correo: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare passwordHash: string;

  @Column(DataType.STRING(20))
  declare telefono?: string;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: 'activo' })
  declare estado: string;

  @BelongsTo(() => Rol)
  declare rol?: Rol;

  @HasOne(() => Tecnico)
  declare tecnico?: Tecnico;

  get activo(): boolean {
    return this.estado === 'activo';
  }
}
