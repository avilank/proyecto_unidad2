'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/presentation/hooks/useProfile';
import { profileService } from '@/application/services/profile.service';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { cn } from '@/lib/utils/cn';

const READONLY_CLASS =
  'cursor-not-allowed border-border-soft bg-surface-2/60 text-ink-muted';

function capitalize(s?: string | null): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function ProfileView() {
  const profile = useProfile();
  const updateUser = useSessionStore((s) => s.updateUser);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const data = profile.data;

  useEffect(() => {
    if (data) {
      setNombre(data.nombre);
      setTelefono(data.telefono ?? '');
    }
  }, [data]);

  const dirty = Boolean(data) && (nombre !== data!.nombre || telefono !== (data!.telefono ?? ''));

  const handleSave = async () => {
    if (!nombre.trim()) {
      setToast('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const updated = await profileService.updateProfile({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
      });
      await profile.mutate(updated, false);
      updateUser({ nombre: updated.nombre });
      setToast('Perfil actualizado correctamente');
    } catch {
      setToast('No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Topbar flush title="Mi perfil" subtitle="Edita tu nombre y teléfono de contacto" />

      <div className="flex flex-1 flex-col gap-5 px-6 py-6">
        {profile.isLoading ? (
          <Skeleton className="h-96 w-full max-w-2xl" />
        ) : (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Datos del usuario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nombre completo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre y apellidos"
                />
                <Input
                  label="Teléfono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+51 999 000 000"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Correo"
                  value={data?.email ?? ''}
                  disabled
                  className={READONLY_CLASS}
                />
                <Input
                  label="Rol"
                  value={capitalize(data?.rol)}
                  disabled
                  className={READONLY_CLASS}
                />
              </div>

              {data?.esTecnico && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Especialidad"
                    value={capitalize(data?.especialidad)}
                    disabled
                    className={READONLY_CLASS}
                  />
                  <Input
                    label="Turno"
                    value={capitalize(data?.turno)}
                    disabled
                    className={READONLY_CLASS}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Estado"
                  value={capitalize(data?.estado)}
                  disabled
                  className={READONLY_CLASS}
                />
              </div>

              <p className="text-xs text-ink-muted">
                Solo puedes editar tu <strong className="text-ink-soft">nombre</strong> y{' '}
                <strong className="text-ink-soft">teléfono</strong>. El resto de los campos
                los gestiona un administrador.
              </p>

              {toast && (
                <p
                  className={cn(
                    'text-sm font-medium',
                    toast.includes('No') || toast.includes('vacío')
                      ? 'text-danger'
                      : 'text-success',
                  )}
                >
                  {toast}
                </p>
              )}

              <Button
                size="lg"
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
