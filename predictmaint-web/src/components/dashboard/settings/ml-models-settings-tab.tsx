'use client';

import { useState } from 'react';
import type { MlModelConfig } from '@/core/entities';
import { EtapaModelo } from '@/core/types';
import { CardContent } from '@/components/ui/card';
import {
  AGREEMENT_OPTIONS,
  type AgreementMinimo,
} from '@/lib/types/settings';
import { DatasetInfoCard } from '@/components/dashboard/settings/dataset-info-card';
import { SettingsAccentPanel } from '@/components/dashboard/settings/settings-controls';
import { useMlModels, useSettingsMutations } from '@/presentation/hooks/useSettings';
import { cn } from '@/lib/utils/cn';

const FALLBACK_S1: MlModelConfig[] = [
  {
    id: 101,
    etapa: EtapaModelo.S1,
    modelo: 'XGBoost',
    accuracy: 93.1,
    metricaPrincipal: 'AUC',
    valorMetrica: 0.961,
    activo: true,
    descripcion: 'Mayor precisión — Recomendado',
    umbral: 0.5,
  },
  {
    id: 102,
    etapa: EtapaModelo.S1,
    modelo: 'Random Forest',
    accuracy: 91.8,
    metricaPrincipal: 'AUC',
    valorMetrica: 0.947,
    activo: false,
    descripcion: 'Robusto ante ruido y outliers',
    umbral: 0.5,
  },
  {
    id: 103,
    etapa: EtapaModelo.S1,
    modelo: 'Regresión Logística',
    accuracy: 78.3,
    metricaPrincipal: 'AUC',
    valorMetrica: 0.831,
    activo: false,
    descripcion: 'Alta interpretabilidad',
    umbral: 0.5,
  },
];

const FALLBACK_S2: MlModelConfig[] = [
  {
    id: 201,
    etapa: EtapaModelo.S2,
    modelo: 'LightGBM',
    accuracy: 85.4,
    metricaPrincipal: 'F1-m',
    valorMetrica: 0.814,
    activo: true,
    descripcion: 'Óptimo para clases desbalanceadas',
  },
  {
    id: 202,
    etapa: EtapaModelo.S2,
    modelo: 'Decision Tree',
    accuracy: 79.1,
    metricaPrincipal: 'F1-m',
    valorMetrica: 0.763,
    activo: false,
    descripcion: 'Alta interpretabilidad visual',
  },
  {
    id: 203,
    etapa: EtapaModelo.S2,
    modelo: 'SVM',
    accuracy: 76.8,
    metricaPrincipal: 'F1-m',
    valorMetrica: 0.701,
    activo: false,
    descripcion: 'Efectivo en alta dimensionalidad',
  },
];

