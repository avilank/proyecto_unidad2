import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';

@Table({ tableName: 'horario_envio', underscored: true, timestamps: false })
export class HorarioEnvio extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Column({ type: DataType.STRING(80), allowNull: false })
  evento!: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  hora!: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  destinatario!: string;

  @Column(DataType.TEXT)
  contenido?: string;
}
