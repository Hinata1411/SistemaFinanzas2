// src/RegistrarPagos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { auth, db } from './firebase';
import { n, toMoney } from './utils/numbers';
import { todayISO } from './utils/dates';

import CategoriasModal from './components/registrar-cierre/CategoriasModal';
import AttachmentViewerModal from './components/registrar-cierre/AttachmentViewerModal';

// ===== Helpers / defaults =====
const INIT_CATS = [
  'Pagos de servicios',
  'Proveedor',
  'Nómina',
  'Transporte',
  'Publicidad',
  'Mantenimiento',
  'Varios',
];

const money = (x) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(x || 0));

const branchLabel = (s) => s?.ubicacion || s?.nombre || s?.id || '—';

// Extrae “Total a depositar” como en Finanzas (robusto con alias)
const nnum = (v) => (typeof v === 'number' ? v : parseFloat(v || 0)) || 0;
const extractTotalADepositar = (d) => {
  const t = d?.totales || {};
  const fromTotalsGeneral =
    t?.totalGeneral ??
    t?.total_general ??
    null;

  if (fromTotalsGeneral != null && !isNaN(fromTotalsGeneral)) {
    const val = nnum(fromTotalsGeneral);
    if (val !== 0) return val;
  }

  const aliases =
    d?.totalADepositar ??
    d?.total_a_depositar ??
    d?.totalDepositar ??
    d?.total_depositar ??
    t?.totalADepositar ??
    t?.total_a_depositar ??
    t?.totalDepositar ??
    t?.total_depositar ??
    t?.depositoEfectivo ??
    t?.efectivoParaDepositos ??
    t?.efectivo_para_depositos ??
    t?.totalDeposito ??
    t?.total_deposito ??
    null;

  if (aliases != null && !isNaN(aliases)) {
    const val = nnum(aliases);
    if (val !== 0) return val;
  }

  if (Array.isArray(d?.cierre) && d.cierre.length) {
    return d.cierre.reduce((acc, c) => acc + nnum(c?.efectivo), 0);
  }
  if (Array.isArray(d?.arqueo) && d.arqueo.length) {
    return d.arqueo.reduce((acc, c) => acc + nnum(c?.efectivo), 0);
  }
  return 0;
};

