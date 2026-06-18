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
import { EstadoOrden, TipoFallo } from '@/core/types';
import { ClipboardList, Clock3, FileCheck2 } from 'lucide-react';

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
        'Estado',
      ];
      const rows = all.map((r) => [
        r.id,
        r.maquinaId,
        r.tipoFallo ?? '',
        r.tecnico?.nombre ?? '',
        r.algoritmoClasificador ?? '',
        r.confianza != null ? r.confianza.toFixed(1) : '',
        r.detectadoEn,
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
    <div className="flex flex-col gap-4">
      <Topbar
        title="Historial de Mantenimiento"
        subtitle="Solo órdenes con técnico asignado · paginado por fecha"
      />

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icon={Clock3} value={pending} label="Pendiente" tone="warning" />
        <KpiCard icon={ClipboardList} value={inProgress} label="En Progreso" tone="accent" />
        <KpiCard icon={FileCheck2} value={done} label="Finalizado" tone="success" />
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
                    header: 'Algoritmo',
                    render: (r) => r.algoritmoClasificador ?? '—',
                  },
                  {
                    key: 'conf',
                    header: 'Confianza',
                    render: (r) => (r.confianza != null ? `${r.confianza.toFixed(1)}%` : '—'),
                  },
                  {
                    key: 'sol',
                    header: 'Solución',
                    render: (r) =>
                      r.solucionDescripcion
                        ? r.solucionDescripcion.slice(0, 40) +
                          (r.solucionDescripcion.length > 40 ? '…' : '')
                        : '—',
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
