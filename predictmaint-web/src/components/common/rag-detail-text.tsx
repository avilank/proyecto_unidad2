function formatDetailLine(line: string) {
  const cleaned = line.replace(/^[-•*]\s*/, '');
  const match = cleaned.match(/^([^:]+:)(.*)$/);
  if (match) {
    return (
      <>
        <span className="font-medium text-ink">{match[1]}</span>
        <span>{match[2]}</span>
      </>
    );
  }
  return cleaned;
}

export function RagDetailText({ text }: { text: string | null | undefined }) {
  if (!text) return <p className="mt-1 text-sm text-ink-soft">Sin detalle</p>;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const isDetailList =
    lines.length > 1 ||
    lines.some((line) =>
      /^[-•*]?\s*(Urgencia|Tiempo|Estandar|Herramientas|Accion|Justificacion)/i.test(line),
    );

  if (!isDetailList) {
    return <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{text}</p>;
  }

  return (
    <ul className="mt-2 space-y-2 text-sm text-ink-soft">
      {lines.map((line, index) => (
        <li
          key={`${index}-${line.slice(0, 24)}`}
          className="relative pl-5 leading-relaxed before:absolute before:left-0 before:top-[0.5rem] before:h-2 before:w-2 before:rounded-full before:bg-accent before:content-['']"
        >
          {formatDetailLine(line)}
        </li>
      ))}
    </ul>
  );
}
