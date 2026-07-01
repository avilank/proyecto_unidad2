'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import {
  AlertsSettingsTab,
  invalidThresholdLevels,
  type ThresholdMap,
} from '@/components/dashboard/settings/alerts-settings-tab';
import { MlModelsSettingsTab } from '@/components/dashboard/settings/ml-models-settings-tab';
import { MessageDispatchSettingsTab } from '@/components/dashboard/settings/message-dispatch-settings-tab';
import { RepetitiveFaultsSettingsTab } from '@/components/dashboard/settings/repetitive-faults-settings-tab';
import {
  normalizeChannel,
  normalizeRecibe,
  DEFAULT_REPETITIVE_CONFIG,
  type AgreementMinimo,
  type DispatchScheduleItem,
  type EscalationAction,
  type NotificationRule,
  type RepetitiveFaultsConfig,
  type TiemposAtencion,
} from '@/lib/types/settings';
import {
  useDispatchSchedule,
  useEscalationActions,
  useNotificationRules,
  useRagSources,
  useSettingsMutations,
  useSystemConfig,
} from '@/presentation/hooks/useSettings';
import { RagSettingsTab } from '@/components/dashboard/settings/rag-settings-tab';
import type { RagSource } from '@/core/entities';
import { cn } from '@/lib/utils/cn';

const DEFAULT_THRESHOLDS: ThresholdMap = {
  LOW: 0.4,
  MEDIUM: 0.65,
  HIGH: 0.85,
  CRITICAL: 1.0,
};

const DEFAULT_TIEMPOS_ATENCION: TiemposAtencion = {
  LOW: null,
  MEDIUM: 120,
  HIGH: 30,
  CRITICAL: 15,
};

type SettingsTab = 'ml' | 'messages' | 'rag' | 'alerts' | 'recurrent';

const TABS: { id: SettingsTab; label: string; ready: boolean }[] = [
  { id: 'ml', label: 'Modelos ML', ready: true },
  // { id: 'messages', label: 'Envío de Mensajes', ready: true },
  { id: 'rag', label: 'RAG', ready: true },
  { id: 'alerts', label: 'Alertas', ready: true },
  { id: 'recurrent', label: 'Fallos Repetitivos', ready: true },
];

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('ml');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const config = useSystemConfig();
  const schedule = useDispatchSchedule();
  const notificationRules = useNotificationRules();
  const escalationActions = useEscalationActions();
  const ragSources = useRagSources();
  const mutations = useSettingsMutations();

  const [umbral, setUmbral] = useState(0.5);
  const [agreement, setAgreement] = useState<AgreementMinimo>('MEDIO');
  const [scheduleItems, setScheduleItems] = useState<DispatchScheduleItem[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdMap>(DEFAULT_THRESHOLDS);
  const [tiemposAtencion, setTiemposAtencion] = useState<TiemposAtencion>(DEFAULT_TIEMPOS_ATENCION);
  const [notifRules, setNotifRules] = useState<NotificationRule[]>([]);
  const [repetitiveConfig, setRepetitiveConfig] = useState<RepetitiveFaultsConfig>(
    DEFAULT_REPETITIVE_CONFIG,
  );
  const [escalationItems, setEscalationItems] = useState<EscalationAction[]>([]);
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
      setThresholds({
        LOW: parseFloat(config.data.riesgo_bajo) || DEFAULT_THRESHOLDS.LOW,
        MEDIUM: parseFloat(config.data.riesgo_medio) || DEFAULT_THRESHOLDS.MEDIUM,
        HIGH: parseFloat(config.data.riesgo_alto) || DEFAULT_THRESHOLDS.HIGH,
        CRITICAL: parseFloat(config.data.riesgo_critico) || DEFAULT_THRESHOLDS.CRITICAL,
      });
      if (config.data.tiempos_atencion) {
        setTiemposAtencion({ ...DEFAULT_TIEMPOS_ATENCION, ...config.data.tiempos_atencion });
      }
      if (config.data.fallos_repetitivos) {
        setRepetitiveConfig(config.data.fallos_repetitivos);
      }
    }
  }, [config.data]);

  useEffect(() => {
    if (escalationActions.data?.length) setEscalationItems(escalationActions.data);
  }, [escalationActions.data]);

  useEffect(() => {
    if (schedule.data?.length) setScheduleItems(schedule.data);
  }, [schedule.data]);

  useEffect(() => {
    if (notificationRules.data?.length) {
      setNotifRules(
        notificationRules.data.map((r) => ({
          ...r,
          canal: normalizeChannel(r.canal),
          recibe: normalizeRecibe(r.recibe),
        })),
      );
    }
  }, [notificationRules.data]);

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
      } else if (tab === 'alerts') {
        if (invalidThresholdLevels(thresholds).size > 0) {
          setToast('Revisa los umbrales: deben crecer en orden (LOW < MEDIUM < HIGH < CRITICAL ≤ 1).');
          return;
        }
        await mutations.saveAlertSettings({
          riesgo_bajo: thresholds.LOW,
          riesgo_medio: thresholds.MEDIUM,
          riesgo_alto: thresholds.HIGH,
          riesgo_critico: thresholds.CRITICAL,
          tiempos_atencion: tiemposAtencion,
        });
        if (notifRules.length) {
          await mutations.saveNotificationRules(notifRules);
        }
      } else if (tab === 'recurrent') {
        await mutations.saveRepetitiveSettings(repetitiveConfig);
        if (escalationItems.length) {
          await mutations.saveEscalationActions(escalationItems);
        }
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

        {tab === 'alerts' && (
          <AlertsSettingsTab
            thresholds={thresholds}
            tiemposAtencion={tiemposAtencion}
            notificationRules={notifRules}
            onThresholdsChange={setThresholds}
            onTiemposAtencionChange={setTiemposAtencion}
            onNotificationRulesChange={setNotifRules}
          />
        )}

        {tab === 'recurrent' && (
          <RepetitiveFaultsSettingsTab
            config={repetitiveConfig}
            escalationActions={escalationItems}
            onConfigChange={setRepetitiveConfig}
            onEscalationActionsChange={setEscalationItems}
          />
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

        {(tab === 'ml' || tab === 'messages' || tab === 'alerts' || tab === 'recurrent' || tab === 'rag') && (
          <Button fullWidth size="lg" onClick={() => void handleSave()} disabled={saving}>
            {saving
              ? 'Guardando configuración…'
              : tab === 'alerts'
                ? 'Guardar configuración de alertas'
                : tab === 'recurrent'
                  ? 'Guardar configuración de fallos repetitivos'
                  : tab === 'rag'
                  ? 'Guardar configuración RAG'
                  : 'Guardar configuración'}
          </Button>
        )}
      </div>
    </div>
  );
}
