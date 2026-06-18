import { OrderDetailView } from '@/components/dashboard/order-detail-view';

interface OrderDetailPageProps {
  params: { id: string };
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  return <OrderDetailView orderId={params.id} />;
}

