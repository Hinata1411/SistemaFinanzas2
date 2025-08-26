// src/Pagos.js  (o src/HistorialPagos.jsx)
import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocs,
  query, where, updateDoc, orderBy
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './HistorialPagos.css';

import { auth, db } from './firebase';
import { getTodayLocalISO as getTodayLocalISO_ventas } from './utils/dates';

// En Ventas usas getTodayLocalISO; aquí lo replico por compatibilidad:
const getTodayLocalISO = getTodayLocalISO_ventas || (() => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
});

const fmtQ = (val) => (typeof val === 'number' ? val : parseFloat(val || 0))
  .toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

const n = (v) => {
  const x = typeof v === 'number' ? v : parseFloat(v || 0);
  return isNaN(x) ? 0 : x;
};

function sumItems(items) {
  return (items || []).reduce((acc, it) => acc + n(it.monto), 0);
}

export default function Pagos() {
  const navigate = useNavigate(); // Hook de navegación

  // Perfil del usuario
  const [me, setMe] = useState({ loaded:false, role:'viewer', sucursalId:null });
  const isAdmin = me.role === 'admin';

  // Filtros
  const [fechaFiltro, setFechaFiltro] = useState(getTodayLocalISO());
  const [sucursalFiltro, setSucursalFiltro] = useState('all');

  // Sucursales
  const [sucursalesList, setSucursalesList] = useState([]);
  const [sucursalesMap, setSucursalesMap] = useState({});

  // Datos
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modales (conservados pero ya no indispensables)
  const [viewer, setViewer] = useState({ open:false, doc:null });
  const [editor, setEditor] = useState({ open:false, doc:null, items:[] });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setMe({ loaded:true, role:'viewer', sucursalId:null }); return; }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const data = snap.exists() ? snap.data() : {};
        setMe({ loaded:true, role: data.role || 'viewer', sucursalId: data.sucursalId || null });
      } catch {
        setMe({ loaded:true, role:'viewer', sucursalId:null });
      }
    });
    return () => unsub();
  }, []);

  // Cargar sucursales
  useEffect(() => {
    (async () => {
      try {
        const qs = await getDocs(collection(db, 'sucursales'));
        const arr = qs.docs.map(d => {
          const data = d.data() || {};
          const ubicacion =
            data.ubicacion ??
            data['ubicación'] ??      // por si está guardado con tilde
            '';
          return {
            id: d.id,
            ...data,
            nombre: data.nombre || d.id,
            ubicacion
          };
        });
        setSucursalesList(arr);

        // Map para mostrar etiquetas en UI: ubicación primero, si no, nombre
        const m = {};
        arr.forEach(s => { m[s.id] = s.ubicacion || s.nombre; });
        setSucursalesMap(m);
      } catch {
        setSucursalesList([]);
        setSucursalesMap({});
      }
    })();
  }, []);

  // Cargar pagos según filtros
  const currentSucursalValue = isAdmin ? sucursalFiltro : (me.sucursalId || 'all');

  const refetch = async () => {
    if (!me.loaded) return;
    setLoading(true);
    try {
      const col = collection(db, 'pagos');
      const conditions = [];
      if (fechaFiltro) conditions.push(where('fecha','==',fechaFiltro));
      if (currentSucursalValue && currentSucursalValue !== 'all') {
        conditions.push(where('sucursalId','==',currentSucursalValue));
      }
      let qRef = query(col, ...conditions, orderBy('fecha','desc'));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map(d => ({ id:d.id, ...(d.data()||{}) }));
      setPagos(rows);
    } catch (e) {
      console.error(e);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!me.loaded) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loaded, fechaFiltro, currentSucursalValue]);

  const uiSucursalesList = useMemo(() => {
    if (!me.loaded) return [];
    return isAdmin
      ? sucursalesList
      : sucursalesList.filter(s => s.id === me.sucursalId);
  }, [sucursalesList, me, isAdmin]);

  // Acciones → Navegar a RegistrarPagos con id y modo
  const handleVer = (row) => {
    navigate(`/Finanzas/RegistrarPagos?id=${row.id}&mode=view`);
  };
  const closeViewer = () => setViewer({ open:false, doc:null });

  const handleEditar = async (row) => {
    if (!isAdmin) {
      await Swal.fire('Solo lectura', 'No tienes permisos para editar.', 'info');
      return;
    }
    navigate(`/Finanzas/RegistrarPagos?id=${row.id}&mode=edit`);
  };
  const closeEditor = () => setEditor({ open:false, doc:null, items:[] });

  const handleSaveEditor = async () => {
    try {
      const docId = editor.doc.id;
      const newItems = editor.items.map(it => ({
        descripcion: it.descripcion || '',
        monto: n(it.monto),
        ref: it.ref || '',
        categoria: it.categoria || 'Varios',
        fileUrl: it.fileUrl || '',
        fileName: it.fileName || '',
        fileMime: it.fileMime || '',
      }));
      const totalUtilizado = sumItems(newItems);
      const prevTotal = n(editor.doc.totalUtilizado || 0);
      const prevSobrante = n(editor.doc.sobranteParaManana || 0);
      const delta = totalUtilizado - prevTotal;
      const newSobrante = prevSobrante - delta;

      await updateDoc(doc(db, 'pagos', docId), {
        items: newItems,
        totalUtilizado,
        sobranteParaManana: newSobrante,
      });
      await Swal.fire({ icon:'success', title:'Pago actualizado', timer:1200, showConfirmButton:false });
      closeEditor();
      refetch();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message || 'No se pudo actualizar.', 'error');
    }
  };

  const handleEliminar = async (row) => {
    if (!isAdmin) {
      await Swal.fire('Solo lectura', 'No tienes permisos para eliminar.', 'info');
      return;
    }
    const confirmar = await Swal.fire({
      title:'¿Eliminar registro?',
      text:'Esta acción no se puede deshacer.',
      icon:'warning',
      showCancelButton:true
    });
    if (!confirmar.isConfirmed) return;

    try {
      // === Revertir efectos en la sucursal antes de borrar ===
      const sucId = row.sucursalId;
      const sucRef = doc(db, 'sucursales', sucId);
      const sucSnap = await getDoc(sucRef);
      const sucData = sucSnap.exists() ? (sucSnap.data() || {}) : {};

      const totalUtilizado = n(row.totalUtilizado ?? sumItems(row.items));
      const cajaChicaUsada = n(row.cajaChicaUsada);
      const addBackDepositos = totalUtilizado - cajaChicaUsada;

      const currentKpi = n(sucData.kpiDepositos);
      const currentCaja = n(sucData.cajaChica);

      const nextKpi = currentKpi + addBackDepositos;
      const nextCaja = currentCaja + cajaChicaUsada;

      await updateDoc(sucRef, {
        kpiDepositos: nextKpi,
        cajaChica: nextCaja,
      });

      await deleteDoc(doc(db, 'pagos', row.id));

      await Swal.fire('Eliminado', 'El registro ha sido eliminado y los saldos fueron revertidos.', 'success');
      refetch();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e?.message || 'No se pudo eliminar.', 'error');
    }
  };

  // UI
  if (!me.loaded) {
    return (
      <div className="ventas-shell">
        <header className="ventas-header">
          <h1>Pagos</h1>
        </header>
        <div className="empty">
          Cargando perfil…
        </div>
      </div>
    );
  }

  return (
    <div className="ventas-shell">
      <header className="ventas-header">
        <h1>Pagos</h1>
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

      <section className="rc-card">
        <div className="rc-card-hd"><h3>Pagos registrados</h3></div>

        {loading ? (
          <div className="rc-empty">Cargando…</div>
        ) : pagos.length === 0 ? (
          <div className="rc-empty">Sin registros</div>
        ) : (
          <table className="rc-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Items</th>
                <th>Total utilizado</th>
                <th>Sobrante p/ mañana</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => {
                const sucNom = sucursalesMap[p.sucursalId] || p.sucursalId || '—';
                const total = n(p.totalUtilizado ?? sumItems(p.items));
                const sob = n(p.sobranteParaManana);
                const count = (p.items || []).length;
                return (
                  <tr key={p.id}>
                    <td>{p.fecha || '—'}</td>
                    <td>{sucNom}</td>
                    <td>{count}</td>
                    <td>{fmtQ(total)}</td>
                    <td>{fmtQ(sob)}</td>
                    <td>
                      <button className="rc-btn rc-btn-outline" type="button" onClick={()=>handleVer(p)}>Ver</button>
                      {' '}
                      <button
                        className="rc-btn rc-btn-accent"
                        type="button"
                        onClick={()=>handleEditar(p)}
                        disabled={!isAdmin}
                        title={isAdmin ? '' : 'Solo admin'}
                      >
                        Editar
                      </button>
                      {' '}
                      <button
                        className="rc-btn rc-btn-ghost"
                        type="button"
                        onClick={()=>handleEliminar(p)}
                        disabled={!isAdmin}
                        title={isAdmin ? '' : 'Solo admin'}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Viewer Modal (conservado por si lo usas en otros flujos) */}
      {viewer.open && viewer.doc && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-hd">
              <h3>Detalle de pagos</h3>
              <button className="rc-btn rc-btn-ghost" onClick={()=>setViewer({open:false, doc:null})}>✕</button>
            </div>
            <div className="modal-bd">
              <div>
                <strong>Fecha:</strong> {viewer.doc.fecha || '—'} · <strong>Sucursal:</strong> {sucursalesMap[viewer.doc.sucursalId] || viewer.doc.sucursalId || '—'}
              </div>
              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Ref</th>
                    <th>Categoría</th>
                    <th>Adjunto</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewer.doc.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.descripcion || '—'}</td>
                      <td>{fmtQ(it.monto || 0)}</td>
                      <td>{it.ref || '—'}</td>
                      <td>{it.categoria || '—'}</td>
                      <td>
                        {it.fileUrl ? (
                          <a href={it.fileUrl} target="_blank" rel="noreferrer">Abrir</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-ft">
              <button className="rc-btn" onClick={()=>setViewer({ open:false, doc:null })}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal (conservado, pero ya no se usa al navegar a RegistrarPagos) */}
      {editor.open && editor.doc && (
        <div className="modal-overlay">
          <div className="modal" >
            <div className="modal-hd">
              <h3>Editar pagos</h3>
              <button className="rc-btn rc-btn-ghost" onClick={closeEditor}>✕</button>
            </div>
            <div className="modal-bd">
              <div>
                <strong>Fecha:</strong> {editor.doc.fecha || '—'} · <strong>Sucursal:</strong> {sucursalesMap[editor.doc.sucursalId] || editor.doc.sucursalId || '—'}
              </div>
              <table className="rc-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Ref</th>
                    <th>Categoría</th>
                    <th>Adjunto</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {editor.items.length === 0 && (
                    <tr><td colSpan={6} className="rc-empty">Sin items</td></tr>
                  )}
                  {editor.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          className="rc-input"
                          value={it.descripcion || ''}
                          onChange={(e)=> {
                            const v = e.target.value;
                            setEditor(prev => {
                              const arr = [...prev.items]; arr[idx] = { ...arr[idx], descripcion: v }; return { ...prev, items: arr };
                            });
                          }}
                          placeholder="Descripción"
                        />
                      </td>
                      <td>
                        <input
                          className="rc-input rc-qty no-spin"
                          type="number" min="0" step="0.01" inputMode="decimal"
                          value={it.monto ?? ''}
                          onChange={(e)=> {
                            const v = e.target.value;
                            setEditor(prev => {
                              const arr = [...prev.items]; arr[idx] = { ...arr[idx], monto: v }; return { ...prev, items: arr };
                            });
                          }}
                          onWheel={(e)=>e.currentTarget.blur()}
                        />
                      </td>
                      <td>
                        <input
                          className="rc-input"
                          value={it.ref || ''}
                          onChange={(e)=> {
                            const v = e.target.value;
                            setEditor(prev => {
                              const arr = [...prev.items]; arr[idx] = { ...arr[idx], ref: v }; return { ...prev, items: arr };
                            });
                          }}
                          placeholder="Referencia"
                        />
                      </td>
                      <td>
                        <input
                          className="rc-input"
                          value={it.categoria || ''}
                          onChange={(e)=> {
                            const v = e.target.value;
                            setEditor(prev => {
                              const arr = [...prev.items]; arr[idx] = { ...arr[idx], categoria: v }; return { ...prev, items: arr };
                            });
                          }}
                          placeholder="Categoría"
                        />
                      </td>
                      <td>
                        {it.fileUrl ? <a href={it.fileUrl} target="_blank" rel="noreferrer">Abrir</a> : '—'}
                      </td>
                      <td>
                        <button
                          className="rc-btn rc-btn-ghost"
                          type="button"
                          onClick={()=>{
                            setEditor(prev => {
                              const arr = prev.items.slice();
                              arr.splice(idx,1);
                              return { ...prev, items: arr };
                            });
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>
                      Total: {fmtQ(sumItems(editor.items))}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div>
                <button
                  className="rc-btn rc-btn-outline"
                  type="button"
                  onClick={()=>{
                    setEditor(prev => ({ ...prev, items: [...prev.items, { descripcion:'', monto:'', ref:'', categoria:'Varios', fileUrl:'', fileName:'', fileMime:'' }] }));
                  }}
                >
                  + Agregar item
                </button>
              </div>
              <div>
                * La edición de adjuntos se realiza desde <em>Registrar Pagos</em> al volver a cargar el soporte (esta vista no reemplaza archivos).
              </div>
            </div>
            <div className="modal-ft">
              <button className="rc-btn" onClick={closeEditor}>Cancelar</button>
              <button className="rc-btn rc-btn-primary" onClick={handleSaveEditor}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
