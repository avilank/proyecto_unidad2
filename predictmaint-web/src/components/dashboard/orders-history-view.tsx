'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Pagination } from '@/components/ui/pagination';
import { StatusPill } from '@/components/ui/status-pill';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useOrders } from '@/presentation/hooks/useOrders';
import { useMachines } from '@/presentation/hooks/useMachines';
import { useTechnicians } from '@/presentation/hooks/useTechnicians';
import { useSystemConfig } from '@/presentation/hooks/useSettings';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { orderService } from '@/application/services/order.service';
import type { OrderQuery } from '@/infrastructure/repositories/order.repository';
import type { Order } from '@/core/entities';
import type { TiemposAtencion } from '@/lib/types/settings';
import { EstadoOrden, RolUsuario, SolucionTipo, TipoFallo } from '@/core/types';
import { ClipboardList, Clock3, FileCheck2, ThumbsDown, UserCog, X } from 'lucide-react';

const ESTADOS = Object.values(EstadoOrden);
const TIPOS_FALLO = Object.values(TipoFallo);
const DEFAULT_PAGE_SIZE = 15;

export function OrdersHistoryView() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [maquinaId, setMaquinaId] = useState('');
  const [estado, setEstado] = useState('');
  const [tipoFallo, setTipoFallo] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const machines = useMachines();
  const systemConfig = useSystemConfig();
  const tiemposAtencion = systemConfig.data?.tiempos_atencion;

  const user = useSessionStore((s) => s.user);
  const isElevated =
    user?.rol === RolUsuario.SUPERVISOR || user?.rol === RolUsuario.JEFE_PLANTA;
  const technicians = useTechnicians();

  const [reassignTarget, setReassignTarget] = useState<Order | null>(null);
  const [reassignTecnico, setReassignTecnico] = useState<number | ''>('');
  const [reassignMotivo, setReassignMotivo] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const closeReassign = () => {
    if (reassigning) return;
    setReassignTarget(null);
    setReassignTecnico('');
    setReassignMotivo('');
  };

  const handleReassign = async () => {
    if (!reassignTarget || !reassignTecnico || !reassignMotivo.trim()) return;
    setReassigning(true);
    try {
      await orderService.reassign(reassignTarget.id, Number(reassignTecnico), reassignMotivo.trim());
      await orders.mutate();
      setReassignTarget(null);
      setReassignTecnico('');
      setReassignMotivo('');
    } catch {
      alert('No se pudo reasignar la orden');
    } finally {
      setReassigning(false);
    }
  };

  const dateRange = useMemo(() => {
    if (!monthFilter) return {};
    const [year, month] = monthFilter.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [monthFilter]);

  const query = useMemo<OrderQuery>(
    () => ({
      page,
      limit: pageSize,
      conTecnico: true,
      maquinaId: maquinaId || undefined,
      estado: estado || undefined,
      tipoFallo: tipoFallo || undefined,
      search: search.trim() || undefined,
      ...dateRange,
    }),
    [page, pageSize, maquinaId, estado, tipoFallo, search, dateRange],
  );

  useEffect(() => {
    setPage(1);
  }, [maquinaId, estado, tipoFallo, search, monthFilter, pageSize]);

  const orders = useOrders(query);

  const list = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const summary = orders.data?.summary;
  const activeOrders = useMemo(
    () =>
      list.filter(
        (o) => o.estado === EstadoOrden.PENDIENTE || o.estado === EstadoOrden.EN_PROGRESO,
      ),
    [list],
  );
  const reassignableOrders = useMemo(
    () => activeOrders.filter((o) => canReassignBySla(o, tiemposAtencion)),
    [activeOrders, tiemposAtencion],
  );
  const technicianOptions = (technicians.data ?? []).filter(
    (t) => t.id !== reassignTarget?.tecnicoId,
  );

  const pending = summary?.pendiente ?? 0;
  const inProgress = summary?.enProgreso ?? 0;
  const done = summary?.finalizado ?? 0;
  const rejected = summary?.rechazada ?? 0;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await orderService.findAllForExport({
        conTecnico: true,
        maquinaId: maquinaId || undefined,
        estado: estado || undefined,
        tipoFallo: tipoFallo || undefined,
        search: search.trim() || undefined,
        ...dateRange,
      });

      const header = [
        'ID',
        'Máquina',
        'Tipo Fallo',
        'Técnico',
        'Algoritmo',
        'Confianza',
        'Detectado',
        'Límite inicio',
        'Inicio',
        'Término',
        'Duración',
        'Tipo solución',
        'Reasignado — Motivo',
        'Estado',
      ];
      const rows = all.map((r) => [
        r.id,
        r.maquinaId,
        r.tipoFallo ?? '',
        r.tecnico?.nombre ?? '',
        r.algoritmoClasificador ?? '',
        confianzaS1Value(r)?.toFixed(1) ?? '',
        r.detectadoEn,
        limiteInicioDate(r, tiemposAtencion)?.toISOString() ?? '',
        r.iniciadoEn ?? '',
        r.finalizadoEn ?? '',
        formatOrderDuration(r) ?? '',
        formatTipoSolucion(r.solucionTipo),
        formatReassignCell(r),
        r.estado,
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial-ordenes-${monthFilter || 'all'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setMaquinaId('');
    setEstado('');
    setTipoFallo('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        flush
        title="Historial de Mantenimiento"
        subtitle={
          isElevated
            ? 'Panel de órdenes · reasignación solo tras vencer el límite de inicio'
            : 'Solo órdenes con técnico asignado · paginado por fecha'
        }
      />

      <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-3">
          <FilterSelect
            label="Máquina"
            value={maquinaId}
            onChange={setMaquinaId}
            options={[
              { value: '', label: 'Todas las máquinas' },
              ...(machines.data ?? []).map((m) => ({ value: m.id, label: m.id })),
            ]}
          />
          <FilterSelect
            label="Estado"
            value={estado}
            onChange={setEstado}
            options={[
              { value: '', label: 'Todos los estados' },
              ...ESTADOS.map((e) => ({ value: e, label: e.replace('_', ' ') })),
            ]}
          />
          <FilterSelect
            label="Tipo de fallo"
            value={tipoFallo}
            onChange={setTipoFallo}
            options={[
              { value: '', label: 'Todos los tipos' },
              ...TIPOS_FALLO.map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            label="Mes"
            value={monthFilter}
            onChange={setMonthFilter}
            options={buildMonthOptions()}
          />
          <div className="min-w-[200px] flex-1">
            <Input
              label="Buscar"
              placeholder="ID de orden…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pb-1">
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={exporting || total === 0}
            >
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Clock3} value={pending} label="Pendiente" tone="warning" />
        <KpiCard icon={ClipboardList} value={inProgress} label="En Progreso" tone="accent" />
        <KpiCard icon={FileCheck2} value={done} label="Finalizado" tone="success" />
        <KpiCard icon={ThumbsDown} value={rejected} label="Rechazada" tone="danger" />
      </div>

      {isElevated && !orders.isLoading && reassignableOrders.length > 0 && (
        <Card className="border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-accent" />
              Órdenes vencidas — reasignación
            </CardTitle>
            <p className="text-xs text-ink-muted">
              {reassignableOrders.length} orden(es) con límite de inicio vencido
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {reassignableOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {order.id} · {order.maquinaId}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {order.tecnico?.nombre ?? `#${order.tecnicoId}`} ·{' '}
                    {order.estado.replace('_', ' ')} · {order.tipoFallo ?? '—'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setReassignTarget(order);
                    setReassignTecnico('');
                    setReassignMotivo('');
                  }}
                >
                  Reasignar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {orders.isLoading ? (
            <div className="p-5">
              <TableSkeleton rows={10} />
            </div>
          ) : (
            <>
              <DataTable
                rows={list}
                emptyMessage="No hay órdenes con técnico asignado para los filtros seleccionados"
                columns={[
                  {
                    key: 'id',
                    header: 'ID Orden',
                    render: (r) => <strong className="text-ink">{r.id}</strong>,
                  },
                  { key: 'machine', header: 'Máquina', render: (r) => r.maquinaId },
                  { key: 'tipo', header: 'Tipo Fallo', render: (r) => r.tipoFallo ?? '—' },
                  {
                    key: 'tecnico',
                    header: 'Técnico',
                    render: (r) => r.tecnico?.nombre ?? `#${r.tecnicoId}`,
                  },
                  {
                    key: 'algo',
                    header: 'Algoritmo S-2',
                    render: (r) => r.algoritmoClasificador ?? '—',
                  },
                  {
                    key: 'conf',
                    header: 'Confianza S-1',
                    render: (r) => formatConfianzaS1(r),
                  },
                  {
                    key: 'sol',
                    header: 'Tipo solución',
                    render: (r) => formatTipoSolucion(r.solucionTipo),
                  },
                  {
                    key: 'det',
                    header: 'Detectado',
                    render: (r) =>
                      new Date(r.detectadoEn).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                  },
                  {
                    key: 'limiteInicio',
                    header: 'Límite inicio',
                    render: (r) => {
                      const deadline = limiteInicioDate(r, tiemposAtencion);
                      if (!deadline) return <span className="text-ink-muted">—</span>;
                      return <span className="text-ink-soft">{fmtDateTime(deadline)}</span>;
                    },
                  },
                  {
                    key: 'reasignado',
                    header: 'Reasignado — Motivo',
                    render: (r) => {
                      if (!r.reasignadoMotivo) {
                        return <span className="text-ink-muted">—</span>;
                      }
                      return (
                        <div className="max-w-[220px] leading-tight">
                          <span className="block text-sm text-ink">
                            {r.tecnico?.nombre ?? `#${r.tecnicoId}`}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            {r.reasignadoMotivo}
                          </span>
                          {r.reasignadoEn && (
                            <span className="mt-0.5 block text-[11px] text-ink-muted">
                              {fmtDateTime(new Date(r.reasignadoEn))}
                            </span>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    key: 'inicio',
                    header: 'Inicio',
                    render: (r) =>
                      r.iniciadoEn
                        ? new Date(r.iniciadoEn).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—',
                  },
                  {
                    key: 'termino',
                    header: 'Término',
                    render: (r) =>
                      r.finalizadoEn
                        ? new Date(r.finalizadoEn).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—',
                  },
                  {
                    key: 'duracion',
                    header: 'Duración',
                    render: (r) => {
                      const d = formatOrderDuration(r);
                      if (!d) return '—';
                      return r.estado === EstadoOrden.EN_PROGRESO ? (
                        <span title="Tiempo transcurrido desde el inicio">{d}</span>
                      ) : (
                        d
                      );
                    },
                  },
                  {
                    key: 'estado',
                    header: 'Estado',
                    render: (r) => (
                      <StatusPill status={r.estado} label={r.estado.replace('_', ' ')} />
                    ),
                  },
                  {
                    key: 'acc',
                    header: 'Acciones',
                    render: (r) => {
                      const canReassign =
                        isElevated &&
                        canReassignBySla(r, tiemposAtencion);
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/orders/${r.id}`}
                            className="text-accent hover:underline"
                          >
                            Ver
                          </Link>
                          {canReassign && (
                            <button
                              type="button"
                              onClick={() => {
                                setReassignTarget(r);
                                setReassignTecnico('');
                                setReassignMotivo('');
                              }}
                              className="text-xs font-semibold text-warning hover:underline"
                            >
                              Reasignar
                            </button>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
              />
              <Pagination
                page={page}
                limit={pageSize}
                total={total}
                onPageChange={setPage}
                onLimitChange={setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      {reassignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            className="w-full max-w-[480px] rounded-xl bg-surface shadow-pop [color-scheme:dark]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <h2 className="text-base font-semibold text-ink">Reasignar orden</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {reassignTarget.id} · {reassignTarget.maquinaId} ·{' '}
                  {reassignTarget.tecnico?.nombre ?? `#${reassignTarget.tecnicoId}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReassign}
                disabled={reassigning}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">Nuevo técnico</span>
                <select
                  className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-ink"
                  value={reassignTecnico}
                  onChange={(e) =>
                    setReassignTecnico(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value="">Seleccionar técnico…</option>
                  {technicianOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} · {t.especialidad}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Motivo de reasignación"
                placeholder="Ej: técnico de turno no disponible"
                value={reassignMotivo}
                onChange={(e) => setReassignMotivo(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-border-soft px-5 py-4">
              <Button variant="secondary" onClick={closeReassign} disabled={reassigning}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleReassign()}
                disabled={reassigning || !reassignTecnico || !reassignMotivo.trim()}
              >
                {reassigning ? 'Reasignando…' : 'Confirmar reasignación'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <span className="text-xs text-ink-muted">{label}</span>
      <select
        className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function slaMinForOrder(
  tiempos: TiemposAtencion | undefined,
  nivel: string,
): number | null {
  if (!tiempos) return null;
  const v = tiempos[nivel as keyof TiemposAtencion];
  return v ?? null;
}

function limiteInicioDate(
  order: Pick<Order, 'detectadoEn' | 'nivelRiesgo'>,
  tiempos: TiemposAtencion | undefined,
): Date | null {
  const sla = slaMinForOrder(tiempos, order.nivelRiesgo);
  if (sla == null) return null;
  return new Date(new Date(order.detectadoEn).getTime() + sla * 60_000);
}

function canReassignBySla(
  order: Pick<Order, 'estado' | 'iniciadoEn' | 'detectadoEn' | 'nivelRiesgo'>,
  tiempos: TiemposAtencion | undefined,
): boolean {
  if (order.estado !== EstadoOrden.PENDIENTE) return false;
  if (order.iniciadoEn) return false;
  const limite = limiteInicioDate(order, tiempos);
  if (!limite) return false;
  return Date.now() >= limite.getTime();
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function confianzaS1Value(
  r: Pick<Order, 'confianzaPrediccion' | 'confianzaLider' | 'ensembleAvg'>,
): number | null {
  if (r.confianzaPrediccion != null) return r.confianzaPrediccion;
  if (r.confianzaLider != null) return Number(r.confianzaLider) * 100;
  if (r.ensembleAvg != null) return Number(r.ensembleAvg) * 100;
  return null;
}

function formatConfianzaS1(r: Pick<Order, 'confianzaPrediccion' | 'confianzaLider' | 'ensembleAvg'>) {
  const value = confianzaS1Value(r);
  return value != null ? `${value.toFixed(1)}%` : '—';
}

function formatReassignCell(r: Pick<Order, 'tecnico' | 'tecnicoId' | 'reasignadoMotivo'>) {
  if (!r.reasignadoMotivo) return '';
  const nombre = r.tecnico?.nombre ?? `#${r.tecnicoId}`;
  return `${nombre} — ${r.reasignadoMotivo}`;
}

function formatTipoSolucion(tipo?: SolucionTipo | string | null): string {
  switch (tipo) {
    case SolucionTipo.CON_RAG:
    case 'con_rag':
      return 'RAG';
    case SolucionTipo.PROPIA:
    case 'propia':
      return 'Propia';
    default:
      return '—';
  }
}

function formatOrderDuration(
  r: Pick<Order, 'iniciadoEn' | 'finalizadoEn' | 'estado'>,
): string | null {
  if (!r.iniciadoEn) return null;
  const start = new Date(r.iniciadoEn).getTime();
  const end = r.finalizadoEn
    ? new Date(r.finalizadoEn).getTime()
    : r.estado === EstadoOrden.EN_PROGRESO
      ? Date.now()
      : null;
  if (end == null || end < start) return null;
  return formatDurationMs(end - start, !r.finalizadoEn);
}

function formatDurationMs(ms: number, inProgress = false): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = inProgress ? ' (en curso)' : '';
  if (hours > 0) return `${hours}h ${minutes}m${suffix}`;
  if (minutes > 0) return `${minutes} min${suffix}`;
  return `< 1 min${suffix}`;
}

function buildMonthOptions() {
  const options = [{ value: '', label: 'Todos los meses' }];
  const now = new Date();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}
