export const ORDER_CREATED_EVENT = 'order.created';

export interface OrderCreatedPayload {
  orderId: string;
  tecnicoId?: number;
  maquinaId: string;
  nivelRiesgo: string;
}

export const ORDER_ESCALATED_EVENT = 'order.escalated';

export interface OrderEscalatedPayload {
  orderId: string;
  maquinaId: string;
  nivelRiesgo: string;
  minutosSinAtender: number;
  slaMinutos: number;
}
