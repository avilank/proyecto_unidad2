import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { buildGeneralRecommendation } from '../common/utils/rag-recommendation.util';
import {
  formatRagSourceFaultLabel,
  ragSourceAppliesToFault,
} from '../common/utils/rag-source-fault.util';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { RecomendacionRagFuente } from '../database/models/recomendacion-rag-fuente.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayService, MlRagSource } from '../ml-gateway/ml-gateway.service';

@Injectable()
export class RagService {
  constructor(
    @InjectModel(RecomendacionRag) private readonly recomendacionModel: typeof RecomendacionRag,
    @InjectModel(RecomendacionRagFuente)
    private readonly recomendacionFuenteModel: typeof RecomendacionRagFuente,
    @InjectModel(FuenteRag) private readonly fuenteModel: typeof FuenteRag,
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(EventoOrden) private readonly eventoModel: typeof EventoOrden,
    @InjectModel(ClasificacionFallo) private readonly clasificacionModel: typeof ClasificacionFallo,
    @InjectModel(RespuestaRecomendacion) private readonly respuestaModel: typeof RespuestaRecomendacion,
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
    private readonly mlGateway: MlGatewayService,
  ) {}

  private async getLiderClasificacion(orderCodigo: string) {
    const orden = await this.ordenModel.findOne({
      where: { codigo: orderCodigo },
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          include: [
            {
              model: ClasificacionFallo,
              include: [{ model: TipoFallo }],
            },
          ],
        },
      ],
    });
    if (!orden?.analisis) throw new NotFoundException('Orden no encontrada');
    const lider = orden.analisis.clasificaciones?.find((c) => c.esLider);
    if (!lider) throw new NotFoundException('Clasificación no encontrada');
    return { orden, lider };
  }

  async toPlanResponse(orderCodigo: string) {
    const { orden, lider } = await this.getLiderClasificacion(orderCodigo);
    const acciones = await this.recomendacionModel.findAll({
      where: { idClasificacion: lider.idClasificacion },
      include: [{ model: RecomendacionRagFuente, include: [FuenteRag] }],
      order: [['orden', 'ASC']],
    });

    const respuesta = await this.respuestaModel.findOne({
      where: { idOrden: orden.idOrden },
      order: [['fechaRespuesta', 'DESC']],
    });

    return {
      id: lider.idClasificacion,
      orderId: orderCodigo,
      tipoFallo: lider.tipoFallo?.codigo ?? null,
      modeloOrigen: 'rag',
      escalado: false,
      estado: respuesta?.decision ?? 'pendiente',
      acciones: acciones.map((a) => ({
        orden: a.orden,
        prioridad: a.prioridad,
        titulo: a.titulo,
        detalle: a.recomendacion ?? null,
      })),
      fuentes: Array.from(
        new Set(
          acciones.flatMap((a) =>
            (a.fuentes ?? [])
              .map((f) => f.fuente?.titulo)
              .filter((t): t is string => Boolean(t)),
          ),
        ),
      ),
    };
  }

  async getPlan(orderCodigo: string) {
    return this.toPlanResponse(orderCodigo);
  }

  private async getRagSourcesForFault(
    tipoFallo: string,
    fuenteIds?: number[],
  ): Promise<MlRagSource[]> {
    if (fuenteIds && fuenteIds.length > 0) {
      return this.getRagSourcesByIds(fuenteIds, tipoFallo);
    }

    const rows = await this.fuenteModel.findAll({
      where: { activo: true },
      order: [['idFuente', 'ASC']],
    });

    return rows
      .filter((f) => ragSourceAppliesToFault(f.titulo, tipoFallo))
      .map((f) => ({
        id: f.idFuente,
        titulo: f.titulo,
        autor: f.autor ?? null,
        url: f.url ?? null,
        descripcion: f.autor ?? null,
        tipoFallo: formatRagSourceFaultLabel(f.titulo),
      }));
  }

  private async getRagSourcesByIds(
    fuenteIds: number[],
    tipoFallo: string,
  ): Promise<MlRagSource[]> {
    const rows = await this.fuenteModel.findAll({
      where: { idFuente: { [Op.in]: fuenteIds }, activo: true },
      order: [['idFuente', 'ASC']],
    });

    return rows
      .filter((f) => ragSourceAppliesToFault(f.titulo, tipoFallo))
      .map((f) => ({
        id: f.idFuente,
        titulo: f.titulo,
        autor: f.autor ?? null,
        url: f.url ?? null,
        descripcion: f.autor ?? null,
        tipoFallo: formatRagSourceFaultLabel(f.titulo),
      }));
  }

  async accept(orderCodigo: string) {
    const { orden } = await this.getLiderClasificacion(orderCodigo);
    await this.respuestaModel.create({
      idOrden: orden.idOrden,
      decision: 'aceptado',
      fechaRespuesta: new Date(),
    });
    await this.eventoModel.create({
      idOrden: orden.idOrden,
      etapa: 'rag_aceptado',
      descripcion: 'Plan RAG aceptado',
      actor: 'tecnico',
      fechaEvento: new Date(),
    });
    return this.toPlanResponse(orderCodigo);
  }

  async reject(orderCodigo: string, motivo?: string) {
    const { orden } = await this.getLiderClasificacion(orderCodigo);
    await this.respuestaModel.create({
      idOrden: orden.idOrden,
      decision: 'rechazado',
      observacion: motivo,
      fechaRespuesta: new Date(),
    });
    await this.eventoModel.create({
      idOrden: orden.idOrden,
      etapa: 'respuesta_tecnico',
      descripcion: motivo ?? 'Plan RAG rechazado',
      actor: 'tecnico',
      fechaEvento: new Date(),
    });
    return this.toPlanResponse(orderCodigo);
  }

  async regenerate(orderCodigo: string, escalado = false, fuenteIds?: number[]) {
    const { orden, lider } = await this.getLiderClasificacion(orderCodigo);
    const maquinaCodigo = orden.maquina?.codigo ?? '';
    const tipoFallo = lider.tipoFallo?.codigo ?? 'RNF';
    const fuentes = await this.getRagSourcesForFault(tipoFallo, fuenteIds);
    const ragResult = await this.mlGateway.rag({
      tipoFallo,
      maquinaId: maquinaCodigo,
      historial: [],
      escalado,
      fuentes,
    });

    const prev = await this.recomendacionModel.findAll({
      where: { idClasificacion: lider.idClasificacion },
      attributes: ['idRecomendacion'],
    });
    const prevIds = prev.map((r) => r.idRecomendacion);
    if (prevIds.length) {
      await this.recomendacionFuenteModel.destroy({
        where: { idRecomendacion: { [Op.in]: prevIds } },
      });
    }
    await this.recomendacionModel.destroy({ where: { idClasificacion: lider.idClasificacion } });

    const general = buildGeneralRecommendation(
      lider.tipoFallo?.codigo ?? ragResult.tipoFallo ?? 'RNF',
      ragResult.acciones,
      Boolean(ragResult.escalado),
    );
    const rec = await this.recomendacionModel.create({
      idClasificacion: lider.idClasificacion,
      orden: 1,
      titulo: general.titulo,
      prioridad: general.prioridad,
      recomendacion: general.detalle,
    });

    const sourceIds = await this.ensureSourceIds(ragResult.fuentes);
    if (sourceIds.length) {
      await this.recomendacionFuenteModel.bulkCreate(
        sourceIds.map((idFuente) => ({ idRecomendacion: rec.idRecomendacion, idFuente })),
      );
    }
    return this.toPlanResponse(orderCodigo);
  }

  private async ensureSourceIds(sourceTitles: string[]): Promise<number[]> {
    const result: number[] = [];
    for (const title of sourceTitles) {
      if (!title) continue;
      let fuente = await this.fuenteModel.findOne({ where: { titulo: title } });
      if (!fuente) fuente = await this.fuenteModel.create({ titulo: title, activo: true });
      result.push(fuente.idFuente);
    }
    return Array.from(new Set(result));
  }
}
