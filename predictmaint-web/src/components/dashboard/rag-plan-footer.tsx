'use client';

import { useState } from 'react';
import { ragService } from '@/application/services/rag.service';
import { Button } from '@/components/ui/button';

export function RagSourcesFooter({ fuentes }: { fuentes?: string[] }) {
  if (!fuentes?.length) return null;

  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-3">
      <p className="text-xs font-semibold text-ink">Fuentes consultadas por el RAG</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">
        Solo se usan fuentes activas en Configuración → RAG.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {fuentes.map((fuente) => (
          <span
            key={fuente}
            className="rounded-full border border-border bg-bg px-2.5 py-1 text-[11px] text-ink-soft"
          >
            {fuente}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RagRegenerateButton({
  orderId,
  onRegenerated,
  fullWidth = false,
}: {
  orderId: string | null;
  onRegenerated?: () => void;
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!orderId) return;
    setBusy(true);
    setError(null);
    try {
      await ragService.regenerate(orderId);
      onRegenerated?.();
    } catch {
      setError('No se pudo regenerar la recomendación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={fullWidth ? 'w-full space-y-1' : 'space-y-1'}>
      <Button
        variant="secondary"
        fullWidth={fullWidth}
        disabled={!orderId || busy}
        onClick={() => void handleRegenerate()}
      >
        {busy ? 'Regenerando recomendación…' : 'Regenerar recomendación RAG'}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
