export const ORDER_CREATED_EVENT = 'order.created';

export interface OrderCreatedPayload {
  orderId: string;
  tecnicoId?: number;
  maquinaId: string;
  nivelRiesgo: string;
}
