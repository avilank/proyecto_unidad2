import type { BinaryPrediction, MulticlassPrediction, Order, OrderDetail, OrderEvent } from '@/core/entities';
import type { OrdersPaginatedResponse } from '@/core/types/api';
import type { IOrderRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export interface OrderQuery {
  page?: number;
  limit?: number;
  estado?: string;
  maquinaId?: string;
  tipoFallo?: string;
  tecnicoId?: number;
  algoritmo?: string;
  from?: string;
  to?: string;
  search?: string;
  /** Historial: solo órdenes con técnico asignado */
  conTecnico?: boolean;
}

export interface BinaryPredictionsResponse {
  items: BinaryPrediction[];
  modeloLider: string | null;
  confianzaLider: number | null;
  ensembleAvg: number | null;
  nivelRiesgo: string;
  consenso: string | null;
}

export interface MulticlassPredictionsResponse {
  items: MulticlassPrediction[];
  modeloLider: string | null;
  tipoPredicho: string | null;
  agreement: string;
  confianza: number | null;
}

export class OrderRepository implements IOrderRepository {
  findAll(query?: OrderQuery): Promise<OrdersPaginatedResponse<Order>> {
    return apiClient.get<OrdersPaginatedResponse<Order>>('/orders', { params: query });
  }

  async findAllPages(query: OrderQuery): Promise<Order[]> {
    const limit = 100;
    let page = 1;
    const all: Order[] = [];

    for (;;) {
      const res = await this.findAll({ ...query, page, limit });
      all.push(...res.items);
      if (all.length >= res.total || res.items.length === 0) break;
      page += 1;
    }

    return all;
  }

  findById(id: string): Promise<OrderDetail> {
    return apiClient.get<OrderDetail>(`/orders/${id}`);
  }

  getTimeline(id: string): Promise<OrderEvent[]> {
    return apiClient.get<OrderEvent[]>(`/orders/${id}/timeline`);
  }

  getBinaryPredictions(orderId: string): Promise<BinaryPredictionsResponse> {
    return apiClient.get<BinaryPredictionsResponse>(`/predictions/binary/${orderId}`);
  }

  getMulticlassPredictions(orderId: string): Promise<MulticlassPredictionsResponse> {
    return apiClient.get<MulticlassPredictionsResponse>(`/predictions/multiclass/${orderId}`);
  }

  updateStatus(orderId: string, estado: string): Promise<OrderDetail> {
    return apiClient.patch<OrderDetail>(`/orders/${orderId}/status`, { estado });
  }

  registerSolution(
    orderId: string,
    payload: {
      descripcion: string;
      solucionTipo: string;
      comentario?: string;
      esFalla?: boolean;
      esPrediccionCorrecta?: boolean;
      esClasificacionCorrecta?: boolean;
    },
  ): Promise<OrderDetail> {
    return apiClient.post<OrderDetail>(`/orders/${orderId}/solution`, payload);
  }

  escalate(orderId: string, motivo: string): Promise<OrderDetail> {
    return apiClient.post<OrderDetail>(`/orders/${orderId}/escalate`, { motivo });
  }

  rejectPrediction(orderId: string, justificacion: string): Promise<OrderDetail> {
    return apiClient.post<OrderDetail>(`/orders/${orderId}/reject-prediction`, {
      justificacion,
    });
  }

  startOrder(orderId: string): Promise<OrderDetail> {
    return apiClient.post<OrderDetail>(`/orders/${orderId}/start`);
  }

  getTechnicianBoard(): Promise<{ pendientes: Order[]; completadas: Order[] }> {
    return apiClient.get<{ pendientes: Order[]; completadas: Order[] }>('/orders/my-board');
  }
}

export const orderRepository = new OrderRepository();

