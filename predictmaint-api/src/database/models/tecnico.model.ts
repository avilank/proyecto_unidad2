import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Especialidad } from './especialidad.model';
import { Usuario } from './usuario.model';
import { Orden } from './orden.model';
import { Alerta } from './alerta.model';

@Table({ tableName: 'tecnicos', underscored: true, timestamps: false })
export class Tecnico extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare idTecnico: number;

  @ForeignKey(() => Usuario)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  declare idUsuario: number;

  @ForeignKey(() => Especialidad)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idEspecialidad: number;

  @Column({ type: DataType.STRING(30), allowNull: false, defaultValue: 'disponible' })
  declare disponibilidad: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  declare enviarWssp: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare enviarCorreo: boolean;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare turno: string;

  @Column({ type: DataType.SMALLINT, defaultValue: 1 })
  declare nivelExperiencia: number;

  @BelongsTo(() => Usuario)
  declare usuario?: Usuario;

  @BelongsTo(() => Especialidad)
  declare especialidadRef?: Especialidad;

  @HasMany(() => Orden)
  declare ordenes?: Orden[];

  @HasMany(() => Alerta)
  declare alertas?: Alerta[];
}
