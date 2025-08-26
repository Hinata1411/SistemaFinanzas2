// src/Ventas.js
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

import { useCuadres } from './hooks/useCuadres';
import { n } from './utils/numbers';
import { getTodayLocalISO, formatDate } from './utils/dates';
import VentasTable from './components/ventas/VentasTable';
import GroupDownloadModal from './components/ventas/GroupDownloadModal';
import { exportSingleCuadrePdf, exportGroupedPdf } from './pdf/exportadores';
import './components/ventas/Ventas.css';

export default function Ventas() {
  const navigate = useNavigate();

  // Perfil del usuario (rol + sucursal asignada si viewer)
  const [me, setMe] = useState({ loaded: false, role: 'viewer', sucursalId: null });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMe({ loaded: true, role: 'viewer', sucursalId: null });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const data = snap.exists() ? snap.data() : {};
        setMe({
          loaded: true,
          role: data.role || 'viewer',
          sucursalId: data.sucursalId || null,
        });
      } catch (e) {
        console.error(e);
        setMe({ loaded: true, role: 'viewer', sucursalId: null });
      }
    });
    return () => unsub();
  }, []);

  const isAdmin = me.role === 'admin';
  const canManage = isAdmin;    // Editar / Eliminar
  const canDownload = isAdmin;  // Descargar PDF (individual y agrupado)

  const [fechaFiltro, setFechaFiltro] = useState(getTodayLocalISO());
  const [sucursalFiltro, setSucursalFiltro] = useState('all');

  // Hook de cuadres (para viewer forzamos su sucursal asignada)
  const { cuadres, sucursalesList, sucursalesMap, refetch } = useCuadres({
    fecha: fechaFiltro,
    sucursalId: isAdmin ? sucursalFiltro : (me.sucursalId || 'all'),
  });

  // Sucursales visibles en filtro
  const uiSucursalesList = useMemo(() => {
    if (!me.loaded) return [];
    return isAdmin
      ? sucursalesList
      : sucursalesList.filter((s) => s.id === me.sucursalId);
  }, [sucursalesList, me, isAdmin]);

  // KPI helpers
  const totalVentaDeCuadre = (c) => {
    const base = Array.isArray(c.cierre) && c.cierre.length ? c.cierre : (c.arqueo || []);
    return base.reduce((acc, caja) =>
      acc + n(caja.efectivo) + n(caja.tarjeta) + n(caja.motorista), 0);
  };

  // Navegar a RegistrarCierre con modo
  const handleVer = (c) => {
    navigate(`/Finanzas/RegistrarCierre?id=${c.id}&mode=view`);
  };
  const handleEditar = (c) => {
    if (!canManage) {
      Swal.fire('Solo lectura', 'No tienes permisos para editar.', 'info');
      navigate(`/Finanzas/RegistrarCierre?id=${c.id}&mode=view`);
      return;
    }
    navigate(`/Finanzas/RegistrarCierre?id=${c.id}&mode=edit`);
  };

  const handleEliminar = async (id) => {
    if (!canManage) {
      Swal.fire('Solo lectura', 'No tienes permisos para eliminar.', 'info');
      return;
    }
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
    if (!canDownload) {
      Swal.fire('Solo lectura', 'No tienes permisos para descargar.', 'info');
      return;
    }
    exportSingleCuadrePdf(c, sucursalesMap[c.sucursalId] || '—', formatDate);
  };

  // Agrupado
  const [showGroup, setShowGroup] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Esperar perfil
  if (!me.loaded) {
    return (
      <div className="ventas-shell">
        <header className="ventas-header">
            <h1>Historial de Cuadres</h1>
        </header>
        <div className="empty" style={{ background:'#fff', padding:16, borderRadius:12, border:'1px solid #e7e2d9' }}>
          Cargando perfil…
        </div>
      </div>
    );
  }

  const currentSucursalValue = isAdmin ? sucursalFiltro : (me.sucursalId || '');

  return (
    <div className="ventas-shell">
      <header className="ventas-header">
        <h1>Historial de Cuadres</h1>
        <div className="ventas-actions">

          {/* Descargar agrupado: solo admin */}
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setSelectedIds(cuadres.map(c=>c.id));
                setShowGroup(true);
              }}
            >
              Descargar PDF Agrupado
            </button>
          )}
        </div>
      </header>

      <div className="ventas-filtros">
        <div className="filtro">
          <label>Sucursal:</label>
          {isAdmin ? (
            <select
              value={currentSucursalValue}
              onChange={(e)=> setSucursalFiltro(e.target.value)}
            >
              <option value="all">Todas</option>
              {sucursalesList.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          ) : (
            <select value={currentSucursalValue} disabled>
              {uiSucursalesList.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div className="filtro">
          <label>Fecha:</label>
          <input type="date" value={fechaFiltro} onChange={(e)=> setFechaFiltro(e.target.value)} />
        </div>
      </div>


      <VentasTable
        cuadres={cuadres}
        sucursalesMap={sucursalesMap}
        onVer={handleVer}
        onEditar={handleEditar}
        onDescargar={handleDescargarPDF}
        onEliminar={handleEliminar}
        // Flags para ocultar acciones cuando es viewer:
        canManage={canManage}
        canDownload={canDownload}
        isAdmin={isAdmin}
      />

      {/* Modal descargas agrupadas solo admin */}
      {isAdmin && (
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
      )}
    </div>
  );
}
