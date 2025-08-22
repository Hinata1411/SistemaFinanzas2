// src/RegistrarCierre.js
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

// Helpers para "Ajuste de caja chica"
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

const emptyArqueoCaja = () => ({
  q200: '',
  q100: '',
  q50: '',
  q20: '',
  q10: '',
  q5: '',
  q1: '',
  tarjeta: '',
  motorista: '',
});

const emptyCierreCaja = () => ({
  efectivo: '',
  tarjeta: '',
  motorista: '',
});

export default function RegistrarCierre() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const editId = sp.get('id') || null;
  const mode = (sp.get('mode') || '').toLowerCase(); // 'edit' | 'view' | ''
  const isViewing = mode === 'view';
  const isEditingExisting = !!editId && mode === 'edit';
  const [originalDoc, setOriginalDoc] = useState(null);

  // ===== Perfil usuario (rol + sucursal asignada si viewer) =====
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

  // Sucursales
  const sucursales = useSucursales();
  // Sucursales visibles según rol
  const sucursalesVisibles = useMemo(() => {
    if (!me.loaded) return [];
    return isAdmin ? sucursales : sucursales.filter((s) => s.id === me.sucursalId);
  }, [sucursales, me, isAdmin]);

  const [activeSucursalId, setActiveSucursalId] = useState(null);

  // Al cargar rol/sucursales, fijar sucursal activa para viewer
  useEffect(() => {
    if (!me.loaded || !sucursalesVisibles.length) return;
    // Si ya hay activa, mantener; si no, fijar primera visible (o la asignada del viewer)
    setActiveSucursalId((prev) => prev || sucursalesVisibles[0]?.id || null);
  }, [me.loaded, sucursalesVisibles]);

  // Fecha
  const [fecha, setFecha] = useState(todayISO);

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
      // adjunto (solo memoria local; NO se sube ni guarda)
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

        setArqueo(
          Array.isArray(d.arqueo) && d.arqueo.length
            ? d.arqueo
            : [emptyArqueoCaja(), emptyArqueoCaja(), emptyArqueoCaja()]
        );
        setCierre(
          Array.isArray(d.cierre) && d.cierre.length
            ? d.cierre
            : [emptyCierreCaja(), emptyCierreCaja(), emptyCierreCaja()]
        );

        setGastos(Array.isArray(d.gastos) ? d.gastos : []);
        setCategorias(
          Array.isArray(d.categorias) && d.categorias.length ? d.categorias : INIT_GASTO_CATEGORIAS
        );

        setComentario(d.comentario || '');
        setCajaChicaUsada(n(d.cajaChicaUsada));
        setFaltantePagado(n(d.faltantePagado));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [editId]);

  const [busy, setBusy] = useState(false);

  // Modales
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCajaChica, setShowCajaChica] = useState(false);

  // Sucursal activa + caja chica
  const activeSucursal = useMemo(
    () => sucursales.find((s) => s.id === activeSucursalId) || null,
    [sucursales, activeSucursalId]
  );
  const cajaChicaDisponible = activeSucursal?.cajaChica || 0;

  // Totales
  const { totals, flags } = useRegistrarCierreTotals({
    arqueo,
    cierre,
    gastos,
    cajaChicaUsada,
    faltantePagado,
  });

  const { faltanteEfectivo, faltantePorGastos } = totals;

  // Handlers de edición
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

  // Bloqueo + alta de nuevo gasto
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

  // Categorías modal callback
  const handleChangeCategorias = (nextCategorias, oldName, newName) => {
    if (isViewing) return;
    setCategorias(nextCategorias);
    if (oldName && newName) {
      setGastos((prev) =>
        prev.map((g) => (g.categoria === oldName ? { ...g, categoria: newName } : g))
      );
    } else if (oldName && !newName) {
      const fallback = nextCategorias[0] || '';
      setGastos((prev) =>
        prev.map((g) => (g.categoria === oldName ? { ...g, categoria: fallback } : g))
      );
    }
  };

  // Pagar faltante (solo admin)
  const handlePagarFaltante = async () => {
    if (!isAdmin) {
      Swal.fire('Solo administradores', 'No puedes pagar faltante.', 'info');
      return;
    }
    if (isViewing) {
      Swal.fire('Solo lectura', 'No puedes pagar faltante en modo ver.', 'info');
      return;
    }
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
      await Swal.fire({
        icon: 'success',
        title: 'Faltante pagado',
        text: `Se agregó Q ${faltanteEfectivo.toFixed(2)} al total a depositar.`,
        timer: 1400,
        showConfirmButton: false,
      });
    }
  };

  // Navegación
  const onBack = () => navigate('/home/Ventas');

  // Guardar
  const validate = () => {
    if (!activeSucursal?.id) {
      Swal.fire('Sucursal', 'Selecciona una sucursal en las pestañas.', 'warning');
      return false;
    }
    // Viewer solo puede su sucursal asignada
    if (!isAdmin && me.loaded && me.sucursalId && activeSucursal.id !== me.sucursalId) {
      Swal.fire('Permisos', 'Solo puedes registrar en tu sucursal asignada.', 'warning');
      return false;
    }
    if (!fecha) {
      Swal.fire('Fecha', 'Selecciona una fecha válida.', 'warning');
      return false;
    }
    if (n(cajaChicaUsada) > n(cajaChicaDisponible)) {
      Swal.fire(
        'Caja chica',
        `No puedes usar más de lo disponible (Q ${Number(cajaChicaDisponible).toFixed(2)}).`,
        'warning'
      );
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

      // Si estás creando, valida duplicado (sucursal+fecha)
      if (!isEditingExisting) {
        const fechaQ = query(cierresRef, where('fecha', '==', fecha));
        const snap = await getDocs(fechaQ);
        const existe = snap.docs.some((d) => (d.data()?.sucursalId || '') === activeSucursal.id);
        if (existe) {
          await Swal.fire({
            icon: 'warning',
            title: 'Ya existe un cuadre',
            text: `Ya hay un cuadre registrado para "${activeSucursal.nombre}" en la fecha ${fecha}.`,
          });
          return;
        }
      }

      // SIN STORAGE: no subimos archivos; omitimos blobs/local preview
      const gastosListos = (gastos || []).map((g) => {
        const { fileBlob, filePreview, ...rest } = g;
        return {
          ...rest,
          fileUrl: '',
          fileName: '',
          fileMime: '',
        };
      });

      const payloadBase = {
        fecha,
        sucursalId: activeSucursal.id,
        arqueo,
        cierre,
        gastos: gastosListos,
        comentario,
        categorias,
        cajaChicaUsada,
        faltantePagado,
        totales: { ...totals },
      };

      if (isEditingExisting) {
        // === Actualizar existente (preservar createdAt) ===
        await updateDoc(doc(db, 'cierres', editId), {
          ...payloadBase,
          updatedAt: serverTimestamp(),
        });

        // Ajuste de caja chica: aplicar diferencia vs documento original
        const oldAjuste = getTotalAjusteCajaChica(originalDoc?.gastos || []);
        const newAjuste = getTotalAjusteCajaChica(gastos);
        const oldUsada = n(originalDoc?.cajaChicaUsada);
        const newUsada = n(cajaChicaUsada);
        const deltaCaja = -(newUsada - oldUsada) + (newAjuste - oldAjuste);
        if (deltaCaja !== 0) {
          const sucRef = doc(db, 'sucursales', activeSucursal.id);
          await updateDoc(sucRef, { cajaChica: increment(deltaCaja) });
        }

        await Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'El cuadre se actualizó correctamente.',
          timer: 1600,
          showConfirmButton: false,
        });
      } else {
        // === Crear nuevo ===
        await addDoc(cierresRef, {
          ...payloadBase,
          createdAt: serverTimestamp(),
        });

        // Actualizamos caja chica (como ya lo hacías)
        const ajustePositivo = getTotalAjusteCajaChica(gastos);
        const delta = -n(cajaChicaUsada) + n(ajustePositivo);
        if (delta !== 0) {
          const sucRef = doc(db, 'sucursales', activeSucursal.id);
          await updateDoc(sucRef, { cajaChica: increment(delta) });
        }

        await Swal.fire({
          icon: 'success',
          title: 'Guardado',
          text: 'El cuadre se guardó correctamente.',
          timer: 1600,
          showConfirmButton: false,
        });
      }
      navigate('/home/Ventas');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ===== Esperar perfil/sucursales =====
  if (!me.loaded) {
    return (
      <div className="rc-shell">
        <div className="rc-header"><h1>Registrar cuadre</h1></div>
        <div className="rc-tab-empty">Cargando permisos…</div>
      </div>
    );
  }

  // ===== CSS de ocultación para viewer (sin tocar componentes) =====
  // - Oculta el botón "Categorías" en Gastos (es el último botón del header de Gastos).
  // - Oculta el botón "Pagar faltante" dentro del Resumen.
  const hideAdminButtonsCss = !isAdmin ? `
    .hide-cats .rc-card-hd > .rc-btn.rc-btn-outline:last-child { display: none !important; }
    .hide-pay  .rc-res-item .rc-btn.rc-btn-primary { display: none !important; }
  ` : '';

  return (
    <div className="rc-shell">
      {/* estilos condicionales para ocultar botones si viewer */}
      {hideAdminButtonsCss && <style>{hideAdminButtonsCss}</style>}

      {/* HEADER (izquierda: título + fecha; derecha: regresar) */}
      <div className="rc-header">
        <div className="rc-header-left">
          <h1>
            Registrar cuadre {isEditingExisting ? '(editando)' : isViewing ? '(viendo)' : ''}
          </h1>
          <div className="rc-date">
            <label htmlFor="rc-fecha">Fecha</label>
            <input
              id="rc-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={isViewing}
              readOnly={isViewing}
            />
            <div className="rc-tabs-actions">
              {!isViewing && (
                <button
                  type="button"
                  className="rc-btn rc-btn-accent"
                  onClick={onSave}
                  disabled={busy}
                  title={isEditingExisting ? 'Actualizar cuadre' : 'Guardar cuadre'}
                >
                  {busy ? 'Guardando…' : isEditingExisting ? 'Actualizar' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rc-actions">
          <button
            type="button"
            className="rc-btn rc-btn-primary"
            onClick={onBack}
            disabled={busy}
            title="Regresar a Ventas"
          >
            Regresar a Ventas
          </button>
        </div>
      </div>

      {/* SUCURSALES (tabs pegadas) */}
      <div className="rc-tabs-row rc-tabs-attached">
        <div className="rc-tabs rc-tabs-browser" role="tablist" aria-label="Sucursales">
          {sucursalesVisibles.map((s) => (
            <button
              key={s.id}
              className={`rc-tab ${activeSucursal?.id === s.id ? 'active' : ''}`}
              onClick={() => {
                if (isViewing) return;
                // Si viewer, no permitir cambiar a otra distinta (por si hubiera 2 visibles por algún motivo)
                if (!isAdmin && me.sucursalId && s.id !== me.sucursalId) return;
                setActiveSucursalId(s.id);
                setCajaChicaUsada(0);
                setFaltantePagado(0);
              }}
              type="button"
              role="tab"
              aria-selected={activeSucursal?.id === s.id}
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
        />

        {/* Cierre de Sistema: solo admin */}
        {isAdmin && (
          <CierreGrid cierre={cierre} setCier={setCier} readOnly={isViewing} />
        )}
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
            activeSucursalNombre={activeSucursal?.nombre}
            cajaChicaDisponible={cajaChicaDisponible}
            faltantePorGastos={faltantePorGastos}
            readOnly={isViewing}
          />
        </div>

        {/* envolvemos Resumen con clase para ocultar 'Pagar faltante' si viewer */}
        <div className={isAdmin ? '' : 'hide-pay'}>
          <ResumenPanel
            totals={totals}
            flags={flags}
            cajaChicaUsada={cajaChicaUsada}
            onPagarFaltante={handlePagarFaltante} // si viewer, el botón no se ve por CSS
            faltantePagado={faltantePagado}
          />
        </div>

        {isAdmin && (
          <section className="rc-card">
            <h3>Comentario</h3>
            <div className="rc-comentario">
              <textarea
                id="rc-comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Agrega un comentario"
                rows={3}
                disabled={isViewing}
                readOnly={isViewing}
              />
            </div>
          </section>
        )}
        {/* MODAL Categorías */}
      <CategoriasModal
        open={showCatModal}
        onClose={() => setShowCatModal(false)}
        categorias={categorias}
        onChangeCategorias={handleChangeCategorias}
      />

      {/* MODAL Caja chica */}
      <CajaChicaModal
        open={showCajaChica}
        onClose={() => setShowCajaChica(false)}
        cajaChicaDisponible={cajaChicaDisponible}
        // ya incluye faltantePagado en el cálculo:
        faltantePorGastos={faltantePorGastos}
        onApply={(monto) => {
          if (isViewing) return;
          setCajaChicaUsada((prev) => prev + monto);
        }}
      />
        
      </div>
  )

      
}
