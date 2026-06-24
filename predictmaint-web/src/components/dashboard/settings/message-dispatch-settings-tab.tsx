'use client';

import type { Technician } from '@/core/entities';
import type { DispatchScheduleItem } from '@/lib/types/settings';
import { useSettingsMutations } from '@/presentation/hooks/useSettings';
import { useTechnicians } from '@/presentation/hooks/useTechnicians';
import {
  ChannelPill,
  SettingsAccentPanel,
  SettingsToggle,
} from '@/components/dashboard/settings/settings-controls';
import { cn } from '@/lib/utils/cn';

const SCHEDULE_DOT: Record<string, string> = {
  turno_inicio: 'bg-accent',
  mitad_turno: 'bg-warning',
  fin_turno: 'bg-success',
  critical: 'bg-danger',
};

const TIME_BORDER: Record<string, string> = {
  turno_inicio: 'border-accent text-accent',
  mitad_turno: 'border-warning text-warning',
  fin_turno: 'border-border text-ink-muted',
  critical: 'border-danger text-danger',
};

function turnoLabel(turno: string): string {
  return turno.toLowerCase();
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-2 px-5 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="max-w-xs text-xs text-ink-muted sm:text-right">{subtitle}</p>
    </div>
  );
}

function TechnicianRow({
  tech,
  onToggle,
}: {
  tech: Technician;
  onToggle: (field: 'enviarWssp' | 'enviarCorreo', value: boolean) => void;
}) {
  const maquinas =
    tech.maquinas.length > 0 ? tech.maquinas.join(', ') : 'Sin asignación activa';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-soft py-4 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{tech.nombre}</p>
        <p className="text-xs text-ink-muted">Técnico · {turnoLabel(tech.turno)}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{maquinas}</p>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-2">
        <ChannelPill
          label="WhatsApp"
          tone="whatsapp"
          active={tech.enviarWssp !== false}
          onClick={() => onToggle('enviarWssp', tech.enviarWssp === false)}
        />
        <ChannelPill
          label="Email"
          tone="email"
          active={tech.enviarCorreo === true}
          onClick={() => onToggle('enviarCorreo', tech.enviarCorreo !== true)}
        />
      </div>
    </div>
  );
}

export function MessageDispatchSettingsTab({
  items,
  onItemsChange,
}: {
  items: DispatchScheduleItem[];
  onItemsChange: (next: DispatchScheduleItem[]) => void;
}) {
  const technicians = useTechnicians();
  const mutations = useSettingsMutations();

  const patchItem = (id: string, partial: Partial<DispatchScheduleItem>) => {
    onItemsChange(items.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  };

  const toggleTechnician = async (
    tech: Technician,
    field: 'enviarWssp' | 'enviarCorreo',
    value: boolean,
  ) => {
    await mutations.updateTechnicianChannels(tech.id, { [field]: value });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <SettingsAccentPanel accent="accent">
        <PanelHeader
          title="Horarios de envío automático"
          subtitle="El sistema genera y envía el CSV sin intervención humana."
        />
        <div className="mx-5 border-t border-border-soft" />
        <div className="divide-y divide-border-soft px-5 pb-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 py-4 first:pt-4 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    SCHEDULE_DOT[item.id] ?? 'bg-ink-muted',
                  )}
                />
                <div>
                  <p className="font-medium text-ink">{item.evento}</p>
                  <p className="text-xs text-ink-muted">{item.descripcion}</p>
                </div>
              </div>
              <div className="flex h-9 shrink-0 items-center gap-3">
                {item.auto ? (
                  <span className="flex h-9 min-w-[5rem] items-center justify-center text-sm font-semibold text-ink-muted">
                    Auto
                  </span>
                ) : (
                  <input
                    type="time"
                    value={item.hora ?? ''}
                    onChange={(e) => patchItem(item.id, { hora: e.target.value })}
                    className={cn(
                      'h-9 w-28 rounded-md border bg-bg px-2.5 text-sm leading-none [color-scheme:dark]',
                      TIME_BORDER[item.id] ?? 'border-border text-ink',
                    )}
                  />
                )}
                <SettingsToggle
                  checked={item.activo}
                  onChange={(activo) => patchItem(item.id, { activo })}
                />
              </div>
            </div>
          ))}
        </div>
      </SettingsAccentPanel>

      <SettingsAccentPanel accent="success">
        <PanelHeader
          title="Destinatarios por máquina asignada"
          subtitle="Cada técnico recibe solo sus máquinas — no las de otros."
        />
        <div className="mx-5 border-t border-border-soft" />
        <div className="px-5 pb-5">
          {(technicians.data ?? []).map((tech) => (
            <TechnicianRow
              key={tech.id}
              tech={tech}
              onToggle={(field, value) => void toggleTechnician(tech, field, value)}
            />
          ))}
        </div>
      </SettingsAccentPanel>
    </div>
  );
}
