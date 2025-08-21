// src/pages/ventas/pdf/cuadrePdf.js
import autoTable from 'jspdf-autotable';
import { n, totalEfectivoCaja } from '../utils/numbers';

// Helper: detectar categoría "Ajuste de caja chica"
const isAjusteCajaChica = (name) =>
  (name || '').toString().trim().toLowerCase() === 'ajuste de caja chica';

/**
 * Calcula métricas para el resumen del PDF (con APERTURA).
 */
export const calcCuadreMetrics = (c) => {
  const arqueo = c.arqueo || [{}, {}, {}];
  const cierre = c.cierre || [{}, {}, {}];

  // Arqueo (bruto)
  const arqueoEfBruto = arqueo.reduce((s, x) => s + totalEfectivoCaja(x), 0);
  const arqueoTar     = arqueo.reduce((s, x) => s + n(x.tarjeta), 0);
  const arqueoMot     = arqueo.reduce((s, x) => s + n(x.motorista), 0);

  // Apertura total (default 1000 por caja si no viene)
  const aperturaTotal = arqueo.reduce((s, x) => s + n(x.apertura ?? 1000), 0);

  // 🔹 EFECTIVO NETO (para resumen / diferencia / depósito)
  const arqueoEfNeto = arqueoEfBruto - aperturaTotal;

  // Cierre
  const cierreEf = cierre.reduce((s, x) => s + n(x.efectivo), 0);
  const cierreTar = cierre.reduce((s, x) => s + n(x.tarjeta), 0);
  const cierreMot = cierre.reduce((s, x) => s + n(x.motorista), 0);

  // Gastos + ajuste de caja chica
  const gastos = (c.gastos || []).reduce((s, g) => s + n(g.cantidad), 0);
  const ajusteCajaChica = (c.gastos || []).reduce(
    (s, g) => s + (isAjusteCajaChica(g.categoria) ? n(g.cantidad) : 0),
    0
  );

  const cajaChicaUsada = n(c.cajaChicaUsada);
  const faltantePagado = n(c.faltantePagado);

  // 🔹 Diferencia y depósito basados en EFECTIVO NETO
  const diffEf = arqueoEfNeto - cierreEf;
  const totalDepositar = arqueoEfNeto - gastos + ajusteCajaChica + faltantePagado;

  return {
    // Para mostrar
    arqueoEfNeto, arqueoTar, arqueoMot,
    cierreEf, cierreTar, cierreMot,

    // Extras
    gastos, ajusteCajaChica, cajaChicaUsada, faltantePagado,
    diffEf, totalDepositar,
  };
};

/**
 * Encabezado visual del PDF.
 */
export const addHeader = (pdf, { title, fecha, sucursal, formatDate }) => {
  const w = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(245, 248, 252);
  pdf.rect(0, 0, w, 66, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(33, 37, 41);
  pdf.setFontSize(18);
  pdf.text(title, 40, 32);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(90, 90, 90);
  pdf.text(`Fecha: ${formatDate(fecha)}`, 40, 50);
  pdf.text(`Sucursal: ${sucursal}`, w - 40, 50, { align: 'right' });
};

/**
 * Pie de página con numeración.
 */
export const addFooterPageNumbers = (pdf) => {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(9);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`Página ${i} de ${pageCount}`, w - 40, h - 12, { align: 'right' });
  }
};

/**
 * Renderiza una sección completa de "Cuadre de ventas" en la página actual del PDF.
 * Incluye: Arqueo Físico, Cierre de Sistema, Gastos y Resumen.
 */
