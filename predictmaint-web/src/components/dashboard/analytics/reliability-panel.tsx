'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReliabilityMachine, ReliabilityResponse } from '@/core/types/api';

const TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
} as const;

/** MTBF: horas o días si el máximo ≥ 48 h. */
function pickMtbfUnit(values: (number | null)[]): { div: number; label: string; decimals: number } {
  const nums = values.filter((v): v is number => v != null);
  const max = nums.length ? Math.max(...nums) : 0;
  return max >= 48
    ? { div: 24, label: 'días', decimals: 1 }
    : { div: 1, label: 'horas', decimals: 1 };
}

/** MTTR en gráfico: siempre horas (2 dec. si < 1 h para evitar 0.0) o días si ≥ 48 h. */
function pickMttrUnit(values: (number | null)[]): { div: number; label: string; decimals: number } {
  const nums = values.filter((v): v is number => v != null);
  const max = nums.length ? Math.max(...nums) : 0;
  if (max >= 48) return { div: 24, label: 'días', decimals: 1 };
  return { div: 1, label: 'horas', decimals: max < 1 ? 2 : 1 };
}

function roundToDecimals(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function fmtMttr(h: number | null): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h >= 48) return `${Math.round((h / 24) * 10) / 10} d`;
  return `${h} h`;
}

