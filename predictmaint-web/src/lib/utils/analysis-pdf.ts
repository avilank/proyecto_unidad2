import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BinaryPrediction, MulticlassPrediction, Order, SensorReading } from '@/core/entities';
import { FAULT_LABELS } from '@/lib/constants/fault-types';
import { formatModelLabel } from '@/lib/utils/dashboard';

/* ── Paleta y tipografía ── */
const C = {
  header: [30, 41, 59] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
};

type PdfContext = {
  maquinaId: string;
  orderId?: string | null;
  nivelRiesgo?: string | null;
};

function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(decimals)}%`;
}

function fmtRoc(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(3);
}

function fmtDate(d = new Date()): string {
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slugFilename(parts: string[]): string {
  return parts.filter(Boolean).join('-').replace(/[^a-zA-Z0-9-_]/g, '_');
}

function createDoc(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, ctx: PdfContext): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.header);
  doc.rect(0, 0, w, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PredictMaint', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('Mantenimiento Predictivo · Informe de Análisis', 14, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(subtitle, 14, 35);

  doc.setTextColor(...C.muted);
  doc.setFontSize(8);
  doc.text(fmtDate(), w - 14, 14, { align: 'right' });

  const y = 46;
  doc.setFillColor(...C.surface);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, w - 28, 22, 2, 2, 'FD');

  doc.setTextColor(...C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Máquina: ${ctx.maquinaId}`, 18, y + 8);
  if (ctx.orderId) doc.text(`Orden: ${ctx.orderId}`, 18, y + 14);
  if (ctx.nivelRiesgo) doc.text(`Nivel de riesgo: ${ctx.nivelRiesgo}`, 18, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text('Documento generado desde el panel de análisis', w - 18, y + 8, { align: 'right' });

  return y + 30;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...C.accent);
  doc.rect(14, y, 3, 7, 'F');
  doc.setTextColor(...C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 20, y + 5.5);
  return y + 12;
}

function drawSummaryBox(doc: jsPDF, y: number, lines: string[]): number {
  const w = doc.internal.pageSize.getWidth();
  const boxH = 8 + lines.length * 5;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, y, w - 28, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.ink);
  lines.forEach((line, i) => doc.text(line, 18, y + 6 + i * 5));
  return y + boxH + 6;
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('PredictMaint — Informe confidencial de uso interno', 14, h - 7);
    doc.text(`Página ${i} de ${pages}`, w - 14, h - 7, { align: 'right' });
  }
}

function saveDoc(doc: jsPDF, filename: string) {
  addFooter(doc);
  doc.save(filename);
}

function sortS1(items: BinaryPrediction[]): BinaryPrediction[] {
  return [...items].sort((a, b) => {
    const rocA = a.rocAuc ?? 0;
    const rocB = b.rocAuc ?? 0;
    if (rocB !== rocA) return rocB - rocA;
    return (b.accuracy ?? 0) - (a.accuracy ?? 0);
  });
}

function sortS2(items: MulticlassPrediction[]): MulticlassPrediction[] {
  return [...items].sort((a, b) => {
    const accA = a.accuracy ?? 0;
    const accB = b.accuracy ?? 0;
    if (accB !== accA) return accB - accA;
    return (b.f1Macro ?? 0) - (a.f1Macro ?? 0);
  });
}

/* ── S-1: Predicción de Fallo ── */
export type S1PdfInput = {
  ctx: PdfContext;
  reading?: SensorReading;
  items: BinaryPrediction[];
  modeloLider: string | null;
  confianzaLider: number | null;
  consenso: string | null;
  umbralFalla?: number;
};

