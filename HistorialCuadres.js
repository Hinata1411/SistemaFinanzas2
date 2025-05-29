import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import TotalesBlock from './TotalesBlock';
import DiferenciasTable from './DiferenciasTable';
import './HistorialCuadres.css';

export default function HistorialCuadres() {
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [cuadres, setCuadres] = useState([]);
  const [cuadreSeleccionado, setCuadreSeleccionado] = useState(null);
  const detalleRef = useRef();

  // Estados para PDF agrupado
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedCierresIds, setSelectedCierresIds] = useState([]);
  const [selectAll, setSelectAll] = useState(true);

  const formatDate = iso => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const obtenerCuadres = async () => {
    try {
      const cuadresRef = collection(db, 'cierres');
      const q = fechaFiltro
        ? query(cuadresRef, where('fecha', '==', fechaFiltro))
        : cuadresRef;
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCuadres(data);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron obtener los cuadre.', 'error');
    }
  };

  useEffect(() => {
    obtenerCuadres();
  }, [fechaFiltro]);

  const handleDescargarPDF = async cuadre => {
    setCuadreSeleccionado(cuadre);
    setTimeout(async () => {
      if (!detalleRef.current) return;
      const canvas = await html2canvas(detalleRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Cuadre_${cuadre.fecha}.pdf`);
    }, 500);
  };

  const handleEliminar = async id => {
    const confirmar = await Swal.fire({
      title: '¿Eliminar cuadre?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (confirmar.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'cierres', id));
        Swal.fire('Eliminado', 'El cuadre ha sido eliminado.', 'success');
        obtenerCuadres();
        setCuadreSeleccionado(null);
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo eliminar el cuadre.', 'error');
      }
    }
  };

  const handleEditar = cuadre => {
    localStorage.setItem('cuadreEditar', JSON.stringify(cuadre));
    window.location.href = '/registrar-cierre?editar=true';
  };

  // Abre modal para seleccionar varios cuadres
  const handleOpenGroupModal = () => {
    if (cuadres.length === 0) {
      Swal.fire('No hay cierres', 'No hay cierres para la fecha seleccionada.', 'info');
      return;
    }
    setSelectedCierresIds(cuadres.map(c => c.id));
    setSelectAll(true);
    setShowGroupModal(true);
  };

  const handleSelectAllChange = e => {
    const checked = e.target.checked;
    setSelectAll(checked);
    setSelectedCierresIds(checked ? cuadres.map(c => c.id) : []);
  };

  const handleCierreCheckbox = id => e => {
    const checked = e.target.checked;
    setSelectedCierresIds(prev =>
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleDownloadGrouped = () => {
    const docs = cuadres.filter(c => selectedCierresIds.includes(c.id));
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
      pdf.text(`Usuario: ${c.usuario || c.uid}`, 40, y);
      y += 20;

      // Arqueo Físico
      pdf.setFontSize(14);
      pdf.text('Arqueo Físico:', 40, y);
      y += 20;
      c.arqueo.forEach((caja, i) => {
        pdf.setFontSize(12);
        pdf.text(
          `Caja ${i + 1} - E: Q${caja.efectivo || 0}, T: Q${caja.tarjeta || 0}, M: Q${caja.motorista || 0}`,
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
          `Caja ${i + 1} - E: Q${caja.efectivo || 0}, T: Q${caja.tarjeta || 0}, M: Q${caja.motorista || 0}`,
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
        c.gastos.forEach(g => {
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
      // Asumiendo que TotalesBlock calcula y muestra totales en detalleRef; aquí solo mostramos diferencia
      pdf.setFontSize(12);
      pdf.text(`Total Diferencia: Q${c.diferenciaEfectivo}`, 60, y);
    });

    pdf.save(`Cierres_Agrupados_${fechaFiltro || 'todos'}.pdf`);
    setShowGroupModal(false);
  };

  return (
    <div className="vista-cuadres">
      <h1>Historial de Cuadres</h1>

      <div
        className="filtros"
        style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
      >
        <button onClick={handleOpenGroupModal}>
          Descargar PDF Agrupado
        </button>
        <label htmlFor="fecha">Filtrar por fecha:</label>
        <input
          id="fecha"
          type="date"
          value={fechaFiltro}
          onChange={e => setFechaFiltro(e.target.value)}
        />
      </div>

      <table className="tabla-cuadres">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cuadres.map((cuadre, idx) => (
            <tr key={idx}>
              <td>{formatDate(cuadre.fecha)}</td>
              <td>{cuadre.usuario || cuadre.uid}</td>
              <td>
                <button onClick={() => setCuadreSeleccionado(cuadre)}>
                  Ver
                </button>
                <button onClick={() => handleEditar(cuadre)}>
                  Editar
                </button>
                <button onClick={() => handleDescargarPDF(cuadre)}>
                  Descargar
                </button>
                <button onClick={() => handleEliminar(cuadre.id)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {cuadreSeleccionado && (
        <div className="detalle-cuadre" ref={detalleRef}>
          {/* ... (detalle tal como tenías) */}
          {/* Arqueo Físico, Cierre de Sistema, Gastos, Diferencias y Totales */}
        </div>
      )}

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
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '100%'
            }}
          >
            <h3>Selecciona cierres para agrupar</h3>
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                margin: '16px 0'
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
              {cuadres.map(c => (
                <label
                  key={c.id}
                  style={{ display: 'block', marginBottom: '6px' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCierresIds.includes(c.id)}
                    onChange={handleCierreCheckbox(c.id)}
                  />{' '}
                  {formatDate(c.fecha)} – {c.usuario || c.uid}
                </label>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px'
              }}
            >
              <button onClick={() => setShowGroupModal(false)}>
                Cancelar
              </button>
              <button onClick={handleDownloadGrouped}>
                Descargar PDF Agrupado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