export default function RegistrarPagos() {
  // ===== Perfil (solo admin) =====
  const [me, setMe] = useState({ loaded: false, role: 'viewer', username: '' });
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMe({ loaded: true, role: 'viewer', username: '' });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const data = snap.exists() ? snap.data() : {};
        setMe({
          loaded: true,
          role: data.role || 'viewer',
          username: data.username || '',
        });
      } catch {
        setMe({ loaded: true, role: 'viewer', username: '' });
      }
    });
    return () => unsub();
  }, []);
  const isAdmin = me.role === 'admin';

  // ===== Sucursales (por ubicación) =====
  const [sucursales, setSucursales] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const qs = await getDocs(collection(db, 'sucursales'));
        const list = qs.docs.map((snap) => {
          const d = snap.data() || {};
          return {
            id: snap.id,
            nombre: d.nombre || d.name || snap.id,
            ubicacion: d.ubicacion || d.location || '',
            cajaChica: Number(d.cajaChica || 0),
          };
        });
        setSucursales(list);
      } catch (e) {
        console.error('Sucursales:', e);
        setSucursales([]);
      }
    })();
  }, []);

  const orderedSucursales = useMemo(
    () => [...sucursales].sort((a, b) =>
      branchLabel(a).localeCompare(branchLabel(b), 'es', { sensitivity: 'base' })),
    [sucursales]
  );

  const [activeSucursalId, setActiveSucursalId] = useState(null);
  const activeSucursal = useMemo(
    () => orderedSucursales.find(s => s.id === activeSucursalId) || orderedSucursales[0] || null,
    [orderedSucursales, activeSucursalId]
  );
  useEffect(() => {
    if (!activeSucursalId && orderedSucursales.length) {
      setActiveSucursalId(orderedSucursales[0].id);
    }
  }, [orderedSucursales, activeSucursalId]);

  // ===== Fecha de trabajo =====
  const [fecha, setFecha] = useState(todayISO());

  // ===== KPI "Dinero de ventas disponible" (cierres de la fecha por sucursal) - menos lo ya asignado =====
  const [ventasDelDia, setVentasDelDia] = useState(0);          // total a depositar del día (cierres)
  const [pagosAsignadosPrevios, setPagosAsignadosPrevios] = useState(0); // ya registrados antes
  const [cajaChicaDisponible, setCajaChicaDisponible] = useState(0);

  useEffect(() => {
    (async () => {
      if (!activeSucursal) {
        setVentasDelDia(0);
        setPagosAsignadosPrevios(0);
        setCajaChicaDisponible(0);
        return;
      }
      const sucId = activeSucursal.id;

      // 1) KPI ventas del día (sumando total a depositar desde cierres por sucursal y fecha)
      try {
        const cierresRef = collection(db, 'cierres');
        const qRef = query(cierresRef, where('sucursalId', '==', sucId), where('fecha', '==', fecha));
        const snap = await getDocs(qRef);
        let sum = 0;
        snap.docs.forEach(d => { sum += extractTotalADepositar(d.data() || {}); });
        setVentasDelDia(sum);
      } catch {
        setVentasDelDia(0);
      }

      // 2) Pagos ya asignados para esa fecha/sucursal
      try {
        const pagosRef = collection(db, 'registrarPagos');
        const pq = query(pagosRef, where('sucursalId', '==', sucId), where('fecha', '==', fecha));
        const psnap = await getDocs(pq);
        let totalPrevio = 0;
        psnap.docs.forEach(s => {
          const d = s.data() || {};
          const t = Number(d.totalUtilizado || 0);
          totalPrevio += isNaN(t) ? 0 : t;
        });
        setPagosAsignadosPrevios(totalPrevio);
      } catch {
        setPagosAsignadosPrevios(0);
      }

      // 3) Caja chica disponible (en doc sucursal)
      try {
        const sSnap = await getDoc(doc(db, 'sucursales', sucId));
        const d = sSnap.exists() ? (sSnap.data() || {}) : {};
        setCajaChicaDisponible(Number(d.cajaChica || 0));
      } catch {
        setCajaChicaDisponible(0);
      }
    })();
  }, [activeSucursal, fecha]);

  const ventasDisponibles = Math.max(0, ventasDelDia - pagosAsignadosPrevios);

  // ===== Categorías =====
  const [categorias, setCategorias] = useState(INIT_CATS);
  const [showCatModal, setShowCatModal] = useState(false);
  const handleChangeCategorias = (nextCategorias, oldName, newName) => {
    setCategorias(nextCategorias);
    // si renombraste/eliminaste, no tocamos filas existentes (opcional)
  };

  // ===== Items de la tabla =====
  const [items, setItems] = useState([
    {
      descripcion: '',
      monto: '',
      ref: '',
      categoria: INIT_CATS[0],
      fileBlob: null,
      filePreview: '',
      fileUrl: '',
      fileName: '',
      fileMime: '',
    },
  ]);

  const addItem = () => {
    setItems(prev => ([
      ...prev.map(it => ({ ...it })), // sin lock; puedes agregar si quieres
      {
        descripcion: '',
        monto: '',
        ref: '',
        categoria: categorias[0] || '',
        fileBlob: null,
        filePreview: '',
        fileUrl: '',
        fileName: '',
        fileMime: '',
      },
    ]));
  };

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const setItem = (i, field, val) =>
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });

  // Adjuntos
  const [viewer, setViewer] = useState({ open: false, url: '', mime: '', name: '' });
  const openViewer = (url, mime, name) => setViewer({ open: true, url, mime: mime || '', name: name || '' });
  const closeViewer = () => setViewer({ open: false, url: '', mime: '', name: '' });

  const handlePickFile = (i) => {
    const el = document.getElementById(`pago-file-${i}`);
    if (el) el.click();
  };

  const handleFileChange = (i, e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const okTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!okTypes.includes(file.type)) {
      Swal.fire('Formato no permitido', 'Solo PNG, JPG o PDF', 'warning');
      e.target.value = '';
      return;
    }
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      Swal.fire('Archivo muy grande', 'Máximo permitido: 8MB', 'warning');
      e.target.value = '';
      return;
    }
    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : '';
    setItem(i, 'fileBlob', file);
    setItem(i, 'filePreview', preview);
    setItem(i, 'fileMime', file.type);
    setItem(i, 'fileName', file.name);
    setItem(i, 'fileUrl', '');
  };

  // Totales
  const totalUtilizado = useMemo(
    () => (items || []).reduce((s, it) => s + n(it.monto), 0),
    [items]
  );

  // Sobrante y caja chica
  const [cajaChicaUsada, setCajaChicaUsada] = useState(0);
  const sobranteParaMananaBruto = ventasDisponibles - totalUtilizado; // puede ser negativo
  const sobranteParaMananaConCaja = sobranteParaMananaBruto >= 0
    ? sobranteParaMananaBruto
    : (sobranteParaMananaBruto + cajaChicaUsada);

  const usarCajaChica = async () => {
    const deficit = Math.abs(sobranteParaMananaBruto);
    if (deficit <= 0) return;
    if (cajaChicaDisponible <= 0) {
      return Swal.fire('Caja chica', 'No hay caja chica disponible en esta sucursal.', 'info');
    }
    const sugerido = Math.min(deficit, cajaChicaDisponible);
    const { value: montoStr } = await Swal.fire({
      title: 'Usar caja chica',
      input: 'number',
      inputAttributes: { step: '0.01', min: '0' },
      inputValue: Number(sugerido).toFixed(2),
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => {
        const x = parseFloat(v || '0');
        if (isNaN(x) || x <= 0) return 'Monto inválido';
        if (x > cajaChicaDisponible) return `No puedes usar más de ${money(cajaChicaDisponible)}`;
        return undefined;
      },
    });
    if (!montoStr) return;
    const monto = parseFloat(montoStr);
    setCajaChicaUsada((prev) => {
      const next = Number(prev || 0) + monto;
      if (next > cajaChicaDisponible) return cajaChicaDisponible; // clamp
      return next;
    });
  };

  // ===== Guardar =====
  const [busy, setBusy] = useState(false);
  const onSave = async () => {
    if (!isAdmin) {
      return Swal.fire('Solo administradores', 'No tienes permisos para registrar pagos.', 'info');
    }
    if (!activeSucursal) {
      return Swal.fire('Sucursal', 'Selecciona una sucursal válida.', 'warning');
    }
    if (!fecha) {
      return Swal.fire('Fecha', 'Selecciona una fecha válida.', 'warning');
    }
    if (totalUtilizado <= 0) {
      return Swal.fire('Validación', 'Agrega al menos un monto a depositar.', 'warning');
    }

    // Si aún con caja chica queda negativo, no permitir
    if (sobranteParaMananaConCaja < 0) {
      return Swal.fire(
        'Fondos insuficientes',
        'El total asignado excede lo disponible (aún usando caja chica). Reduce montos o usa más caja chica.',
        'warning'
      );
    }

    try {
      setBusy(true);

      // Subir adjuntos
      const storage = getStorage();
      const folder = `pagos/${activeSucursal.id}/${fecha}`;
      const itemsListos = await Promise.all(items.map(async (it, i) => {
        const { fileBlob, filePreview, ...rest } = it;
        if (fileBlob) {
          const safeName = (it.fileName || fileBlob.name || `pago_${i}`).replace(/[^\w.\-.]+/g, '_');
          const path = `${folder}/${Date.now()}_${i}_${safeName}`;
          const fileRef = sRef(storage, path);
          await uploadBytes(fileRef, fileBlob, {
            contentType: it.fileMime || fileBlob.type || 'application/octet-stream',
          });
          const url = await getDownloadURL(fileRef);
          return { ...rest, fileUrl: url, fileName: safeName, fileMime: it.fileMime || fileBlob.type || '' };
        }
        return { ...rest, fileUrl: it.fileUrl || '', fileName: it.fileName || '', fileMime: it.fileMime || '' };
      }));

      // Documento de pago
      const actor = {
        uid: auth.currentUser?.uid || null,
        username: me.username || '',
        email: auth.currentUser?.email || '',
      };

      const payload = {
        fecha,
        sucursalId: activeSucursal.id,
        sucursalUbicacion: activeSucursal.ubicacion || '',
        items: itemsListos,
        totalUtilizado,
        ventasDelDia,
        ventasDisponiblesAntes: ventasDisponibles,
        sobranteParaManana: Math.max(0, sobranteParaMananaConCaja),
        cajaChicaUsada: Number(cajaChicaUsada || 0),
        createdAt: serverTimestamp(),
        createdBy: actor,
      };

      await addDoc(collection(db, 'registrarPagos'), payload);

      // Actualizar caja chica de sucursal si se usó
      if (cajaChicaUsada > 0) {
        await updateDoc(doc(db, 'sucursales', activeSucursal.id), {
          cajaChica: increment(-Math.abs(cajaChicaUsada)),
        });
      }

      await Swal.fire({ icon: 'success', title: 'Pagos registrados', timer: 1400, showConfirmButton: false });

      // Reset básico
      setItems([{
        descripcion: '',
        monto: '',
        ref: '',
        categoria: categorias[0] || '',
        fileBlob: null,
        filePreview: '',
        fileUrl: '',
        fileName: '',
        fileMime: '',
      }]);
      setCajaChicaUsada(0);
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e?.message || 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!me.loaded) {
    return <div className="rc-tab-empty" style={{ padding: 16 }}>Cargando permisos…</div>;
  }
  if (!isAdmin) {
    return <div className="rc-tab-empty" style={{ padding: 16 }}>Solo administradores</div>;
  }

  return (
    <div className="rp-shell" style={{ display: 'grid', gap: 12 }}>
      {/* Header + filtros */}
      <section className="rc-card" style={{ padding: 14 }}>
        <div className="rc-card-hd" style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 auto' }}>
            <h2 style={{ margin: 0, color: 'var(--dark)' }}>Registrar Pagos</h2>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontWeight: 600, color: 'var(--dark-2)' }}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rc-input"
              style={{ minWidth: 180 }}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontWeight: 600, color: 'var(--dark-2)' }}>Categorías</label>
            <button className="rc-btn rc-btn-outline" onClick={() => setShowCatModal(true)}>
              Administrar categorías
            </button>
          </div>
        </div>

        {/* Píldoras de sucursal */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {orderedSucursales.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`rc-btn ${activeSucursal?.id === s.id ? 'rc-btn-accent' : 'rc-btn-outline'}`}
              onClick={() => setActiveSucursalId(s.id)}
              title={branchLabel(s)}
            >
              {branchLabel(s)}
            </button>
          ))}
        </div>
      </section>

      {/* KPIs */}
      <section className="rc-card" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="kpi-card" style={{ padding: 10 }}>
            <div className="kpi-title">Sucursal</div>
            <div className="kpi-value" style={{ fontWeight: 800 }}>{branchLabel(activeSucursal)}</div>
          </div>
          <div className="kpi-card" style={{ padding: 10 }}>
            <div className="kpi-title">Dinero de ventas disponible (hoy)</div>
            <div className="kpi-value">{money(ventasDisponibles)}</div>
          </div>
          <div className="kpi-card" style={{ padding: 10 }}>
            <div className="kpi-title">Caja chica disponible</div>
            <div className="kpi-value">{money(cajaChicaDisponible - cajaChicaUsada)}</div>
          </div>
        </div>
      </section>

      {/* Tabla de items */}
      <section className="rc-card" style={{ padding: 0 }}>
        <table className="rc-table" style={{ width: '100%' }}>
          {/* prettier-ignore */}
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Descripción</th>
              <th style={{ textAlign: 'center' }}>Monto a depositar</th>
              <th style={{ textAlign: 'center' }}>Ref</th>
              <th style={{ textAlign: 'center' }}>Img/PDF</th>
              <th style={{ textAlign: 'center' }}>Categoría</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="rc-empty">Sin pagos aún.</td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="rc-input"
                    placeholder="Descripción..."
                    value={it.descripcion}
                    onChange={(e) => setItem(i, 'descripcion', e.target.value)}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    className="rc-input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={it.monto}
                    onChange={(e) => setItem(i, 'monto', e.target.value)}
                    style={{ textAlign: 'center' }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    className="rc-input"
                    placeholder="Referencia"
                    value={it.ref || ''}
                    onChange={(e) => setItem(i, 'ref', e.target.value)}
                    style={{ textAlign: 'center' }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    id={`pago-file-${i}`}
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(i, e)}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button className="rc-btn rc-btn-outline" type="button" onClick={() => handlePickFile(i)}>
                      {it.fileBlob || it.fileUrl ? 'Cambiar' : 'Subir'}
                    </button>
                    {(it.filePreview || it.fileUrl) && (
                      <button
                        className="rc-btn rc-btn-ghost"
                        type="button"
                        onClick={() => openViewer(it.filePreview || it.fileUrl, it.fileMime, it.fileName)}
                        title="Ver adjunto"
                      >
                        Ver
                      </button>
                    )}
                    <button
                      className="rc-btn rc-btn-ghost"
                      type="button"
                      onClick={() => {
                        setItem(i, 'fileBlob', null);
                        setItem(i, 'filePreview', '');
                        setItem(i, 'fileUrl', '');
                        setItem(i, 'fileName', '');
                        setItem(i, 'fileMime', '');
                      }}
                      title="Quitar adjunto"
                    >
                      Quitar
                    </button>
                    <button
                      className="rc-btn rc-btn-ghost"
                      type="button"
                      onClick={() => removeItem(i)}
                      title="Eliminar fila"
                    >
                      ✕
                    </button>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <select
                    className="rc-input rc-select"
                    value={it.categoria || categorias[0] || ''}
                    onChange={(e) => setItem(i, 'categoria', e.target.value)}
                  >
                    {categorias.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dark)' }}>
                Total utilizado
              </td>
              <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--dark)' }}>
                {toMoney(totalUtilizado)}
              </td>
              <td colSpan={3} />
            </tr>
            <tr>
              <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dark)' }}>
                Sobrante para mañana
              </td>
              <td style={{
                textAlign: 'center',
                fontWeight: 800,
                color: sobranteParaMananaConCaja < 0 ? '#b91c1c' : 'var(--accent)',
              }}>
                {toMoney(Math.max(0, sobranteParaMananaConCaja))}
              </td>
              <td colSpan={3} style={{ textAlign: 'right' }}>
                {sobranteParaMananaBruto < 0 && (
                  <button className="rc-btn rc-btn-primary" type="button" onClick={usarCajaChica}>
                    Usar caja chica
                  </button>
                )}
                {cajaChicaUsada > 0 && (
                  <span style={{ marginLeft: 10, fontWeight: 700, color: 'var(--dark-2)' }}>
                    Se tomó de caja chica: {money(cajaChicaUsada)}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ padding: 12, display: 'flex', gap: 8 }}>
          <button type="button" className="rc-btn rc-btn-outline" onClick={addItem}>
            + Agregar fila
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="rc-btn rc-btn-accent"
            onClick={onSave}
            disabled={busy || !activeSucursal}
            title="Guardar pagos"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>

      {/* Modales */}
      <CategoriasModal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        categorias={categorias}
        onChangeCategorias={handleChangeCategorias}
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
