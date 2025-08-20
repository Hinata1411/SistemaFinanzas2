import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, deleteDoc, getDoc, updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import ArqueoBlock from './ArqueoBlock';
import CierreBlock from './CierreBlock';
import GastosBlock from './GastosBlock';
import DiferenciasTable from './DiferenciasTable';
import TotalesBlock from './TotalesBlock';

import './Ventas.css';

export default function Ventas() {
  const navigate = useNavigate();

  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [sucursalFiltro, setSucursalFiltro] = useState('all');
  const [sucursalesList, setSucursalesList] = useState([]); // [{id, nombre}]
  const [cuadres, setCuadres] = useState([]);
  const [cuadreSeleccionado, setCuadreSeleccionado] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [datosEditados, setDatosEditados] = useState(null);

  const detalleRef = useRef();

  // Mapas auxiliares
  const [sucursalesMap, setSucursalesMap] = useState({});
  const [cajaChicaMap, setCajaChicaMap] = useState({});

  // PDF agrupado
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedCierresIds, setSelectedCierresIds] = useState([]);
  const [selectAll, setSelectAll] = useState(true);

  const arqueoRefs = [useRef(), useRef(), useRef()];
  const cierreRefs = [useRef(), useRef(), useRef()];
  const gastosRef = useRef();
  const totalesRef = useRef();

  const formatDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // ======================
  // Sucursales (para combo)
  // ======================
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map(d => ({ id: d.id, nombre: d.data().ubicacion || 'Sin nombre' }));
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
      // si hay fecha seleccionada, la usamos para el query (esto evita traer todo)
      const q = fechaFiltro ? query(cuadresRef, where('fecha', '==', fechaFiltro)) : cuadresRef;
      const snap = await getDocs(q);
      let data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Filtrado por sucursal en cliente (evita necesitar un índice compuesto)
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
              nuevoMapUbicacion[sucId] = datos.ubicacion || 'Sin lugar';
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
      (parseFloat(caja.efectivo || 0) || 0) +
      (parseFloat(caja.tarjeta  || 0) || 0) +
      (parseFloat(caja.motorista|| 0) || 0)
    , 0);
    return sum;
  };

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

  // Formato Quetzal (GT)
