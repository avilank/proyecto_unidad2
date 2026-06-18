'use client';

import { useState, type ReactNode } from 'react';
import { Activity, Clock3, Pencil, Plus, Trash2, Users, Wrench, X } from 'lucide-react';
import type { Technician } from '@/core/entities';
import { Especialidad, EstadoTecnico, Turno } from '@/core/types';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill } from '@/components/ui/status-pill';
import { Badge } from '@/components/ui/badge';
import { useTechnicians, useTechnicianMutations } from '@/presentation/hooks/useTechnicians';
import { TableSkeleton } from '@/components/ui/skeleton';

const ESPECIALIDADES = Object.values(Especialidad);
const TURNOS = Object.values(Turno);
const ESTADOS = Object.values(EstadoTecnico);

export function TechniciansView() {
  const technicians = useTechnicians();
  const mutations = useTechnicianMutations();
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; technician: Technician } | null>(
    null,
  );
  const list = technicians.data ?? [];

  const stats = {
    total: list.length,
    available: list.filter((t) => t.estado === EstadoTecnico.DISPONIBLE).length,
    inProgress: list.filter((t) => t.estado === EstadoTecnico.EN_INTERVENCION).length,
    off: list.filter((t) => t.estado === EstadoTecnico.FUERA_DE_TURNO).length,
  };

  const handleDelete = async (t: Technician) => {
    if (!confirm(`¿Desactivar al técnico ${t.nombre}?`)) return;
    try {
      await mutations.remove(t.id);
    } catch {
      alert('No se pudo eliminar el técnico');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Topbar
        title="Gestión de Técnicos"
        subtitle="CRUD de técnicos · Máquinas asignadas se calculan desde órdenes activas"
        right={
          <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
            <Plus className="h-4 w-4" /> Nuevo Técnico
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} value={stats.total} label="Total técnicos" tone="accent" />
        <KpiCard icon={Activity} value={stats.available} label="Disponibles ahora" tone="success" />
        <KpiCard icon={Wrench} value={stats.inProgress} label="En intervención" tone="warning" />
        <KpiCard icon={Clock3} value={stats.off} label="Fuera de turno" tone="accent" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Lista de técnicos</CardTitle>
          </CardHeader>
          <CardContent>
            {technicians.isLoading ? (
              <TableSkeleton rows={6} />
            ) : (
              <DataTable
                rows={list}
                emptyMessage="No hay técnicos registrados"
                className="overflow-x-hidden [&_table]:min-w-0 [&_table]:w-full [&_table]:text-xs [&_td]:px-23 [&_td]:py-4 [&_th]:px-3 [&_th]:py-5 [&_th]:text-[12px]"
                columns={[
                  {
                    key: 'tecnico',
                    header: 'Técnico',
                    className: 'min-w-[140px]',
                    render: (t) => (
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                          {t.iniciales}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{t.nombre}</p>
                          <p className="truncate text-[10px] text-ink-muted">{t.telefono}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'esp',
                    header: 'Especialidad',
                    className: 'whitespace-nowrap',
                    render: (t) => (
                      <span className="text-[11px]">{prettyEspecialidad(t.especialidad)}</span>
                    ),
                  },
                  {
                    key: 'turno',
                    header: 'Turno',
                    className: 'whitespace-nowrap',
                    render: (t) => <span className="text-[11px]">{prettyTurno(t.turno)}</span>,
                  },
                  {
                    key: 'estado',
                    header: 'Estado',
                    render: (t) => (
                      <StatusPill
                        status={mapTechnicianStatus(t.estado)}
                        label={prettyTechnicianStatus(t.estado)}
                        className="px-2 py-0.5 text-[10px]"
                      />
                    ),
                  },
                  {
                    key: 'maquinas',
                    header: 'Máquinas',
                    render: (t) =>
                      t.maquinas?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {t.maquinas.map((m) => (
                            <Badge key={m} variant="accent" className="px-1.5 py-0 text-[10px]">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-muted">Sin asignación activa</span>
                      ),
                  },
                  {
                    key: 'ordenes',
                    header: 'Órdenes hoy',
                    className: 'whitespace-nowrap',
                    render: (t) => (
                      <span className="text-[11px] text-ink-soft">
                        {t.ordenesHoy} {t.ordenesHoy === 1 ? 'orden' : 'órdenes'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    header: 'Acciones',
                    className: 'w-[72px]',
                    render: (t) => (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-ink-muted hover:text-ink text-yellow-500"
                          title="Editar"
                          aria-label={`Editar ${t.nombre}`}
                          onClick={() => setModal({ mode: 'edit', technician: t })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-ink-muted hover:text-danger text-red-500"
                          title="Eliminar"
                          aria-label={`Eliminar ${t.nombre}`}
                          onClick={() => handleDelete(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reglas de asignación automática</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <Rule tone="danger" title="CRITICAL" body="Técnico disponible de mayor experiencia en turno" />
              <Rule tone="warning" title="HIGH" body="Especialidad coincidente con tipo de fallo" />
              <Rule tone="accent" title="MEDIUM" body="Menor carga de órdenes activas" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Especialidad por tipo de fallo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong className="text-danger">HDF</strong> · Mecánico / Térmico
              </p>
              <p>
                <strong className="text-warning">PWF</strong> · Eléctrico
              </p>
              <p>
                <strong className="text-accent">TWF</strong> · Mecánico
              </p>
              <p>
                <strong className="text-purple-400">OSF</strong> · Mecánico / General
              </p>
              <p>
                <strong className="text-ink-muted">RNF</strong> · General + inspección manual
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {modal && (
        <TechnicianFormModal
          mode={modal.mode}
          technician={modal.mode === 'edit' ? modal.technician : undefined}
          onClose={() => setModal(null)}
          onSave={async (payload) => {
            if (modal.mode === 'create') {
              await mutations.create(payload);
            } else {
              await mutations.update(modal.technician.id, payload);
            }
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

const MODAL_FIELD_CLASS =
  'h-10 w-full rounded-lg border border-white/[0.06] bg-[#1c202c] px-3 text-sm text-ink shadow-none placeholder:text-ink-muted focus:border-accent/40 focus:outline-none focus:ring-0 autofill:shadow-[inset_0_0_0px_1000px_#1c202c] autofill:[-webkit-text-fill-color:var(--color-ink)]';

const MODAL_SELECT_CLASS = `${MODAL_FIELD_CLASS} appearance-none bg-[#1c202c] [color-scheme:dark]`;

function TechnicianFormModal({
  mode,
  technician,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  technician?: Technician;
  onClose: () => void;
  onSave: (payload: {
    nombre: string;
    especialidad: Especialidad;
    turno: Turno;
    telefono: string;
    email?: string;
    estado?: EstadoTecnico;
  }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(technician?.nombre ?? '');
  const [especialidad, setEspecialidad] = useState<Especialidad>(
    technician?.especialidad ?? Especialidad.MECANICO,
  );
  const [turno, setTurno] = useState<Turno>(technician?.turno ?? Turno.MANANA);
  const [estado, setEstado] = useState<EstadoTecnico>(
    technician?.estado ?? EstadoTecnico.DISPONIBLE,
  );
  const [telefono, setTelefono] = useState(technician?.telefono ?? '');
  const [email, setEmail] = useState(technician?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!nombre.trim() || !telefono.trim()) {
      setError('Nombre y teléfono son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        nombre: nombre.trim(),
        especialidad,
        turno,
        telefono: telefono.trim(),
        email: email.trim() || undefined,
        ...(mode === 'edit' && { estado }),
      });
    } catch {
      setError('Error al guardar. Verifique los datos e intente de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        className="w-full max-w-[460px] rounded-xl bg-surface shadow-pop [color-scheme:dark]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5">
          <div>
            <h2 className="text-base font-semibold text-ink">
              {mode === 'create' ? 'Nuevo Técnico' : 'Editar Técnico'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {mode === 'create'
                ? 'Completa los datos del técnico'
                : 'Actualiza los datos del técnico'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-[#1c202c] hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <ModalField label="Nombre completo">
            <ModalInput
              placeholder="Ej: Carlos Torres"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </ModalField>

          {mode === 'create' ? (
            <>
              <ModalField label="Especialidad">
                <ModalSelect
                  value={especialidad}
                  onChange={(e) => setEspecialidad(e.target.value as Especialidad)}
                >
                  {ESPECIALIDADES.map((e) => (
                    <option key={e} value={e} style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}>
                      {prettyEspecialidad(e)}
                    </option>
                  ))}
                </ModalSelect>
              </ModalField>

              <ModalField label="Turno">
                <ModalSelect value={turno} onChange={(e) => setTurno(e.target.value as Turno)}>
                  {TURNOS.map((t) => (
                    <option key={t} value={t} style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}>
                      {prettyTurno(t)}
                    </option>
                  ))}
                </ModalSelect>
              </ModalField>

              <ModalField label="Máquinas asignadas">
                <ModalInput
                  readOnly
                  className="cursor-default text-ink-soft"
                  placeholder="M-001, M-002, M-003"
                />
              </ModalField>

              <ModalField label="Teléfono (WhatsApp)">
                <ModalInput
                  placeholder="+51 9XX XXX XXX"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </ModalField>

              <ModalField label="Email">
                <ModalInput
                  placeholder="tecnico@planta.pe"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </ModalField>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Especialidad">
                  <ModalSelect
                    value={especialidad}
                    onChange={(e) => setEspecialidad(e.target.value as Especialidad)}
                  >
                    {ESPECIALIDADES.map((e) => (
                      <option key={e} value={e} style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}>
                        {prettyEspecialidad(e)}
                      </option>
                    ))}
                  </ModalSelect>
                </ModalField>

                <ModalField label="Turno">
                  <ModalSelect value={turno} onChange={(e) => setTurno(e.target.value as Turno)}>
                    {TURNOS.map((t) => (
                      <option key={t} value={t} style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}>
                        {prettyTurno(t)}
                      </option>
                    ))}
                  </ModalSelect>
                </ModalField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Estado">
                  <ModalSelect
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoTecnico)}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e} style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}>
                        {prettyTechnicianStatus(e)}
                      </option>
                    ))}
                  </ModalSelect>
                </ModalField>

                <ModalField label="Máquinas asignadas">
                  <ModalInput
                    readOnly
                    className="cursor-default text-ink-soft"
                    value={technician?.maquinas?.length ? technician.maquinas.join(', ') : ''}
                    placeholder="M-001, M-002, M-003"
                  />
                </ModalField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Teléfono (WhatsApp)">
                  <ModalInput
                    placeholder="+51 9XX XXX XXX"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </ModalField>

                <ModalField label="Email">
                  <ModalInput
                    placeholder="tecnico@planta.pe"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </ModalField>
              </div>
            </>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button className="h-10 flex-1 text-sm" onClick={submit} disabled={saving}>
              {saving
                ? 'Guardando…'
                : mode === 'create'
                  ? 'Guardar técnico'
                  : 'Actualizar técnico'}
            </Button>
            <button
              type="button"
              className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[#1c202c] text-sm font-semibold text-ink-muted transition-colors hover:bg-[#252a38] hover:text-ink disabled:opacity-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function ModalInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${MODAL_FIELD_CLASS} ${className ?? ''}`}
      style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}
      {...props}
    />
  );
}

function ModalSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${MODAL_SELECT_CLASS} ${className ?? ''}`}
      style={{ backgroundColor: '#1c202c', color: '#e4e4f0' }}
      {...props}
    >
      {children}
    </select>
  );
}

function mapTechnicianStatus(estado: string): 'normal' | 'alerta' | 'mantenimiento' {
  if (estado === EstadoTecnico.DISPONIBLE) return 'normal';
  if (estado === EstadoTecnico.EN_INTERVENCION) return 'alerta';
  return 'mantenimiento';
}

function prettyTechnicianStatus(estado: string) {
  return estado
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyEspecialidad(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function prettyTurno(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Rule({
  tone,
  title,
  body,
}: {
  tone: 'danger' | 'warning' | 'accent';
  title: string;
  body: string;
}) {
  const dotClass =
    tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-accent';
  const titleClass =
    tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-accent';
  return (
    <div className="rounded-md bg-surface-2/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <p className={`text-[11px] font-bold uppercase tracking-wide ${titleClass}`}>{title}</p>
      </div>
      <p className="mt-1.5 pl-4 text-[11px] leading-snug text-ink-soft">{body}</p>
    </div>
  );
}