export function downloadS1AnalysisPdf(input: S1PdfInput): void {
  const doc = createDoc();
  let y = drawHeader(
    doc,
    'Etapa S-1 — Predicción de Fallo',
    'Análisis binario: FALLA vs SIN FALLA (3 modelos)',
    input.ctx,
  );

  const sorted = sortS1(input.items);
  const liderName = input.modeloLider ? formatModelLabel(input.modeloLider) : '—';
  const confPct =
    input.confianzaLider != null ? `${(input.confianzaLider * 100).toFixed(1)}%` : '—';

  y = drawSummaryBox(doc, y, [
    `Modelo líder (mayor confianza en esta lectura): ${liderName}`,
    `Confianza de falla: ${confPct}${input.consenso ? ` · Decisión: ${input.consenso}` : ''}`,
    input.umbralFalla != null
      ? `Umbral configurado: ${(input.umbralFalla * 100).toFixed(0)}% — ${input.confianzaLider != null && input.confianzaLider >= input.umbralFalla ? 'FALLA confirmada' : 'Evaluar contra umbral'}`
      : 'Modelos ordenados por ROC-AUC (mayor precisión offline primero)',
  ]);

  if (input.reading) {
    y = drawSectionTitle(doc, y, 'Datos del sensor');
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Variable', 'Valor']],
      body: [
        ['Tipo máquina', input.reading.tipo ?? '—'],
        ['Temp. aire', input.reading.airTemperature != null ? `${input.reading.airTemperature} K` : '—'],
        ['Temp. proceso', input.reading.processTemperature != null ? `${input.reading.processTemperature} K` : '—'],
        ['Velocidad rotacional', input.reading.rotationalSpeed != null ? `${input.reading.rotationalSpeed} rpm` : '—'],
        ['Torque', input.reading.torque != null ? `${input.reading.torque} Nm` : '—'],
        ['Desgaste herramienta', input.reading.toolWear != null ? `${input.reading.toolWear} min` : '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: C.header, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.ink },
      alternateRowStyles: { fillColor: C.surface },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  y = drawSectionTitle(doc, y, 'Comparativa de modelos (orden: mayor ROC-AUC)');

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [
      ['#', 'Modelo', 'Rol', 'Predicción', 'Prob.', 'Accuracy', 'ROC-AUC', 'Precision', 'Recall', 'F1'],
    ],
    body: sorted.map((p, i) => [
      String(i + 1),
      formatModelLabel(p.modelo),
      p.esLider ? '★ Líder' : '—',
      p.prediccion.replace(/_/g, ' '),
      fmtPct(p.probabilidad),
      fmtPct(p.accuracy),
      fmtRoc(p.rocAuc),
      fmtPct(p.precision),
      fmtPct(p.recall),
      fmtPct(p.f1Score),
    ]),
    theme: 'striped',
    headStyles: { fillColor: C.header, fontSize: 7, halign: 'center' },
    bodyStyles: { fontSize: 7, textColor: C.ink },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      2: { halign: 'center', textColor: C.accent },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw);
        if (val.includes('FALLA') && !val.includes('SIN')) {
          data.cell.styles.textColor = C.danger;
          data.cell.styles.fontStyle = 'bold';
        } else if (val.includes('SIN')) {
          data.cell.styles.textColor = C.success;
        }
      }
      if (data.section === 'body' && data.column.index === 2 && String(data.cell.raw).includes('Líder')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = C.accent;
      }
    },
  });

  const fn = slugFilename([
    'PredictMaint',
    'S1',
    input.ctx.maquinaId,
    input.ctx.orderId ?? '',
  ]);
  saveDoc(doc, `${fn}.pdf`);
}

/* ── S-2: Clasificación de Tipo ── */
export type S2PdfInput = {
  ctx: PdfContext;
  items: MulticlassPrediction[];
  modeloLider: string | null;
  tipoPredicho: string | null;
  agreement: string | null;
  confianza: number | null;
  tecnico?: { nombre: string } | null;
  tecnicoPendiente?: boolean;
};

export function downloadS2ClassificationPdf(input: S2PdfInput): void {
  const doc = createDoc();
  let y = drawHeader(
    doc,
    'Etapa S-2 — Clasificación de Tipo de Fallo',
    'Análisis multiclase: HDF · PWF · TWF · OSF · RNF',
    input.ctx,
  );

  const sorted = sortS2(input.items);
  const tipo = input.tipoPredicho ?? '—';
  const tipoLabel = FAULT_LABELS[tipo] ?? tipo;

  y = drawSummaryBox(doc, y, [
    `Tipo predicho (consenso): ${tipo} — ${tipoLabel}`,
    `Modelo líder S-2: ${input.modeloLider ? formatModelLabel(input.modeloLider) : '—'}${input.confianza != null ? ` · ${input.confianza.toFixed(1)}% confianza` : ''}`,
    `Agreement entre modelos: ${input.agreement ?? '—'}`,
    input.tecnico
      ? `Técnico asignado: ${input.tecnico.nombre}`
      : input.tecnicoPendiente
        ? 'Técnico: asignación pendiente (reintento programado)'
        : 'Técnico: sin asignar',
  ]);

  y = drawSectionTitle(doc, y, 'Comparativa de modelos (orden: mayor accuracy)');

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [
      ['#', 'Modelo', 'Rol', 'Tipo pred.', 'HDF', 'PWF', 'TWF', 'OSF', 'RNF', 'Accuracy', 'F1-macro'],
    ],
    body: sorted.map((m, i) => [
      String(i + 1),
      formatModelLabel(m.modelo),
      m.esLider ? '★ Líder' : m.diverge ? 'Diverge' : '—',
      m.tipoPredicho ?? '—',
      fmtPct(m.probHdf),
      fmtPct(m.probPwf),
      fmtPct(m.probTwf),
      fmtPct(m.probOsf),
      fmtPct(m.probRnf),
      fmtPct(m.accuracy),
      m.f1Macro != null ? m.f1Macro.toFixed(3) : '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: C.header, fontSize: 6.5, halign: 'center' },
    bodyStyles: { fontSize: 6.5, textColor: C.ink },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      2: { halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 2) {
        const raw = String(data.cell.raw);
        if (raw.includes('Líder')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = C.accent;
        } else if (raw.includes('Diverge')) {
          data.cell.styles.textColor = C.warning;
        }
      }
    },
  });

  const fn = slugFilename(['PredictMaint', 'S2', input.ctx.maquinaId, input.ctx.orderId ?? '']);
  saveDoc(doc, `${fn}.pdf`);
}