function fmtMtbf(h: number | null): string {
  if (h == null) return '—';
  return h >= 48 ? `${Math.round((h / 24) * 10) / 10} d` : `${h} h`;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function fmtDuration(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h >= 48) return `${Math.round((h / 24) * 10) / 10} d`;
  return `${Math.round(h * 10) / 10} h`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function MttrBreakdown({ row }: { row: ReliabilityMachine }) {
  const reps = row.reparacionesDetalle ?? [];

  if (reps.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        No hay órdenes <strong className="font-medium text-ink-soft">cerradas</strong> en el
        rango (hace falta que el técnico inicie y registre la solución).
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-soft">
        <strong className="font-medium text-ink">{reps.length}</strong>{' '}
        {reps.length === 1 ? 'reparación medida' : 'reparaciones medidas'} (desde que el
        técnico inicia hasta que cierra la orden):
      </p>
      <ul className="space-y-2 text-ink-muted">
        {reps.map((r, i) => (
          <li key={i}>
            <span className="font-medium text-ink-soft">Reparación {i + 1}:</span>{' '}
            <strong className="text-ink-soft">{fmtDuration(r.duracionHoras)}</strong>
            <br />
            <span className="text-[11px]">
              {fmtDateTime(r.inicio)} → {fmtDateTime(r.fin)}
            </span>
          </li>
        ))}
      </ul>
      <p className="rounded-md bg-warning/10 px-2 py-1.5 font-medium text-ink">
        Promedio = MTTR{' '}
        <span className="text-warning">{row.mttrHoras != null ? fmtMttr(row.mttrHoras) : '—'}</span>
      </p>
    </div>
  );
}

function MtbfBreakdown({ row }: { row: ReliabilityMachine }) {
  const periodos = row.periodosEntreFallas ?? [];
  const fechas = row.fechasDeteccion ?? [];

  if (row.fallas < 2 || periodos.length === 0) {
    return (
      <div className="space-y-2 text-xs">
        {fechas.length === 1 && (
          <p className="text-ink-muted">
            Único fallo registrado:{' '}
            <strong className="text-ink-soft">{fmtDateTime(fechas[0])}</strong>
          </p>
        )}
        <p className="leading-relaxed text-ink-muted">
          Solo <strong className="font-medium text-ink-soft">{row.fallas}</strong>{' '}
          {row.fallas === 1 ? 'fallo' : 'fallos'} en el rango. Para MTBF se necesitan{' '}
          <strong className="font-medium text-ink-soft">al menos 2 fallos</strong> en la
          misma máquina.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-soft">
        <strong className="font-medium text-ink">{row.fallas}</strong> fallos registrados →{' '}
        <strong className="font-medium text-ink">{periodos.length}</strong>{' '}
        {periodos.length === 1 ? 'periodo' : 'periodos'} medidos entre ellos:
      </p>
      {fechas.length > 0 && (
        <ul className="space-y-1 border-b border-border-soft pb-2 text-[11px] text-ink-muted">
          {fechas.map((iso, i) => (
            <li key={iso}>
              Fallo {i + 1}: {fmtDateTime(iso)}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-2 text-ink-muted">
        {periodos.map((p, i) => (
          <li key={i}>
            <span className="font-medium text-ink-soft">
              De fallo {i + 1} a {i + 2}:
            </span>{' '}
            <strong className="text-ink-soft">{fmtDuration(p.duracionHoras)}</strong>
            <br />
            <span className="text-[11px]">
              {fmtDateTime(p.desde)} → {fmtDateTime(p.hasta)}
            </span>
          </li>
        ))}
      </ul>
      <p className="rounded-md bg-accent/10 px-2 py-1.5 font-medium text-ink">
        Promedio = MTBF{' '}
        <span className="text-accent">{row.mtbfHoras != null ? fmtMtbf(row.mtbfHoras) : '—'}</span>
      </p>
    </div>
  );
}

function ReliabilityDetailModal({
  row,
  onClose,
}: {
  row: ReliabilityMachine;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface shadow-pop [color-scheme:dark]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="reliability-detail-title"
      >
        <div className="flex items-start justify-between border-b border-border-soft px-5 py-4">
          <div>
            <h2 id="reliability-detail-title" className="text-base font-semibold text-ink">
              Cálculo — {row.maquinaId}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Fechas y duraciones que explican MTTR y MTBF del gráfico
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">
              MTTR — tiempo de reparación
            </p>
            <MttrBreakdown row={row} />
          </div>
          <div className="border-t border-border-soft pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
              MTBF — tiempo entre fallas
            </p>
            <MtbfBreakdown row={row} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReliabilityDetailTable({ rows }: { rows: ReliabilityMachine[] }) {
  const [detailRow, setDetailRow] = useState<ReliabilityMachine | null>(null);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        Sin órdenes con técnico asignado en el rango seleccionado
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border-soft bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/80 text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3 font-semibold">Máquina</th>
              <th className="px-4 py-3 text-center font-semibold">Fallos recurrentes</th>
              <th className="px-4 py-3 text-center font-semibold">Rep. cerradas</th>
              <th className="px-4 py-3 text-right font-semibold">MTTR</th>
              <th className="px-4 py-3 text-right font-semibold">MTBF</th>
              <th className="px-4 py-3 text-center font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.maquinaId}
                className="border-b border-border-soft transition-colors hover:bg-surface-2/40"
              >
                <td className="px-4 py-3 font-semibold text-ink">{row.maquinaId}</td>
                <td
                  className="px-4 py-3 text-center text-ink-soft"
                  title="Fallos con técnico asignado en el rango"
                >
                  {row.fallas}
                </td>
                <td className="px-4 py-3 text-center text-ink-soft">{row.reparaciones}</td>
                <td className="px-4 py-3 text-right font-semibold text-warning">
                  {row.mttrHoras != null ? fmtMttr(row.mttrHoras) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-accent">
                  {row.mtbfHoras != null ? fmtMtbf(row.mtbfHoras) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setDetailRow(row)}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-accent"
                    title="Ver fechas y cálculo de MTTR y MTBF"
                    aria-label={`Ver cálculo de ${row.maquinaId}`}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailRow && (
        <ReliabilityDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </>
  );
}

function ReliabilityBars({
  rows,
  metric,
  color,
  unitLabel,
  div,
  decimals,
}: {
  rows: ReliabilityMachine[];
  metric: 'mttrHoras' | 'mtbfHoras';
  color: string;
  unitLabel: string;
  div: number;
  decimals: number;
}) {
  const data = rows
    .filter((r) => r[metric] != null)
    .map((r) => {
      const raw = (r[metric] as number) / div;
      return { maquinaId: r.maquinaId, valor: roundToDecimals(raw, decimals) };
    });

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-muted">
        Sin datos suficientes en el rango
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="maquinaId" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
          tickFormatter={(v) => roundToDecimals(Number(v), decimals).toFixed(decimals)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--color-surface-2)' }}
          formatter={(v) => [`${roundToDecimals(Number(v), decimals).toFixed(decimals)} ${unitLabel}`, '']}
        />
        <Bar dataKey="valor" name={unitLabel} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReliabilityPanel({
  data,
  isLoading,
}: {
  data?: ReliabilityResponse;
  isLoading?: boolean;
}) {
  if (isLoading) return <Skeleton className="h-[560px] w-full" />;

  const rows = data?.porMaquina ?? [];
  const mttrUnit = pickMttrUnit(rows.map((r) => r.mttrHoras));
  const mtbfUnit = pickMtbfUnit(rows.map((r) => r.mtbfHoras));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confiabilidad — MTTR y MTBF</CardTitle>
        <p className="text-xs text-ink-muted">
          MTTR = tiempo medio de reparación (menos es mejor) · MTBF = tiempo medio entre
          fallas (más es mejor)
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniMetric label="MTTR global" value={fmtMttr(data?.global.mttrHoras ?? null)} />
          <MiniMetric label="MTBF global" value={fmtMtbf(data?.global.mtbfHoras ?? null)} />
          <MiniMetric label="Reparaciones" value={String(data?.global.reparaciones ?? 0)} />
          <MiniMetric label="Fallas" value={String(data?.global.fallas ?? 0)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              MTTR por máquina{' '}
              <span className="text-xs font-normal text-ink-muted">({mttrUnit.label})</span>
            </p>
            <ReliabilityBars
              rows={rows.filter((r) => r.reparaciones > 0)}
              metric="mttrHoras"
              color="var(--color-warning)"
              unitLabel={mttrUnit.label}
              div={mttrUnit.div}
              decimals={mttrUnit.decimals}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              MTBF por máquina{' '}
              <span className="text-xs font-normal text-ink-muted">({mtbfUnit.label})</span>
            </p>
            <ReliabilityBars
              rows={rows}
              metric="mtbfHoras"
              color="var(--color-accent)"
              unitLabel={mtbfUnit.label}
              div={mtbfUnit.div}
              decimals={mtbfUnit.decimals}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border-soft bg-surface-2/30 p-4">
          <p className="mb-2 text-sm font-semibold text-ink">Resumen por máquina</p>
          <p className="mb-4 text-xs text-ink-muted">
            Valores del gráfico en columnas. Pulsa{' '}
            <Info className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> para ver
            fechas y duraciones de cada fallo y reparación.
          </p>
          <ReliabilityDetailTable rows={rows} />
        </div>
      </CardContent>
    </Card>
  );
}
