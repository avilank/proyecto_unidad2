import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { EstadoAlerta } from '../common/enums';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { findMaquinaByCodigo } from '../common/utils/maquina.util';
import { modeloSlug } from '../common/utils/modelo-ml.util';
import { tecnicoIniciales, tecnicoNombre } from '../common/utils/tecnico-display.util';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { Maquina } from '../database/models/maquina.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';

const ALERT_INCLUDES = [
  { model: Tecnico, include: [{ model: Usuario }] },
  {
    model: Orden,
    include: [
      {
        model: AnalisisFallo,
        include: [{ model: ClasificacionFallo, include: [{ model: TipoFallo }] }],
      },
    ],
  },
  {
    model: AnalisisFallo,
    include: [
      { model: PrediccionFallo, include: [{ model: ModeloMl }] },
      { model: ClasificacionFallo, include: [{ model: TipoFallo }, { model: ModeloMl }] },
    ],
  },
  { model: Maquina },
];

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
  ) {}

  toResponse(a: Alerta) {
    const liderS2 = a.analisis?.clasificaciones?.find((c) => c.esLider);
    const liderS1 = a.analisis?.predicciones?.find((p) => p.esLider);
    const tipoFallo = liderS2?.tipoFallo?.codigo ?? null;
    const confianzaLider =
      liderS1?.probabilidad != null
        ? Number(liderS1.probabilidad) / 100
        : a.analisis?.ensembleAvg != null
          ? Number(a.analisis.ensembleAvg)
          : null;

    return {
      id: a.codigo,
      orderId: a.orden?.codigo ?? null,
      ordenId: a.orden?.codigo ?? null,
      maquinaId: a.maquina?.codigo ?? String(a.idMaquina),
      nivel: a.nivelRiesgo,
      reglaCodigo: a.reglaDisparada ?? null,
      tipoFallo,
      modeloPrediccion: liderS1?.modeloMl
        ? modeloSlug(liderS1.modeloMl, 'xgboost')
        : null,
      confianzaPrediccion:
        liderS1?.probabilidad != null ? Number(liderS1.probabilidad) : null,
      modeloClasificacion: liderS2?.modeloMl
        ? modeloSlug(liderS2.modeloMl, 'lightgbm')
        : null,
      confianzaLider,
      ensembleAvg: confianzaLider,
      tecnicoId: a.idTecnico ?? null,
      tecnico: a.tecnico
        ? {
            id: a.tecnico.idTecnico,
            nombre: tecnicoNombre(a.tecnico),
            iniciales: tecnicoIniciales(a.tecnico),
          }
        : null,
      proximoReintentoAsignacion:
        a.orden?.proximoReintentoAsignacion?.toISOString() ?? null,
      estado: a.estado,
      notificacionEnviada: false,
      creadoEn: a.fechaAlerta,
    };
  }

  async findAll(
    query: PaginationQueryDto & {
      estado?: string;
      nivel?: string;
      maquinaId?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.estado) where.estado = query.estado;
    if (query.nivel) where.nivelRiesgo = query.nivel;
    if (query.maquinaId) {
      const m = await findMaquinaByCodigo(query.maquinaId);
      if (m) where.idMaquina = m.idMaquina;
    }

    const { rows, count } = await this.alertaModel.findAndCountAll({
      where,
      include: ALERT_INCLUDES,
      offset: (page - 1) * limit,
      limit,
      order: [['fechaAlerta', 'DESC']],
    });

    return paginate(
      rows.map((a) => this.toResponse(a)),
      count,
      page,
      limit,
    );
  }

  async findActive() {
    const rows = await this.alertaModel.findAll({
      where: {
        estado: {
          [Op.in]: [
            EstadoAlerta.ANALIZANDO,
            EstadoAlerta.CLASIFICANDO,
            EstadoAlerta.PENDIENTE,
            EstadoAlerta.EN_PROGRESO,
          ],
        },
      },
      include: ALERT_INCLUDES,
      order: [['fechaAlerta', 'DESC']],
    });
    return rows.map((a) => this.toResponse(a));
  }

  async findOne(codigo: string) {
    const a = await this.alertaModel.findOne({
      where: { codigo },
      include: ALERT_INCLUDES,
    });
    if (!a) throw new NotFoundException('Alerta no encontrada');
    return this.toResponse(a);
  }

  async updateStatus(codigo: string, estado: EstadoAlerta) {
    const a = await this.alertaModel.findOne({ where: { codigo } });
    if (!a) throw new NotFoundException('Alerta no encontrada');
    await a.update({ estado });
    return this.findOne(codigo);
  }
}