const fmtQ = (n) =>
  (typeof n === 'number'
    ? n
    : parseFloat(n || 0)
  ).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });


  // ======================
  // Acciones
  // ======================
  const handleDescargarPDF = async (cuadre) => {
    setCuadreSeleccionado(cuadre);
    setIsEditing(false);
    setDatosEditados(null);

    setTimeout(async () => {
      if (!detalleRef.current) return;
      const canvas = await html2canvas(detalleRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Venta_${cuadre.fecha}.pdf`);
    }, 300);
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
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
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

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    setSelectAll(checked);
    setSelectedCierresIds(checked ? cuadres.map((c) => c.id) : []);
  };

  const handleCierreCheckbox = (id) => (e) => {
    const checked = e.target.checked;
    setSelectedCierresIds((prev) => checked ? [...prev, id] : prev.filter((i) => i !== id));
  };

  const handleDownloadGrouped = () => {
    const docs = cuadres.filter((c) => selectedCierresIds.includes(c.id));
    if (!docs.length) {
      Swal.fire('Selecciona al menos un registro', '', 'warning');
      return;
    }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    docs.forEach((c, idx) => {
      if (idx !== 0) pdf.addPage();
      let y = 40;
      pdf.setFontSize(16);
      pdf.text(`Ventas - Fecha: ${formatDate(c.fecha)}`, 40, y);
      y += 30;
      pdf.setFontSize(12);

      const nombreSuc = sucursalesMap[c.sucursalId] || 'Sin sucursal';
      pdf.text(`Sucursal: ${nombreSuc}`, 40, y);
      y += 20;

      // Totales por caja
      pdf.setFontSize(14); pdf.text('Cierre de Sistema:', 40, y); y += 20;
      (c.cierre || []).forEach((caja, i) => {
        pdf.setFontSize(12);
        pdf.text(`Caja ${i+1} – E: Q${caja.efectivo||0}, T: Q${caja.tarjeta||0}, M: Q${caja.motorista||0}`, 60, y);
        y += 18;
      });
      y += 10;

      // Diferencia
      pdf.setFontSize(14); pdf.text('Diferencia Efectivo:', 40, y); y += 20;
      pdf.setFontSize(12); pdf.text(`Q${c.diferenciaEfectivo || 0}`, 60, y);
    });

    pdf.save(`Ventas_Agrupadas_${fechaFiltro || 'todas'}.pdf`);
    setShowGroupModal(false);
  };

  const handleVer = (c) => { setCuadreSeleccionado(c); setIsEditing(false); setDatosEditados(null); };
  const handleEditar = (c) => {
    setCuadreSeleccionado(c);
    setIsEditing(true);
    setDatosEditados({
      arqueo: (c.arqueo || []).map(x => ({...x})),
      cierre: (c.cierre || []).map(x => ({...x})),
      gastos: (c.gastos || []).map(x => ({...x})),
      comentario: c.comentario || '',
    });
  };

  const handleActualizar = async () => {
    if (!cuadreSeleccionado || !datosEditados) return;
    const { arqueo, cierre, gastos, comentario } = datosEditados;

    const validBoxes = [...(arqueo||[]), ...(cierre||[])].every((b) =>
      ['efectivo','tarjeta','motorista'].every((f)=> b[f] !== undefined && !isNaN(parseFloat(b[f])))
    );
    const validGastos = (gastos||[]).every((g)=> !isNaN(parseFloat(g.cantidad)));
    if (!validBoxes || !validGastos) {
      return Swal.fire('Datos inválidos', 'Revisa montos y gastos.', 'warning');
    }

    try {
      await updateDoc(doc(db, 'cierres', cuadreSeleccionado.id), { arqueo, cierre, gastos, comentario });
      Swal.fire({ icon:'success', title:'Actualizado', text:`Venta del ${formatDate(cuadreSeleccionado.fecha)} actualizada.`, timer:2000, showConfirmButton:false });
      setIsEditing(false); setDatosEditados(null); obtenerCuadres();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    }
  };

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
            {/* money-bag */}
            <svg viewBox="0 0 24 24"><path d="M7 3c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v1H7V3Zm-1 4h12l.9 1.8c.7 1.3 1.1 2.8 1.1 4.2 0 4.4-3.6 8-8 8s-8-3.6-8-8c0-1.5.4-2.9 1.1-4.2L6 7Zm6 3c-.6 0-1 .4-1 1v.3c-.6.1-1.2.3-1.7.6-.5.3-.8.8-.8 1.5 0 .6.2 1.1.7 1.4.4.3 1 .6 1.8.7v1.5h2V16c.6-.1 1.2-.3 1.6-.6.5-.3.7-.8.7-1.5 0-.6-.2-1.1-.7-1.4-.4-.3-1-.5-1.6-.6V11c0-.6-.4-1-1-1Zm-1.1 3.1c0-.2.1-.3.3-.4.2-.1.5-.2.8-.2v1.3c-.3-.1-.6-.2-.8-.3-.2-.1-.3-.2-.3-.4Zm2.9 1.9c-.2.1-.5.2-.8.2v-1.2c.3.1.6.2.8.3.2.1.3.2.3.4 0 .2-.1.3-.3.3Z"/></svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-title">Total de ventas</span>
            <div className="kpi-value">{fmtQ(totalVentas)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-avg" aria-hidden="true">
            {/* trend-up */}
            <svg viewBox="0 0 24 24"><path d="M3 17h18v2H3v-2Zm2-6 4 4 3-3 4 4 5-5-1.4-1.4-3.6 3.6-4-4-3 3-2.6-2.6L5 11Z"/></svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-title">Promedio de ventas</span>
            <div className="kpi-value">{fmtQ(promedioVentas)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-best" aria-hidden="true">
            {/* trophy */}
            <svg viewBox="0 0 24 24"><path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a5 5 0 0 0 4 4.9V14a3 3 0 0 0 2 2.83V19H8v2h8v-2h-2v-2.17A3 3 0 0 0 16 14v-2.1A5 5 0 0 0 20 7V5a1 1 0 0 0-1-1ZM6 7V6h1v3.92A3 3 0 0 1 6 7Zm12 0a3 3 0 0 1-1 2.92V6h1v1Z"/></svg>
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

      {/* Detalle / Edición */}
      {cuadreSeleccionado && (
        <div className="detalle-cuadre" ref={detalleRef}>
          <h2>
            {isEditing ? `Editando registro del ${formatDate(cuadreSeleccionado.fecha)}`
                       : `Registro del ${formatDate(cuadreSeleccionado.fecha)}`}
            &nbsp;|&nbsp; Sucursal: {sucursalesMap[cuadreSeleccionado.sucursalId] || 'Sin sucursal'}
          </h2>

          <div className="panel">
            <div className="panel-title">Arqueo Físico</div>
            <div className="grid">
              {(isEditing ? datosEditados.arqueo : (cuadreSeleccionado.arqueo||[])).map((caja, i) => (
                <ArqueoBlock
                  key={i}
                  ref={arqueoRefs[i]}
                  title={`Caja ${i+1}`}
                  inicialData={caja}
                  readonly={!isEditing}
                  onDataChange={ isEditing ? (nuevo) => {
                    const copia = datosEditados.arqueo.slice();
                    copia[i] = nuevo;
                    setDatosEditados(prev => ({...prev, arqueo:copia}));
                  } : undefined }
                />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Cierre de Sistema</div>
            <div className="grid">
              {(isEditing ? datosEditados.cierre : (cuadreSeleccionado.cierre||[])).map((caja, i) => (
                <CierreBlock
                  key={i}
                  ref={cierreRefs[i]}
                  title={`Caja ${i+1}`}
                  inicialData={caja}
                  readonly={!isEditing}
                  onDataChange={ isEditing ? (nuevo) => {
                    const copia = datosEditados.cierre.slice();
                    copia[i] = nuevo;
                    setDatosEditados(prev => ({...prev, cierre:copia}));
                  } : undefined }
                />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Gastos</div>
            <div className="grid">
              <GastosBlock
                ref={gastosRef}
                title="Gastos"
                inicialData={isEditing ? datosEditados.gastos : (cuadreSeleccionado.gastos||[])}
                readonly={!isEditing}
                onDataChange={ isEditing ? (nuevo) => {
                  setDatosEditados(prev => ({...prev, gastos:nuevo.gastos}));
                } : undefined }
              />
            </div>
          </div>

          <div className="cuadre">
            <div className="footer-section">
              <div className="section diferencias">
                <DiferenciasTable
                  arqueoData={isEditing ? datosEditados.arqueo : (cuadreSeleccionado.arqueo||[])}
                  cierreData={isEditing ? datosEditados.cierre : (cuadreSeleccionado.cierre||[])}
                />
              </div>
              <div className="section totales">
                <TotalesBlock
                  ref={totalesRef}
                  arqueoData={isEditing ? datosEditados.arqueo : (cuadreSeleccionado.arqueo||[])}
                  cierreData={isEditing ? datosEditados.cierre : (cuadreSeleccionado.cierre||[])}
                  gastosData={isEditing ? datosEditados.gastos : (cuadreSeleccionado.gastos||[])}
                  sumDifEfectivo={ isEditing ? undefined : cuadreSeleccionado.diferenciaEfectivo }
                  sucursalId={cuadreSeleccionado.sucursalId}
                  balanceCajaChica={cajaChicaMap[cuadreSeleccionado.sucursalId] || 0}
                  onCoverWithCajaChica={() => {}}
                  inicialComentario={ isEditing ? datosEditados.comentario : (cuadreSeleccionado.comentario||'') }
                  readonly={!isEditing}
                  onDataChange={ isEditing ? (nuevoComentario) => {
                    setDatosEditados(prev => ({...prev, comentario:nuevoComentario}));
                  } : undefined }
                />
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="acciones-actualizar">
              <button className="btn btn-primary" onClick={handleActualizar}>
                Actualizar
              </button>
            </div>
          )}
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
