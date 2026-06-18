import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';

@Table({ tableName: 'regla_notificacion', underscored: true, timestamps: false })
export class ReglaNotificacion extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Column({ type: DataType.STRING(10), allowNull: false, unique: true })
  nivel!: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  recibe!: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  canal!: string;
}