/* ── S-3: Recomendaciones RAG ── */
export type RagPdfInput = {
  ctx: PdfContext;
  order?: Order | null;
  tipoFallo: string;
  estado?: string;
  escalado?: boolean;
  acciones: { orden: number; titulo: string; detalle: string | null; prioridad: string }[];
  fuentes?: string[];
  multiclassMeta?: {
    modeloLider: string | null;
    agreement: string | null;
    confianza: number | null;
  };
};

function priorityLabel(p: string): string {
  switch (p?.toUpperCase()) {
    case 'CRITICO':
      return 'Crítica';
    case 'MEDIO':
      return 'Moderada';
    case 'BAJO':
    case 'ALTO':
      return 'Baja';
    default:
      return p ?? '—';
  }
}

export function downloadRagRecommendationPdf(input: RagPdfInput): void {
  const doc = createDoc();
  let y = drawHeader(
    doc,
    'Etapa S-3 — Recomendaciones RAG',
    'Plan de acción basado en historial y fuentes técnicas',
    input.ctx,
  );

  const tipoLabel = FAULT_LABELS[input.tipoFallo] ?? input.tipoFallo;
  const meta = input.multiclassMeta;

  y = drawSummaryBox(doc, y, [
    `Tipo de fallo: ${input.tipoFallo} — ${tipoLabel}`,
    `Estado del plan RAG: ${input.estado ?? 'pendiente'}${input.escalado ? ' · Escalado activo' : ''}`,
    meta?.modeloLider
      ? `Origen clasificación: ${formatModelLabel(meta.modeloLider)}${meta.confianza != null ? ` (${meta.confianza.toFixed(1)}%)` : ''} · Agreement ${meta.agreement ?? '—'}`
      : 'Generado automáticamente tras confirmación S-2',
    input.order?.tecnico
      ? `Técnico asignado: ${input.order.tecnico.nombre}`
      : 'Técnico: pendiente de asignación',
  ]);

  if (input.order) {
    y = drawSectionTitle(doc, y, 'Contexto de la orden');
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Campo', 'Valor']],
      body: [
        ['Orden', input.order.id],
        ['Máquina', input.order.maquinaId],
        ['Estado orden', input.order.estado.replace(/_/g, ' ')],
        ['Nivel de riesgo', input.order.nivelRiesgo],
        ['Detectado', input.order.detectadoEn ? new Date(input.order.detectadoEn).toLocaleString('es-PE') : '—'],
        ['Estado RAG', input.order.ragEstado ?? input.estado ?? '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: C.header, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: C.surface },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  y = drawSectionTitle(doc, y, 'Plan de acción recomendado');

  if (input.acciones.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('No hay acciones registradas en el plan RAG.', 14, y + 4);
    y += 12;
  } else {
    input.acciones
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .forEach((a) => {
        const w = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const detalle = (a.detalle ?? '').trim();
        const lines = doc.splitTextToSize(detalle || 'Sin detalle adicional.', w - 40);
        const blockH = 14 + lines.length * 4.5;

        if (y + blockH > pageH - 20) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(...C.accent);
        doc.circle(20, y + 4, 3.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(String(a.orden), 20, y + 5.2, { align: 'center' });

        doc.setTextColor(...C.ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(a.titulo, 28, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(`Prioridad: ${priorityLabel(a.prioridad)}`, w - 14, y + 5, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(lines, 28, y + 11);

        y += blockH + 4;
      });
  }

  if (input.fuentes?.length) {
    y = drawSectionTitle(doc, y, 'Fuentes consultadas');
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['#', 'Fuente RAG']],
      body: input.fuentes.map((f, i) => [String(i + 1), f]),
      theme: 'striped',
      headStyles: { fillColor: C.header, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });
  }

  const fn = slugFilename(['PredictMaint', 'RAG', input.ctx.maquinaId, input.ctx.orderId ?? '']);
  saveDoc(doc, `${fn}.pdf`);
}
