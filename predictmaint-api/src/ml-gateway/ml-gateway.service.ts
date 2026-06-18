import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface MlPredictFeatures {
  type: string;
  airTemperature: number;
  processTemperature: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
}

export interface MlBinaryModelResult {
  modelo: string;
  prediccion: string;
  probabilidad: number;
  accuracy?: number;
  rocAuc?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  tn?: number;
  fp?: number;
  fn?: number;
  tp?: number;
  esLider?: boolean;
}

export interface MlPredictResponse {
  ensembleAvg: number;
  nivelRiesgo: string;
  consenso: string;
  modelos: MlBinaryModelResult[];
}

export interface MlMulticlassModelResult {
  modelo: string;
  tipoPredicho: string;
  probHdf?: number;
  probPwf?: number;
  probTwf?: number;
  probOsf?: number;
  probRnf?: number;
  f1Macro?: number;
  f1Weighted?: number;
  accuracy?: number;
  tp?: number;
  fn?: number;
  fp?: number;
  tn?: number;
  esLider?: boolean;
  diverge?: boolean;
}

export interface MlClassifyResponse {
  tipoPredicho: string;
  agreement: string;
  confianza: number;
  modelos: MlMulticlassModelResult[];
}

export interface MlRagAction {
  orden: number;
  prioridad: string;
  titulo: string;
  detalle: string;
}

export interface MlRagResponse {
  tipoFallo: string;
  escalado: boolean;
  acciones: MlRagAction[];
  fuentes: string[];
}

@Injectable()
export class MlGatewayService {
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('ml.serviceUrl');
    const apiKey = this.configService.get<string>('ml.apiKey');
    this.client = axios.create({
      baseURL,
      headers: { 'X-API-Key': apiKey },
      timeout: 30000,
    });
  }

  async predict(features: MlPredictFeatures): Promise<MlPredictResponse> {
    const { data } = await this.client.post<MlPredictResponse>('/predict', features);
    return data;
  }

  async classify(features: MlPredictFeatures): Promise<MlClassifyResponse> {
    const { data } = await this.client.post<MlClassifyResponse>('/classify', features);
    return data;
  }

  async rag(payload: {
    tipoFallo: string;
    maquinaId: string;
    historial: unknown[];
    escalado?: boolean;
  }): Promise<MlRagResponse> {
    const { data } = await this.client.post<MlRagResponse>('/rag', payload);
    return data;
  }

  async health(): Promise<{ status: string; modelosCargados?: number }> {
    const { data } = await this.client.get('/health');
    return data;
  }
}
