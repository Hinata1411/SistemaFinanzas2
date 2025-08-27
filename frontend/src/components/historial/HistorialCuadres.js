import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  doc, getDoc, collection, getDocs,
  query, where, orderBy, limit, writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../services/firebase';

import { useCuadres } from '../../hooks/useCuadres';
import { getTodayLocalISO, formatDate } from '../../utils/dates';
import VentasTable from '../ventas/HistorialCuadreTable';
import GroupDownloadModal from '../ventas/GroupDownloadModal';
import { exportSingleCuadrePdf, exportGroupedPdf } from '../../pdf/exportadores';
import '../ventas/Ventas.css';

// ★ Encabezados EXACTOS que quieres ver también en móvil
const HEADERS = [
  'Fecha',
  'Sucursal',
  'Usuario',
  'Efectivo',
  'Tarjeta',
  'Motorista',
  'Total a depositar',
  'Hora',
  'Acciones'
];

// Convierte Timestamp|Date|string a milisegundos
const toMillis = (tsLike) => {
  if (!tsLike) return 0;
  if (typeof tsLike?.toDate === 'function') return tsLike.toDate().getTime(); // Firestore Timestamp
  if (typeof tsLike?.seconds === 'number') return tsLike.seconds * 1000;
  const d = new Date(tsLike);
  return isNaN(d) ? 0 : d.getTime();
};

// Valor base del cuadre para KPI (preferimos totales.totalGeneral)
const getKpiFromCuadre = (c) => {
  const raw = c?.totales?.totalGeneral;
  const v = typeof raw === 'number' ? raw : parseFloat(raw || 0);
  return Number.isFinite(v) ? v : 0;
};

export default function HistorialCuadres() {
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

  //Eliminar registro
  const handleEliminar = async (id) => {
    if (!canManage) {
      Swal.fire('Solo lectura', 'No tienes permisos para eliminar.', 'info');
      return;
    }

    const confirmar = await Swal.fire({
      title: '¿Eliminar cuadre?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmar.isConfirmed) return;

    try {
      // 1) Leemos el cuadre para saber sucursal y fecha/createdAt
      const cierreRef = doc(db, 'cierres', id);
      const cierreSnap = await getDoc(cierreRef);
      if (!cierreSnap.exists()) {
        await Swal.fire('No encontrado', 'El cuadre ya no existe.', 'info');
        return;
      }
      const cierre = cierreSnap.data() || {};
      const sucursalId = cierre.sucursalId;
      const cierreMs = toMillis(cierre.createdAt || cierre.updatedAt || cierre.fecha);

      // 2) ¿Hay un PAGO más reciente que este cuadre para esa sucursal?
      //    Si sí, NO tocamos el KPI (queda gobernado por pagos).
      let nextKpi = null; // null => no tocar KPI
      let hayPagoMasReciente = false;
      try {
        const pagosQ = query(
          collection(db, 'pagos'),
          where('sucursalId', '==', sucursalId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const pagosSnap = await getDocs(pagosQ);
        if (!pagosSnap.empty) {
          const pago = pagosSnap.docs[0].data() || {};
          const pagoMs = toMillis(pago.createdAt || pago.updatedAt || pago.fecha);
          hayPagoMasReciente = pagoMs > cierreMs;
        }
      } catch (e) {
        // si falla la consulta, asumimos que NO hay pago más reciente y seguiremos con cierres
        hayPagoMasReciente = false;
      }

      // 3) Si NO hay pago más reciente, el KPI debe quedar en el “siguiente” cuadre más nuevo
      //    (o 0 si este era el único)
      if (!hayPagoMasReciente) {
        try {
          const cierresQ = query(
            collection(db, 'cierres'),
            where('sucursalId', '==', sucursalId),
            orderBy('createdAt', 'desc'),
            limit(2)
          );
          const cierresSnap = await getDocs(cierresQ);
          const docs = cierresSnap.docs;

          if (!docs.length) {
            // raro, pero por seguridad
            nextKpi = 0;
          } else if (docs[0].id === id) {
            // borras el más reciente
            if (docs.length > 1) {
              const second = docs[1].data() || {};
              nextKpi = getKpiFromCuadre(second);
            } else {
              // era el único cuadre
              nextKpi = 0;
            }
          } else {
            // no es el más reciente => no tocar KPI
            nextKpi = null;
          }
        } catch (e) {
          // si falla, al menos dejar en 0
          nextKpi = 0;
        }
      } else {
        nextKpi = null; // hay pago más reciente => KPI ya está definido por pagos, no mover
      }

      // 4) Ejecutar en batch: borrar cuadre + (opcional) actualizar KPI
      const batch = writeBatch(db);
      const sucRef = doc(db, 'sucursales', sucursalId);

      batch.delete(cierreRef);
      if (nextKpi !== null && Number.isFinite(nextKpi)) {
        batch.update(sucRef, { kpiDepositos: Number(nextKpi) });
      }

      await batch.commit();

      await Swal.fire({ icon: 'success', title: 'Cuadre eliminado', timer: 1200, showConfirmButton: false });
      await refetch();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e?.message || 'No se pudo eliminar.', 'error');
    }
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
        headers={HEADERS}              // ★ pasamos tus categorías
        cuadres={cuadres}
        sucursalesMap={sucursalesMap}
        onVer={handleVer}
        onEditar={handleEditar}
        onDescargar={handleDescargarPDF}
        onEliminar={handleEliminar}
        canManage={canManage}
        canDownload={canDownload}
        isAdmin={isAdmin}
      />

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
            const nombre = `Cuadre-${fechaFiltro || 'todas'}`;
            exportGroupedPdf(docs, sucursalesMap, nombre, formatDate);
            setShowGroup(false);
          }}
        />
      )}
    </div>
  );
}
