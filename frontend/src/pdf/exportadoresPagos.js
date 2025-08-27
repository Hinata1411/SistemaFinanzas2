// src/pdf/exportadoresPagos.js
// Render de tablas simple usando jsPDF puro (sin jspdf-autotable)

import jsPDF from 'jspdf';

// ==== utilidades ====
const fmtQ = (v) =>
  (Number(v) || 0).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 });

const n = (v) => {
  const x = typeof v === 'number' ? v : parseFloat(v || 0);
  return Number.isFinite(x) ? x : 0;
};

// Márgenes y medidas básicas (A4 portrait: 210x297mm => ~ 210x297 puntos * 0.75, jsPDF ya da en pt)
const MARGIN_L = 14;
const MARGIN_R = 14;
const MARGIN_T = 16;
const MARGIN_B = 16;

// Alturas
const LINE_H = 6.5;     // alto mínimo de línea
const HDR_H  = 7.5;     // alto del header de tabla
const GAP    = 4;       // separación vertical entre bloques

// Crea una tabla básica con columnas definidas
// headers: [{label, width, align: 'left'|'right'|'center'}]
// rows:    Array<Array<string>>
function drawTable(doc, startY, headers, rows) {
  let y = startY;

  // ancho de página útil
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableW = pageWidth - MARGIN_L - MARGIN_R;

  // Validar suma de widths de headers: si no suman, normalizar proporcionalmente
  const sumW = headers.reduce((s, h) => s + (h.width || 0), 0);
  let cols = headers.map((h) => ({ ...h }));
  if (!sumW || Math.abs(sumW - usableW) > 1) {
    // Normaliza proporcionalmente al usableW si pasaron anchos en px
    const sum = sumW || headers.length;
    cols = headers.map((h) => ({
      ...h,
      width: usableW * ((h.width || 1) / sum),
    }));
  }

  // header
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');

  let x = MARGIN_L;
  const headerH = HDR_H;
  const bottomLimit = doc.internal.pageSize.getHeight() - MARGIN_B;

  // Salto si no cabe header
  if (y + headerH > bottomLimit) {
    doc.addPage();
    y = MARGIN_T;
  }

  cols.forEach((c) => {
    const textX = alignX(x, c.width, c.align || 'left');
    doc.text(String(c.label || ''), textX, y + headerH - 2, { align: fixAlign(c.align) });
    x += c.width;
  });

  y += headerH;
  doc.setFont(undefined, 'normal');

  // filas
  (rows || []).forEach((row) => {
    // calcular alto de fila (considerando wraps de texto)
    let rowHeight = LINE_H;
    const heights = [];
    x = MARGIN_L;

    cols.forEach((c, i) => {
      const text = String(row[i] ?? '');
      const lines = doc.splitTextToSize(text, c.width - 2); // pequeño padding
      const h = Math.max(LINE_H, lines.length * LINE_H);
      heights.push({ lines, h, align: c.align || 'left', width: c.width });
      if (h > rowHeight) rowHeight = h;
    });

    // salto de página si no cabe la fila
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = MARGIN_T;
    }

    // dibujar textos de la fila
    heights.forEach((cell, i) => {
      const col = cols[i];
      const textX = alignX(x, col.width, cell.align);
      const startTextY = y + LINE_H; // primera línea

      // varias líneas: imprimir una debajo de otra
      (cell.lines || []).forEach((ln, idx) => {
        const yy = startTextY + (idx * LINE_H);
        doc.text(String(ln), textX, yy, { align: fixAlign(cell.align) });
      });

      x += col.width;
    });

    y += rowHeight;
  });

  return y;
}

// helper: alinear x dentro de una celda
function alignX(x, w, align = 'left') {
  switch (align) {
    case 'center': return x + w / 2;
    case 'right':  return x + w - 1; // pequeño padding a la derecha
    default:       return x + 1;     // pequeño padding a la izquierda
  }
}
function fixAlign(a) {
  return a === 'right' ? 'right' : a === 'center' ? 'center' : 'left';
}

// ===================== EXPORTS =========================

/**
 * Exporta un PDF AGRUPADO (por sucursal) de documentos de "pagos".
 * Columnas: Descripción / Monto / Ref / Categoría
 * No usa plugins; solo jsPDF.
 */
