import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './components/registrar-cierre/RegistrarCierre.css';
import AmexModal from './components/registrar-cierre/AmexModal';

import { todayISO } from './utils/dates';
import { n } from './utils/numbers';
import { useSucursales } from './hooks/useSucursales';
import { useRegistrarCierreTotals } from './hooks/useRegistrarCierreTotals';

import ArqueoGrid from './components/registrar-cierre/ArqueoGrid';
import CierreGrid from './components/registrar-cierre/CierreGrid';
import GastosList from './components/registrar-cierre/GastosList';
import ResumenPanel from './components/registrar-cierre/ResumenPanel';
import CajaChicaModal from './components/registrar-cierre/CajaChicaModal';
import CategoriasModal from './components/registrar-cierre/CategoriasModal';

const isAjusteCajaChica = (name) =>
  (name || '').toString().trim().toLowerCase() === 'ajuste de caja chica';

const getTotalAjusteCajaChica = (gastos) =>
  (gastos || []).reduce((s, g) => s + (isAjusteCajaChica(g.categoria) ? n(g.cantidad) : 0), 0);

const INIT_GASTO_CATEGORIAS = [
  'Varios',
  'Coca-cola',
  'Servicios',
  'Publicidad',
  'Gas y gasolina',
  'Transporte',
  'Mantenimiento',
  'Ajuste de caja chica',
];

/** 👇 Ahora cada caja lleva `apertura: 1000` por defecto */
const emptyArqueoCaja = () => ({
  q200: '',
  q100: '',
  q50: '',
  q20: '',
  q10: '',
  q5: '',
  q1: '',
  apertura: 1000,   // <— default
  tarjeta: '',
  motorista: '',
});

const emptyCierreCaja = () => ({
  efectivo: '',
  tarjeta: '',
  motorista: '',
});

/** Normaliza un arreglo de arqueo a 3 cajas y asegura apertura=1000 si falta */
const normalizeArqueo = (arr) => {
  const base = [emptyArqueoCaja(), emptyArqueoCaja(), emptyArqueoCaja()];
  const src = Array.isArray(arr) ? arr : [];
  return base.map((b, i) => {
    const fromDoc = src[i] || {};
    // si el doc no trae apertura, usamos 1000
    const apertura =
      fromDoc.apertura === 0 || Number.isFinite(+fromDoc.apertura)
        ? fromDoc.apertura
        : 1000;
    return { ...b, ...fromDoc, apertura };
  });
};

