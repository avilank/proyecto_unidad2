'use client';

import { RawJsonView } from '@/components/common/RawJsonView';
import { useConfig } from '@/presentation/hooks/useConfig';

export default function SettingsPage() {
  const config = useConfig();

  return (
    <RawJsonView
      title="Configuración"
      isLoading={config.isLoading}
      error={config.error}
      data={config.data}
    />
  );
}
