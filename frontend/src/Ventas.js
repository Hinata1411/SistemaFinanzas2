// src/Ventas.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, deleteDoc, getDoc, updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import './components/ventas/Ventas.css';
import './components/registrar-cierre/RegistrarCierre.css';

// ===== Modal base styles (no overrides to rc- classes) =====
const MODAL_BASE = `
  .modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1000}
  .modal-card{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);width:min(1200px,96vw);max-height:96vh;display:flex;flex-direction:column;overflow:hidden}
  .modal-card.modal-xl{width:min(1200px,96vw)}
  .modal-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #eef2f7;background:#fff;position:sticky;top:0;z-index:2}
  .modal-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}
  @media (max-width: 640px){
    .modal-mask{padding:0}
    .modal-card{border-radius:0;width:100vw;height:100vh;max-height:none}
  }
`;

// ===== Helpers

// números seguros
const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const isNumericOrEmpty = (v) =>
  v === '' || v === null || v === undefined || !isNaN(parseFloat(v));
const totalEfectivoCaja = (c = {}) =>
  n(c.q100) + n(c.q50) + n(c.q20) + n(c.q10) + n(c.q5) + n(c.q1);

function getTodayLocalISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0]; // YYYY-MM-DD
}
const formatDate = (iso) => {
  const [y, m, d] = (iso || '').split('-');
  return y ? `${d}/${m}/${y}` : '-';
};

