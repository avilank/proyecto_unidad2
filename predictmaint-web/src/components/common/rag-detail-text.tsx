export function RagDetailText({ text }: { text: string | null | undefined }) {
  if (!text) return <p className="mt-1 text-sm text-ink-soft">Sin detalle</p>;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const isBullets = lines.some((line) => line.startsWith('-'));

  if (!isBullets) {
    return <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{text}</p>;
  }

  return (
    <ul className="mt-2 list-none space-y-1.5 text-sm text-ink-soft">
      {lines.map((line, index) => (
        <li key={`${index}-${line.slice(0, 24)}`} className="flex gap-2">
          <span className="mt-0.5 shrink-0 text-accent">—</span>
          <span>{line.replace(/^-\s*/, '')}</span>
        </li>
      ))}
    </ul>
  );
}
