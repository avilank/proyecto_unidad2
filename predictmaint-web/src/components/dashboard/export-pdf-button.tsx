'use client';

import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ExportPdfButton({
  label = 'Exportar PDF',
  disabled,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0"
    >
      <FileDown className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