export const renderCuadreSection = (pdf, c, sucursalNombre, formatDate) => {
  // Encabezado
  addHeader(pdf, {
    title: 'Cuadre de ventas',
    fecha: c.fecha,
    sucursal: sucursalNombre || '—',
    formatDate,
  });

  let y = 76; // debajo del encabezado
  const width = pdf.internal.pageSize.getWidth();

  // ===== Arqueo Físico =====
  const arqueo = c.arqueo || [{}, {}, {}];
  const arqueoRows = [0, 1, 2].map((i) => {
    const a = arqueo[i] || {};
    const totalCaja = totalEfectivoCaja(a);
    const apertura = n(a.apertura ?? 1000);
    const neto = totalCaja - apertura;

    return [
      `Caja ${i + 1}`,
      n(a.q100).toFixed(2),
      n(a.q50).toFixed(2),
      n(a.q20).toFixed(2),
      n(a.q10).toFixed(2),
      n(a.q5).toFixed(2),
      n(a.q1).toFixed(2),
      totalCaja.toFixed(2),       // Total efectivo
      apertura.toFixed(2),        // Apertura
      neto.toFixed(2),            // Efectivo neto
      n(a.tarjeta).toFixed(2),    // Tarjeta
      n(a.motorista).toFixed(2),  // Motorista
    ];
  });

  // Totales de arqueo
  const mArqEfBruto = arqueo.reduce((s, x) => s + totalEfectivoCaja(x), 0);
  const aperturaTotal = arqueo.reduce((s, x) => s + n(x.apertura ?? 1000), 0);
  const mArqEfNeto = mArqEfBruto - aperturaTotal;
  const mArqTar = arqueo.reduce((s, x) => s + n(x.tarjeta), 0);
  const mArqMot = arqueo.reduce((s, x) => s + n(x.motorista), 0);

  autoTable(pdf, {
    startY: y,
    head: [[
      'Arqueo Físico',
      'Q100', 'Q50', 'Q20', 'Q10', 'Q5', 'Q1',
      'Total efectivo', 'Apertura', 'Efectivo neto', 'Tarjeta', 'Motorista'
    ]],
    body: arqueoRows,
    styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.2, lineColor: [230, 236, 240] },
    headStyles: { fillColor: [13, 71, 161], textColor: 255 },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
      7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' },
      10:{ halign: 'right' }, 11:{ halign: 'right' },
    },
    theme: 'grid',
    // Fila de totales con etiqueta en la columna Q1 (índice 6)
    foot: [[
      '', '', '', '', '', '',
      { content: 'Totales', styles: { halign: 'right' } }, // en col Q1
      { content: mArqEfBruto.toFixed(2), styles: { halign: 'right' } }, // Total efectivo
      { content: aperturaTotal.toFixed(2), styles: { halign: 'right' } }, // Apertura
      { content: mArqEfNeto.toFixed(2), styles: { halign: 'right' } },    // Efectivo neto
      { content: mArqTar.toFixed(2), styles: { halign: 'right' } },       // Tarjeta
      { content: mArqMot.toFixed(2), styles: { halign: 'right' } },       // Motorista
    ]],
    footStyles: { fillColor: [236, 239, 241], textColor: [33, 37, 41], halign: 'right' },
  });

  y = pdf.lastAutoTable.finalY + 10;

  // ===== Cierre de Sistema =====
  const cierre = c.cierre || [{}, {}, {}];
  const cierreRows = [0, 1, 2].map((i) => {
    const cc = cierre[i] || {};
    const total = n(cc.efectivo) + n(cc.tarjeta) + n(cc.motorista);
    return [
      `Caja ${i + 1}`,
      n(cc.efectivo).toFixed(2),
      n(cc.tarjeta).toFixed(2),
      n(cc.motorista).toFixed(2),
      total.toFixed(2),
    ];
  });

  // Totales de cierre
  const mCieEf  = cierre.reduce((s, x) => s + n(x.efectivo), 0);
  const mCieTar = cierre.reduce((s, x) => s + n(x.tarjeta), 0);
  const mCieMot = cierre.reduce((s, x) => s + n(x.motorista), 0);
  const mCieTot = mCieEf + mCieTar; // (respetando tu lógica actual)

  autoTable(pdf, {
    startY: y,
    head: [['Cierre de Sistema', 'Efectivo', 'Tarjeta', 'Motorista', 'Total']],
    body: cierreRows,
    styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.2, lineColor: [230, 236, 240] },
    headStyles: { fillColor: [25, 118, 210], textColor: 255 },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    },
    theme: 'grid',
    foot: [[
      { content: 'Totales', styles: { halign: 'right' } },
      { content: mCieEf.toFixed(2),  styles: { halign: 'right' } },
      { content: mCieTar.toFixed(2), styles: { halign: 'right' } },
      { content: mCieMot.toFixed(2), styles: { halign: 'right' } },
      { content: mCieTot.toFixed(2), styles: { halign: 'right' } },
    ]],
    footStyles: { fillColor: [236, 239, 241], textColor: [33, 37, 41], halign: 'right' },
  });

  y = pdf.lastAutoTable.finalY + 10;

  // ===== Gastos =====
  const gastosRows = (c.gastos || []).map((g) => [
    (g.categoria || '').toString(),
    (g.descripcion || '').toString(),
    n(g.cantidad).toFixed(2),
  ]);
  const totalGastos = (c.gastos || []).reduce((s, g) => s + n(g.cantidad), 0);

  autoTable(pdf, {
    startY: y,
    head: [['Gastos', 'Descripción', 'Cantidad']],
    body: gastosRows.length ? gastosRows : [['—', '—', '0.00']],
    styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.2, lineColor: [230, 236, 240] },
    headStyles: { fillColor: [21, 101, 192], textColor: 255 },
    columnStyles: { 2: { halign: 'right' } },
    theme: 'grid',
    foot: [[
      '', // 1a col
      { content: 'Total', styles: { halign: 'right' } },
      { content: totalGastos.toFixed(2), styles: { halign: 'right' } }
    ]],
    footStyles: { fillColor: [236, 239, 241], textColor: [33, 37, 41] },
  });

  y = pdf.lastAutoTable.finalY + 12;

  // ===== Resumen (tarjeta) =====
  {
    const m = calcCuadreMetrics(c);

    const boxTop = y;
    const leftColX = 52;
    const rightColX = width / 2 + 10;
    const GAP = 16; // separación entre filas

    // Título
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(33, 37, 41);
    pdf.text('Resumen', leftColX, boxTop + 18);

    // Helper para línea
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const drawLine = (x, yLine, label, value) => {
      pdf.setTextColor(90, 90, 90);
      pdf.text(label, x, yLine);
      pdf.setTextColor(33, 37, 41);
      pdf.text(value, x + 140, yLine);
    };

    // -------- Columna izquierda: Ventas Total Sistema (Cierre)
    let leftY = boxTop + 36;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Ventas Total Sistema', leftColX, leftY);
    pdf.setFont('helvetica', 'normal');
    leftY += GAP;
    drawLine(leftColX, leftY, 'Efectivo', `Q ${m.cierreEf.toFixed(2)}`);       leftY += GAP;
    drawLine(leftColX, leftY, 'Tarjeta',  `Q ${m.cierreTar.toFixed(2)}`);      leftY += GAP;
    drawLine(leftColX, leftY, 'A domicilio', `Q ${m.cierreMot.toFixed(2)}`);   leftY += GAP;

    const totalSistema = m.cierreEf + m.cierreTar; // tu lógica
    drawLine(leftColX, leftY, 'Total Sistema', `Q ${totalSistema.toFixed(2)}`);

    // -------- Columna derecha: Control Administración (Arqueo) + ajustes
    let rightY = boxTop + 36;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Control Administración', rightColX, rightY);
    pdf.setFont('helvetica', 'normal');
    rightY += GAP;
    drawLine(rightColX, rightY, 'Efectivo (neto)', `Q ${m.arqueoEfNeto.toFixed(2)}`); rightY += GAP;
    drawLine(rightColX, rightY, 'A domicilio',     `Q ${m.arqueoMot.toFixed(2)}`);    rightY += GAP;
    drawLine(rightColX, rightY, 'Gastos',          `Q ${m.gastos.toFixed(2)}`);       rightY += GAP;

    drawLine(rightColX, rightY, 'Caja chica (usada)', `Q ${m.cajaChicaUsada.toFixed(2)}`); rightY += GAP;

    const diffLabel = m.diffEf >= 0 ? 'Sobrante' : 'Faltante';
    drawLine(rightColX, rightY, diffLabel, `Q ${Math.abs(m.diffEf).toFixed(2)}`);       rightY += GAP;

    if (m.faltantePagado > 0) {
      drawLine(rightColX, rightY, 'Faltante pagado', `Q ${m.faltantePagado.toFixed(2)}`);
      rightY += GAP;
    }

    const contentBottom = Math.max(leftY, rightY);

    // ---- Total a depositar: pegado al contenido (centrado)
    const totalDepY = contentBottom + 20;
    const depColor = m.totalDepositar < 0 ? [183, 28, 28] : [27, 94, 32];
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...depColor);

    const centerX = width / 2;
    pdf.text(
      `Total a depositar: Q ${m.totalDepositar.toFixed(2)}`,
      centerX,
      totalDepY,
      { align: 'center' }
    );
    pdf.setTextColor(33, 37, 41);

    // Borde del cuadro
    const boxHeight = (totalDepY - boxTop) + 14;
    pdf.setDrawColor(230, 236, 240);
    pdf.roundedRect(40, boxTop, width - 80, boxHeight, 4, 4);

    y = boxTop + boxHeight + 8;
  }

  // Comentario (si existe)
  const comentarioPlano = (c.comentario || '').toString().trim();
  if (comentarioPlano) {
    autoTable(pdf, {
      startY: y + 12,
      head: [['Comentario']],
      body: [[comentarioPlano]],
      styles: { fontSize: 10, cellPadding: 6, lineWidth: 0.2, lineColor: [230, 236, 240] },
      headStyles: { fillColor: [69, 90, 100], textColor: 255 },
      theme: 'grid',
    });
  }
};
