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
import {
  EstadoFalloRepetitivo,
  NivelFalloRepetitivo,
} from '../../common/enums';
import { enumValues } from '../../common/utils/enum-values.util';
import { Maquina } from './maquina.model';
import { TipoFallo } from './tipo-fallo.model';

@Table({ tableName: 'fallo_repetitivo', underscored: true, timestamps: false })
export class FalloRepetitivo extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @ForeignKey(() => Maquina)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare idMaquina: number;

  @ForeignKey(() => TipoFallo)
  @Column({ type: DataType.CHAR(3), field: 'tipo_fallo' })
  tipoFalloCodigo?: string;

  @Column({ type: DataType.SMALLINT, allowNull: false })
  ocurrencias!: number;

  @Column({ type: DataType.SMALLINT, defaultValue: 7, field: 'ventana_dias' })
  ventanaDias!: number;

  @Column({ type: DataType.ENUM(...enumValues(EstadoFalloRepetitivo)), allowNull: false })
  estado!: EstadoFalloRepetitivo;

  @Column({ type: DataType.STRING(160), field: 'ultima_accion' })
  ultimaAccion?: string;

  @Column({ type: DataType.ENUM(...enumValues(NivelFalloRepetitivo)) })
  nivel?: NivelFalloRepetitivo;

  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'supervisor_notificado' })
  supervisorNotificado!: boolean;

  @Column({ type: DataType.DATE, field: 'ultima_ocurrencia_en' })
  ultimaOcurrenciaEn?: Date;

  @BelongsTo(() => Maquina)
  maquina?: Maquina;

  @BelongsTo(() => TipoFallo, { foreignKey: 'tipo_fallo', targetKey: 'codigo' })
  tipoFallo?: TipoFallo;
}
