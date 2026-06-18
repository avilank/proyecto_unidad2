import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { EtapaModelo } from '../common/enums';
import { ModeloMl } from '../database/models/modelo-ml.model';

@Injectable()
export class MlModelsService {
  constructor(@InjectModel(ModeloMl) private readonly modeloModel: typeof ModeloMl) {}

  toResponse(m: ModeloMl) {
    return {
      id: m.idModelo,
      etapa: m.esPrediccion ? EtapaModelo.S1 : EtapaModelo.S2,
      modelo: m.nombre,
      accuracy: m.accuracy != null ? Number(m.accuracy) : null,
      metricaPrincipal: m.esPrediccion ? 'AUC' : 'F1-m',
      valorMetrica:
        m.rocAuc != null
          ? Number(m.rocAuc)
          : m.f1Score != null
            ? Number(m.f1Score)
            : null,
      activo: m.esDefault,
      descripcion: m.version ?? null,
    };
  }

  async findAll(etapa?: EtapaModelo) {
    const where =
      etapa === EtapaModelo.S1
        ? { esPrediccion: true }
        : etapa === EtapaModelo.S2
          ? { esClasificacion: true }
          : {};
    const rows = await this.modeloModel.findAll({
      where,
      order: [['idModelo', 'ASC']],
    });
    return rows.map((m) => this.toResponse(m));
  }

  async activate(id: number) {
    const modelo = await this.modeloModel.findByPk(id);
    if (!modelo) throw new NotFoundException('Modelo no encontrado');
    const filter = modelo.esPrediccion
      ? { esPrediccion: true }
      : { esClasificacion: true };
    await this.modeloModel.update({ esDefault: false }, { where: filter });
    await modelo.update({ esDefault: true });
    return this.toResponse(modelo);
  }
}
