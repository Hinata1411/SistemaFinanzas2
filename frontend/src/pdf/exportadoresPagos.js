// src/pdf/exportadoresPagos.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Formateador rápido de quetzales
const fmtQ = (v) =>
  (typeof v === 'number' ? v : parseFloat(v || 0))
    .toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

const n = (v) => {
  const x = typeof v === 'number' ? v : parseFloat(v || 0);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Exporta un PDF AGRUPADO por sucursal para una fecha (docs = array de documentos de 'pagos').
 * Cada doc debe tener: { fecha, sucursalId, items[], totalUtilizado, cajaChicaUsada, sobranteParaManana }
 */
export function exportPagosGroupedPdf(docs, sucursalesMap = {}, nombre = 'Pagos_Agrupados') {
  const doc = new jsPDF();

  const fecha = docs[0]?.fecha || '';
  doc.setFontSize(16);
  doc.text(`Pagos agrupados — ${fecha || ''}`, 14, 16);

  // Agrupar por sucursal
  const bySucursal = {};
  docs.forEach(d => {
    const sid = d.sucursalId || '—';
    if (!bySucursal[sid]) bySucursal[sid] = [];
    bySucursal[sid].push(d);
  });

  let firstTable = true;
  Object.entries(bySucursal).forEach(([sucursalId, pagos]) => {
    if (!firstTable) doc.addPage();
    firstTable = false;

    const sucNom = sucursalesMap[sucursalId] || sucursalId || '—';
    doc.setFontSize(13);
    doc.text(`Sucursal: ${sucNom}`, 14, 26);

    // Aplanar items de todos los docs de esa sucursal
    const rows = [];
    let totalUtilizado = 0;
    let cajaChicaTotal = 0;
    let sobranteTotal = 0;

    pagos.forEach(p => {
      const items = Array.isArray(p.items) ? p.items : [];
      items.forEach(it => {
        rows.push([
          it.descripcion || '—',
          fmtQ(n(it.monto)),
          it.ref || '—',
          it.categoria || '—',
        ]);
      });
      totalUtilizado += n(p.totalUtilizado ?? items.reduce((a, b) => a + n(b.monto), 0));
      cajaChicaTotal += n(p.cajaChicaUsada);
      sobranteTotal += n(p.sobranteParaManana);
    });

    doc.autoTable({
      startY: 32,
      head: [['Descripción', 'Monto', 'Ref', 'Categoría']],
      body: rows.length ? rows : [['—', '—', '—', '—']],
      styles: { fontSize: 9 },
      headStyles: { halign: 'center' },
      bodyStyles: { valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'right', cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
      },
      foot: [[
        'Totales',
        fmtQ(totalUtilizado),
        `Caja chica: ${fmtQ(cajaChicaTotal)}`,
        `Sobrante: ${fmtQ(sobranteTotal)}`
      ]],
      footStyles: { fontStyle: 'bold' },
    });
  });

  doc.save(`${nombre}.pdf`);
}

/**
 * Exporta un PDF de DEPÓSITOS de UNA FILA de pagos (solo Descripción y Cantidad),
 * ideal para el botón "Descargar depósitos" en la tabla de Historial.
 * row = documento de 'pagos' con items[].
 */
export function exportDepositosPdf(row, sucursalNombre = '—', nombreCustom) {
  const doc = new jsPDF();
  const fecha = row?.fecha || '';
  const title = nombreCustom || `Depositos_${sucursalNombre}_${fecha}`;

  doc.setFontSize(16);
  doc.text(`Depósitos — ${fecha}`, 14, 16);
  doc.setFontSize(12);
  doc.text(`Sucursal: ${sucursalNombre}`, 14, 24);

  const items = Array.isArray(row?.items) ? row.items : [];
  const body = items.map(it => [
    it.descripcion || '—',
    fmtQ(n(it.monto)),
  ]);

  const total = items.reduce((s, it) => s + n(it.monto), 0);

  doc.autoTable({
    startY: 30,
    head: [['Descripción', 'Cantidad']],
    body: body.length ? body : [['—', '—']],
    styles: { fontSize: 10 },
    headStyles: { halign: 'center' },
    bodyStyles: { valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { halign: 'right', cellWidth: 50 },
    },
    foot: [['TOTAL', fmtQ(total)]],
    footStyles: { fontStyle: 'bold' },
  });

  doc.save(`${title}.pdf`);
}
