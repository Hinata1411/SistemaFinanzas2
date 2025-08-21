// src/pages/ventas/pdf/cuadrePdf.js
import autoTable from 'jspdf-autotable';
import { n, totalEfectivoCaja } from '../utils/numbers';

/**
 * Calcula métricas para el resumen del PDF.
 */
export const calcCuadreMetrics = (c) => {
  const arqueo = c.arqueo || [{}, {}, {}];
  const cierre = c.cierre || [{}, {}, {}];

  const arqueoEf = arqueo.reduce((s, x) => s + totalEfectivoCaja(x), 0);
  const arqueoTar = arqueo.reduce((s, x) => s + n(x.tarjeta), 0);
  const arqueoMot = arqueo.reduce((s, x) => s + n(x.motorista), 0);

  const cierreEf = cierre.reduce((s, x) => s + n(x.efectivo), 0);
  const cierreTar = cierre.reduce((s, x) => s + n(x.tarjeta), 0);
  const cierreMot = cierre.reduce((s, x) => s + n(x.motorista), 0);

  const gastos = (c.gastos || []).reduce((s, g) => s + n(g.cantidad), 0);

  const cajaChicaUsada = n(c.cajaChicaUsada);
  const faltantePagado = n(c.faltantePagado);

  const diffEf = arqueoEf - cierreEf;
  const totalDepositar = arqueoEf - gastos + cajaChicaUsada + faltantePagado;

  return {
    arqueoEf, arqueoTar, arqueoMot,
    cierreEf, cierreTar, cierreMot,
    gastos, cajaChicaUsada, faltantePagado,
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
    return [
      `Caja ${i + 1}`,
      n(a.q100).toFixed(2),
      n(a.q50).toFixed(2),
      n(a.q20).toFixed(2),
      n(a.q10).toFixed(2),
      n(a.q5).toFixed(2),
      n(a.q1).toFixed(2),
      n(a.tarjeta).toFixed(2),
      n(a.motorista).toFixed(2),
      totalEfectivoCaja(a).toFixed(2),
    ];
  });

  autoTable(pdf, {
    startY: y,
    head: [[
      'Arqueo Físico',
      'Q100', 'Q50', 'Q20', 'Q10', 'Q5', 'Q1',
      'Tarjeta', 'Motorista', 'Total efectivo'
    ]],
    body: arqueoRows,
    styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.2, lineColor: [230, 236, 240] },
    headStyles: { fillColor: [13, 71, 161], textColor: 255 },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
      7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' },
    },
    theme: 'grid',
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
    foot: [['', 'Total', totalGastos.toFixed(2)]],
    footStyles: { fillColor: [236, 239, 241], textColor: [33, 37, 41] },
  });

  y = pdf.lastAutoTable.finalY + 12;

  // ===== Resumen (tarjeta) =====
  const m = calcCuadreMetrics(c);

  pdf.setDrawColor(230, 236, 240);
  // roundedRect(x, y, w, h, rx, ry)
  pdf.roundedRect(40, y, width - 80, 70, 4, 4);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(33, 37, 41);
  pdf.text('Resumen', 52, y + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const left = 52;
  const right = width - 52;

  const line = (label, value, yLine, alignRight = false) => {
    pdf.setTextColor(90, 90, 90);
    pdf.text(label, alignRight ? right - 160 : left, yLine);
    pdf.setTextColor(33, 37, 41);
    pdf.text(
      value,
      alignRight ? right : left + 110,
      yLine,
      alignRight ? { align: 'right' } : {}
    );
  };

  line('Efectivo (Cierre):', `Q ${m.cierreEf.toFixed(2)}`, y + 36);
  line('Efectivo (Arqueo):', `Q ${m.arqueoEf.toFixed(2)}`, y + 52);
  line(
    'Diferencia:',
    `Q ${Math.abs(m.diffEf).toFixed(2)} ${m.diffEf >= 0 ? '(Sobrante)' : '(Faltante)'}`,
    y + 68
  );

  line('Caja chica usada:', `Q ${m.cajaChicaUsada.toFixed(2)}`, y + 36, true);
  line('Faltante pagado:', `Q ${m.faltantePagado.toFixed(2)}`, y + 52, true);

  // Total a depositar destacado
  const depColor = m.totalDepositar < 0 ? [183, 28, 28] : [27, 94, 32];
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(depColor[0], depColor[1], depColor[2]);
  pdf.text(`Total a depositar: Q ${m.totalDepositar.toFixed(2)}`, right, y + 68, { align: 'right' });
  pdf.setTextColor(33, 37, 41); // reset

  // Comentario (si existe)
  const comentarioPlano = (c.comentario || '').toString().trim();
  if (comentarioPlano) {
    autoTable(pdf, {
      startY: y + 90,
      head: [['Comentario']],
      body: [[comentarioPlano]],
      styles: { fontSize: 10, cellPadding: 6, lineWidth: 0.2, lineColor: [230, 236, 240] },
      headStyles: { fillColor: [69, 90, 100], textColor: 255 },
      theme: 'grid',
    });
  }
};
