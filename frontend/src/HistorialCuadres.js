// src/HistorialCuadres.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  getDoc,
  updateDoc
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
import './HistorialCuadres.css';

export default function HistorialCuadres() {
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [cuadres, setCuadres] = useState([]);
  const [cuadreSeleccionado, setCuadreSeleccionado] = useState(null);

  // Nuevo estado para controlar si estamos en modo edición
  const [isEditing, setIsEditing] = useState(false);

  // Estado local donde guardaremos los datos que estamos editando
  const [datosEditados, setDatosEditados] = useState(null);

  const detalleRef = useRef();

  // Mapa sucursalId → nombre/ubicación
  const [sucursalesMap, setSucursalesMap] = useState({});
const [cajaChicaMap, setCajaChicaMap] = useState({});
  // Estados para PDF agrupado
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedCierresIds, setSelectedCierresIds] = useState([]);
  const [selectAll, setSelectAll] = useState(true);

  // Refs para los bloques en modo “ver” o “editar”
  const arqueoRefs = [useRef(), useRef(), useRef()];
  const cierreRefs = [useRef(), useRef(), useRef()];
  const gastosRef = useRef();
  const totalesRef = useRef();

  const formatDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // 1) Obtener lista de cuadres desde Firestore
  const obtenerCuadres = async () => {
    try {
      const cuadresRef = collection(db, 'cierres');
      const q = fechaFiltro
        ? query(cuadresRef, where('fecha', '==', fechaFiltro))
        : cuadresRef;
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCuadres(data);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron obtener los cuadres.', 'error');
    }
  };

  // Cada vez que cambie fechaFiltro, recargamos los cuadres
  useEffect(() => {
    obtenerCuadres();
  }, [fechaFiltro]);

  // 2) Cuando cambie la lista de cuadres, obtenemos los nombres de sucursal
  useEffect(() => {
    const fetchSucursales = async () => {
      const idsUnicos = Array.from(
        new Set(cuadres.map((c) => c.sucursalId).filter(Boolean))
      );
      const nuevoMapUbicacion = {};
      const nuevoMapCajaChica = {};

      await Promise.all(
        idsUnicos.map(async (sucId) => {
          try {
            const sucDoc = await getDoc(doc(db, 'sucursales', sucId));
            if (sucDoc.exists()) {
              const datos = sucDoc.data();
              // Guardamos la ubicación
            nuevoMapUbicacion[sucId] = datos.ubicacion || 'Sin lugar';
            // Guardamos el saldo de caja chica (0 si no existe)
            nuevoMapCajaChica[sucId] = parseFloat(datos.cajaChica) || 0;
          } else {
              nuevoMapUbicacion[sucId] = 'Sucursal no encontrada';
              nuevoMapCajaChica[sucId] = 0; 
            }
          } catch (err) {
          console.error(`Error al leer sucursal ${sucId}:`, err);
          nuevoMapUbicacion[sucId] = 'Error al cargar';
          nuevoMapCajaChica[sucId] = 0;
          }
        })
      );

      setSucursalesMap(nuevoMapUbicacion);
    setCajaChicaMap(nuevoMapCajaChica);
    };

      if (cuadres.length > 0) {
      fetchSucursales();
    } else {
      setSucursalesMap({});
      setCajaChicaMap({});
    }
  }, [cuadres]);

  // Descargar PDF de un cuadre individual (“Ver”)
  const handleDescargarPDF = async (cuadre) => {
    setCuadreSeleccionado(cuadre);
    setIsEditing(false);
    setDatosEditados(null);

    // Esperamos un instante para que el contenido se renderice
    setTimeout(async () => {
      if (!detalleRef.current) return;
      const canvas = await html2canvas(detalleRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Cuadre_${cuadre.fecha}.pdf`);
    }, 300);
  };

  // Eliminar un cuadre
  const handleEliminar = async (id) => {
    const confirmar = await Swal.fire({
      title: '¿Eliminar cuadre?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (confirmar.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'cierres', id));
        Swal.fire('Eliminado', 'El cuadre ha sido eliminado.', 'success');
        obtenerCuadres();
        setCuadreSeleccionado(null);
        setIsEditing(false);
        setDatosEditados(null);
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo eliminar el cuadre.', 'error');
      }
    }
  };

  // Abrir modal para agrupar PDF
  const handleOpenGroupModal = () => {
    if (cuadres.length === 0) {
      Swal.fire('No hay cierres', 'No hay cierres para la fecha seleccionada.', 'info');
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
    setSelectedCierresIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  };

  // Descargar PDF múltiple (agrupado)
  const handleDownloadGrouped = () => {
    const docs = cuadres.filter((c) => selectedCierresIds.includes(c.id));
    if (docs.length === 0) {
      Swal.fire('Selecciona al menos un cierre', 'No hay cierres seleccionados.', 'warning');
      return;
    }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    docs.forEach((c, idx) => {
      if (idx !== 0) pdf.addPage();
      let y = 40;
      pdf.setFontSize(16);
      pdf.text(`Cierre - Fecha: ${formatDate(c.fecha)}`, 40, y);
      y += 30;
      pdf.setFontSize(12);

      const nombreSuc = sucursalesMap[c.sucursalId] || 'Sin sucursal';
      pdf.text(`Sucursal: ${nombreSuc}`, 40, y);
      y += 20;

      // Arqueo Físico
      pdf.setFontSize(14);
      pdf.text('Arqueo Físico:', 40, y);
      y += 20;
      c.arqueo.forEach((caja, i) => {
        pdf.setFontSize(12);
        pdf.text(
          `Caja ${i + 1} – E: Q${caja.efectivo || 0}, T: Q${caja.tarjeta || 0}, M: Q${caja.motorista || 0}`,
          60,
          y
        );
        y += 18;
      });
      y += 10;

      // Cierre de Sistema
      pdf.setFontSize(14);
      pdf.text('Cierre de Sistema:', 40, y);
      y += 20;
      c.cierre.forEach((caja, i) => {
        pdf.setFontSize(12);
        pdf.text(
          `Caja ${i + 1} – E: Q${caja.efectivo || 0}, T: Q${caja.tarjeta || 0}, M: Q${caja.motorista || 0}`,
          60,
          y
        );
        y += 18;
      });
      y += 10;

      // Gastos
      pdf.setFontSize(14);
      pdf.text('Gastos:', 40, y);
      y += 20;
      if (!c.gastos || c.gastos.length === 0) {
        pdf.setFontSize(12);
        pdf.text('No hay gastos registrados.', 60, y);
        y += 18;
      } else {
        c.gastos.forEach((g) => {
          pdf.setFontSize(12);
          pdf.text(`- ${g.categoria}: Q${g.cantidad}`, 60, y);
          y += 18;
        });
      }
      y += 10;

      // Diferencias y Totales
      pdf.setFontSize(14);
      pdf.text('Diferencia Efectivo:', 40, y);
      y += 20;
      pdf.setFontSize(12);
      pdf.text(`Q${c.diferenciaEfectivo}`, 60, y);
      y += 30;

      pdf.setFontSize(14);
      pdf.text('Totales:', 40, y);
      y += 20;
      pdf.setFontSize(12);
      pdf.text(`Total Diferencia: Q${c.diferenciaEfectivo}`, 60, y);
    });

    pdf.save(`Cierres_Agrupados_${fechaFiltro || 'todos'}.pdf`);
    setShowGroupModal(false);
  };

  // -------------------------------
  // Al presionar “Ver”
  // -------------------------------
  const handleVer = async (cuadre) => {
    setCuadreSeleccionado(cuadre);
    setIsEditing(false);
    setDatosEditados(null);
  };

  // -------------------------------
  // Al presionar “Editar”
  // -------------------------------
  const handleEditar = (cuadre) => {
    setCuadreSeleccionado(cuadre);
    setIsEditing(true);

    // Creamos copias de los objetos (para editar sin mutar el original)
    setDatosEditados({
      arqueo: cuadre.arqueo.map((caja) => ({ ...caja })),
      cierre: cuadre.cierre.map((caja) => ({ ...caja })),
      gastos: cuadre.gastos.map((g) => ({ ...g })),
      comentario: cuadre.comentario || '',
    });
  };

  // -------------------------------
  // Al presionar “Actualizar Cuadre”
  // -------------------------------
  const handleActualizar = async () => {
    if (!cuadreSeleccionado || !datosEditados) return;

    const { arqueo, cierre, gastos, comentario } = datosEditados;

    // Validar campos numéricos como en RegistrarCierre
    const validBoxes = [...arqueo, ...cierre].every((b) =>
      ['efectivo', 'tarjeta', 'motorista'].every(
        (f) => b[f] !== undefined && !isNaN(parseFloat(b[f]))
      )
    );
    const validGastos = gastos.every((g) => !isNaN(parseFloat(g.cantidad)));

    if (!validBoxes || !validGastos) {
      return Swal.fire('Datos inválidos', 'Revisa montos y gastos.', 'warning');
    }

    try {
      // Actualizamos el documento Firestore
      const docRef = doc(db, 'cierres', cuadreSeleccionado.id);
      await updateDoc(docRef, {
        arqueo,
        cierre,
        gastos,
        comentario,
      });

      Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        text: `Cuadre del ${formatDate(cuadreSeleccionado.fecha)} actualizado.`,
        timer: 2000,
        showConfirmButton: false,
      });

      // Volver a modo solo lectura y recargar lista
      setIsEditing(false);
      setDatosEditados(null);
      obtenerCuadres();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    }
  };

  return (
    <div className="vista-cuadres">
      <h1>Historial de Cuadres</h1>

      {/* Filtros y botón agrupado */}
      <div className="centro-contenido">
        <div className="filtros">
          <button onClick={handleOpenGroupModal}>Descargar PDF Agrupado</button>
          <div className="fecha-container">
            <label htmlFor="fecha">Filtrar por fecha:</label>
            <input
              id="fecha"
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />
          </div>
        </div>

        {/* Tabla de cuadres */}
        <table className="tabla-cuadres">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Sucursal</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cuadres.map((cuadre, idx) => {
              const nombreSucursal = sucursalesMap[cuadre.sucursalId] || 'Sin sucursal';
              return (
                <tr key={idx}>
                  <td>{formatDate(cuadre.fecha)}</td>
                  <td>{nombreSucursal}</td>
                  <td>
                    <button onClick={() => handleVer(cuadre)}>Ver</button>
                    <button onClick={() => handleEditar(cuadre)}>Editar</button>
                    <button onClick={() => handleDescargarPDF(cuadre)}>Descargar</button>
                    <button onClick={() => handleEliminar(cuadre.id)}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Si el usuario eligió “Ver” o “Editar”, mostramos la vista completa */}
        {cuadreSeleccionado && (
          <div className="detalle-cuadre" ref={detalleRef}>
            {/* ----- Título con fecha y sucursal ----- */}
            <h2>
              {isEditing
                ? `Editando cuadre del ${formatDate(cuadreSeleccionado.fecha)}`
                : `Cuadre del ${formatDate(cuadreSeleccionado.fecha)}`}
              &nbsp;|&nbsp; Sucursal:{' '}
              {sucursalesMap[cuadreSeleccionado.sucursalId] || 'Sin sucursal'}
            </h2>

            {/* ----- Sección: Arqueo Físico ----- */}
            <div className="panel">
              <div className="toggle-header">
                <div className="line" />
                <div className="header-center">
                  <span className="panel-title">Arqueo Físico</span>
                </div>
                <div className="line" />
              </div>
              <div className="grid">
                {(isEditing ? datosEditados.arqueo : cuadreSeleccionado.arqueo).map(
                  (caja, i) => (
                    <ArqueoBlock
                      key={i}
                      ref={arqueoRefs[i]}
                      title={`Caja ${i + 1}`}
                      inicialData={caja}
                      readonly={!isEditing}
                      onDataChange={
                        isEditing
                          ? (nuevo) => {
                              const copia = datosEditados.arqueo.slice();
                              copia[i] = nuevo;
                              setDatosEditados((prev) => ({
                                ...prev,
                                arqueo: copia,
                              }));
                            }
                          : undefined
                      }
                    />
                  )
                )}
              </div>
            </div>

            {/* ----- Sección: Cierre de Sistema ----- */}
            <div className="panel">
              <div className="toggle-header">
                <div className="line" />
                <div className="header-center">
                  <span className="panel-title">Cierre de Sistema</span>
                </div>
                <div className="line" />
              </div>
              <div className="grid">
                {(isEditing ? datosEditados.cierre : cuadreSeleccionado.cierre).map(
                  (caja, i) => (
                    <CierreBlock
                      key={i}
                      ref={cierreRefs[i]}
                      title={`Caja ${i + 1}`}
                      inicialData={caja}
                      readonly={!isEditing}
                      onDataChange={
                        isEditing
                          ? (nuevo) => {
                              const copiaCierre = datosEditados.cierre.slice();
                              copiaCierre[i] = nuevo;
                              setDatosEditados((prev) => ({
                                ...prev,
                                cierre: copiaCierre,
                              }));
                            }
                          : undefined
                      }
                    />
                  )
                )}
              </div>
            </div>

            {/* ----- Sección: Gastos ----- */}
            <div className="panel">
              <div className="toggle-header">
                <div className="line" />
                <div className="header-center">
                  <span className="panel-title">Gastos</span>
                </div>
                <div className="line" />
              </div>
              <div className="grid">
                <GastosBlock
                  ref={gastosRef}
                  title="Gastos"
                  inicialData={isEditing ? datosEditados.gastos : cuadreSeleccionado.gastos}
                  readonly={!isEditing}
                  onDataChange={
                    isEditing
                      ? (nuevo) => {
                          setDatosEditados((prev) => ({
                            ...prev,
                            gastos: nuevo.gastos,
                          }));
                        }
                      : undefined
                  }
                />
              </div>
            </div>

            {/* ----- Sección: Diferencias y Totales ----- */}
            <div className="cuadre">
              <div className="footer-section">
                <div className="section diferencias">
                  <DiferenciasTable
                    arqueoData={isEditing ? datosEditados.arqueo : cuadreSeleccionado.arqueo}
                    cierreData={isEditing ? datosEditados.cierre : cuadreSeleccionado.cierre}
                  />
                </div>
                <div className="section totales">
                  <TotalesBlock
                    ref={totalesRef}
                    arqueoData={isEditing ? datosEditados.arqueo : cuadreSeleccionado.arqueo}
                    cierreData={isEditing ? datosEditados.cierre : cuadreSeleccionado.cierre}
                    gastosData={isEditing ? datosEditados.gastos : cuadreSeleccionado.gastos}
                    sumDifEfectivo={
                      isEditing 
                        ? undefined 
                        : cuadreSeleccionado.diferenciaEfectivo
                    }
                    sucursalId={cuadreSeleccionado.sucursalId}
                    balanceCajaChica={cajaChicaMap[cuadreSeleccionado.sucursalId] || 0}
                      onCoverWithCajaChica={() => {}}
                    
                    inicialComentario={
                      isEditing 
                        ? datosEditados.comentario 
                        : cuadreSeleccionado.comentario || ''
                    }
                    readonly={!isEditing}
                    onDataChange={
                      isEditing
                        ? (nuevoComentario) => {
                            setDatosEditados((prev) => ({
                              ...prev,
                              comentario: nuevoComentario
                            }));
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            {/* ===== BOTÓN “Actualizar Cuadre” (solo en modo edición) ===== */}
            {isEditing && (
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={handleActualizar}
                  style={{
                    backgroundColor: '#27ae60',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  Actualizar Cuadre
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----- Modal de selección múltiple para PDF agrupado ----- */}
      {showGroupModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '100%',
            }}
          >
            <h3>Selecciona cierres para agrupar</h3>
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                margin: '16px 0',
              }}
            >
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAllChange}
                />{' '}
                Seleccionar todo
              </label>
              {cuadres.map((c) => {
                const nombreSucursal = sucursalesMap[c.sucursalId] || 'Sin sucursal';
                return (
                  <label key={c.id} style={{ display: 'block', marginBottom: '6px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCierresIds.includes(c.id)}
                      onChange={handleCierreCheckbox(c.id)}
                    />{' '}
                    {formatDate(c.fecha)} – {nombreSucursal}
                  </label>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button onClick={() => setShowGroupModal(false)}>Cancelar</button>
              <button onClick={handleDownloadGrouped}>Descargar PDF Agrupado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
