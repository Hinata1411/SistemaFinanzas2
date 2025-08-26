// src/RegistrarPagos.jsx
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, addDoc, getDoc, getDocs, query, where,
  doc, updateDoc, serverTimestamp, increment
} from 'firebase/firestore';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import './RegistrarPagos.css';

import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import { auth, db } from './firebase';
import { todayISO as getTodayISO } from './utils/dates';

import CategoriasModal from './components/registrar-cierre/CategoriasModal';
import AttachmentViewerModal from './components/registrar-cierre/AttachmentViewerModal';

// ====== Helpers ======
const money = (v) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 }).format(Number(v) || 0);

const extractTotalADepositar = (d) => {
  const t = d?.totales || {};
  const nnum = (v) => (typeof v === 'number' ? v : parseFloat(v || 0)) || 0;

  const fromTotals = t?.totalGeneral ?? t?.total_general ?? null;
  if (fromTotals != null && !isNaN(fromTotals)) {
    const val = nnum(fromTotals); if (val !== 0) return val;
  }
  const aliases = d?.totalADepositar ?? d?.total_a_depositar ?? d?.totalDepositar ??
                  d?.total_depositar ?? t?.totalADepositar ?? t?.total_a_depositar ??
                  t?.totalDepositar ?? t?.total_depositar ?? t?.depositoEfectivo ??
                  t?.efectivoParaDepositos ?? t?.efectivo_para_depositos ??
                  t?.totalDeposito ?? t?.total_deposito ?? null;
  if (aliases != null && !isNaN(aliases)) {
    const val = nnum(aliases); if (val !== 0) return val;
  }
  if (Array.isArray(d?.cierre)) return d.cierre.reduce((acc, c) => acc + nnum(c?.efectivo), 0);
  if (Array.isArray(d?.arqueo)) return d.arqueo.reduce((acc, c) => acc + nnum(c?.efectivo), 0);
  return 0;
};

const okTypes = ['image/png', 'image/jpeg', 'application/pdf'];

