'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { MlModelsSettingsTab } from '@/components/dashboard/settings/ml-models-settings-tab';
import { MessageDispatchSettingsTab } from '@/components/dashboard/settings/message-dispatch-settings-tab';
import { RagSettingsTab } from '@/components/dashboard/settings/rag-settings-tab';
import type { RagSource } from '@/core/entities';
import type { AgreementMinimo, DispatchScheduleItem } from '@/lib/types/settings';
import {
  useDispatchSchedule,
  useRagSources,
  useSettingsMutations,
  useSystemConfig,
} from '@/presentation/hooks/useSettings';
import { cn } from '@/lib/utils/cn';

type SettingsTab = 'ml' | 'messages' | 'rag' | 'alerts' | 'recurrent';

const TABS: { id: SettingsTab; label: string; ready: boolean }[] = [
  { id: 'ml', label: 'Modelos ML', ready: true },
  { id: 'messages', label: 'Envío de Mensajes', ready: true },
  { id: 'rag', label: 'RAG', ready: true },
  { id: 'alerts', label: 'Alertas', ready: false },
  { id: 'recurrent', label: 'Fallos Repetitivos', ready: false },
];

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('ml');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const config = useSystemConfig();
  const schedule = useDispatchSchedule();
  const ragSources = useRagSources();
  const mutations = useSettingsMutations();

  const [umbral, setUmbral] = useState(0.5);
  const [agreement, setAgreement] = useState<AgreementMinimo>('MEDIO');
  const [scheduleItems, setScheduleItems] = useState<DispatchScheduleItem[]>([]);
  const [ragItems, setRagItems] = useState<RagSource[]>([]);

  useEffect(() => {
    if (config.data) {
      setUmbral(parseFloat(config.data.umbral_ensemble_falla) || 0.5);
      const raw = (config.data.agreement_minimo_s3 ?? 'MEDIO').toUpperCase();
      if (raw.includes('ALTO')) setAgreement('ALTO');
      else if (raw.includes('BAJO')) setAgreement('BAJO');
      else setAgreement('MEDIO');
      if (config.data.horarios_envio?.length) {
        setScheduleItems(config.data.horarios_envio);
      }
    }
  }, [config.data]);

  useEffect(() => {
    if (schedule.data?.length) setScheduleItems(schedule.data);
  }, [schedule.data]);

  useEffect(() => {
    if (ragSources.data?.length) setRagItems(ragSources.data);
  }, [ragSources.data]);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      if (tab === 'ml') {
        await mutations.saveMlSettings({
          umbral_ensemble_falla: umbral,
          agreement_minimo_s3: agreement,
        });
      } else if (tab === 'messages' && scheduleItems.length) {
        await mutations.saveDispatchSchedule(scheduleItems);
      } else if (tab === 'rag' && ragItems.length) {
        const changed = ragItems.filter(
          (source) =>
            ragSources.data?.find((it) => it.id === source.id)?.activa !== source.activa,
        );
        for (const source of changed) {
          await mutations.patchRagSource(source.id, source.activa);
        }
      }
      setToast('Configuración guardada correctamente');
    } catch {
      setToast('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Topbar flush title="Configuración del Sistema" subtitle="Modelos ML · Envíos · Alertas" />

      <div className="flex flex-1 flex-col gap-5 px-6 py-6">
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.ready}
              onClick={() => t.ready && setTab(t.id)}
              className={cn(
                'rounded-md border px-4 py-1.5 text-xs font-semibold transition-colors',
                tab === t.id
                  ? t.id === 'messages'
                    ? 'border-success/50 bg-success text-white'
                    : t.id === 'rag'
                      ? 'border-violet-400/60 bg-violet-500 text-white'
                    : 'border-accent/50 bg-accent text-white'
                  : t.ready
                    ? 'border-border-soft bg-surface-2/50 text-ink-muted hover:text-ink'
                    : 'cursor-not-allowed border-border-soft bg-surface-2/20 text-ink-muted/40',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'ml' && (
          <MlModelsSettingsTab
            umbral={umbral}
            agreement={agreement}
            onUmbralChange={setUmbral}
            onAgreementChange={setAgreement}
          />
        )}

        {tab === 'messages' && (
          <MessageDispatchSettingsTab
            items={scheduleItems}
            onItemsChange={setScheduleItems}
          />
        )}

        {tab === 'rag' && (
          <RagSettingsTab
            sources={ragItems}
            loading={Boolean(ragSources.isLoading)}
            error={ragSources.error ? 'No se pudo cargar fuentes RAG desde el backend.' : null}
            onToggle={(id, activa) => {
              setRagItems((prev) =>
                prev.map((source) => (source.id === id ? { ...source, activa } : source)),
              );
            }}
          />
        )}

        {(tab === 'alerts' || tab === 'recurrent') && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-8 text-center text-ink-muted">
            Sección en preparación — disponible próximamente.
          </div>
        )}

        {toast && (
          <p
            className={cn(
              'text-sm font-medium',
              toast.includes('No') ? 'text-danger' : 'text-success',
            )}
          >
            {toast}
          </p>
        )}

        {(tab === 'ml' || tab === 'messages' || tab === 'rag') && (
          <Button fullWidth size="lg" onClick={() => void handleSave()} disabled={saving}>
            {saving
              ? 'Guardando configuración…'
              : tab === 'rag'
                ? 'Guardar configuración RAG'
                : 'Guardar configuración'}
          </Button>
        )}
      </div>
    </div>
  );
}
