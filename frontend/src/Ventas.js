import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

import { useCuadres } from './hooks/useCuadres';
import { n } from './utils/numbers';
import { getTodayLocalISO, formatDate } from './utils/dates';
import KpiCards from './components/ventas/KpiCards';
import VentasTable from './components/ventas/VentasTable';
import GroupDownloadModal from './components/ventas/GroupDownloadModal';
import { exportSingleCuadrePdf, exportGroupedPdf } from './pdf/exportadores';
import './components/ventas/Ventas.css';

const MODAL_BASE = `/* (sin uso ya, puedes borrar si quieres) */`;

export default function Ventas() {
  const navigate = useNavigate();

  const [fechaFiltro, setFechaFiltro] = useState(getTodayLocalISO());
  const [sucursalFiltro, setSucursalFiltro] = useState('all');

  const { cuadres, sucursalesList, sucursalesMap, refetch } = useCuadres({
    fecha: fechaFiltro, sucursalId: sucursalFiltro
  });

  // KPI helpers
  const totalVentaDeCuadre = (c) => {
    const base = Array.isArray(c.cierre) && c.cierre.length ? c.cierre : (c.arqueo || []);
    return base.reduce((acc, caja) =>
      acc + n(caja.efectivo) + n(caja.tarjeta) + n(caja.motorista), 0);
  };
  const fmtQ = (val) => (typeof val === 'number' ? val : parseFloat(val || 0))
    .toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

  const totalVentas = useMemo(() => cuadres.reduce((acc,c)=> acc + totalVentaDeCuadre(c), 0), [cuadres]);
  const promedioVentas = cuadres.length ? (totalVentas / cuadres.length) : 0;
  const diaMasVenta = useMemo(() => {
    if (!cuadres.length) return '-';
    let best = cuadres[0], max = totalVentaDeCuadre(cuadres[0]);
    for (let i=1;i<cuadres.length;i++){
      const v = totalVentaDeCuadre(cuadres[i]);
      if (v > max){ max = v; best = cuadres[i]; }
    }
    return `${formatDate(best.fecha)} (${fmtQ(max)})`;
  }, [cuadres]);

  // Navegar a RegistrarCierre con modo
  const handleVer = (c) => {
    navigate(`/home/RegistrarCierre?id=${c.id}&mode=view`);
  };
  const handleEditar = (c) => {
    navigate(`/home/RegistrarCierre?id=${c.id}&mode=edit`);
  };

  const handleEliminar = async (id) => {
    const confirmar = await Swal.fire({
      title:'¿Eliminar registro?',
      text:'Esta acción no se puede deshacer.',
      icon:'warning',
      showCancelButton:true
    });
    if (!confirmar.isConfirmed) return;
    await deleteDoc(doc(db, 'cierres', id));
    Swal.fire('Eliminado', 'El registro ha sido eliminado.', 'success');
    await refetch();
  };

  // PDFs
  const handleDescargarPDF = (c) => {
    exportSingleCuadrePdf(c, sucursalesMap[c.sucursalId] || '—', formatDate);
  };

  // Agrupado
  const [showGroup, setShowGroup] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  return (
    <div className="ventas-shell">
      <header className="ventas-header">
        <h1>Ventas</h1>
        <div className="ventas-actions">
          <button
            className="btn btn-accent"
            onClick={() => navigate('/home/RegistrarCierre')}
          >
            Registrar Cuadre
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelectedIds(cuadres.map(c=>c.id));
              setShowGroup(true);
            }}
          >
            Descargar PDF Agrupado
          </button>
        </div>
      </header>

      <div className="ventas-filtros">
        <div className="filtro">
          <label>Sucursal:</label>
          <select value={sucursalFiltro} onChange={(e)=> setSucursalFiltro(e.target.value)}>
            <option value="all">Todas</option>
            {sucursalesList.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="filtro">
          <label>Fecha:</label>
          <input type="date" value={fechaFiltro} onChange={(e)=> setFechaFiltro(e.target.value)} />
        </div>
      </div>

      <KpiCards
        totalVentas={totalVentas}
        promedioVentas={promedioVentas}
        diaMasVenta={diaMasVenta}
        fmtQ={fmtQ}
      />

      <VentasTable
        cuadres={cuadres}
        sucursalesMap={sucursalesMap}
        onVer={handleVer}
        onEditar={handleEditar}
        onDescargar={handleDescargarPDF}
        onEliminar={handleEliminar}
      />
      {/* ⬆ ahora Ver/Editar redirigen a RegistrarCierre */}

      <GroupDownloadModal
        visible={showGroup}
        cuadres={cuadres}
        sucursalesMap={sucursalesMap}
        selectedIds={selectedIds}
        onToggleAll={() =>
          setSelectedIds(selectedIds.length === cuadres.length ? [] : cuadres.map(c=>c.id))
        }
        onToggleOne={(id) =>
          setSelectedIds((prev)=> prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
        }
        onCancel={()=> setShowGroup(false)}
        onDownload={() => {
          const docs = cuadres.filter(c => selectedIds.includes(c.id));
          if (!docs.length) return Swal.fire('Selecciona al menos un registro','','warning');
          const nombre = `Ventas_Agrupadas_${fechaFiltro || 'todas'}`;
          exportGroupedPdf(docs, sucursalesMap, nombre, formatDate);
          setShowGroup(false);
        }}
      />
    </div>
  );
}