// ===== Helpers para PDF estético =====
const calcCuadreMetrics = (c) => {
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

const addHeader = (pdf, { title, fecha, sucursal }) => {
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

const addFooterPageNumbers = (pdf) => {
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

const renderCuadreSection = (pdf, c, sucursalNombre) => {
  // Encabezado
  addHeader(pdf, {
    title: 'Cuadre de ventas',
    fecha: c.fecha,
    sucursal: sucursalNombre || '—',
  });

  let y = 76; // debajo del header
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
  const gastos = (c.gastos || []).map((g) => [
    (g.categoria || '').toString(),
    (g.descripcion || '').toString(),
    n(g.cantidad).toFixed(2),
  ]);
  const totalGastos = (c.gastos || []).reduce((s, g) => s + n(g.cantidad), 0);

  autoTable(pdf, {
    startY: y,
    head: [['Gastos', 'Descripción', 'Cantidad']],
    body: gastos.length ? gastos : [['—', '—', '0.00']],
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
  pdf.roundedRect(40, y, width - 80, 70, 4, 4);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Resumen', 52, y + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const left = 52;
  const right = width - 52;

  const line = (label, value, yLine, alignRight = false) => {
  pdf.setTextColor(90, 90, 90);          
  pdf.text(label, alignRight ? right - 160 : left, yLine);
  pdf.setTextColor(33, 37, 41);          
  pdf.text(value, alignRight ? right : left + 110, yLine, alignRight ? { align: 'right' } : {});
};


  line('Efectivo (Cierre):', `Q ${m.cierreEf.toFixed(2)}`, y + 36);
  line('Efectivo (Arqueo):', `Q ${m.arqueoEf.toFixed(2)}`, y + 52);
  line('Diferencia:', `Q ${Math.abs(m.diffEf).toFixed(2)} ${m.diffEf >= 0 ? '(Sobrante)' : '(Faltante)'}`, y + 68);

  line('Caja chica usada:', `Q ${m.cajaChicaUsada.toFixed(2)}`, y + 36, true);
  line('Faltante pagado:', `Q ${m.faltantePagado.toFixed(2)}`, y + 52, true);

  // total a depositar destacado
  pdf.setFont('helvetica', 'bold');
  const neg = m.totalDepositar < 0;
  const r = neg ? 183 : 27;
  const g = neg ?  28 : 94;
  const b = neg ?  28 : 32;
  pdf.setTextColor(r, g, b);  
  pdf.text(`Total a depositar: Q ${m.totalDepositar.toFixed(2)}`, right, y + 68, { align: 'right' });
  pdf.setTextColor(33, 37, 41);  


  const depColor = m.totalDepositar < 0 ? [183, 28, 28] : [27, 94, 32];
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(depColor[0], depColor[1], depColor[2]);
  pdf.text(`Total a depositar: Q ${m.totalDepositar.toFixed(2)}`, right, y + 68, { align: 'right' });
  pdf.setTextColor(33, 37, 41);

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





const exportSingleCuadrePdf = (c, sucursalNombre) => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  renderCuadreSection(pdf, c, sucursalNombre);
  addFooterPageNumbers(pdf);
  pdf.save(`Venta_${c.fecha}.pdf`);
};

const exportGroupedPdf = (docs, sucursalesMap, nombreArchivo = 'Ventas_Agrupadas') => {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  // ===== Páginas siguientes: una por cuadre
  docs.forEach((c, idx) => {
    if (idx > 0) pdf.addPage(); // importante: NO agregar página antes del primero
    renderCuadreSection(pdf, c, sucursalesMap[c.sucursalId] || '—');
  });

  addFooterPageNumbers(pdf);
  pdf.save(`${nombreArchivo}.pdf`);
};

export default function Ventas() {
  const navigate = useNavigate();

  // Filtros / listados
  const [fechaFiltro, setFechaFiltro] = useState(getTodayLocalISO);
  const [sucursalFiltro, setSucursalFiltro] = useState('all');
  const [sucursalesList, setSucursalesList] = useState([]); // [{id, nombre}]
  const [cuadres, setCuadres] = useState([]);
  const [cuadreSeleccionado, setCuadreSeleccionado] = useState(null);

  // Edición
  const [isEditing, setIsEditing] = useState(false);
  const [datosEditados, setDatosEditados] = useState(null);

  // Auxiliares para labels
  const [sucursalesMap, setSucursalesMap] = useState({}); // {id: ubicacion}
  const [cajaChicaMap, setCajaChicaMap] = useState({});   // {id: cajaChica}

  // Detalle en modal
  const detalleRef = useRef();
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ======================
  // Sucursales (para combo)
  // ======================
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map(d => ({
          id: d.id,
          nombre: d.data().ubicacion || d.data().nombre || 'Sin nombre'
        }));
        setSucursalesList(list.sort((a,b)=>a.nombre.localeCompare(b.nombre)));
      } catch (err) {
        console.error('Error leyendo sucursales:', err);
      }
    })();
  }, []);

  // ======================
  // Obtención de cierres
  // ======================
  const obtenerCuadres = async () => {
    try {
      const cuadresRef = collection(db, 'cierres');
      const q = fechaFiltro ? query(cuadresRef, where('fecha', '==', fechaFiltro)) : cuadresRef;
      const snap = await getDocs(q);
      let data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (sucursalFiltro !== 'all') {
        data = data.filter(c => c.sucursalId === sucursalFiltro);
      }
      setCuadres(data);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron obtener las ventas.', 'error');
    }
  };

  useEffect(() => {
    obtenerCuadres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaFiltro, sucursalFiltro]);

  // Cuando cambian los cuadres, resolvemos nombres de sucursal y caja chica
  useEffect(() => {
    const fetchSucursales = async () => {
      const idsUnicos = Array.from(new Set(cuadres.map((c) => c.sucursalId).filter(Boolean)));
      const nuevoMapUbicacion = {};
      const nuevoMapCajaChica = {};

      await Promise.all(
        idsUnicos.map(async (sucId) => {
          try {
            const sucDoc = await getDoc(doc(db, 'sucursales', sucId));
            if (sucDoc.exists()) {
              const datos = sucDoc.data();
              nuevoMapUbicacion[sucId] = datos.ubicacion || datos.nombre || 'Sin lugar';
              nuevoMapCajaChica[sucId] = parseFloat(datos.cajaChica) || 0;
            } else {
              nuevoMapUbicacion[sucId] = 'Sucursal no encontrada';
              nuevoMapCajaChica[sucId] = 0;
            }
          } catch (err) {
            console.error(`Error sucursal ${sucId}:`, err);
            nuevoMapUbicacion[sucId] = 'Error al cargar';
            nuevoMapCajaChica[sucId] = 0;
          }
        })
      );

      setSucursalesMap(nuevoMapUbicacion);
      setCajaChicaMap(nuevoMapCajaChica);
    };

    if (cuadres.length > 0) fetchSucursales();
    else { setSucursalesMap({}); setCajaChicaMap({}); }
  }, [cuadres]);

  // ======================
  // KPIs
  // ======================
  const totalVentaDeCuadre = (c) => {
    const base = Array.isArray(c.cierre) && c.cierre.length ? c.cierre : (c.arqueo || []);
    const sum = base.reduce((acc, caja) =>
      acc +
      n(caja.efectivo) +
      n(caja.tarjeta) +
      n(caja.motorista)
    , 0);
    return sum;
  };

  const fmtQ = (val) =>
    (typeof val === 'number' ? val : parseFloat(val || 0))
      .toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

  const totalVentas = cuadres.reduce((acc, c) => acc + totalVentaDeCuadre(c), 0);
  const promedioVentas = cuadres.length ? (totalVentas / cuadres.length) : 0;
  const diaMasVenta = (() => {
    if (!cuadres.length) return '-';
    let best = cuadres[0], max = totalVentaDeCuadre(cuadres[0]);
    for (let i=1;i<cuadres.length;i++){
      const v = totalVentaDeCuadre(cuadres[i]);
      if (v > max){ max = v; best = cuadres[i]; }
    }
    return `${formatDate(best.fecha)} (${fmtQ(max)})`;
  })();

  // ======================
  // Acciones de fila
  // ======================
  const openDetalleModal = () => setShowDetailModal(true);
  const closeDetalleModal = () => {
    setShowDetailModal(false);
    setIsEditing(false);
    setDatosEditados(null);
  };

  const handleVer = (c) => {
    setCuadreSeleccionado(c);
    setIsEditing(false);
    setDatosEditados(null);
    openDetalleModal();
  };

  const handleEditar = (c) => {
    setCuadreSeleccionado(c);
    setIsEditing(true);
    setDatosEditados({
      arqueo: (c.arqueo || [{},{},{}]).map(x => ({...x})),
      cierre: (c.cierre || [{},{},{}]).map(x => ({...x})),
      gastos: (c.gastos || []).map(x => ({...x})),
      comentario: c.comentario || '',
      // si tu doc tiene estos campos y quieres permitir editarlos desde aquí:
      cajaChicaUsada: n(c.cajaChicaUsada),
      faltantePagado: n(c.faltantePagado),
    });
    openDetalleModal();
  };

  const handleEliminar = async (id) => {
    const confirmar = await Swal.fire({
      title: '¿Eliminar registro?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (!confirmar.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'cierres', id));
      Swal.fire('Eliminado', 'El registro ha sido eliminado.', 'success');
      setCuadreSeleccionado(null);
      setIsEditing(false);
      setDatosEditados(null);
      obtenerCuadres();
      closeDetalleModal();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  };

  // PDF individual (vectorial y con tablas)
  const handleDescargarPDF = (cuadre) => {
    const sucursalNombre = sucursalesMap[cuadre.sucursalId] || '—';
    exportSingleCuadrePdf(cuadre, sucursalNombre);
  };

  const handleOpenGroupModal = () => {
    if (!cuadres.length) {
      Swal.fire('Sin datos', 'No hay registros para la selección.', 'info');
      return;
    }
    setSelectedCierresIds(cuadres.map((c) => c.id));
    setSelectAll(true);
    setShowGroupModal(true);
  };

  // Agrupado
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedCierresIds, setSelectedCierresIds] = useState([]);
  const [selectAll, setSelectAll] = useState(true);

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    setSelectAll(checked);
    setSelectedCierresIds(checked ? cuadres.map((c) => c.id) : []);
  };
  const handleCierreCheckbox = (id) => (e) => {
    const checked = e.target.checked;
    setSelectedCierresIds((prev) => checked ? [...prev, id] : prev.filter((i) => i !== id));
  };

  // PDF agrupado (portada + detalle por cuadre)
  const handleDownloadGrouped = () => {
    const docs = cuadres.filter((c) => selectedCierresIds.includes(c.id));
    if (!docs.length) {
      Swal.fire('Selecciona al menos un registro', '', 'warning');
      return;
    }
    const nombreArchivo = `Ventas_Agrupadas_${fechaFiltro || 'todas'}`;
    exportGroupedPdf(docs, sucursalesMap, nombreArchivo);
    setShowGroupModal(false);
  };

  // ======================
  // Guardar cambios de edición
  // ======================
  const handleActualizar = async () => {
    if (!cuadreSeleccionado || !datosEditados) return;
    const { arqueo, cierre, gastos, comentario } = datosEditados;

    const validBoxes = [...(arqueo||[]), ...(cierre||[])].every((b = {}) =>
      ['efectivo','tarjeta','motorista','q100','q50','q20','q10','q5','q1'].every((f)=>
        b[f] === undefined || isNumericOrEmpty(b[f])
      )
    );
    const validGastos = (gastos||[]).every((g)=> isNumericOrEmpty(g.cantidad));
    if (!validBoxes || !validGastos) {
      return Swal.fire('Datos inválidos', 'Revisa montos y gastos.', 'warning');
    }

    try {
      await updateDoc(doc(db, 'cierres', cuadreSeleccionado.id), {
        arqueo, cierre, gastos, comentario,
        cajaChicaUsada: n(datosEditados.cajaChicaUsada),
        faltantePagado: n(datosEditados.faltantePagado),
      });
      Swal.fire({
        icon:'success',
        title:'Actualizado',
        text:`Venta del ${formatDate(cuadreSeleccionado.fecha)} actualizada.`,
        timer:2000,
        showConfirmButton:false
      });
      setIsEditing(false); setDatosEditados(null); obtenerCuadres();
      // mantener abierto en modo "ver" para que el usuario confirme
      setCuadreSeleccionado((prev)=> prev ? { ...prev, ...datosEditados } : prev);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo actualizar.', 'error');
    }
  };

  // ======================
  // Datos para el detalle (ver/editar)
  // ======================
  const fuente = isEditing ? datosEditados : cuadreSeleccionado;

  const arqueoData  = fuente?.arqueo || [{},{},{}];
  const cierreData  = fuente?.cierre || [{},{},{}];
  const gastosData  = fuente?.gastos || [];
  const comentario  = fuente?.comentario || '';

  const cajaChicaUsada = n(fuente?.cajaChicaUsada);
  const faltantePagado = n(fuente?.faltantePagado);

  // Totales y cálculos (como en RegistrarCierre)
  const totalArqueoEfectivo = useMemo(
    () => arqueoData.reduce((acc, c) => acc + totalEfectivoCaja(c), 0),
    [arqueoData]
  );
  const totalArqueoTarjeta = useMemo(
    () => arqueoData.reduce((s, c) => s + n(c.tarjeta), 0),
    [arqueoData]
  );
  const totalArqueoMotorista = useMemo(
    () => arqueoData.reduce((s, c) => s + n(c.motorista), 0),
    [arqueoData]
  );

  const totalCierreEfectivo = useMemo(
    () => cierreData.reduce((s, c) => s + n(c.efectivo), 0),
    [cierreData]
  );
  const totalCierreTarjeta = useMemo(
    () => cierreData.reduce((s, c) => s + n(c.tarjeta), 0),
    [cierreData]
  );
  const totalCierreMotorista = useMemo(
    () => cierreData.reduce((s, c) => s + n(c.motorista), 0),
    [cierreData]
  );

  const totalGastos = useMemo(
    () => gastosData.reduce((s, g) => s + n(g.cantidad), 0),
    [gastosData]
  );

  const diferenciaEfectivo = useMemo(
    () => totalArqueoEfectivo - totalCierreEfectivo,
    [totalArqueoEfectivo, totalCierreEfectivo]
  );
  const diffEsPositivo = diferenciaEfectivo >= 0;
  const diffLabel = diffEsPositivo ? 'Sobrante' : 'Faltante';
  const diffAbs = Math.abs(diferenciaEfectivo);

  const totalGeneral = useMemo(
    () => totalArqueoEfectivo - totalGastos + cajaChicaUsada + faltantePagado,
    [totalArqueoEfectivo, totalGastos, cajaChicaUsada, faltantePagado]
  );
  const isDepositNegative = totalGeneral < 0;

  // Handlers de edición inline
  const setArq = (idx, field, value) => {
    if (!isEditing) return;
    setDatosEditados((prev) => {
      const copy = prev.arqueo.map((c) => ({ ...c }));
      copy[idx][field] = value;
      return { ...prev, arqueo: copy };
    });
  };
  const setCier = (idx, field, value) => {
    if (!isEditing) return;
    setDatosEditados((prev) => {
      const copy = prev.cierre.map((c) => ({ ...c }));
      copy[idx][field] = value;
      return { ...prev, cierre: copy };
    });
  };
  const setGasto = (i, field, val) => {
    if (!isEditing) return;
    setDatosEditados((prev) => {
      const list = prev.gastos.map((g) => ({ ...g }));
      list[i][field] = val;
      return { ...prev, gastos: list };
    });
  };

  // Utilidades faltante pagado
  const revertirFaltantePagado = () => {
    if (!isEditing) return;
    setDatosEditados((prev) => ({ ...prev, faltantePagado: 0 }));
  };

  // Cerrar modal con ESC
  useEffect(() => {
    if (!showDetailModal) return;
    const onKey = (e) => { if (e.key === 'Escape') closeDetalleModal(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDetailModal]);

  return (
    <div className="ventas-shell">
      <header className="ventas-header">
        <h1>Ventas</h1>

        <div className="ventas-actions">
          <button className="btn btn-accent" onClick={() => navigate('/home/RegistrarCierre')}>
            Registrar Cuadre
          </button>
          <button className="btn btn-primary" onClick={handleOpenGroupModal}>
            Descargar PDF Agrupado
          </button>
        </div>
      </header>

      <div className="ventas-filtros">
        <div className="filtro">
          <label>Sucursal:</label>
          <select
            value={sucursalFiltro}
            onChange={(e)=> setSucursalFiltro(e.target.value)}
          >
            <option value="all">Todas</option>
            {sucursalesList.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        <div className="filtro">
          <label>Fecha:</label>
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e)=> setFechaFiltro(e.target.value)}
          />
        </div>
      </div>

      {/* KPI cards */}
      <section className="ventas-kpis">
        <div className="kpi-card">
          <div className="kpi-icon kpi-money" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 3c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v1H7V3Zm-1 4h12l.9 1.8c.7 1.3 1.1 2.8 1.1 4.2 0 4.4-3.6 8-8 8s-8-3.6-8-8c0-1.5.4-2.9 1.1-4.2L6 7Zm6 3c-.6 0-1 .4-1 1v.3c-.6.1-1.2.3-1.7.6-.5.3-.8.8-.8 1.5 0 .6.2 1.1.7 1.4.4.3 1 .6 1.8.7v1.5h2V16c.6-.1 1.2-.3 1.6-.6.5-.3.7-.8.7-1.5 0-.6-.2-1.1-.7-1.4-.4-.3-1-.5-1.6-.6V11c0-.6-.4-1-1-1Zm-1.1 3.1c0-.2.1-.3.3-.4.2-.1.5-.2.8-.2v1.3c-.3-.1-.6-.2-.8-.3-.2-.1-.3-.2-.3-.4Zm2.9 1.9c-.2.1-.5.2-.8.2v-1.2c.3.1.6.2.8.3.2.1.3.2.3.4 0 .2-.1.3-.3.3Z"/></svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-title">Total de ventas</span>
            <div className="kpi-value">{fmtQ(totalVentas)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-avg" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 17h18v2H3v-2Zm2-6 4 4 3-3 4 4 5-5-1.4-1.4-3.6 3.6-4-4-3 3-2.6-2.6L5 11Z"/></svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-title">Promedio de ventas</span>
            <div className="kpi-value">{fmtQ(promedioVentas)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-best" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a5 5 0 0 0 4 4.9V14a3 3 0 0 0 2 2.83V19H8v2h8v-2h-2.17A3 3 0 0 0 16 14v-2.1A5 5 0 0 0 20 7V5a1 1 0 0 0-1-1ZM6 7V6h1v3.92A3 3 0 0 1 6 7Zm12 0a3 3 0 0 1-1 2.92V6h1v1Z"/></svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-title">Día de más venta</span>
            <div className="kpi-value">{diaMasVenta}</div>
          </div>
        </div>
      </section>

      {/* Tabla */}
      <section className="ventas-tabla-wrap">
        <table className="ventas-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Sucursal</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cuadres.map((c) => {
              const nombreSucursal = sucursalesMap[c.sucursalId] || 'Sin sucursal';
              return (
                <tr key={c.id}>
                  <td>{formatDate(c.fecha)}</td>
                  <td>{nombreSucursal}</td>
                  <td className="acciones">
                    <button className="btn btn-min" onClick={() => handleVer(c)}>Ver</button>
                    <button className="btn btn-min" onClick={() => handleEditar(c)}>Editar</button>
                    <button className="btn btn-min" onClick={() => handleDescargarPDF(c)}>Descargar</button>
                    <button className="btn btn-min danger" onClick={() => handleEliminar(c.id)}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
            {!cuadres.length && (
              <tr><td colSpan="3" className="empty">Sin registros para la selección.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ===== Detalle en MODAL ===== */}
      {showDetailModal && fuente && (
        <div className="modal-mask" role="dialog" aria-modal="true" onClick={closeDetalleModal}>
          <div className="modal-card modal-xl" onClick={(e)=>e.stopPropagation()}>
            <style>{MODAL_BASE}</style>
            <div className="modal-hd">
              <h3 style={{margin:0}}>{isEditing ? 'Editar cuadre' : 'Detalle del cuadre'}</h3>
              <div style={{display:'flex', gap:8}}>
                {!isEditing && (
                  <button className="btn" onClick={() => handleEditar(cuadreSeleccionado)}>Editar</button>
                )}
                <button className="btn" onClick={closeDetalleModal}>Cerrar</button>
              </div>
            </div>

            {/* Scroll interno del modal */}
            <div className="modal-body">
              <div className="rc-shell" ref={detalleRef}>
                <div className="rc-header" style={{marginBottom: 0}}>
                  <h1 style={{fontSize: '1.6rem', margin: 0}}>
                    {isEditing ? 'Editar cuadre' : 'Detalle del cuadre'}
                  </h1>
                  <div className="rc-header-right">
                    <div className="rc-date">
                      <label>Fecha</label>
                      <input type="date" value={fuente.fecha} disabled />
                    </div>
                  </div>
                </div>

                <div className="rc-tabs" style={{marginTop: 8}}>
                  <div className="rc-tab active">
                    {sucursalesMap[fuente.sucursalId] || 'Sucursal'}
                  </div>
                </div>

                {/* GRID PRINCIPAL */}
                <div className="rc-grid">
                  {/* Arqueo Físico */}
                  <section className="rc-card">
                    <h3>Arqueo Físico</h3>
                    <div className="rc-sheet rc-sheet-3cols">
                      {[0,1,2].map((i) => {
                        const c = arqueoData[i] || {};
                        const totalCaja = totalEfectivoCaja(c);
                        return (
                          <div className="rc-col" key={`arq-${i}`}>
                            <div className="rc-col-hd">Caja {i+1}</div>

                            {[
                              ['q100', 'Q 100'],
                              ['q50',  'Q 50'],
                              ['q20',  'Q 20'],
                              ['q10',  'Q 10'],
                              ['q5',   'Q 5'],
                              ['q1',   'Q 1'],
                            ].map(([field, label]) => (
                              <div className="rc-row" key={field}>
                                <span className="rc-cell-label">{label}</span>
                                <input
                                  className="rc-input"
                                  inputMode="numeric"
                                  value={c[field] || ''}
                                  onChange={(e) => setArq(i, field, e.target.value)}
                                  placeholder="0.00"
                                  disabled={!isEditing}
                                />
                              </div>
                            ))}

                            <div className="rc-row rc-total-caja">
                              <span className="rc-cell-label strong">Total de caja</span>
                              <b>Q {totalCaja.toFixed(2)}</b>
                            </div>

                            <div className="rc-row rc-row-sep" />

                            <div className="rc-row">
                              <span className="rc-cell-label">Tarjeta</span>
                              <input
                                className="rc-input"
                                inputMode="numeric"
                                value={c.tarjeta || ''}
                                onChange={(e) => setArq(i, 'tarjeta', e.target.value)}
                                placeholder="0.00"
                                disabled={!isEditing}
                              />
                            </div>
                            <div className="rc-row">
                              <span className="rc-cell-label">A domicilio (Motorista)</span>
                              <input
                                className="rc-input"
                                inputMode="numeric"
                                value={c.motorista || ''}
                                onChange={(e) => setArq(i, 'motorista', e.target.value)}
                                placeholder="0.00"
                                disabled={!isEditing}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Cierre de Sistema */}
                  <section className="rc-card">
                    <h3>Cierre de Sistema</h3>
                    <div className="rc-sheet rc-sheet-3cols">
                      {[0,1,2].map((i) => {
                        const c = cierreData[i] || {};
                        return (
                          <div className="rc-col" key={`cier-${i}`}>
                            <div className="rc-col-hd">Caja {i+1}</div>

                            {[
                              ['efectivo', 'Efectivo'],
                              ['tarjeta',  'Tarjeta'],
                              ['motorista','A domicilio (Motorista)'],
                            ].map(([field, label]) => (
                              <div className="rc-row" key={field}>
                                <span className="rc-cell-label">{label}</span>
                                <input
                                  className="rc-input"
                                  inputMode="numeric"
                                  value={c[field] || ''}
                                  onChange={(e) => setCier(i, field, e.target.value)}
                                  placeholder="0.00"
                                  disabled={!isEditing}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* GASTOS + RESUMEN */}
                <div className="rc-grid rc-grid-bottom">
                  {/* Gastos */}
                  <section className="rc-card">
                    <h3>Gastos</h3>
                    <div className="rc-gastos">
                      {gastosData.map((g, i) => (
                        <div className="rc-gasto-row" key={i}>
                          <input
                            className="rc-input rc-desc"
                            placeholder="Categoría"
                            value={g.categoria || ''}
                            onChange={(e) => setGasto(i, 'categoria', e.target.value)}
                            disabled={!isEditing}
                          />
                          <input
                            className="rc-input rc-desc"
                            placeholder="Descripción"
                            value={g.descripcion || ''}
                            onChange={(e) => setGasto(i, 'descripcion', e.target.value)}
                            disabled={!isEditing}
                          />
                          <input
                            className="rc-input rc-qty"
                            placeholder="Cantidad"
                            inputMode="numeric"
                            value={g.cantidad || ''}
                            onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
                            disabled={!isEditing}
                          />
                        </div>
                      ))}
                      {!gastosData.length && <div className="rc-tab-empty">Sin gastos</div>}
                    </div>
                  </section>

                  {/* Resumen / Totales */}
                  <section className="rc-card">
                    <h3>Resumen</h3>

                    <div className="rc-resumen-grid">
                      {/* IZQ - Ventas Total Sistema */}
                      <div className="rc-res-col">
                        <div className="rc-res-title">Ventas Total Sistema</div>

                        <div className="rc-res-item">
                          <span>Efectivo</span>
                          <b>Q {totalCierreEfectivo.toFixed(2)}</b>
                        </div>
                        <div className="rc-res-item">
                          <span>Tarjeta</span>
                          <b>Q {totalCierreTarjeta.toFixed(2)}</b>
                        </div>
                        <div className="rc-res-item">
                          <span>A domicilio</span>
                          <b>Q {totalCierreMotorista.toFixed(2)}</b>
                        </div>
                        <div className="rc-res-item">
                          <span>Caja chica (usada)</span>
                          {isEditing ? (
                            <input
                              className="rc-input"
                              inputMode="numeric"
                              value={datosEditados.cajaChicaUsada}
                              onChange={(e) =>
                                setDatosEditados((prev) => ({ ...prev, cajaChicaUsada: e.target.value }))
                              }
                              placeholder="0.00"
                            />
                          ) : (
                            <b>Q {cajaChicaUsada.toFixed(2)}</b>
                          )}
                        </div>

                        <div className={`rc-res-item ${diffEsPositivo ? 'ok' : 'bad'}`}>
                          <span>{diffLabel}</span>
                          <b>Q {diffAbs.toFixed(2)}</b>
                        </div>
                      </div>

                      {/* Item independiente para faltante pagado */}
                      <div className="rc-res-item" style={{alignItems:'center', gap:8}}>
                        <span>Faltante pagado</span>
                        {isEditing ? (
                          <>
                            <input
                              className="rc-input"
                              inputMode="numeric"
                              value={datosEditados.faltantePagado}
                              onChange={(e) =>
                                setDatosEditados((prev) => ({ ...prev, faltantePagado: e.target.value }))
                              }
                              placeholder="0.00"
                            />
                            <button className="btn btn-min" onClick={revertirFaltantePagado}>
                              Revertir
                            </button>
                          </>
                        ) : (
                          <b>Q {faltantePagado.toFixed(2)}</b>
                        )}
                      </div>

                      {/* DER - Control Administración */}
                      <div className="rc-res-col">
                        <div className="rc-res-title">Control Administración</div>

                        <div className="rc-res-item">
                          <span>Efectivo</span>
                          <b>Q {totalArqueoEfectivo.toFixed(2)}</b>
                        </div>
                        <div className="rc-res-item">
                          <span>Tarjeta</span>
                          <b>Q {totalArqueoTarjeta.toFixed(2)}</b>
                        </div>
                        <div className="rc-res-item">
                          <span>A domicilio</span>
                          <b>Q {totalArqueoMotorista.toFixed(2)}</b>
                        </div>
                        <div className="rc-res-item">
                          <span>Gastos</span>
                          <b>Q {totalGastos.toFixed(2)}</b>
                        </div>
                      </div>
                    </div>

                    {/* Total a depositar */}
                    <div className={`rc-total-deposit ${isDepositNegative ? 'bad' : ''}`}>
                      <span className="money">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 7h18v10H3V7zm2 2v6h14V9H5zm3 1h4v4H8v-4zM4 6h16V5H4v1z"/>
                        </svg>
                        Total a depositar
                      </span>
                      <b>Q {totalGeneral.toFixed(2)}</b>
                    </div>

                    {/* Comentario */}
                    <div className="rc-comentario">
                      <label htmlFor="rc-com">Comentario</label>
                      <textarea
                        id="rc-com"
                        value={comentario}
                        onChange={(e) => isEditing && setDatosEditados(prev => ({...prev, comentario: e.target.value}))}
                        placeholder="Agrega un comentario"
                        rows={3}
                        disabled={!isEditing}
                      />
                    </div>

                    {/* Acciones footer */}
                    <div style={{marginTop: 12, display:'flex', gap:8, justifyContent:'flex-end'}}>
                      {isEditing ? (
                        <>
                          <button className="rc-btn" onClick={() => { setIsEditing(false); setDatosEditados(null); }}>
                            Cancelar edición
                          </button>
                          <button className="rc-btn rc-btn-primary" onClick={handleActualizar}>
                            Guardar cambios
                          </button>
                        </>
                      ) : (
                        <>
                        </>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
            {/* fin modal-body */}
          </div>
        </div>
      )}

      {/* Modal de selección múltiple (agrupado) */}
      {showGroupModal && (
        <div className="modal-mask">
          <div className="modal-card">
            <h3>Selecciona registros para agrupar</h3>
            <div className="modal-body">
              <label className="check-all">
                <input type="checkbox" checked={selectAll} onChange={handleSelectAllChange} /> Seleccionar todo
              </label>
              <div className="modal-list">
                {cuadres.map((c) => {
                  const nombreSucursal = sucursalesMap[c.sucursalId] || 'Sin sucursal';
                  return (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={selectedCierresIds.includes(c.id)}
                        onChange={handleCierreCheckbox(c.id)}
                      /> {formatDate(c.fecha)} – {nombreSucursal}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowGroupModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleDownloadGrouped}>Descargar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}