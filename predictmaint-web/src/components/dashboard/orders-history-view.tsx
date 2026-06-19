'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Pagination } from '@/components/ui/pagination';
import { StatusPill } from '@/components/ui/status-pill';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useOrders } from '@/presentation/hooks/useOrders';
import { useMachines } from '@/presentation/hooks/useMachines';
import { orderService } from '@/application/services/order.service';
import type { OrderQuery } from '@/infrastructure/repositories/order.repository';
import type { Order } from '@/core/entities';
import { EstadoOrden, SolucionTipo, TipoFallo } from '@/core/types';
import { ClipboardList, Clock3, FileCheck2, ThumbsDown } from 'lucide-react';

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
        'Inicio',
        'Término',
        'Duración',
        'Tipo solución',
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
        r.iniciadoEn ?? '',
        r.finalizadoEn ?? '',
        formatOrderDuration(r) ?? '',
        formatTipoSolucion(r.solucionTipo),
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
        subtitle="Solo órdenes con técnico asignado · paginado por fecha"
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
                    render: (r) => (
                      <Link
                        href={`/dashboard/orders/${r.id}`}
                        className="text-accent hover:underline"
                      >
                        Ver
                      </Link>
                    ),
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