export default function RegistrarCierre() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const editId = sp.get('id') || null;
  const mode = (sp.get('mode') || '').toLowerCase();
  const isViewing = mode === 'view';
  const isEditingExisting = !!editId && mode === 'edit';
  const [originalDoc, setOriginalDoc] = useState(null);

  // Perfil usuario
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

  // Sucursales desde hook (puede que no traiga extras)
  const sucursales = useSucursales();

  // Filtrar sucursales visibles
  const sucursalesVisibles = useMemo(() => {
    if (!me.loaded) return [];
    return isAdmin ? sucursales : sucursales.filter((s) => s.id === me.sucursalId);
  }, [sucursales, me, isAdmin]);

  const [activeSucursalId, setActiveSucursalId] = useState(null);

  // Doc real de la sucursal activa (para extras)
  const [activeSucursalDoc, setActiveSucursalDoc] = useState(null);

  // Al cargar, fijar sucursal activa
  useEffect(() => {
    if (!me.loaded || !sucursalesVisibles.length) return;
    setActiveSucursalId((prev) => prev || sucursalesVisibles[0]?.id || null);
  }, [me.loaded, sucursalesVisibles]);

  // Cuando cambia la sucursal activa, leer SIEMPRE el doc real de Firestore
  useEffect(() => {
    (async () => {
      if (!activeSucursalId) { setActiveSucursalDoc(null); return; }
      try {
        const sSnap = await getDoc(doc(db, 'sucursales', activeSucursalId));
        setActiveSucursalDoc(sSnap.exists() ? { id: sSnap.id, ...sSnap.data() } : null);
      } catch (e) {
        console.error('No se pudo leer la sucursal activa:', e);
        setActiveSucursalDoc(null);
      }
    })();
  }, [activeSucursalId]);

  // American Express (detalle por sabores)
  const [showAmex, setShowAmex] = useState(false);
  const [amexItems, setAmexItems] = useState({});   // { sabor: cantidad }
  const [amexTotal, setAmexTotal] = useState(0);

  // Fecha
  const [fecha, setFecha] = useState(todayISO());

  // Estados principales
  const [arqueo, setArqueo] = useState([emptyArqueoCaja(), emptyArqueoCaja(), emptyArqueoCaja()]);
  const [cierre, setCierre] = useState([emptyCierreCaja(), emptyCierreCaja(), emptyCierreCaja()]);
  const [categorias, setCategorias] = useState(INIT_GASTO_CATEGORIAS);
  const [gastos, setGastos] = useState([
    {
      categoria: INIT_GASTO_CATEGORIAS[0],
      descripcion: '',
      cantidad: '',
      ref: '',
      locked: false,
      fileUrl: '',
      fileBlob: null,
      filePreview: '',
      fileMime: '',
      fileName: '',
    },
  ]);
  const [comentario, setComentario] = useState('');
  const [cajaChicaUsada, setCajaChicaUsada] = useState(0);
  const [faltantePagado, setFaltantePagado] = useState(0);

  // Pedidos Ya
  const [pedidosYaCantidad, setPedidosYaCantidad] = useState(0);

  // Cargar documento existente si aplica
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'cierres', editId));
        if (!snap.exists()) return;
        const d = snap.data() || {};
        setOriginalDoc(d);

        setActiveSucursalId(d.sucursalId || null);
        setFecha(d.fecha || todayISO);

        // 👇 Normalizamos arqueo a 3 cajas y forzamos apertura si no existe
        const arqNorm = normalizeArqueo(d.arqueo);
        setArqueo(arqNorm);

        setCierre(Array.isArray(d.cierre) && d.cierre.length ? d.cierre : [emptyCierreCaja(), emptyCierreCaja(), emptyCierreCaja()]);

        setGastos(Array.isArray(d.gastos) ? d.gastos : []);
        setCategorias(Array.isArray(d.categorias) && d.categorias.length ? d.categorias : INIT_GASTO_CATEGORIAS);

        setComentario(d.comentario || '');
        setCajaChicaUsada(n(d.cajaChicaUsada));
        setFaltantePagado(n(d.faltantePagado));

        const py = (d.extras && d.extras.pedidosYaCantidad != null)
          ? d.extras.pedidosYaCantidad
          : (d.pedidosYaCantidad != null ? d.pedidosYaCantidad : 0);
        setPedidosYaCantidad(n(py));

        // extras american express (si existiera)
        const ax = d.extras?.americanExpress;
        if (ax && typeof ax === 'object') {
          setAmexItems(ax.items || {});
          setAmexTotal(ax.total || 0);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [editId]);

  const [busy, setBusy] = useState(false);

  // Modales
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCajaChica, setShowCajaChica] = useState(false);

  // Sucursal activa según hook (solo para nombre y fallback de caja chica)
  const activeFromHook = useMemo(
    () => sucursales.find((s) => s.id === activeSucursalId) || null,
    [sucursales, activeSucursalId]
  );

  // Preferimos el doc real para caja chica y extras; caemos al hook si no llegó
  const cajaChicaDisponible = (activeSucursalDoc?.cajaChica ?? activeFromHook?.cajaChica) || 0;

  
  const totalAperturas = (arqueo || []).reduce((s, c) => s + (Number.isFinite(+c?.apertura) ? +c.apertura : 1000), 0);


  // === EXTRAS seguros y tolerantes a variantes ===
  const truthy = (v) =>
    v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');

  // Saca flags intentando varias rutas/alias y normaliza a boolean
  const resolveExtras = (srcA, srcB) => {
    const a = srcA || {};
    const b = srcB || {};
    const ax = a.extras || {};
    const bx = b.extras || {};

    const pedidosYa =
      truthy(ax.pedidosYa ?? a.pedidosYa ?? bx.pedidosYa ?? b.pedidosYa ?? ax.py ?? bx.py ?? ax.pedidos_y ?? bx.pedidos_y ?? false);

    const americanExpress =
      truthy(
        ax.americanExpress ??
          a.americanExpress ??
          bx.americanExpress ??
          b.americanExpress ??
          ax.amex ??
          bx.amex ??
          ax.american_express ??
          bx.american_express ??
          ax.ae ??
          bx.ae ??
          false
      );

    return { pedidosYa, americanExpress };
  };

  // Preferimos el doc real; b es el hook como respaldo
  const { pedidosYa: _py, americanExpress: _amex } = resolveExtras(activeSucursalDoc, activeFromHook);

  const showPedidosYaBtn = _py;
  const showAmexBtn = _amex;

  // Totales
  const { totals, flags } = useRegistrarCierreTotals({
    arqueo,
    cierre,
    gastos,
    cajaChicaUsada,
    faltantePagado,
  });
  const { faltanteEfectivo, faltantePorGastos } = totals;

  // Handlers
  const setArq = (idx, field, value) => {
    if (isViewing) return;
    setArqueo((prev) => {
      const copy = prev.map((c) => ({ ...c }));
      copy[idx][field] = value;
      return copy;
    });
  };

  const setCier = (idx, field, value) => {
    if (isViewing) return;
    setCierre((prev) => {
      const copy = prev.map((c) => ({ ...c }));
      copy[idx][field] = value;
      return copy;
    });
  };

  const addGasto = () => {
    if (isViewing) return;
    setGastos((g) => {
      const prevLocked = g.map((item) => ({ ...item, locked: true }));
      const nuevo = {
        categoria: categorias[0] || '',
        descripcion: '',
        cantidad: '',
        ref: '',
        locked: false,
        fileUrl: '',
        fileBlob: null,
        filePreview: '',
        fileMime: '',
        fileName: '',
      };
      return [...prevLocked, nuevo];
    });
  };

  const setGasto = (i, field, val) => {
    if (isViewing) return;
    setGastos((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], [field]: val };
      return c;
    });
  };

  const removeGasto = (i) => {
    if (isViewing) return;
    setGastos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleChangeCategorias = (nextCategorias, oldName, newName) => {
    if (isViewing) return;
    setCategorias(nextCategorias);
    if (oldName && newName) {
      setGastos((prev) => prev.map((g) => (g.categoria === oldName ? { ...g, categoria: newName } : g)));
    } else if (oldName && !newName) {
      const fallback = nextCategorias[0] || '';
      setGastos((prev) => prev.map((g) => (g.categoria === oldName ? { ...g, categoria: fallback } : g)));
    }
  };

  const handlePagarFaltante = async () => {
    if (!isAdmin) return Swal.fire('Solo administradores', 'No puedes pagar faltante.', 'info');
    if (isViewing) return Swal.fire('Solo lectura', 'No puedes pagar faltante en modo ver.', 'info');
    if (faltanteEfectivo <= 0) return;
    const confirmar = await Swal.fire({
      title: 'Pagar faltante',
      text: `Se sumará ${Number(faltanteEfectivo).toFixed(2)} al depósito.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, pagar',
      cancelButtonText: 'Cancelar',
    });
    if (confirmar.isConfirmed) {
      setFaltantePagado(faltanteEfectivo);
      await Swal.fire({ icon: 'success', title: 'Faltante pagado', text: `Se agregó Q ${faltanteEfectivo.toFixed(2)} al total a depositar.`, timer: 1400, showConfirmButton: false });
    }
  };

  const handlePedidosYa = async () => {
    if (isViewing) return;
    const { isConfirmed, value } = await Swal.fire({
      title: 'Ingresar cantidad vendida en Pedidos Ya',
      input: 'number',
      inputValue: (Number.isFinite(pedidosYaCantidad) && pedidosYaCantidad >= 0) ? pedidosYaCantidad : '',
      inputAttributes: { min: '0', step: '1', inputmode: 'numeric' },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      allowEscapeKey: true,
      inputValidator: (val) => {
        if (val === '' || val === null) return 'Ingresa un número entero';
        if (!/^\d+$/.test(String(val))) return 'Solo enteros (0, 1, 2, …)';
        return undefined;
      },
    });
    if (isConfirmed) {
      setPedidosYaCantidad(parseInt(value, 10));
      await Swal.fire({ icon: 'success', title: 'Guardado', timer: 900, showConfirmButton: false });
    }
  };

  const handleAmericanExpress = () => {
    if (isViewing) return;
    setShowAmex(true);
  };

  const onBack = () => navigate('/home/Ventas');

  // Validaciones
  const validate = () => {
    const activeNombre = activeSucursalDoc?.nombre ?? activeFromHook?.nombre;
    const activeId = activeSucursalDoc?.id ?? activeFromHook?.id;

    if (!activeId) {
      Swal.fire('Sucursal', 'Selecciona una sucursal en las pestañas.', 'warning');
      return false;
    }
    if (!isAdmin && me.loaded && me.sucursalId && activeId !== me.sucursalId) {
      Swal.fire('Permisos', 'Solo puedes registrar en tu sucursal asignada.', 'warning');
      return false;
    }
    if (!fecha) {
      Swal.fire('Fecha', 'Selecciona una fecha válida.', 'warning');
      return false;
    }
    if (n(cajaChicaUsada) > n(cajaChicaDisponible)) {
      Swal.fire('Caja chica', `No puedes usar más de lo disponible (Q ${Number(cajaChicaDisponible).toFixed(2)}).`, 'warning');
      return false;
    }
    return true;
  };

  const onSave = async () => {
    if (busy || isViewing) return;
    if (!validate()) return;

    setBusy(true);
    try {
      const cierresRef = collection(db, 'cierres');

      const sucId = activeSucursalDoc?.id ?? activeFromHook?.id;
      const sucNombre = activeSucursalDoc?.nombre ?? activeFromHook?.nombre;

      if (!isEditingExisting) {
        const fechaQ = query(cierresRef, where('fecha', '==', fecha));
        const snap = await getDocs(fechaQ);
        const existe = snap.docs.some((d) => (d.data()?.sucursalId || '') === sucId);
        if (existe) {
          await Swal.fire({ icon: 'warning', title: 'Ya existe un cuadre', text: `Ya hay un cuadre registrado para "${sucNombre}" en la fecha ${fecha}.` });
          return;
        }
      }

      const gastosListos = (gastos || []).map((g) => {
        const { fileBlob, filePreview, ...rest } = g;
        return { ...rest, fileUrl: '', fileName: '', fileMime: '' };
      });

      const payloadBase = {
        fecha,
        sucursalId: sucId,
        arqueo, // ya trae apertura por caja
        cierre,
        gastos: gastosListos,
        comentario,
        categorias,
        cajaChicaUsada,
        faltantePagado,
        extras: {
          pedidosYaCantidad: Number.isFinite(pedidosYaCantidad) ? parseInt(pedidosYaCantidad, 10) : 0,
          americanExpress: {
            items: amexItems,   // { sabor: cantidad }
            total: amexTotal,   // número
          },
        },
        totales: { ...totals },
      };

      if (isEditingExisting) {
        await updateDoc(doc(db, 'cierres', editId), { ...payloadBase, updatedAt: serverTimestamp() });

        const oldAjuste = getTotalAjusteCajaChica(originalDoc?.gastos || []);
        const newAjuste = getTotalAjusteCajaChica(gastos);
        const oldUsada = n(originalDoc?.cajaChicaUsada);
        const newUsada = n(cajaChicaUsada);
        const deltaCaja = -(newUsada - oldUsada) + (newAjuste - oldAjuste);
        if (deltaCaja !== 0) {
          await updateDoc(doc(db, 'sucursales', sucId), { cajaChica: increment(deltaCaja) });
        }

        await Swal.fire({ icon: 'success', title: 'Actualizado', text: 'El cuadre se actualizó correctamente.', timer: 1600, showConfirmButton: false });
      } else {
        await addDoc(cierresRef, { ...payloadBase, createdAt: serverTimestamp() });

        const ajustePositivo = getTotalAjusteCajaChica(gastos);
        const delta = -n(cajaChicaUsada) + n(ajustePositivo);
        if (delta !== 0) {
          await updateDoc(doc(db, 'sucursales', sucId), { cajaChica: increment(delta) });
        }

        await Swal.fire({ icon: 'success', title: 'Guardado', text: 'El cuadre se guardó correctamente.', timer: 1600, showConfirmButton: false });
      }
      navigate('/home/Ventas');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!me.loaded) {
    return (
      <div className="rc-shell">
        <div className="rc-header"><h1>Registrar cuadre</h1></div>
        <div className="rc-tab-empty">Cargando permisos…</div>
      </div>
    );
  }

  const hideAdminButtonsCss = !isAdmin ? `
    .hide-cats .rc-card-hd > .rc-btn.rc-btn-outline:last-child { display: none !important; }
    .hide-pay  .rc-res-item .rc-btn.rc-btn-primary { display: none !important; }
  ` : '';

  return (
    <div className="rc-shell">
      {hideAdminButtonsCss && <style>{hideAdminButtonsCss}</style>}

      <div className="rc-header">
        <div className="rc-header-left">
          <h1>Registrar cuadre {isEditingExisting ? '(editando)' : isViewing ? '(viendo)' : ''}</h1>
          <div className="rc-date">
            <label htmlFor="rc-fecha">Fecha</label>
            <input id="rc-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={isViewing} readOnly={isViewing} />
            <div className="rc-tabs-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!isViewing && (
                <>
                  <button type="button" className="rc-btn rc-btn-accent" onClick={onSave} disabled={busy} title={isEditingExisting ? 'Actualizar cuadre' : 'Guardar cuadre'}>
                    {busy ? 'Guardando…' : isEditingExisting ? 'Actualizar' : 'Guardar'}
                  </button>

                  {showPedidosYaBtn && (
                    <button type="button" className="rc-btn rc-btn-outline" onClick={handlePedidosYa} disabled={busy} title="Ingresar cantidad vendida en Pedidos Ya">
                      Pedidos Ya
                    </button>
                  )}

                  {showAmexBtn && (
                    <button type="button" className="rc-btn rc-btn-outline" onClick={handleAmericanExpress} disabled={busy} title="American Express">
                      American Express
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rc-actions">
          <button type="button" className="rc-btn rc-btn-primary" onClick={onBack} disabled={busy} title="Regresar a Ventas">
            Regresar a Ventas
          </button>
        </div>
      </div>

      {/* SUCURSALES */}
      <div className="rc-tabs-row rc-tabs-attached">
        <div className="rc-tabs rc-tabs-browser" role="tablist" aria-label="Sucursales">
          {sucursalesVisibles.map((s) => (
            <button
              key={s.id}
              className={`rc-tab ${(activeSucursalDoc?.id ?? activeFromHook?.id) === s.id ? 'active' : ''}`}
              onClick={() => {
                if (isViewing) return;
                if (!isAdmin && me.sucursalId && s.id !== me.sucursalId) return;
                setActiveSucursalId(s.id);
                setCajaChicaUsada(0);
                setFaltantePagado(0);
              }}
              type="button"
              role="tab"
              aria-selected={(activeSucursalDoc?.id ?? activeFromHook?.id) === s.id}
              aria-controls={`panel-${s.id}`}
              id={`tab-${s.id}`}
              disabled={isViewing || (!isAdmin && me.sucursalId && s.id !== me.sucursalId)}
            >
              {s.nombre}
            </button>
          ))}
          {!sucursalesVisibles.length && <div className="rc-tab-empty">No hay sucursales disponibles</div>}
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="rc-grid">
        <ArqueoGrid
          arqueo={arqueo}
          setArq={setArq}
          cajaChicaDisponible={cajaChicaDisponible}
          readOnly={isViewing}
          extras={{
            showPedidosYaBtn,
            showAmexBtn,
            onPedidosYa: handlePedidosYa,
            onAmex: handleAmericanExpress,
            disabled: busy || isViewing,
          }}
        />

        {isAdmin && <CierreGrid cierre={cierre} setCier={setCier} readOnly={isViewing} />}
      </div>

      {/* GASTOS + RESUMEN */}
      <div className="rc-grid rc-grid-bottom">
        <GastosList
          gastos={gastos}
          categorias={categorias}
          setGasto={setGasto}
          addGasto={addGasto}
          removeGasto={removeGasto}
          showCategoriasBtn={isAdmin && !isViewing}
          onOpenCategorias={() => setShowCatModal(true)}
          onUseCajaChica={() => setShowCajaChica(true)}
          activeSucursalNombre={activeSucursalDoc?.nombre ?? activeFromHook?.nombre}
          cajaChicaDisponible={cajaChicaDisponible}
          faltantePorGastos={faltantePorGastos}
          readOnly={isViewing}
        />
      </div>

      <div className={isAdmin ? '' : 'hide-pay'}>


        <ResumenPanel
          totals={totals || {}}    
          flags={flags || {}} 
          cajaChicaUsada={cajaChicaUsada}
          onPagarFaltante={handlePagarFaltante}
          faltantePagado={faltantePagado}
          pedidosYaCantidad={pedidosYaCantidad}
          amexTotal={amexTotal}
          showPedidosYa={showPedidosYaBtn}
          showAmex={showAmexBtn}
          totalAperturas={totalAperturas}  
        />
      </div>

      {isAdmin && (
        <section className="rc-card">
          <h3>Comentario</h3>
          <div className="rc-comentario">
            <textarea id="rc-comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Agrega un comentario" rows={3} disabled={isViewing} readOnly={isViewing} />
          </div>
        </section>
      )}

      <CategoriasModal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        categorias={categorias}
        onChangeCategorias={handleChangeCategorias}
      />

      <CajaChicaModal
        open={showCajaChica}
        onClose={() => setShowCajaChica(false)}
        cajaChicaDisponible={cajaChicaDisponible}
        faltantePorGastos={faltantePorGastos}
        onApply={(monto) => { if (isViewing) return; setCajaChicaUsada((prev) => prev + monto); }}
      />

      <AmexModal
        open={showAmex}
        onClose={() => setShowAmex(false)}
        initialItems={amexItems}
        readOnly={isViewing}
        onSave={({ items, total }) => {
          setAmexItems(items);
          setAmexTotal(total);
          setShowAmex(false);
        }}
      />
    </div>
  );
}
