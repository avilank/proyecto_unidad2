import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({ tableName: 'configuracion', underscored: true, timestamps: false })
export class Configuracion extends Model {
  @PrimaryKey
  @Column(DataType.STRING(80))
  clave!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  valor!: string;

  @Column(DataType.STRING(40))
  vista?: string;
}
