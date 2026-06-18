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
import { Usuario } from './usuario.model';

@Table({ tableName: 'audit_logs', underscored: true, timestamps: false })
export class AuditLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Usuario)
  @Column(DataType.INTEGER)
  declare idUsuario?: number;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare modulo: string;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare accion: string;

  @Column(DataType.STRING(255))
  declare url?: string;

  @Column(DataType.TEXT)
  declare body?: string;

  @Column(DataType.STRING(45))
  declare ip?: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare fechaRegistro: Date;

  @BelongsTo(() => Usuario)
  declare usuario?: Usuario;
}
