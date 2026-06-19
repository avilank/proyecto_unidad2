import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { EstadoOrden } from '../common/enums';
import { findMaquinaByCodigo } from '../common/utils/maquina.util';
import { resolveModeloId } from '../common/utils/modelo-ml.util';
import { tecnicoNombre } from '../common/utils/tecnico-display.util';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayService, MlRagSource } from '../ml-gateway/ml-gateway.service';

@Injectable()
export class RagService {
  constructor(
    @InjectModel(RecomendacionRag) private readonly recomendacionModel: typeof RecomendacionRag,
    @InjectModel(FuenteRag) private readonly fuenteModel: typeof FuenteRag,
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(EventoOrden) private readonly eventoModel: typeof EventoOrden,
    @InjectModel(ClasificacionFallo) private readonly clasificacionModel: typeof ClasificacionFallo,
    @InjectModel(RespuestaRecomendacion) private readonly respuestaModel: typeof RespuestaRecomendacion,
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
      include: [{ model: FuenteRag }],
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
      fuentes: acciones
        .map((a) => a.fuente?.titulo)
        .filter(Boolean) as string[],
    };
  }

  async getPlan(orderCodigo: string) {
    return this.toPlanResponse(orderCodigo);
  }

  private async getRagSources(fuenteIds?: number[]): Promise<MlRagSource[]> {
    const where =
      fuenteIds && fuenteIds.length > 0
        ? { idFuente: { [Op.in]: fuenteIds } }
        : { activo: true };
    const rows = await this.fuenteModel.findAll({
      where,
      order: [['idFuente', 'ASC']],
    });

    return rows.map((f) => ({
      id: f.idFuente,
      titulo: f.titulo,
      autor: f.autor ?? null,
      url: f.url ?? null,
      descripcion: f.autor ?? null,
    }));
  }

  async accept(orderCodigo: string) {
    const { orden } = await this.getLiderClasificacion(orderCodigo);
    await this.respuestaModel.create({
      idOrden: orden.idOrden,
      decision: 'aceptado',
      fechaRespuesta: new Date(),
    });
    if (orden.estado === EstadoOrden.PENDIENTE) {
      await orden.update({ estado: EstadoOrden.EN_PROGRESO, fechaInicio: new Date() });
      await this.eventoModel.create({
        idOrden: orden.idOrden,
        etapa: 'en_progreso',
        descripcion: 'Plan RAG aceptado',
        actor: 'tecnico',
        fechaEvento: new Date(),
      });
    }
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
    const fuentes = await this.getRagSources(fuenteIds);
    const ragResult = await this.mlGateway.rag({
      tipoFallo: lider.tipoFallo?.codigo ?? 'RNF',
      maquinaId: maquinaCodigo,
      historial: [],
      escalado,
      fuentes,
    });

    await this.recomendacionModel.destroy({ where: { idClasificacion: lider.idClasificacion } });

    for (const acc of ragResult.acciones) {
      let fuenteId: number | undefined;
      const titulo = ragResult.fuentes[acc.orden - 1];
      if (titulo) {
        let fuente = await this.fuenteModel.findOne({ where: { titulo } });
        if (!fuente) fuente = await this.fuenteModel.create({ titulo, activo: true });
        fuenteId = fuente.idFuente;
      }
      await this.recomendacionModel.create({
        idClasificacion: lider.idClasificacion,
        idFuente: fuenteId,
        orden: acc.orden,
        titulo: acc.titulo,
        prioridad: acc.prioridad,
        recomendacion: acc.detalle,
      });
    }
    return this.toPlanResponse(orderCodigo);
  }
}
