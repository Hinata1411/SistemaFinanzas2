// src/RegistrarCierre.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './RegistrarCierre.css';

/* ============================
   Helpers
============================ */
const todayISO = () => new Date().toISOString().slice(0, 10);
const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

const emptyArqueoCaja = () => ({
  q100: '', q50: '', q20: '', q10: '', q5: '', q1: '',
  tarjeta: '', motorista: '',
});
const emptyCierreCaja = () => ({
  efectivo: '', tarjeta: '', motorista: '',
});

export default function RegistrarCierre() {
  const navigate = useNavigate();

  // Tabs de sucursales
  const [sucursales, setSucursales] = useState([]); // [{id, nombre}]
  const [activeSucursalId, setActiveSucursalId] = useState(null);

  // Fecha
  const [fecha, setFecha] = useState(todayISO());

  // Arqueo (3 cajas)
  const [arqueo, setArqueo] = useState([
    emptyArqueoCaja(),
    emptyArqueoCaja(),
    emptyArqueoCaja(),
  ]);

  // Cierre de sistema (3 cajas)
  const [cierre, setCierre] = useState([
    emptyCierreCaja(),
    emptyCierreCaja(),
    emptyCierreCaja(),
  ]);

  // Gastos dinámicos
  const [gastos, setGastos] = useState([{ categoria: 'Caja chica', cantidad: '' }]);

  // Busy para evitar doble guardado
  const [busy, setBusy] = useState(false);

  // Carga sucursales para tabs
  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'sucursales'), orderBy('ubicacion', 'asc')));
      const list = snap.docs.map((d) => ({
        id: d.id,
        nombre: d.data().ubicacion || d.data().nombre || d.id,
      }));
      setSucursales(list);
      if (list.length && !activeSucursalId) setActiveSucursalId(list[0].id);
    };
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================
     Cálculos (memoizados)
  ============================ */
  const totalArqueoEfectivo = useMemo(() => {
    const perCaja = arqueo.map((c) =>
      100 * n(c.q100) +
      50 * n(c.q50) +
      20 * n(c.q20) +
      10 * n(c.q10) +
      5 * n(c.q5) +
      1 * n(c.q1)
    );
    return perCaja.reduce((a, b) => a + b, 0);
  }, [arqueo]);

  const totalArqueoTarjeta = useMemo(
    () => arqueo.reduce((s, c) => s + n(c.tarjeta), 0),
    [arqueo]
  );
  const totalArqueoMotorista = useMemo(
    () => arqueo.reduce((s, c) => s + n(c.motorista), 0),
    [arqueo]
  );

  const totalCierreEfectivo = useMemo(
    () => cierre.reduce((s, c) => s + n(c.efectivo), 0),
    [cierre]
  );
  const totalCierreTarjeta = useMemo(
    () => cierre.reduce((s, c) => s + n(c.tarjeta), 0),
    [cierre]
  );
  const totalCierreMotorista = useMemo(
    () => cierre.reduce((s, c) => s + n(c.motorista), 0),
    [cierre]
  );

  const totalGastos = useMemo(
    () => gastos.reduce((s, g) => s + n(g.cantidad), 0),
    [gastos]
  );

  // Diferencia simple: efectivo físico - efectivo sistema - gastos
  const diferenciaEfectivo = useMemo(
    () => totalArqueoEfectivo - totalCierreEfectivo - totalGastos,
    [totalArqueoEfectivo, totalCierreEfectivo, totalGastos]
  );

  const totalGeneral = useMemo(() => {
    // Ajusta esta fórmula si manejas más lógicas
    return (
      totalCierreEfectivo +
      totalCierreTarjeta +
      totalCierreMotorista -
      totalGastos
    );
  }, [totalCierreEfectivo, totalCierreTarjeta, totalCierreMotorista, totalGastos]);

  /* ============================
     Handlers UI
  ============================ */
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

  const addGasto = () => setGastos((g) => [...g, { categoria: '', cantidad: '' }]);
  const setGasto = (i, field, val) =>
    setGastos((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], [field]: val };
      return c;
    });
  const removeGasto = (i) => setGastos((prev) => prev.filter((_, idx) => idx !== i));

  const onBack = () => navigate('/home/Ventas'); // Ajusta si tu ruta difiere

  /* ============================
     Guardar
  ============================ */
  const validate = () => {
    if (!activeSucursalId) {
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

    try {
      setBusy(true);
      const payload = {
        fecha,
        sucursalId: activeSucursalId,
        arqueo,
        cierre,
        gastos,
        totales: {
          totalArqueoEfectivo,
          totalArqueoTarjeta,
          totalArqueoMotorista,
          totalCierreEfectivo,
          totalCierreTarjeta,
          totalCierreMotorista,
          totalGastos,
          diferenciaEfectivo,
          totalGeneral,
        },
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'cierres'), payload);
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

  /* ============================
     Render
  ============================ */
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

      {/* TABS: SUCURSALES */}
      <div className="rc-tabs" role="tablist" aria-label="Sucursales">
        {sucursales.map((s) => (
          <button
            key={s.id}
            className={`rc-tab ${activeSucursalId === s.id ? 'active' : ''}`}
            onClick={() => setActiveSucursalId(s.id)}
            type="button"
            role="tab"
            aria-selected={activeSucursalId === s.id}
            aria-controls={`panel-${s.id}`}
            id={`tab-${s.id}`}
          >
            {s.nombre}
          </button>
        ))}
        {!sucursales.length && (
          <div className="rc-tab-empty">No hay sucursales</div>
        )}
      </div>

      {/* GRID PRINCIPAL */}
      <div className="rc-grid">
        {/* Arqueo Físico */}
        <section
          className="rc-card"
          id={activeSucursalId ? `panel-${activeSucursalId}` : undefined}
          role="tabpanel"
          aria-labelledby={activeSucursalId ? `tab-${activeSucursalId}` : undefined}
        >
          <h3>Arqueo Físico</h3>
          <div className="rc-sheet rc-sheet-3cols">
            {[0, 1, 2].map((i) => (
              <div className="rc-col" key={`arq-${i}`}>
                <div className="rc-col-hd">Caja {i + 1}</div>

                {[
                  ['q100', 'Q 100'],
                  ['q50', 'Q 50'],
                  ['q20', 'Q 20'],
                  ['q10', 'Q 10'],
                  ['q5', 'Q 5'],
                  ['q1', 'Q 1'],
                ].map(([field, label]) => (
                  <div className="rc-row" key={field}>
                    <span className="rc-cell-label">{label}</span>
                    <input
                      className="rc-input"
                      inputMode="numeric"
                      value={arqueo[i][field]}
                      onChange={(e) => setArq(i, field, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}

                <div className="rc-row rc-row-sep" />

                <div className="rc-row">
                  <span className="rc-cell-label">Tarjeta</span>
                  <input
                    className="rc-input"
                    inputMode="numeric"
                    value={arqueo[i].tarjeta}
                    onChange={(e) => setArq(i, 'tarjeta', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="rc-row">
                  <span className="rc-cell-label">Motorista</span>
                  <input
                    className="rc-input"
                    inputMode="numeric"
                    value={arqueo[i].motorista}
                    onChange={(e) => setArq(i, 'motorista', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cierre de Sistema */}
        <section className="rc-card">
          <h3>Cierre de Sistema</h3>
          <div className="rc-sheet rc-sheet-3cols">
            {[0, 1, 2].map((i) => (
              <div className="rc-col" key={`cier-${i}`}>
                <div className="rc-col-hd">Caja {i + 1}</div>

                {[
                  ['efectivo', 'Efectivo'],
                  ['tarjeta', 'Tarjeta'],
                  ['motorista', 'Motorista'],
                ].map(([field, label]) => (
                  <div className="rc-row" key={field}>
                    <span className="rc-cell-label">{label}</span>
                    <input
                      className="rc-input"
                      inputMode="numeric"
                      value={cierre[i][field]}
                      onChange={(e) => setCier(i, field, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* GASTOS + RESUMEN */}
      <div className="rc-grid rc-grid-bottom">
        {/* Gastos */}
        <section className="rc-card">
          <h3>Gastos</h3>
          <div className="rc-gastos">
            {gastos.map((g, i) => (
              <div className="rc-gasto-row" key={i}>
                <input
                  className="rc-input"
                  placeholder="Categoría"
                  value={g.categoria}
                  onChange={(e) => setGasto(i, 'categoria', e.target.value)}
                />
                <input
                  className="rc-input"
                  placeholder="Cantidad"
                  inputMode="numeric"
                  value={g.cantidad}
                  onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
                />
                <button
                  type="button"
                  className="rc-btn rc-btn-ghost"
                  onClick={() => removeGasto(i)}
                  title="Eliminar gasto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="rc-gastos-actions">
            <button type="button" className="rc-btn rc-btn-outline" onClick={addGasto}>
              + Agregar gasto
            </button>
          </div>
        </section>

        {/* Resumen / Totales */}
        <section className="rc-card">
          <h3>Resumen</h3>
          <div className="rc-resumen">
            <div className="rc-res-item">
              <span>Efectivo (Arqueo)</span>
              <b>Q {totalArqueoEfectivo.toFixed(2)}</b>
            </div>
            <div className="rc-res-item">
              <span>Efectivo (Sistema)</span>
              <b>Q {totalCierreEfectivo.toFixed(2)}</b>
            </div>
            <div className="rc-res-item">
              <span>Gastos</span>
              <b>Q {totalGastos.toFixed(2)}</b>
            </div>
            <div className="rc-res-item diff">
              <span>Diferencia de efectivo</span>
              <b>Q {diferenciaEfectivo.toFixed(2)}</b>
            </div>
            <div className="rc-res-item total">
              <span>Total general</span>
              <b>Q {totalGeneral.toFixed(2)}</b>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}