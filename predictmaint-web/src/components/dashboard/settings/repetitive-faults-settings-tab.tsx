'use client';

import {
  SettingsAccentPanel,
  SettingsToggle,
} from '@/components/dashboard/settings/settings-controls';
import type {
  EscalationAction,
  RepetitiveFaultsConfig,
  RepetitiveThreshold,
} from '@/lib/types/settings';
import { cn } from '@/lib/utils/cn';

type FaultCode = 'HDF' | 'PWF' | 'TWF' | 'OSF' | 'RNF';

const FAULT_ORDER: FaultCode[] = ['HDF', 'PWF', 'TWF', 'OSF', 'RNF'];

const FAULT_BADGE: Record<FaultCode, string> = {
  HDF: 'bg-danger/15 text-danger',
  PWF: 'bg-warning/15 text-warning',
  TWF: 'bg-accent/15 text-accent',
  OSF: 'bg-violet-500/15 text-violet-400',
  RNF: 'bg-ink-muted/15 text-ink-muted',
};

const NOTIFICATIONS: { id: keyof RepetitiveFaultsConfig['notificaciones']; title: string; detail: string }[] = [
  { id: 'mark', title: 'Al marcar como repetitivo (2do fallo)', detail: 'Técnico asignado · WhatsApp con historial' },
  { id: 'supervisor', title: 'Al notificar supervisor (3er fallo)', detail: 'Supervisor + Técnico · WhatsApp + Email' },
  { id: 'rag', title: 'Al escalar plan RAG', detail: 'Técnico asignado · WhatsApp con plan escalado' },
];

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-2 px-5 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="max-w-xs text-xs text-ink-muted sm:text-right">{subtitle}</p>
    </div>
  );
}

function NumericInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      value={value}
      onChange={(e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed) && parsed > 0) onChange(parsed);
      }}
      className="h-9 w-14 rounded-md border border-accent bg-bg px-2 text-center text-sm font-semibold text-accent [color-scheme:dark]"
    />
  );
}

export function RepetitiveFaultsSettingsTab({
  config,
  escalationActions,
  onConfigChange,
  onEscalationActionsChange,
}: {
  config: RepetitiveFaultsConfig;
  escalationActions: EscalationAction[];
  onConfigChange: (next: RepetitiveFaultsConfig) => void;
  onEscalationActionsChange: (next: EscalationAction[]) => void;
}) {
  const setThreshold = (
    key: 'marcar' | 'notificar' | 'rag',
    field: keyof RepetitiveThreshold,
    value: number,
  ) =>
    onConfigChange({
      ...config,
      umbrales: {
        ...config.umbrales,
        [key]: { ...config.umbrales[key], [field]: value },
      },
    });

  const setVentana = (value: number) =>
    onConfigChange({
      ...config,
      umbrales: { ...config.umbrales, ventanaDias: value },
    });

  const setNotif = (id: keyof RepetitiveFaultsConfig['notificaciones'], value: boolean) =>
    onConfigChange({
      ...config,
      notificaciones: { ...config.notificaciones, [id]: value },
    });

  const setAction = (tipoFallo: string, acciones: string) =>
    onEscalationActionsChange(
      escalationActions.map((a) => (a.tipoFallo === tipoFallo ? { ...a, acciones } : a)),
    );

  const orderedActions = [...escalationActions].sort(
    (a, b) => FAULT_ORDER.indexOf(a.tipoFallo as FaultCode) - FAULT_ORDER.indexOf(b.tipoFallo as FaultCode),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <SettingsAccentPanel accent="warning">
          <PanelHeader
            title="Umbrales de repetitividad"
            subtitle="Define cuándo un fallo se considera repetitivo y activa el plan escalado"
          />
          <div className="mx-5 border-t border-border-soft" />
          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>Marcar como repetitivo si ocurre</span>
              <NumericInput value={config.umbrales.marcar.veces} onChange={(v) => setThreshold('marcar', 'veces', v)} />
              <span>veces en</span>
              <NumericInput value={config.umbrales.marcar.dias} onChange={(v) => setThreshold('marcar', 'dias', v)} />
              <span>días</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>Notificar supervisor automáticamente si ocurre</span>
              <NumericInput value={config.umbrales.notificar.veces} onChange={(v) => setThreshold('notificar', 'veces', v)} />
              <span>veces en</span>
              <NumericInput value={config.umbrales.notificar.dias} onChange={(v) => setThreshold('notificar', 'dias', v)} />
              <span>días</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>Escalar plan RAG a nivel profundo si ocurre</span>
              <NumericInput value={config.umbrales.rag.veces} onChange={(v) => setThreshold('rag', 'veces', v)} />
              <span>veces en</span>
              <NumericInput value={config.umbrales.rag.dias} onChange={(v) => setThreshold('rag', 'dias', v)} />
              <span>días</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <span>Ventana de tiempo para conteo de repeticiones</span>
              <NumericInput value={config.umbrales.ventanaDias} onChange={setVentana} />
              <span>días</span>
            </div>
          </div>
        </SettingsAccentPanel>

        <SettingsAccentPanel accent="accent">
          <PanelHeader
            title="Acciones escaladas por tipo de fallo repetitivo"
            subtitle="Estas acciones se agregan al plan RAG base cuando hay repetición"
          />
          <div className="mx-5 border-t border-border-soft" />
          <div className="space-y-3 px-5 pb-5 pt-4">
            {orderedActions.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">Cargando acciones…</p>
            ) : (
              orderedActions.map((item) => (
                <div key={item.tipoFallo} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-1 inline-flex h-6 shrink-0 items-center rounded px-2 text-xs font-bold',
                      FAULT_BADGE[item.tipoFallo as FaultCode] ?? 'bg-ink-muted/15 text-ink-muted',
                    )}
                  >
                    [{item.tipoFallo}]
                  </span>
                  <textarea
                    rows={2}
                    value={item.acciones}
                    onChange={(e) => setAction(item.tipoFallo, e.target.value)}
                    className="min-h-0 w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              ))
            )}
          </div>
        </SettingsAccentPanel>
      </div>

      <div className="flex flex-col gap-4">
        <SettingsAccentPanel accent="success">
          <PanelHeader
            title="Notificaciones por fallo repetitivo"
            subtitle="Quién recibe aviso en cada etapa del ciclo repetitivo"
          />
          <div className="mx-5 border-t border-border-soft" />
          <div className="divide-y divide-border-soft px-5 pb-5">
            {NOTIFICATIONS.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 py-4 first:pt-4 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs text-accent">{item.detail}</p>
                </div>
                <SettingsToggle
                  checked={config.notificaciones[item.id]}
                  onChange={(next) => setNotif(item.id, next)}
                />
              </div>
            ))}
          </div>
        </SettingsAccentPanel>
      </div>
    </div>
  );
}
