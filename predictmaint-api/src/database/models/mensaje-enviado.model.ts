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
import { Canal, TipoEnvio, EstadoMensaje } from '../../common/enums';
import { enumValues } from '../../common/utils/enum-values.util';
import { Tecnico } from './tecnico.model';
import { Orden } from './orden.model';

@Table({ tableName: 'mensaje_enviado', underscored: true, timestamps: false })
export class MensajeEnviado extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id!: number;

  @ForeignKey(() => Tecnico)
  @Column({ type: DataType.INTEGER, field: 'tecnico_id' })
  tecnicoId?: number;

  @ForeignKey(() => Orden)
  @Column({ type: DataType.BIGINT, field: 'id_orden' })
  declare idOrden?: number;

  @Column(DataType.STRING(120))
  maquinas?: string;

  @Column(DataType.STRING(160))
  motivo?: string;

  @Column({ type: DataType.ENUM(...enumValues(Canal)), allowNull: false })
  canal!: Canal;

  @Column({ type: DataType.ENUM(...enumValues(TipoEnvio)), field: 'tipo_envio' })
  tipoEnvio?: TipoEnvio;

  @Column({ type: DataType.ENUM(...enumValues(EstadoMensaje)), defaultValue: 'pendiente' })
  estado!: EstadoMensaje;

  @Column({ type: DataType.DATE, allowNull: false, field: 'enviado_en' })
  enviadoEn!: Date;

  @BelongsTo(() => Tecnico)
  tecnico?: Tecnico;

  @BelongsTo(() => Orden)
  orden?: Orden;
}
