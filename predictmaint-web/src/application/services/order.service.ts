import type { Order, OrderDetail, OrderEvent } from '@/core/entities';
import { orderRepository, type BinaryPredictionsResponse, type MulticlassPredictionsResponse, type OrderQuery } from '@/infrastructure/repositories/order.repository';
import type { OrdersPaginatedResponse } from '@/core/types/api';

export class OrderService {
  findAll(query?: OrderQuery): Promise<OrdersPaginatedResponse<Order>> {
    return orderRepository.findAll(query);
  }

  findAllForExport(query?: OrderQuery): Promise<Order[]> {
    return orderRepository.findAllPages(query ?? {});
  }

  async findFlat(query?: OrderQuery): Promise<Order[]> {
    const res = await this.findAll(query);
    return res.items;
  }

  findById(id: string): Promise<OrderDetail> {
    return orderRepository.findById(id);
  }

  getTimeline(id: string): Promise<OrderEvent[]> {
    return orderRepository.getTimeline(id);
  }

  getBinaryPredictions(orderId: string): Promise<BinaryPredictionsResponse> {
    return orderRepository.getBinaryPredictions(orderId);
  }

  getMulticlassPredictions(orderId: string): Promise<MulticlassPredictionsResponse> {
    return orderRepository.getMulticlassPredictions(orderId);
  }

  updateStatus(orderId: string, estado: string): Promise<OrderDetail> {
    return orderRepository.updateStatus(orderId, estado);
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
    return orderRepository.registerSolution(orderId, payload);
  }

  escalate(orderId: string, motivo: string): Promise<OrderDetail> {
    return orderRepository.escalate(orderId, motivo);
  }

  rejectPrediction(orderId: string, justificacion: string): Promise<OrderDetail> {
    return orderRepository.rejectPrediction(orderId, justificacion);
  }

  startOrder(orderId: string): Promise<OrderDetail> {
    return orderRepository.startOrder(orderId);
  }

  getTechnicianBoard(): Promise<{ pendientes: Order[]; completadas: Order[] }> {
    return orderRepository.getTechnicianBoard();
  }
}

export const orderService = new OrderService();