export function exportPagosGroupedPdf(docs = [], sucursalesMap = {}, nombre = 'Pagos_Agrupados') {
  const doc = new jsPDF();

  // Agrupar por sucursal
  const bySucursal = {};
  (docs || []).forEach((d) => {
    const sid = d?.sucursalId || '—';
    if (!bySucursal[sid]) bySucursal[sid] = [];
    bySucursal[sid].push(d);
  });

  const sucIds = Object.keys(bySucursal);
  if (!sucIds.length) {
    // Nada que exportar
    doc.setFontSize(14);
    doc.text('Sin datos para exportar', MARGIN_L, MARGIN_T + 4);
    doc.save(`${nombre}.pdf`);
    return;
  }

  sucIds.forEach((sid, idx) => {
    if (idx > 0) doc.addPage();

    const sucNombre = sucursalesMap[sid] || sid || '—';
    const fecha = bySucursal[sid][0]?.fecha || '';

    // Título
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Pagos — ${fecha}`, MARGIN_L, MARGIN_T);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Sucursal: ${sucNombre}`, MARGIN_L, MARGIN_T + 8);

    let y = MARGIN_T + 8 + GAP;

    // Preparar filas (aplana items)
    const rows = [];
    let totalUtilizado = 0;
    let cajaChicaTotal = 0;
    let sobranteTotal = 0;

    bySucursal[sid].forEach((p) => {
      const items = Array.isArray(p.items) ? p.items : [];
      items.forEach((it) => {
        rows.push([
          it.descripcion || '—',
          fmtQ(n(it.monto)),
          it.ref || '—',
          it.categoria || '—',
        ]);
      });

      // totales por doc
      const sumItems = items.reduce((s, it) => s + n(it.monto), 0);
      totalUtilizado += n(p.totalUtilizado ?? sumItems);
      cajaChicaTotal += n(p.cajaChicaUsada);
      sobranteTotal += n(p.sobranteParaManana);
    });

    // Tabla
    const headers = [
      { label: 'Descripción', width: 100, align: 'left' },
      { label: 'Monto',       width: 35,  align: 'right' },
      { label: 'Ref',         width: 35,  align: 'left' },
      { label: 'Categoría',   width: 35,  align: 'left' },
    ];

    y = drawTable(doc, y, headers, rows.length ? rows : [['—','—','—','—']]);
    y += GAP;

    // Totales
    const bottomLimit = doc.internal.pageSize.getHeight() - MARGIN_B;
    if (y + 3 * LINE_H > bottomLimit) {
      doc.addPage();
      y = MARGIN_T;
    }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`Total utilizado: ${fmtQ(totalUtilizado)}`, MARGIN_L, y);
    doc.setFont(undefined, 'normal');
    doc.text(`Caja chica usada: ${fmtQ(cajaChicaTotal)}`, MARGIN_L, y + LINE_H);
    doc.text(`Sobrante para mañana: ${fmtQ(sobranteTotal)}`, MARGIN_L, y + 2 * LINE_H);
  });

  doc.save(`${nombre}.pdf`);
}

/**
 * Exporta un PDF de DEPÓSITOS de UNA fila de "pagos".
 * Solo columnas: Descripción / Cantidad (monto).
 */
export function exportDepositosPdf(row, sucursalNombre = '—', nombreCustom) {
  const doc = new jsPDF();

  const fecha = row?.fecha || '';
  const title = nombreCustom || `Depositos_${sucursalNombre}_${fecha}`;

  // Título
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`Depósitos — ${fecha}`, MARGIN_L, MARGIN_T);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(`Sucursal: ${sucursalNombre}`, MARGIN_L, MARGIN_T + 8);

  let y = MARGIN_T + 8 + GAP;

  const items = Array.isArray(row?.items) ? row.items : [];
  const rows = items.map((it) => [
    it.descripcion || '—',
    fmtQ(n(it.monto)),
  ]);

  const headers = [
    { label: 'Descripción', width: 120, align: 'left' },
    { label: 'Cantidad',    width: 50,  align: 'right' },
  ];

  y = drawTable(doc, y, headers, rows.length ? rows : [['—','—']]);
  y += GAP;

  const total = items.reduce((s, it) => s + n(it.monto), 0);
  const bottomLimit = doc.internal.pageSize.getHeight() - MARGIN_B;
  if (y + LINE_H > bottomLimit) {
    doc.addPage();
    y = MARGIN_T;
  }

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`TOTAL: ${fmtQ(total)}`, MARGIN_L, y);

  doc.save(`${title}.pdf`);
}
