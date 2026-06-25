import { cn } from '@/lib/utils/cn';

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

function isEscalationLine(line: string): boolean {
  return /^[-•*]?\s*Tiempo para escalamiento:/i.test(line);
}

function isRiskLine(line: string): boolean {
  return /^[-•*]?\s*Riesgo si no se interviene:/i.test(line);
}

function isPriorityLine(line: string): boolean {
  return /^[-•*]?\s*Prioridad:/i.test(line);
}

function isStepLine(line: string): boolean {
  return /^[-•*]?\s*Paso\s+\d+/i.test(line);
}

export function RagDetailText({ text }: { text: string | null | undefined }) {
  if (!text) return <p className="mt-1 text-sm text-ink-soft">Sin detalle</p>;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const escalationLine = lines.find(isEscalationLine);
  const riskLine = lines.find(isRiskLine);
  const priorityLine = lines.find(isPriorityLine);
  const bodyLines = lines.filter(
    (line) => !isEscalationLine(line) && !isPriorityLine(line) && !isRiskLine(line),
  );

  const isDetailList =
    lines.length > 1 ||
    lines.some((line) =>
      /^[-•*]?\s*(Urgencia|Tiempo|Paso|Descripción|Herramientas|Qué revisar|Justificaci)/i.test(
        line,
      ),
    );

  if (!isDetailList) {
    return <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{text}</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      {priorityLine && (
        <div className="rounded-md bg-surface-2/80 px-3 py-2 text-sm text-ink-soft">
          {formatDetailLine(priorityLine.replace(/^[-•*]\s*/, ''))}
        </div>
      )}

      {escalationLine && (
        <div className="rounded-md bg-warning/10 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            Tiempo límite de intervención
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {formatDetailLine(escalationLine.replace(/^[-•*]\s*/, ''))}
          </p>
        </div>
      )}

      {riskLine && (
        <div className="rounded-md bg-danger/10 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger">
            Riesgo operacional
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {formatDetailLine(riskLine.replace(/^[-•*]\s*/, ''))}
          </p>
        </div>
      )}

      <ul className="space-y-2 text-sm text-ink-soft">
        {bodyLines.map((line, index) => (
          <li
            key={`${index}-${line.slice(0, 24)}`}
            className={cn(
              'relative pl-5 leading-relaxed before:absolute before:left-0 before:top-[0.5rem] before:h-2 before:w-2 before:rounded-full before:content-[""]',
              isStepLine(line) ? 'before:bg-success' : 'before:bg-accent',
            )}
          >
            {formatDetailLine(line.replace(/^[-•*]\s*/, ''))}
          </li>
        ))}
      </ul>
    </div>
  );
}
