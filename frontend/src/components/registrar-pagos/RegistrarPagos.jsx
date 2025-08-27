// src/RegistrarPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, addDoc, getDoc, getDocs,
  doc, updateDoc, serverTimestamp, increment, onSnapshot
} from 'firebase/firestore';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import './RegistrarPagos.css';

import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import { auth, db } from '../../services/firebase';
import { todayISO as getTodayISO } from '../../utils/dates';

import CategoriasModal from '../registrar-cierre/CategoriasModal';
import AttachmentViewerModal from '../registrar-cierre/AttachmentViewerModal';

// ====== Helpers ======
const money = (v) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 }).format(Number(v) || 0);

const okTypes = ['image/png', 'image/jpeg', 'application/pdf'];
const n = (v) => {
  const x = typeof v === 'number' ? v : parseFloat(v || 0);
  return Number.isFinite(x) ? x : 0;
};

// ====== Componente ======
export default function RegistrarPagos() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const editId = sp.get('id') || null;
  const mode = (sp.get('mode') || '').toLowerCase();
  const isViewing = mode === 'view';
  const isEditingExisting = !!editId && mode === 'edit';

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

  // Para deltas al editar y snapshots
  const [originalDoc, setOriginalDoc] = useState(null);

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

  // Cargar sucursales + KPI + caja chica EN TIEMPO REAL
  useEffect(() => {
    if (!me.loaded) return;

    const colRef = collection(db, 'sucursales');
    const unsub = onSnapshot(colRef, (qs) => {
      // 1) Mapeo de sucursales
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

      if (!editId) {
        setActiveSucursalId(prev => prev || arr[0]?.id || null);
      }

      // 2) Caja chica + KPI desde el doc de sucursal (siempre en vivo)
      const caja = {};
      const kpi  = {};
      arr.forEach(s => {
        caja[s.id] = Number(s?.cajaChica || 0);
        kpi[s.id]  = Number(s?.kpiDepositos || 0);
      });

      // 3) Si vienes a VER un documento (mode=view), respeta el snapshot guardado SOLO para esa sucursal
      //    (Si estás editando, mejor usar el KPI vivo para que refleje cambios posteriores, p.ej. al borrar pagos/cuadres)
      if (isViewing && originalDoc?.sucursalId) {
        const sid = originalDoc.sucursalId;
        kpi[sid] = Number(originalDoc?.kpiDepositosAtSave ?? originalDoc?.sobranteParaManana ?? 0);
        if (typeof originalDoc?.cajaChicaDisponibleAtSave === 'number') {
          caja[sid] = Number(originalDoc.cajaChicaDisponibleAtSave);
        }
      }

      setKpiDepositosBySuc(kpi);
      setCajaChicaBySuc(caja);
    }, (err) => {
      console.error('onSnapshot sucursales:', err);
    });

    return () => unsub();
    // Importante: dependencias que realmente cambian el comportamiento del efecto
  }, [me.loaded, editId, isViewing, originalDoc?.sucursalId, originalDoc?.kpiDepositosAtSave, originalDoc?.sobranteParaManana, originalDoc?.cajaChicaDisponibleAtSave]);

  
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

  // Precarga cuando venimos de HistorialPagos: ?id=<doc>&mode=<view|edit>
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'pagos', editId));
        if (!snap.exists()) {
          await Swal.fire('No encontrado', 'El registro de pagos no existe.', 'warning');
          return;
        }
        const d = snap.data() || {};
        setOriginalDoc({ id: editId, ...d });

        // Fijar sucursal y fecha del documento
        setActiveSucursalId(d.sucursalId || null);
        setFecha(d.fecha || getTodayISO());

        // Asegurar slot
        setPagosMap(prev => {
          const copy = { ...prev };
          if (!copy[d.sucursalId]) {
            copy[d.sucursalId] = { items: [], cajaChicaUsada: 0 };
          }
          copy[d.sucursalId].items = (Array.isArray(d.items) ? d.items : []).map(it => ({
            descripcion: it.descripcion || '',
            monto: n(it.monto),
            ref: it.ref || '',
            categoria: it.categoria || 'Varios',
            fileUrl: it.fileUrl || '',
            fileName: it.fileName || '',
            fileMime: it.fileMime || '',
            fileBlob: null,
            filePreview: '',
            locked: false,
          }));
          copy[d.sucursalId].cajaChicaUsada = n(d.cajaChicaUsada);
          return copy;
        });

        // Forzar que el KPI muestre lo que se guardó en este documento (snapshot)
        const kpiVal = Number(d?.kpiDepositosAtSave ?? d?.sobranteParaManana ?? 0);
        setKpiDepositosBySuc(prev => ({ ...prev, [d.sucursalId]: kpiVal }));

        // Si guardaste snapshot de caja chica, úsalo para la UI en modo ver
        if (typeof d?.cajaChicaDisponibleAtSave === 'number') {
          setCajaChicaBySuc(prev => ({ ...prev, [d.sucursalId]: Number(d.cajaChicaDisponibleAtSave) }));
        }
      } catch (e) {
        console.error(e);
        Swal.fire('Error', e?.message || 'No se pudo cargar el registro.', 'error');
      }
    })();
  }, [editId]);

  // Derivados
  const active = activeSucursalId;
  const state = pagosMap[active] || { items:[], cajaChicaUsada:0 };
  const readOnly = isViewing;

  // Total utilizado
  const totalUtilizado = useMemo(
    () =>
      (state.items || []).reduce(
        (sum, it) => sum + (parseFloat(it.monto || 0) || 0),
        0
      ),
    [state.items]
  );

  if (!me.loaded) {
    return <div className="rc-tab-empty">Cargando permisos…</div>;
  }
  if (!isAdmin && !isViewing) {
    return <div className="rc-tab-empty">Solo administradores</div>;
  }

  const branchLabel = (s) => s?.ubicacion || s?.nombre || s?.id || '—';

  const setRow = (i, field, val) => {
    if (readOnly) return;
    setPagosMap(prev => {
      const m = { ...prev };
      const arr = [...(m[active]?.items || [])];
      arr[i] = { ...arr[i], [field]: val };
      m[active] = { ...(m[active]||{}), items: arr };
      return m;
    });
  };

  const addRow = () => {
    if (readOnly) return;
    setPagosMap(prev => {
      const m = { ...prev };
      const arr = [...(m[active]?.items || [])].map(x => ({ ...x, locked:true }));
      arr.push({
        descripcion:'', monto:'', ref:'', categoria: categorias[0] || 'Varios',
        fileBlob:null, filePreview:'', fileUrl:'', fileName:'', fileMime:'', locked:false
      });
      m[active] = { ...(m[active]||{}), items: arr };
      return m;
    });
  };

  const removeRow = (i) => {
    if (readOnly) return;
    setPagosMap(prev => {
      const m = { ...prev };
      const arr = [...(m[active]?.items || [])];
      arr.splice(i,1);
      m[active] = { ...(m[active]||{}), items: arr };
      return m;
    });
  };

  const handlePickFile = (i) => {
    if (readOnly) return;
    const el = document.getElementById(`pago-file-${active}-${i}`);
    if (el) el.click();
  };

  const handleFileChange = (i, e) => {
    if (readOnly) return;
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

    try {
      const prev = (pagosMap[active]?.items || [])[i]?.filePreview;
      if (prev) URL.revokeObjectURL(prev);
    } catch {}

    const preview = URL.createObjectURL(file);

    setRow(i, 'fileBlob', file);
    setRow(i, 'filePreview', preview);
    setRow(i, 'fileName', file.name);
    setRow(i, 'fileMime', file.type);
    setRow(i, 'fileUrl', '');
  };

  const clearFile = (i) => {
    const item = (pagosMap[active]?.items || [])[i];
    if (item?.filePreview) {
      try { URL.revokeObjectURL(item.filePreview); } catch {}
    }
    setRow(i, 'fileBlob', null);
    setRow(i, 'filePreview', '');
    setRow(i, 'fileMime', '');
    setRow(i, 'fileName', '');
    setRow(i, 'fileUrl', '');
  };

  const kpiDepositos = Number(kpiDepositosBySuc[active] || 0);
  const cajaChicaDisponible = Number(cajaChicaBySuc[active] || 0);

  const sobranteBruto = kpiDepositos - totalUtilizado;
  const deficit = Math.min(0, sobranteBruto);
  const sobranteFinal = Math.max(0, sobranteBruto + (state.cajaChicaUsada || 0));
  const mostrarUsarCajaChica = deficit < 0;

  const usarCajaChica = async () => {
    if (readOnly) return;
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

  // Guardar nuevo o actualizar existente
  const onSave = async () => {
    try {
      if (!active) return Swal.fire('Sucursal', 'Selecciona una sucursal', 'warning');
      if (!fecha) return Swal.fire('Fecha', 'Selecciona una fecha', 'warning');

      const items = state.items || [];
      if (!items.length) return Swal.fire('Pagos', 'Agrega al menos un pago', 'warning');

      const storage = getStorage();
      const folder = `pagos/${active}/${fecha}`;

      const ready = await Promise.all(items.map(async (r, i) => {
        const { fileBlob, filePreview, ...rest } = r;
        if (fileBlob) {
          const safe = (r.fileName || fileBlob.name || `pago_${i}`).replace(/[^\w.-]+/g, '_');
          const path = `${folder}/${Date.now()}_${i}_${safe}`;
          const fileRef = sRef(storage, path);
          await uploadBytes(
            fileRef,
            fileBlob,
            { contentType: r.fileMime || fileBlob.type || 'application/octet-stream' }
          );
          const url = await getDownloadURL(fileRef);
          return { ...rest, fileUrl:url, fileName:safe, fileMime:(r.fileMime || fileBlob.type || '') };
        }
        return { ...rest };
      }));

      const totalUtilizadoCalc = ready.reduce((s, it) => s + n(it.monto), 0);
      const cajaChicaUsada = n(state.cajaChicaUsada || 0);
      const sobranteParaManana = Math.max(0, (kpiDepositos - totalUtilizadoCalc) + cajaChicaUsada);

      const actor = { uid: me.uid, username: me.username };

      // snapshots visibles en ver/editar
      const kpiSnapshot = Number(kpiDepositos);              // lo que se ve en “Dinero para depósitos”
      const cajaChicaSnapshot = Number(cajaChicaDisponible); // disponible al guardar

      if (isEditingExisting) {
        const prevCaja = n(originalDoc?.cajaChicaUsada);
        const deltaCajaChica = -(cajaChicaUsada - prevCaja);

        await updateDoc(doc(db, 'pagos', editId), {
          fecha,
          sucursalId: active,
          items: ready,
          totalUtilizado: totalUtilizadoCalc,
          cajaChicaUsada,
          sobranteParaManana,
          // snapshots
          kpiDepositosAtSave: kpiSnapshot,
          cajaChicaDisponibleAtSave: cajaChicaSnapshot,
          updatedAt: serverTimestamp(),
          updatedBy: actor,
        });

        if (deltaCajaChica !== 0) {
          await updateDoc(doc(db, 'sucursales', active), { cajaChica: increment(deltaCajaChica) });
          setCajaChicaBySuc(prev => ({ ...prev, [active]: n(prev[active]) + deltaCajaChica }));
        }
        // después de guardar, el KPI base de sucursal pasa a ser el sobrante calculado
        await updateDoc(doc(db, 'sucursales', active), { kpiDepositos: Number(sobranteParaManana) });
        setKpiDepositosBySuc(prev => ({ ...prev, [active]: Number(sobranteParaManana) }));

        await Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Los pagos se guardaron correctamente.'
        });
        navigate('/Finanzas/HistorialPagos');
      } else {
        await addDoc(collection(db, 'pagos'), {
          fecha,
          sucursalId: active,
          items: ready,
          totalUtilizado: totalUtilizadoCalc,
          cajaChicaUsada,
          sobranteParaManana,
          // snapshots
          kpiDepositosAtSave: kpiSnapshot,
          cajaChicaDisponibleAtSave: cajaChicaSnapshot,
          createdBy: actor,
          createdAt: serverTimestamp(),
        });

        const deltaCajaChica = -cajaChicaUsada;
        if (deltaCajaChica !== 0) {
          await updateDoc(doc(db, 'sucursales', active), { cajaChica: increment(deltaCajaChica) });
        }
        // base KPI = sobrante para mañana
        await updateDoc(doc(db, 'sucursales', active), { kpiDepositos: Number(sobranteParaManana) });

        setCajaChicaBySuc(prev => ({ ...prev, [active]: Number(prev[active] || 0) + deltaCajaChica }));
        setKpiDepositosBySuc(prev => ({ ...prev, [active]: Number(sobranteParaManana) }));

         // ✅ Opción A: esperar el toast y luego redirigir
        await Swal.fire({ icon:'success', title:'Pagos guardados', timer:1200, showConfirmButton:false });
        navigate('/Finanzas/HistorialPagos');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message || 'No se pudo guardar.', 'error');
    }
  };

  const headerSuffix = isEditingExisting ? '(editando)' : isViewing ? '(viendo)' : '';

  return (
    <div className="rc-shell registrar-pagos">
      <div className="rc-header">
        <div className="rc-header-left">
          <h1>
            Registrar Pagos {headerSuffix && <span>{headerSuffix}</span>}
          </h1>
          <div className="rc-date" style={{ display:'grid', gap:8, gridTemplateColumns:'1fr 1fr', alignItems:'end' }}>
            {/* FECHA */}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e)=>setFecha(e.target.value)}
                disabled={readOnly}
                readOnly={readOnly}
              />
            </div>

            {/* Acciones */}
            <div className="rc-tabs-actions" style={{ gridColumn:'1 / -1', display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
              {!readOnly && (
                <button type="button" className="rc-btn rc-btn-accent" onClick={onSave}>
                  {isEditingExisting ? 'Actualizar pagos' : 'Guardar pagos'}
                </button>
              )}
              <button type="button" className="rc-btn rc-btn-outline" onClick={()=>setShowCatModal(true)} disabled={readOnly}>
                Categorías
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PILS de sucursal (muestran UBICACIÓN) */}
      <div className="rc-tabs-row rc-tabs-attached">
        <div
          className="rc-tabs rc-tabs-browser"
          role="tablist"
          aria-label="Sucursales"
          style={{ flexWrap:'nowrap' }}   /* refuerzo anti-colapso */
        >
          {sucursales.map((s) => (
            <button
              key={s.id}
              className={`rc-tab ${active === s.id ? 'active' : ''}`}
              onClick={()=>!readOnly && setActiveSucursalId(s.id)}
              type="button"
              role="tab"
              aria-selected={active === s.id}
              disabled={readOnly}
              title={readOnly ? 'Vista de solo lectura' : ''}
              style={{ flex:'0 0 auto' }} /* refuerzo anti-wrap */
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

        <table className="rc-table rc-gastos-table rc-pagos-table">
          <colgroup>
            <col style={{width:'200px'}}/>{/* Categoría */}
            <col style={{width:'auto'}}/>{/* Descripción */}
            <col style={{width:'140px'}}/>{/* Monto */}
            <col style={{width:'200px'}}/>{/* Ref */}
            <col style={{width:'180px'}}/>{/* Img */}
            <col style={{width:'120px'}}/>{/* Acciones */}
          </colgroup>

        <thead>
          <tr>
            <th style={{textAlign:'center'}}>Categoría</th>
            <th style={{textAlign:'center'}}>Descripción</th>
            <th style={{textAlign:'center'}}>Cantidad</th>
            <th style={{textAlign:'center'}}>No. de ref</th>
            <th style={{textAlign:'center'}}>Comprobante</th>
            <th style={{textAlign:'center'}}>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {(!state.items || !state.items.length) && (
            <tr><td colSpan={6} className="rc-empty">Sin pagos</td></tr>
          )}

          {state.items?.map((r, i) => {
            const isPdf = (r.fileMime || '').includes('pdf');
            const hasFile = !!(r.filePreview || r.fileUrl || r.fileBlob);
            return (
              <tr key={`${active}-${i}`}>

                {/* Categoría */}
                <td data-label="Categoría">
                  <select
                    className="rc-input rc-select"
                    value={r.categoria}
                    onChange={(e)=>setRow(i,'categoria',e.target.value)}
                    disabled={readOnly}
                  >
                    {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </td>

                {/* Descripción */}
                <td data-label="Descripción">
                  <input
                    className="rc-input rc-desc"
                    placeholder="Descripción"
                    value={r.descripcion}
                    onChange={(e)=>setRow(i,'descripcion',e.target.value)}
                    disabled={readOnly}
                    readOnly={readOnly}
                  />
                </td>

                {/* Monto */}
                <td data-label="Monto a depositar">
                  <input
                    className="rc-input rc-qty no-spin"
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={r.monto ?? ''}
                    onChange={(e)=>setRow(i,'monto',e.target.value)}
                    onWheel={(e)=>e.currentTarget.blur()}
                    disabled={readOnly}
                    readOnly={readOnly}
                  />
                </td>

                {/* Ref */}
                <td data-label="Ref">
                  <input
                    className="rc-input"
                    placeholder="Referencia"
                    value={r.ref || ''}
                    onChange={(e)=>setRow(i,'ref',e.target.value)}
                    disabled={readOnly}
                    readOnly={readOnly}
                  />
                </td>

                {/* Comprobante (Img/PDF) */}
                <td data-label="Comprobante" className="img-cell">
                  <div>
                    {hasFile ? (
                      <>
                        <button
                          className="rc-btn rc-btn-outline"
                          type="button"
                          onClick={()=>openViewer(r.filePreview || r.fileUrl || '', r.fileMime || '', r.fileName || '')}
                          disabled={!(r.filePreview || r.fileUrl)}
                          title="Ver comprobante"
                        >
                          {isPdf ? 'PDF' : 'Ver'}
                        </button>

                        {!readOnly && (
                          <>
                            <button className="rc-btn rc-btn-outline" type="button" onClick={()=>handlePickFile(i)}>
                              Cambiar
                            </button>
                            <button className="rc-btn rc-btn-ghost" type="button" onClick={()=>clearFile(i)}>
                              Quitar
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      !readOnly && (
                        <>
                          <input
                            id={`pago-file-${active}-${i}`}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e)=>handleFileChange(i,e)}
                            style={{ display:'none' }}
                            disabled={readOnly}
                          />
                          <button className="rc-btn rc-btn-outline" type="button" onClick={()=>handlePickFile(i)}>
                            Adjuntar
                          </button>
                        </>
                      )
                    )}
                  </div>
                </td>

                {/* Acciones */}
                <td data-label="Acciones" style={{textAlign:'center'}}>
                  <button className="rc-btn rc-btn-ghost" type="button" onClick={()=>removeRow(i)} disabled={readOnly}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <td></td>
            <td style={{ fontWeight:800, textAlign:'right', color:'var(--dark)' }}>
              Total utilizado
            </td>
            <td style={{ fontWeight:800, textAlign:'right', color:'var(--dark)' }}>
              {money(totalUtilizado)}
            </td>
            <td colSpan={4}></td>
          </tr>

          <tr>
            <td></td>
            <td style={{ fontWeight:800, textAlign:'right', color:'var(--dark)' }}>
              Sobrante para mañana
            </td>
            <td style={{ fontWeight:800, textAlign:'right', color: sobranteFinal >= 0 ? 'var(--accent)' : 'var(--dark)' }}>
              {money(sobranteFinal)}
            </td>
            <td colSpan={4} style={{ textAlign:'right' }}>
              {mostrarUsarCajaChica && !readOnly && (
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

        {!readOnly && (
          <div className="rc-gastos-actions" style={{ marginTop:10 }}>
            <button type="button" className="rc-btn rc-btn-outline" onClick={addRow}>+ Agregar pago</button>
          </div>
        )}
      </section>

      {/* Modales */}
      <CategoriasModal
        open={showCatModal}
        onClose={()=>setShowCatModal(false)}
        categorias={categorias}
        onChangeCategorias={(nextCats, oldName, newName) => {
          if (readOnly) return;
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
