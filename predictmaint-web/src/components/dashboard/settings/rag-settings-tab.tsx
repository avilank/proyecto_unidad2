'use client';

import type { RagSource } from '@/core/entities';
import { cn } from '@/lib/utils/cn';
import { SettingsAccentPanel, SettingsToggle } from './settings-controls';

const MAP_ITEMS = [
  {
    code: 'HDF',
    tone: 'bg-danger/20 text-danger',
    bullets: ['Verificar sistema de enfriamiento', 'Calibrar variador de frecuencia', 'Confirmar dif. térmica > 8.6K'],
  },
  {
    code: 'PWF',
    tone: 'bg-warning/20 text-warning',
    bullets: ['Revisar potencia en rango 3500-9000W', 'Inspeccionar conexiones eléctricas', 'Verificar variador de frecuencia'],
  },
  {
    code: 'TWF',
    tone: 'bg-accent/20 text-accent',
    bullets: ['Reemplazar herramienta de corte', 'Verificar desgaste vs umbral del tipo', 'Registrar nuevo ciclo de herramienta'],
  },
  {
    code: 'OSF',
    tone: 'bg-violet-500/20 text-violet-300',
    bullets: ['Reducir carga mecánica del eje', 'Revisar torque x desgaste vs umbral', 'Inspeccionar rodamientos'],
  },
  {
    code: 'RNF',
    tone: 'bg-surface-2 text-ink-muted',
    bullets: ['Inspección manual obligatoria', 'Sin plan RAG automático', 'Documentar hallazgos del técnico'],
  },
];

export function RagSettingsTab({
  sources,
  onToggle,
  loading,
  error,
}: {
  sources: RagSource[];
  onToggle: (id: number, activa: boolean) => void;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <SettingsAccentPanel accent="accent">
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">Fuentes de conocimiento RAG activas</h3>
            <p className="text-xs text-ink-muted">
              El motor RAG consulta estas fuentes para generar recomendaciones específicas por tipo de fallo.
            </p>
          </div>

          <div className="overflow-hidden rounded-md border border-border-soft">
            <div className="grid grid-cols-[1.4fr_0.7fr_0.3fr] gap-2 bg-surface-2/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <span>Fuente</span>
              <span>Tipo de fallo</span>
              <span className="text-right">Activa</span>
            </div>
            {loading && (
              <div className="border-t border-border-soft px-3 py-4 text-sm text-ink-muted">
                Cargando fuentes RAG...
              </div>
            )}
            {!loading && error && (
              <div className="border-t border-border-soft px-3 py-4 text-sm text-danger">
                {error}
              </div>
            )}
            {!loading && !error && !sources.length && (
              <div className="border-t border-border-soft px-3 py-4 text-sm text-ink-muted">
                No se encontraron fuentes RAG en el API.
              </div>
            )}
            {!loading &&
              !error &&
              sources.map((source) => (
                <div
                  key={source.id}
                  className="grid grid-cols-[1.4fr_0.7fr_0.3fr] gap-2 border-t border-border-soft px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{source.fuente}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {source.descripcion ?? 'Fuente técnica para mantenimiento predictivo'}
                    </p>
                  </div>
                  <p className="self-center text-xs font-semibold text-violet-300">
                    {source.tipoFallo ?? 'Todos'}
                  </p>
                  <div className="flex justify-end">
                    <SettingsToggle
                      checked={source.activa}
                      onChange={(next) => onToggle(source.id, next)}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </SettingsAccentPanel>

      <SettingsAccentPanel accent="warning">
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">Mapa fallo → recomendación base</h3>
            <p className="text-xs text-ink-muted">El RAG siempre parte de estas acciones</p>
          </div>

          <div className="space-y-3 rounded-md border border-border-soft bg-bg/60 p-3">
            {MAP_ITEMS.map((item) => (
              <div key={item.code} className="space-y-1.5">
                <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-bold', item.tone)}>
                  {item.code}
                </span>
                <ul className="space-y-1 text-xs text-ink-soft">
                  {item.bullets.map((b) => (
                    <li key={b} className="leading-relaxed">{`• ${b}`}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </SettingsAccentPanel>
    </div>
  );
}
