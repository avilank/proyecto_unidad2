'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService } from '@/application/services/auth.service';
import { loginSchema, type LoginFormValues } from '@/lib/validations/login';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { Logo } from '@/components/common/logo';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RolUsuario } from '@/core/types';

export function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'operador@planta.pe', password: 'password123' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      const response = await authService.login(values);
      setSession(response.accessToken, {
        id: response.user.id,
        email: values.email,
        nombre: response.user.nombre,
        rol: response.user.rol,
        tecnicoId: response.user.tecnicoId,
        activo: true,
        creadoEn: new Date().toISOString(),
      });
      const isTechnician =
        response.user.rol === RolUsuario.TECNICO ||
        response.user.rol === RolUsuario.TECNICO_SENIOR;
      router.push(isTechnician ? '/dashboard/my-work' : '/dashboard');
    } catch {
      setSubmitError('Credenciales inválidas. Verifica email y contraseña.');
    }
  };

  return (
    <div className="relative flex min-h-screen">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle iconOnly />
      </div>

      {/* Panel izquierdo — branding */}
      <section className="hidden w-1/2 flex-col justify-between bg-bg-deep p-12 lg:flex">
        <Logo />
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-ink">
            Anticipa fallos.
            <br />
            <span className="text-accent">Protege tu planta.</span>
          </h1>
          <p className="text-lg text-ink-soft">
            Detección inteligente de fallas con ML.
            <br />
            Predicción, clasificación y recomendaciones automáticas.
          </p>
        </div>
        <p className="text-xs text-ink-muted">© 2026 PredictMaint</p>
      </section>

      {/* Panel derecho — formulario */}
      <section className="flex w-full flex-col justify-center bg-bg px-8 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink">Iniciar sesión</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              id="email"
              type="email"
              label="Correo electrónico"
              placeholder="operador@planta.pe"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              id="password"
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            {submitError && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {submitError}
              </p>
            )}
            <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Accediendo…' : 'Acceder al sistema'}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-muted">
            ¿Olvidaste tu contraseña?
          </p>
        </div>
      </section>
    </div>
  );
}
