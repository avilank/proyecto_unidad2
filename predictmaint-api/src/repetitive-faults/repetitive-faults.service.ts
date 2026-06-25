import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import {
  EstadoFalloRepetitivo,
  NivelFalloRepetitivo,
} from '../common/enums';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { FalloRepetitivo } from '../database/models/fallo-repetitivo.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { ConfigCatalogService } from '../config-catalog/config-catalog.service';

@Injectable()
export class RepetitiveFaultsService {
  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(FalloRepetitivo)
    private readonly falloModel: typeof FalloRepetitivo,
    private readonly configCatalog: ConfigCatalogService,
  ) {}

  /**
   * Calcula los fallos repetitivos en vivo (máquina + tipo de fallo con ≥ umbral de
   * ocurrencias en la ventana), los persiste/actualiza en `fallo_repetitivo` y devuelve
   * los que siguen activos (no resueltos).
   */
  async findAll(_query?: PaginationQueryDto & Record<string, string>) {
    const cfg = await this.configCatalog.getFallosRepetitivosConfig();
    const ventanaDias = cfg.umbrales.marcar.dias;
    const minVeces = cfg.umbrales.marcar.veces;
    const notificarVeces = cfg.umbrales.notificar.veces;
    const from = new Date(Date.now() - ventanaDias * 24 * 60 * 60 * 1000);

    const ordenes = await this.ordenModel.findAll({
      where: { fechaCreacion: { [Op.gte]: from }, idTecnico: { [Op.ne]: null } },
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          required: true,
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: true,
              include: [{ model: TipoFallo, required: true }],
            },
          ],
        },
      ],
    });

    // Agrupar por máquina + tipo de fallo.
    const groups = new Map<
      string,
      { idMaquina: number; maquinaId: string; tipoFallo: string; count: number; last: Date }
    >();
    for (const o of ordenes) {
      const lider = o.analisis?.clasificaciones?.find((c) => c.esLider);
      const tipo = lider?.tipoFallo?.codigo;
      if (!tipo) continue;
      const key = `${o.idMaquina}:${tipo}`;
      const prev = groups.get(key);
      const fecha = new Date(o.fechaCreacion);
      if (prev) {
        prev.count += 1;
        if (fecha > prev.last) prev.last = fecha;
      } else {
        groups.set(key, {
          idMaquina: o.idMaquina,
          maquinaId: o.maquina?.codigo ?? String(o.idMaquina),
          tipoFallo: tipo,
          count: 1,
          last: fecha,
        });
      }
    }

    const recurrentes = [...groups.values()].filter((g) => g.count >= minVeces);

    // Persistir / actualizar registros y recolectar los activos.
    const items: ReturnType<typeof this.toResponse>[] = [];
    for (const g of recurrentes) {
      const nivel =
        g.count >= notificarVeces
          ? NivelFalloRepetitivo.CRITICO
          : NivelFalloRepetitivo.MODERADO;

      let row = await this.falloModel.findOne({
        where: { idMaquina: g.idMaquina, tipoFalloCodigo: g.tipoFallo },
      });

      if (!row) {
        row = await this.falloModel.create({
          idMaquina: g.idMaquina,
          tipoFalloCodigo: g.tipoFallo,
          ocurrencias: g.count,
          ventanaDias,
          estado: EstadoFalloRepetitivo.EN_REVISION,
          nivel,
          supervisorNotificado: false,
          ultimaOcurrenciaEn: g.last,
        });
      } else if (row.estado !== EstadoFalloRepetitivo.RESUELTO) {
        await row.update({
          ocurrencias: g.count,
          ventanaDias,
          nivel,
          ultimaOcurrenciaEn: g.last,
        });
      }
      // Si está RESUELTO, se deja oculto (no se reactiva automáticamente).

      if (row.estado !== EstadoFalloRepetitivo.RESUELTO) {
        items.push(this.toResponse(row, g.maquinaId));
      }
    }

    items.sort((a, b) => b.ocurrencias - a.ocurrencias);
    return { items, total: items.length };
  }

  async getHistory(_maquinaId: string, _tipoFallo?: string) {
    return [];
  }

  async resolve(id: number, nota?: string) {
    const row = await this.falloModel.findByPk(id);
    if (!row) throw new NotFoundException('Fallo repetitivo no encontrado');
    await row.update({
      estado: EstadoFalloRepetitivo.RESUELTO,
      ultimaAccion: nota?.trim() || 'Resuelto manualmente',
    });
    return { ok: true };
  }

  private toResponse(row: FalloRepetitivo, maquinaId: string) {
    return {
      id: Number(row.id),
      maquinaId,
      tipoFallo: row.tipoFalloCodigo ?? null,
      ocurrencias: row.ocurrencias,
      ventanaDias: row.ventanaDias,
      estado: row.estado,
      nivel: row.nivel ?? null,
      ultimaAccion: row.ultimaAccion ?? null,
      supervisorNotificado: row.supervisorNotificado,
      ultimaOcurrenciaEn: row.ultimaOcurrenciaEn ?? null,
    };
  }
}