function ModelOption({
  model,
  onSelect,
  selecting,
}: {
  model: MlModelConfig;
  onSelect: (id: number) => void;
  selecting: boolean;
}) {
  const principal = model.metricaPrincipal === 'AUC' ? 'AUC' : 'F1-m';
  const value = model.valorMetrica != null ? model.valorMetrica.toFixed(3) : '—';

  return (
    <button
      type="button"
      disabled={selecting || model.activo}
      onClick={() => onSelect(model.id)}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        model.activo
          ? 'border-accent bg-accent/10 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)]'
          : 'border-border bg-surface-2/40 hover:border-border-soft hover:bg-surface-2',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border',
              model.activo ? 'border-accent bg-accent' : 'border-border-soft bg-transparent',
            )}
          />
          <div>
            <p className="font-semibold text-ink">{model.modelo}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{model.descripcion}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-muted">Acc: {model.accuracy}%</p>
          <p className="text-[11px] text-ink-muted">
            {principal}: {value}
          </p>
          {model.descripcion && (
            <p className={cn('mt-1 text-[10px] font-bold uppercase', model.activo ? 'text-accent' : 'text-transparent')}>
              {model.activo ? 'Activo' : '---'}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function MlModelsSettingsTab({
  agreement,
  modelThresholds,
  onAgreementChange,
  onModelThresholdChange,
}: {
  agreement: AgreementMinimo;
  modelThresholds: Record<number, number>;
  onAgreementChange: (v: AgreementMinimo) => void;
  onModelThresholdChange: (id: number, value: number) => void;
}) {
  const s1 = useMlModels(EtapaModelo.S1);
  const s2 = useMlModels(EtapaModelo.S2);
  const mutations = useSettingsMutations();
  const [activating, setActivating] = useState<number | null>(null);
  const s1Items = (s1.data && s1.data.length ? s1.data : FALLBACK_S1).slice(0, 3);
  const s2Items = (s2.data && s2.data.length ? s2.data : FALLBACK_S2).slice(0, 3);

  const activate = async (id: number, etapa: EtapaModelo) => {
    if (id >= 100) return;
    setActivating(id);
    try {
      await mutations.activateModel(id, etapa);
    } finally {
      setActivating(null);
    }
  };

  const activeS1 = s1Items.find((m) => m.activo) ?? s1Items[0];
  const activeUmbral = activeS1
    ? (modelThresholds[activeS1.id] ?? activeS1.umbral ?? 0.5)
    : 0.5;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <SettingsAccentPanel accent="accent">
          <div className="flex flex-col gap-1 px-5 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="text-base font-bold text-ink">S-1 — Predicción de Fallo (Binario)</h3>
            <p className="text-xs text-ink-muted sm:text-right">
              Clasificación binaria: FALLA / SIN FALLA
            </p>
          </div>
          <CardContent className="space-y-3 px-5 pb-5 pt-0">
            <p className="text-xs text-ink-muted">Algoritmo activo:</p>
            {s1Items.map((m) => (
              <ModelOption
                key={m.id}
                model={m}
                selecting={activating === m.id}
                onSelect={(id) => void activate(id, EtapaModelo.S1)}
              />
            ))}

            <div className="rounded-lg border border-border bg-surface-2/35 p-4 pt-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  Umbral de clasificación de fallo:
                </span>
                <span className="font-bold text-accent">{activeUmbral.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.01}
                value={activeUmbral}
                onChange={(e) => {
                  if (!activeS1) return;
                  onModelThresholdChange(activeS1.id, parseFloat(e.target.value));
                }}
                className="h-2 w-full cursor-pointer accent-accent"
                aria-label={`Umbral ${activeS1?.modelo ?? 'S-1'}`}
              />
              <div className="mt-1 flex justify-between text-[10px] text-ink-muted">
                <span>Bajo</span>
                <span>Alto</span>
              </div>
            </div>
          </CardContent>
        </SettingsAccentPanel>

        <DatasetInfoCard />
      </div>

      <SettingsAccentPanel accent="warning">
        <div className="flex flex-col gap-1 px-5 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-base font-bold text-ink">S-2 — Clasificación de Tipo (Multiclase)</h3>
          <p className="text-xs text-ink-muted sm:text-right">TWF · HDF · PWF · OSF · RNF</p>
        </div>
        <CardContent className="space-y-3 px-5 pb-5 pt-0">
          <p className="text-xs text-ink-muted">Algoritmo activo:</p>
          {s2Items.map((m) => (
            <ModelOption
              key={m.id}
              model={m}
              selecting={activating === m.id}
              onSelect={(id) => void activate(id, EtapaModelo.S2)}
            />
          ))}

          <div className="rounded-lg border border-border bg-surface-2/35 p-4">
            <p className="mb-3 text-sm text-ink-soft">
              Agreement mínimo para activar S-3 automático:
            </p>
            <div className="flex flex-wrap gap-2">
              {AGREEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onAgreementChange(opt.value)}
                  className={cn(
                    'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
                    agreement === opt.value
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-ink-muted hover:text-ink',
                  )}
                >
                  {opt.label}{' '}
                  <span className="text-xs opacity-80">({opt.hint})</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Si el mínimo es 2/3, el tipo de falla se confirma solo cuando al menos 2 modelos S-2
              coinciden en el mismo código.
            </p>
          </div>
        </CardContent>
      </SettingsAccentPanel>
    </div>
  );
}
