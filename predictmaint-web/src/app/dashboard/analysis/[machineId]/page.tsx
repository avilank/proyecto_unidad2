import { AnalysisView } from '@/components/dashboard/analysis-view';

interface AnalysisPageProps {
  params: { machineId: string };
  searchParams: { order?: string };
}

export default function AnalysisPage({ params, searchParams }: AnalysisPageProps) {
  return (
    <AnalysisView
      machineId={params.machineId}
      initialOrderId={searchParams.order ?? null}
    />
  );
}
