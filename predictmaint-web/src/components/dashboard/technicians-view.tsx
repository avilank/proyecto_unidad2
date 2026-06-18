'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { Technician } from '@/core/entities';
import { Especialidad, EstadoTecnico, Turno } from '@/core/types';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusPill } from '@/components/ui/status-pill';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTechnicians, useTechnicianMutations } from '@/presentation/hooks/useTechnicians';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Activity, Clock3, Users, Wrench } from 'lucide-react';

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
                columns={[
                  {
                    key: 'tecnico',
                    header: 'Técnico',
                    render: (t) => (
                      <div>
                        <p className="font-semibold text-ink">{t.nombre}</p>
                        <p className="text-xs text-ink-muted">
                          {t.email ?? '—'} · Tel: {t.telefono}
                        </p>
                      </div>
                    ),
                  },
                  { key: 'esp', header: 'Especialidad', render: (t) => prettyEspecialidad(t.especialidad) },
                  { key: 'turno', header: 'Turno', render: (t) => prettyTurno(t.turno) },
                  {
                    key: 'estado',
                    header: 'Estado',
                    render: (t) => (
                      <StatusPill
                        status={mapTechnicianStatus(t.estado)}
                        label={prettyTechnicianStatus(t.estado)}
                      />
                    ),
                  },
                  {
                    key: 'maquinas',
                    header: 'Máquinas asignadas',
                    render: (t) =>
                      t.maquinas?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {t.maquinas.map((m) => (
                            <Badge key={m} variant="accent">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-muted">Sin asignación activa</span>
                      ),
                  },
                  { key: 'ordenes', header: 'Órdenes hoy', render: (t) => `${t.ordenesHoy}` },
                  {
                    key: 'actions',
                    header: 'Acciones',
                    render: (t) => (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setModal({ mode: 'edit', technician: t })}
                        >
                          Editar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleDelete(t)}>
                          Eliminar
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
            <CardContent className="space-y-2 text-sm">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-xl border-accent/50 shadow-pop">
        <CardHeader>
          <CardTitle>{mode === 'create' ? 'Nuevo Técnico' : 'Editar Técnico'}</CardTitle>
          <p className="text-sm text-ink-muted">
            Las máquinas asignadas se muestran automáticamente según órdenes activas.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            label="Nombre completo"
            placeholder="Ej: Carlos Torres"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <Field label="Especialidad">
            <select
              className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-ink"
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value as Especialidad)}
            >
              {ESPECIALIDADES.map((e) => (
                <option key={e} value={e}>
                  {prettyEspecialidad(e)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Turno">
            <select
              className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-ink"
              value={turno}
              onChange={(e) => setTurno(e.target.value as Turno)}
            >
              {TURNOS.map((t) => (
                <option key={t} value={t}>
                  {prettyTurno(t)}
                </option>
              ))}
            </select>
          </Field>

          {mode === 'edit' && (
            <Field label="Estado">
              <select
                className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-ink"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoTecnico)}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {prettyTechnicianStatus(e)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {mode === 'edit' && technician?.maquinas?.length ? (
            <div className="rounded-md border border-border-soft bg-surface-2 p-3">
              <p className="text-xs text-ink-muted">Máquinas asignadas (automático)</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {technician.maquinas.map((m) => (
                  <Badge key={m} variant="accent">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <Input
            label="Teléfono (WhatsApp)"
            placeholder="+51 9XX XXX XXX"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
          <Input
            label="Email"
            placeholder="tecnico@planta.pe"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Guardando…' : mode === 'create' ? 'Guardar técnico' : 'Actualizar'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

function mapTechnicianStatus(estado: string): 'normal' | 'alerta' | 'mantenimiento' {
  if (estado === EstadoTecnico.DISPONIBLE) return 'normal';
  if (estado === EstadoTecnico.EN_INTERVENCION) return 'alerta';
  return 'mantenimiento';
}

function prettyTechnicianStatus(estado: string) {
  return estado.replace(/_/g, ' ');
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
  const toneClass =
    tone === 'danger'
      ? 'border-danger/50 bg-danger/10'
      : tone === 'warning'
        ? 'border-warning/50 bg-warning/10'
        : 'border-accent/50 bg-accent/10';
  return (
    <div className={`rounded-md border p-2 ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-ink-soft">{body}</p>
    </div>
  );
}
