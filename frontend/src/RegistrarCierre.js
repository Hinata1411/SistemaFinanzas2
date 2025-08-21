// src/RegistrarCierre.js
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,   // 👈 importamos para validar duplicados
} from 'firebase/firestore';
import { db } from './firebase';
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

const INIT_GASTO_CATEGORIAS = [
  'Varios',
  'Coca-cola',
  'Servicios',
  'Publicidad',
  'Gas y gasolina',
  'Transporte',
  'Mantenimiento',
];

const emptyArqueoCaja = () => ({
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

  // Sucursales
  const sucursales = useSucursales();
  const [activeSucursalId, setActiveSucursalId] = useState(null);

  // Fecha
  const [fecha, setFecha] = useState(todayISO);

  // Estados principales
  const [arqueo, setArqueo] = useState([emptyArqueoCaja(), emptyArqueoCaja(), emptyArqueoCaja()]);
  const [cierre, setCierre] = useState([emptyCierreCaja(), emptyCierreCaja(), emptyCierreCaja()]);
  const [categorias, setCategorias] = useState(INIT_GASTO_CATEGORIAS);
  const [gastos, setGastos] = useState([{ categoria: INIT_GASTO_CATEGORIAS[0], descripcion: '', cantidad: '' }]);
  const [comentario, setComentario] = useState('');
  const [cajaChicaUsada, setCajaChicaUsada] = useState(0);
  const [faltantePagado, setFaltantePagado] = useState(0);

  const [busy, setBusy] = useState(false);

  // Modales
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCajaChica, setShowCajaChica] = useState(false);

  // Sucursal activa + caja chica
  const activeSucursal = useMemo(
    () => sucursales.find((s) => s.id === (activeSucursalId || (sucursales[0]?.id || null))) || null,
    [sucursales, activeSucursalId]
  );
  const cajaChicaDisponible = activeSucursal?.cajaChica || 0;

  // Totales centralizados
  const { totals, flags } = useRegistrarCierreTotals({
    arqueo,
    cierre,
    gastos,
    cajaChicaUsada,
    faltantePagado,
  });

  const {
    totalArqueoEfectivo,
    totalGastos,
    faltanteEfectivo,
    faltantePorGastos,
  } = totals;

  // Handlers de edición
  const setArq = (idx, field, value) => {
    setArqueo((prev) => {
      const copy = prev.map((c) => ({ ...c }));
      copy[idx][field] = value;
      return copy;
    });
  };
  const setCier = (idx, field, value) => {
    setCierre((prev) => {
      const copy = prev.map((c) => ({ ...c }));
      copy[idx][field] = value;
      return copy;
    });
  };
  const addGasto = () =>
    setGastos((g) => [...g, { categoria: categorias[0] || '', descripcion: '', cantidad: '' }]);
  const setGasto = (i, field, val) =>
    setGastos((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], [field]: val };
      return c;
    });
  const removeGasto = (i) => setGastos((prev) => prev.filter((_, idx) => idx !== i));

  // Categorías modal callback: también re-mapea gastos si editas/eliminás
  const handleChangeCategorias = (nextCategorias, oldName, newName) => {
    setCategorias(nextCategorias);
    if (oldName && newName) {
      // Renombrar
      setGastos((prev) => prev.map((g) => (g.categoria === oldName ? { ...g, categoria: newName } : g)));
    } else if (oldName && !newName) {
      // Eliminación
      const fallback = nextCategorias[0] || '';
      setGastos((prev) => prev.map((g) => (g.categoria === oldName ? { ...g, categoria: fallback } : g)));
    }
  };

  // Abrir / aplicar caja chica (modal React)
  const openCajaChica = () => setShowCajaChica(true);
  const applyCajaChica = (monto) => setCajaChicaUsada((prev) => prev + monto);

  // Pagar faltante
  const handlePagarFaltante = async () => {
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
    if (!fecha) {
      Swal.fire('Fecha', 'Selecciona una fecha válida.', 'warning');
      return false;
    }
    return true;
  };

  const onSave = async () => {
    if (busy) return;
    if (!validate()) return;

    setBusy(true);
    try {
      // 🔎 Validación: un cuadre por sucursal por fecha
      // Buscamos por fecha y luego filtramos por sucursalId (evita índice compuesto)
      const cierresRef = collection(db, 'cierres');
      const fechaQ = query(cierresRef, where('fecha', '==', fecha));
      const snap = await getDocs(fechaQ);
      const existe = snap.docs.some((d) => (d.data()?.sucursalId || '') === activeSucursal.id);

      if (existe) {
        await Swal.fire({
          icon: 'warning',
          title: 'Ya existe un cuadre',
          text: `Ya hay un cuadre registrado para "${activeSucursal.nombre}" en la fecha ${fecha}.`,
        });
        return; // 👈 no guardamos
      }

      const payload = {
        fecha,
        sucursalId: activeSucursal.id,
        arqueo,
        cierre,
        gastos,
        comentario,
        categorias,
        cajaChicaUsada,
        faltantePagado,
        totales: totals,
        createdAt: serverTimestamp(),
      };
      await addDoc(cierresRef, payload);

      await Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: 'El cuadre se guardó correctamente.',
        timer: 1600,
        showConfirmButton: false,
      });
      navigate('/home/Ventas');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rc-shell">
      {/* HEADER */}
      <div className="rc-header">
        <h1>Registrar cuadre</h1>
        <div className="rc-header-right">
          <div className="rc-date">
            <label htmlFor="rc-fecha">Fecha</label>
            <input
              id="rc-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="rc-tabs" role="tablist" aria-label="Sucursales">
            {sucursales.map((s) => (
              <button
                key={s.id}
                className={`rc-tab ${activeSucursal?.id === s.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveSucursalId(s.id);
                  setCajaChicaUsada(0);   // resetea uso de caja chica al cambiar sucursal
                  setFaltantePagado(0);   // resetea pago de faltante (si aplica por sucursal)
                }}
                type="button"
                role="tab"
                aria-selected={activeSucursal?.id === s.id}
                aria-controls={`panel-${s.id}`}
                id={`tab-${s.id}`}
              >
                {s.nombre}
              </button>
            ))}
            {!sucursales.length && <div className="rc-tab-empty">No hay sucursales</div>}
          </div>

          <button
            type="button"
            className="rc-btn rc-btn-outline"
            onClick={onBack}
            disabled={busy}
            title="Regresar a Ventas"
          >
            Regresar a Ventas
          </button>

          <button
            type="button"
            className="rc-btn rc-btn-primary"
            onClick={onSave}
            disabled={busy}
            title="Guardar cuadre"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="rc-grid">
        <ArqueoGrid arqueo={arqueo} setArq={setArq} />
        <CierreGrid cierre={cierre} setCier={setCier} />
      </div>

      {/* GASTOS + RESUMEN */}
      <div className="rc-grid rc-grid-bottom">
        <GastosList
          gastos={gastos}
          categorias={categorias}
          setGasto={setGasto}
          addGasto={addGasto}
          removeGasto={removeGasto}
          onOpenCategorias={() => setShowCatModal(true)}
        />

        <ResumenPanel
          totals={totals}
          flags={flags}
          cajaChicaUsada={cajaChicaUsada}
          onUseCajaChica={() => setShowCajaChica(true)}
          onPagarFaltante={handlePagarFaltante}
          faltantePagado={faltantePagado}
          activeSucursalNombre={activeSucursal?.nombre}
          cajaChicaDisponible={cajaChicaDisponible}
        />

        <section className="rc-card">
          <h3>Comentario</h3>
          <div className="rc-comentario">
            <textarea
              id="rc-comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Agrega un comentario"
              rows={3}
            />
          </div>
        </section>

      </div>

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
        // OJO: ya incluye faltantePagado en el cálculo:
        faltantePorGastos={faltantePorGastos}
        onApply={applyCajaChica}
      />
    </div>
  );
}
