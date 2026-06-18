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
import { TipoFallo } from './tipo-fallo.model';

@Table({ tableName: 'accion_escalada', underscored: true, timestamps: false })
export class AccionEscalada extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => TipoFallo)
  @Column({ type: DataType.CHAR(3), allowNull: false, field: 'tipo_fallo' })
  tipoFalloCodigo!: string;

  @Column({ type: DataType.TEXT, allowNull: false, field: 'acciones_adicionales' })
  accionesAdicionales!: string;

  @BelongsTo(() => TipoFallo, { foreignKey: 'tipo_fallo', targetKey: 'codigo' })
  tipoFallo?: TipoFallo;
}
