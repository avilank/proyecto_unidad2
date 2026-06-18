'use client';

interface RawJsonViewProps {
  title: string;
  data: unknown;
  error?: unknown;
  isLoading?: boolean;
}

export function RawJsonView({ title, data, error, isLoading }: RawJsonViewProps) {
  return (
    <main>
      <h1>{title}</h1>
      {isLoading && <p>Cargando...</p>}
      {error != null && (
        <pre>{JSON.stringify({ error: String(error) }, null, 2)}</pre>
      )}
      {!isLoading && !error && (
        <pre>{JSON.stringify(data ?? null, null, 2)}</pre>
      )}
    </main>
  );
}