// ====== Componente ======
export default function RegistrarPagos() {
  const [me, setMe] = useState({ loaded: false, role: 'viewer', uid: null, username: '' });
  const isAdmin = me.role === 'admin';

  // sucursales
  const [sucursales, setSucursales] = useState([]);
  const [activeSucursalId, setActiveSucursalId] = useState(null);

  // fecha (por día)
  const [fecha, setFecha] = useState(getTodayISO());

  // KPI por sucursal (dinero para depósitos) y caja chica
  const [kpiDepositosBySuc, setKpiDepositosBySuc] = useState({}); // { [id]: number }
  const [cajaChicaBySuc, setCajaChicaBySuc] = useState({});        // { [id]: number }

  // categorías
  const INIT_CATS = ['Varios','Servicios','Transporte','Publicidad','Mantenimiento','Ajuste de caja chica'];
  const [categorias, setCategorias] = useState(INIT_CATS);
  const [showCatModal, setShowCatModal] = useState(false);

  // pagos por sucursal (estado local)
  // map por sucursal: { items: [...], cajaChicaUsada: number }
  const [pagosMap, setPagosMap] = useState({});

  // visor
  const [viewer, setViewer] = useState({ open:false, url:'', mime:'', name:'' });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setMe({ loaded:true, role:'viewer', uid:null, username:'' }); return; }
      try {
        const us = await getDoc(doc(db, 'usuarios', user.uid));
        const ud = us.exists() ? us.data() : {};
        setMe({ loaded:true, role: (ud.role||'viewer'), uid:user.uid, username: ud.username || '' });
      } catch {
        setMe({ loaded:true, role:'viewer', uid:user.uid, username:'' });
      }
    });
    return () => unsub();
  }, []);

  // Cargar sucursales + KPI (sumar cierres) + caja chica (MISMA lógica que en Finanzas)
  useEffect(() => {
    if (!me.loaded || !isAdmin) return;

    (async () => {
      try {
        const qs = await getDocs(collection(db, 'sucursales'));
        const arr = qs.docs.map((snap) => {
          const d = snap.data() || {};
          return {
            id: snap.id,
            nombre: d.nombre || d.name || snap.id,
            ubicacion: d.ubicacion || d.location || '',
            ...d,
          };
        });
        setSucursales(arr);
        setActiveSucursalId(prev => prev || arr[0]?.id || null);

        const hoy = getTodayISO();

        // 1) leer caja chica + posibles overrides
        const caja = {};
        const override = {};
        arr.forEach(s => {
          caja[s.id] = Number(s?.cajaChica || 0);
          if (typeof s?.kpiDepositos === 'number') override[s.id] = Number(s.kpiDepositos);
        });

        // 2) sumar cierres (Total a depositar)
        const desdeCierres = {};
        await Promise.all(arr.map(async (s) => {
          const cierresRef = collection(db, 'cierres');
          const qRef = query(cierresRef, where('sucursalId','==',s.id), where('fecha','<=',hoy));
          const snap = await getDocs(qRef);
          let sum = 0;
          snap.forEach(d => { sum += extractTotalADepositar(d.data() || {}); });
          desdeCierres[s.id] = sum;
        }));

        // 3) ¿hay pagos hoy? para decidir si usar override
        const hayPagosHoy = {};
        await Promise.all(arr.map(async (s) => {
          const pagosRef = collection(db, 'pagos');
          const qRef = query(pagosRef, where('sucursalId', '==', s.id), where('fecha', '==', hoy));
          const snap = await getDocs(qRef);
          hayPagosHoy[s.id] = snap.size > 0;
        }));

        // 4) construir mapas finales
        const kpi = {};
        arr.forEach(s => {
          const usarOverride = hayPagosHoy[s.id] && override[s.id] != null;
          kpi[s.id] = usarOverride ? override[s.id] : (desdeCierres[s.id] || 0);
        });

        setKpiDepositosBySuc(kpi);
        setCajaChicaBySuc(caja);
      } catch (e) {
        console.error(e);
        setSucursales([]);
        setKpiDepositosBySuc({});
        setCajaChicaBySuc({});
      }
    })();
  }, [me.loaded, isAdmin, getTodayISO, extractTotalADepositar]);

  // Inicializar pagosMap por sucursal
  useEffect(() => {
    if (!sucursales.length) return;
    setPagosMap((prev) => {
      const copy = { ...prev };
      sucursales.forEach(s => {
        if (!copy[s.id]) {
          copy[s.id] = {
            items: [
              { descripcion:'', monto:'', ref:'', categoria: categorias[0] || 'Varios',
                fileBlob:null, fileUrl:'', fileName:'', fileMime:'', locked:false }
            ],
            cajaChicaUsada: 0,
          };
        }
      });
      return copy;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursales.length]);

  if (!me.loaded) {
    return <div className="rc-tab-empty">Cargando permisos…</div>;
  }
  if (!isAdmin) {
    return <div className="rc-tab-empty">Solo administradores</div>;
  }

  const active = activeSucursalId;
  const suc = sucursales.find(s => s.id === active) || {};
  const state = pagosMap[active] || { items:[], cajaChicaUsada:0 };

  // Igual que en Finanzas: etiqueta por ubicación (fallback)
  const branchLabel = (s) => s?.ubicacion || s?.nombre || s?.id || '—';

  const setRow = (i, field, val) => {
    setPagosMap(prev => {
      const m = { ...prev };
      const arr = [...(m[active]?.items || [])];
      arr[i] = { ...arr[i], [field]: val };
      m[active] = { ...(m[active]||{}), items: arr };
      return m;
    });
  };

  const addRow = () => {
    setPagosMap(prev => {
      const m = { ...prev };
      const arr = [...(m[active]?.items || [])].map(x => ({ ...x, locked:true }));
      arr.push({
        descripcion:'', monto:'', ref:'', categoria: categorias[0] || 'Varios',
        fileBlob:null, fileUrl:'', fileName:'', fileMime:'', locked:false
      });
      m[active] = { ...(m[active]||{}), items: arr };
      return m;
    });
  };

  const removeRow = (i) => {
    setPagosMap(prev => {
      const m = { ...prev };
      const arr = [...(m[active]?.items || [])];
      arr.splice(i,1);
      m[active] = { ...(m[active]||{}), items: arr };
      return m;
    });
  };

  const handlePickFile = (i) => {
    const el = document.getElementById(`pago-file-${active}-${i}`);
    if (el) el.click();
  };

  const handleFileChange = (i, e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (!okTypes.includes(file.type)) {
      Swal.fire('Formato no permitido', 'Solo PNG, JPG o PDF', 'warning');
      e.target.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      Swal.fire('Archivo muy grande', 'Máximo 8MB', 'warning');
      e.target.value = '';
      return;
    }
    setRow(i, 'fileBlob', file);
    setRow(i, 'fileName', file.name);
    setRow(i, 'fileMime', file.type);
    setRow(i, 'fileUrl', '');
  };

  const totalUtilizado = (state.items || []).reduce((s, r) => s + (parseFloat(r.monto || 0) || 0), 0);
  const kpiDepositos = Number(kpiDepositosBySuc[active] || 0);
  const cajaChicaDisponible = Number(cajaChicaBySuc[active] || 0);

  const sobranteBruto = kpiDepositos - totalUtilizado;
  const deficit = Math.min(0, sobranteBruto);
  const sobranteFinal = Math.max(0, sobranteBruto + (state.cajaChicaUsada || 0));
  const mostrarUsarCajaChica = deficit < 0;

  const usarCajaChica = async () => {
    const maxNecesario = Math.abs(deficit);
    const maxPermitido = Math.min(maxNecesario, cajaChicaDisponible);
    if (maxPermitido <= 0) return Swal.fire('Caja chica', 'No hay caja chica disponible', 'info');

    const { value } = await Swal.fire({
      title: 'Usar caja chica',
      input: 'number',
      inputLabel: `Necesario: ${money(maxNecesario)} · Disponible: ${money(cajaChicaDisponible)}`,
      inputAttributes: { min: '0', step: '0.01' },
      inputValue: maxPermitido.toFixed(2),
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      cancelButtonText: 'Cancelar',
      preConfirm: (raw) => {
        const v = parseFloat(raw || 0);
        if (isNaN(v) || v <= 0) return 'Ingresa un monto válido';
        if (v > maxPermitido) return `No puedes usar más de ${money(maxPermitido)}`;
        return v;
      }
    });
    if (!value || typeof value === 'string') return;

    setPagosMap(prev => {
      const m = { ...prev };
      m[active] = { ...(m[active]||{}), cajaChicaUsada: Number((m[active]?.cajaChicaUsada || 0) + value) };
      return m;
    });
    await Swal.fire({ icon: 'success', title: 'Caja chica aplicada', timer: 1000, showConfirmButton:false });
  };

  const openViewer = (url, mime, name) => setViewer({ open:true, url, mime:mime||'', name:name||'' });
  const closeViewer = () => setViewer({ open:false, url:'', mime:'', name:'' });

  const onSave = async () => {
    try {
      if (!active) return Swal.fire('Sucursal', 'Selecciona una sucursal', 'warning');
      if (!fecha) return Swal.fire('Fecha', 'Selecciona una fecha', 'warning');

      const items = state.items || [];
      if (!items.length) return Swal.fire('Pagos', 'Agrega al menos un pago', 'warning');

      // Subir adjuntos y limpiar payload
      const storage = getStorage();
      const folder = `pagos/${active}/${fecha}`;

      const ready = await Promise.all(items.map(async (r, i) => {
        const { fileBlob, ...rest } = r;
        if (fileBlob) {
          const safe = (r.fileName || fileBlob.name || `pago_${i}`).replace(/[^\w.\-]+/g, '_');
          const path = `${folder}/${Date.now()}_${i}_${safe}`;
          const fileRef = sRef(storage, path);
          await uploadBytes(fileRef, fileBlob,
            { contentType: r.fileMime || fileBlob.type || 'application/octet-stream' });
          const url = await getDownloadURL(fileRef);
          return { ...rest, fileUrl:url, fileName:safe, fileMime:(r.fileMime || fileBlob.type || '') };
        }
        return { ...rest };
      }));

      // Guardar documento de pagos
      const actor = { uid: me.uid, username: me.username };
      const payload = {
        fecha,
        sucursalId: active,
        items: ready,
        totalUtilizado,
        cajaChicaUsada: Number(state.cajaChicaUsada || 0),
        sobranteParaManana: sobranteFinal,
        createdBy: actor,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'pagos'), payload);

      // Descontar caja chica en sucursal
      const deltaCajaChica = -Number(state.cajaChicaUsada || 0);
      if (deltaCajaChica !== 0) {
        await updateDoc(doc(db, 'sucursales', active), { cajaChica: increment(deltaCajaChica) });
      }

      // Escribir override para KPI de depósitos del Home (se usa SOLO si hay pagos hoy)
      await updateDoc(doc(db, 'sucursales', active), { kpiDepositos: Number(sobranteFinal) });

      // Actualizar estados locales (refrescar caja y kpi en esta vista)
      setCajaChicaBySuc(prev => ({ ...prev, [active]: Number(prev[active] || 0) + deltaCajaChica }));
      setKpiDepositosBySuc(prev => ({ ...prev, [active]: Number(sobranteFinal) }));

      await Swal.fire({ icon:'success', title:'Pagos guardados', timer:1400, showConfirmButton:false });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message || 'No se pudo guardar.', 'error');
    }
  };

  return (
    <div className="rc-shell">
      <div className="rc-header">
        <div className="rc-header-left">
          <h1>Registrar Pagos</h1>

          <div className="rc-date" style={{ display:'grid', gap:8, gridTemplateColumns:'1fr 1fr', alignItems:'end' }}>
            {/* FECHA */}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label>Fecha</label>
              <input type="date" value={fecha} onChange={(e)=>setFecha(e.target.value)} />
            </div>

            {/* Acciones */}
            <div className="rc-tabs-actions" style={{ gridColumn:'1 / -1', display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
              <button type="button" className="rc-btn rc-btn-accent" onClick={onSave}>
                Guardar pagos
              </button>
              <button type="button" className="rc-btn rc-btn-outline" onClick={()=>setShowCatModal(true)}>
                Categorías
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PILS de sucursal (muestran UBICACIÓN) */}
      <div className="rc-tabs-row rc-tabs-attached">
        <div className="rc-tabs rc-tabs-browser" role="tablist" aria-label="Sucursales">
          {sucursales.map((s) => (
            <button
              key={s.id}
              className={`rc-tab ${active === s.id ? 'active' : ''}`}
              onClick={()=>setActiveSucursalId(s.id)}
              type="button"
              role="tab"
              aria-selected={active === s.id}
            >
              {branchLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI compacto */}
      <section className="rc-card" style={{ marginTop: 8 }}>
        <div className="rc-card-bd" style={{ display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
          <div>
            <div className="kpi-title">Sucursal</div>
            <div className="kpi-value" style={{ color:'var(--dark)' }}>{branchLabel(suc)}</div>
          </div>
          <div>
            <div className="kpi-title">Dinero para depósitos</div>
            <div className="kpi-value">{money(kpiDepositos)}</div>
          </div>
          <div>
            <div className="kpi-title">Caja chica disponible</div>
            <div className="kpi-value">{money(cajaChicaDisponible)}</div>
          </div>
          <div>
            <div className="kpi-title">Sobrante para mañana</div>
            <div className="kpi-value" style={{ color: sobranteFinal > 0 ? 'var(--accent)' : 'var(--dark)' }}>
              {money(sobranteFinal)}
            </div>
          </div>
        </div>
      </section>

      {/* TABLA */}
      <section className="rc-card">
        <div className="rc-card-hd"><h3>Asignar pagos</h3></div>
        <table className="rc-table">
          <colgroup>
            <col style={{width:'auto'}}/>
            <col style={{width:'160px'}}/>
            <col style={{width:'160px'}}/>
            <col style={{width:'200px'}}/>
            <col style={{width:'200px'}}/>
            <col style={{width:'120px'}}/>
          </colgroup>
        <thead>
          <tr>
            <th>Descripción</th>
            <th style={{textAlign:'center'}}>Monto a depositar</th>
            <th style={{textAlign:'center'}}>Ref</th>
            <th style={{textAlign:'center'}}>Img</th>
            <th style={{textAlign:'center'}}>Categoría</th>
            <th style={{textAlign:'center'}}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(!state.items || !state.items.length) && (
            <tr><td colSpan={6} className="rc-empty">Sin pagos</td></tr>
          )}
          {state.items?.map((r, i) => {
            const isPdf = (r.fileMime || '').includes('pdf');
            return (
              <tr key={`${active}-${i}`}>
                <td>
                  <input
                    className="rc-input"
                    placeholder="Descripción"
                    value={r.descripcion}
                    onChange={(e)=>setRow(i,'descripcion',e.target.value)}
                    style={{width:'100%'}}
                  />
                </td>
                <td>
                  <input
                    className="rc-input rc-qty no-spin"
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={r.monto ?? ''}
                    onChange={(e)=>setRow(i,'monto',e.target.value)}
                    onWheel={(e)=>e.currentTarget.blur()}
                    style={{width:'100%', textAlign:'center'}}
                  />
                </td>
                <td>
                  <input
                    className="rc-input"
                    placeholder="Referencia"
                    value={r.ref || ''}
                    onChange={(e)=>setRow(i,'ref',e.target.value)}
                    style={{width:'100%', textAlign:'center'}}
                  />
                </td>
                <td style={{textAlign:'center'}}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, flexWrap:'wrap' }}>
                    {r.fileUrl || r.fileBlob ? (
                      <>
                        <span style={{ fontSize:12, color:'var(--slate)' }}>
                          {isPdf ? 'PDF' : 'Imagen'}
                        </span>
                        <button className="rc-btn rc-btn-outline"
                          type="button"
                          onClick={()=>openViewer(r.fileUrl || '', r.fileMime || '', r.fileName || '')}
                          disabled={!r.fileUrl}
                        >
                          Ver
                        </button>
                      </>
                    ) : <span style={{ color:'var(--muted)' }}>—</span>}
                    <input
                      id={`pago-file-${active}-${i}`}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e)=>handleFileChange(i,e)}
                      style={{ display:'none' }}
                    />
                    <button className="rc-btn rc-btn-outline" type="button" onClick={()=>handlePickFile(i)}>
                      {r.fileUrl || r.fileBlob ? 'Cambiar' : 'Adjuntar'}
                    </button>
                  </div>
                </td>
                <td>
                  <select className="rc-input rc-select"
                    value={r.categoria}
                    onChange={(e)=>setRow(i,'categoria',e.target.value)}
                  >
                    {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </td>
                <td style={{textAlign:'center'}}>
                  <button className="rc-btn rc-btn-ghost" type="button" onClick={()=>removeRow(i)}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={1} style={{textAlign:'right', fontWeight:800, color:'var(--dark)'}}>Total utilizado</td>
            <td style={{textAlign:'right', fontWeight:800, color:'var(--dark)'}}>{money(totalUtilizado)}</td>
            <td colSpan={4}/>
          </tr>
          <tr>
            <td colSpan={1} style={{textAlign:'right', fontWeight:800, color:'var(--dark)'}}>Sobrante para mañana</td>
            <td style={{textAlign:'right', fontWeight:800, color: sobranteFinal >= 0 ? 'var(--accent)':'var(--dark)'}}>
              {money(sobranteFinal)}
            </td>
            <td colSpan={4} style={{ textAlign:'right' }}>
              {mostrarUsarCajaChica && (
                <button className="rc-btn rc-btn-primary" type="button" onClick={usarCajaChica}>
                  Usar caja chica
                </button>
              )}
              {state.cajaChicaUsada > 0 && (
                <span style={{ marginLeft:12, fontWeight:700, color:'var(--dark)' }}>
                  Se tomó de caja chica: {money(state.cajaChicaUsada)}
                </span>
              )}
            </td>
          </tr>
        </tfoot>
        </table>

        <div className="rc-gastos-actions" style={{ marginTop:10 }}>
          <button type="button" className="rc-btn rc-btn-outline" onClick={addRow}>+ Agregar pago</button>
        </div>
      </section>

      {/* Modales */}
      <CategoriasModal
        open={showCatModal}
        onClose={()=>setShowCatModal(false)}
        categorias={categorias}
        onChangeCategorias={(nextCats, oldName, newName) => {
          setCategorias(nextCats);
          if (oldName) {
            setPagosMap(prev => {
              const copy = { ...prev };
              Object.keys(copy).forEach(k => {
                copy[k].items = copy[k].items.map(it => (
                  it.categoria === oldName ? { ...it, categoria: (newName || nextCats[0] || 'Varios') } : it
                ));
              });
              return copy;
            });
          }
        }}
      />

      <AttachmentViewerModal
        open={viewer.open}
        url={viewer.url}
        mime={viewer.mime}
        name={viewer.name}
        onClose={closeViewer}
      />
    </div>
  );
}
