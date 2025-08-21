// src/pages/ventas/components/DetalleCuadreModal.jsx
import React, { useEffect } from 'react';
import { totalEfectivoCaja, n } from '../../utils/numbers';

// CSS embebido para el modal (puedes moverlo a tu .css si prefieres)
const MODAL_CSS = `
  .modal-mask {
    position: fixed; inset: 0; background: rgba(0,0,0,.55);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; z-index: 1000;
  }
  .modal-card {
    background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,.25);
    width: min(1200px, 96vw); max-height: 96vh; display: flex; flex-direction: column; overflow: hidden;
  }
  .modal-card.modal-xl { width: min(1200px, 96vw); }
  .modal-hd {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #fff; position: sticky; top: 0; z-index: 2;
  }
  .modal-body {
    flex: 1; overflow: auto; -webkit-overflow-scrolling: touch; padding: 12px 16px;
  }
  .rc-shell { min-height: 100%; }
  .rc-card { background:#fff; border:1px solid #eef2f7; border-radius:12px; padding:12px; margin-bottom:12px; }
  .rc-sheet-3cols { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; }
  .rc-col-hd { font-weight:600; margin-bottom:8px; }
  .rc-row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px 0; }
  .rc-input { width: 140px; padding:8px; border:1px solid #e5e7eb; border-radius:8px; }
  .rc-total-caja b { font-size: 0.95rem; }
  .rc-resumen-grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:16px; }
  .rc-res-col .rc-res-title { font-weight:600; margin-bottom:8px; }
  .rc-res-item { display:flex; align-items:center; justify-content:space-between; margin:6px 0; }
  .rc-total-deposit { display:flex; align-items:center; justify-content:space-between; border-top:1px dashed #e5e7eb; margin-top:12px; padding-top:12px; }
  .rc-total-deposit.bad { color:#b71c1c; }
  .rc-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rc-field { display:flex; flex-direction: column; gap:6px; }
  .rc-select, .rc-date-input {
    padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;
  }

  @media (max-width: 640px) {
    .modal-mask { padding: 0; }
    .modal-card { border-radius: 0; width: 100vw; height: 100vh; max-height: none; }
    .modal-body { padding: 10px 12px; }
    .rc-sheet-3cols { grid-template-columns: 1fr; }
    .rc-resumen-grid { grid-template-columns: 1fr; }
    .rc-input { width: 100px; }
    .rc-header-grid { grid-template-columns: 1fr; }
  }
`;

export default function DetalleCuadreModal({
  visible, onClose, isEditing,
  fuente, // cuando isEditing == true, debería venir del estado editable (reducer/state)
  metrics, dispatch, sucursalesMap, sucursalesList = [],
  onGuardar, onEditarClick
}) {
  // Cerrar con ESC + Bloquear scroll del fondo cuando esté visible
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => (e.key === 'Escape') && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible, onClose]);

  if (!visible || !fuente) return null;

  // Datos base
  const arqueoData = fuente?.arqueo || [{}, {}, {}];
  const cierreData = fuente?.cierre || [{}, {}, {}];
  const gastosData = fuente?.gastos || [];
  const comentario = fuente?.comentario || '';
  const fechaValue = fuente?.fecha || '';
  const sucursalIdValue = fuente?.sucursalId || '';

  // Handlers con reducer: NO hacen nada si no está en edición
  const setArq = (idx, field, value) => { if (!isEditing) return; dispatch({ type:'FIELD_ARQUEO', idx, field, value }); };
  const setCier = (idx, field, value) => { if (!isEditing) return; dispatch({ type:'FIELD_CIERRE', idx, field, value }); };
  const setGasto = (i, field, value) => { if (!isEditing) return; dispatch({ type:'FIELD_GASTO', i, field, value }); };
  const setCampo = (key, value) => { if (!isEditing) return; dispatch({ type:'SET', key, value }); };

  // ====== CÁLCULOS LOCALES (usando EFECTIVO NETO) ======
  const totalArqEfBruto = (arqueoData || []).reduce((acc, c) => acc + totalEfectivoCaja(c || {}), 0);
  const totalAperturas  = (arqueoData || []).reduce((acc, c) => acc + n(c?.apertura ?? 1000), 0);
  const totalArqEfNeto  = totalArqEfBruto - totalAperturas;

  const totalArqTar = (arqueoData || []).reduce((s, c) => s + n(c?.tarjeta), 0);
  const totalArqMot = (arqueoData || []).reduce((s, c) => s + n(c?.motorista), 0);

  const totalCieEf  = (cierreData || []).reduce((s, c) => s + n(c?.efectivo), 0);
  const totalCieTar = (cierreData || []).reduce((s, c) => s + n(c?.tarjeta), 0);
  const totalCieMot = (cierreData || []).reduce((s, c) => s + n(c?.motorista), 0);

  const totalGastos = (gastosData || []).reduce((s, g) => s + n(g?.cantidad), 0);

  const cajaChicaUsada = n(fuente?.cajaChicaUsada);
  const faltantePagado = n(fuente?.faltantePagado);

  // Diferencia (Sobrante/Faltante) con EFECTIVO NETO
  const diferenciaNeta = totalArqEfNeto - totalCieEf;
  const diffEsPositivo = diferenciaNeta >= 0;
  const diffLabel = diffEsPositivo ? 'Sobrante' : 'Faltante';
  const diffAbs = Math.abs(diferenciaNeta);

  // Total a depositar con EFECTIVO NETO
  const totalGeneral = totalArqEfNeto - totalGastos + cajaChicaUsada + faltantePagado;
  const isDepositNegative = totalGeneral < 0;

  return (
    <div className="modal-mask" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card modal-xl" onClick={(e) => e.stopPropagation()}>
        <style>{MODAL_CSS}</style>

        {/* Header del modal (sticky) */}
        <div className="modal-hd">
          <h3 style={{ margin: 0 }}>{isEditing ? 'Editar cuadre' : 'Detalle del cuadre'}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isEditing && (
              <button className="btn" onClick={onEditarClick}>Editar</button>
            )}
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {/* Cuerpo con scroll interno */}
        <div className="modal-body">
          <div className="rc-shell">
            {/* Encabezado interno con Fecha y Sucursal */}
            <div className="rc-card" style={{ marginBottom: 12 }}>
              <div className="rc-header-grid">
                <div className="rc-field">
                  <label>Fecha</label>
                  <input
                    className="rc-date-input"
                    type="date"
                    value={fechaValue}
                    onChange={(e) => setCampo('fecha', e.target.value)}
                    disabled={!isEditing}
                    readOnly={!isEditing}
                  />
                </div>

                <div className="rc-field">
                  <label>Sucursal</label>
                  {isEditing ? (
                    <select
                      className="rc-select"
                      value={sucursalIdValue || ''}
                      onChange={(e) => setCampo('sucursalId', e.target.value)}
                    >
                      <option value="" disabled>Selecciona sucursal</option>
                      {sucursalesList.map((s) => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="rc-date-input"
                      value={sucursalesMap[sucursalIdValue] || 'Sucursal'}
                      disabled
                      readOnly
                    />
                  )}
                </div>
              </div>
            </div>

            {/* GRID PRINCIPAL */}
            <div className="rc-grid">
              {/* Arqueo Físico */}
              <section className="rc-card">
                <h3>Arqueo Físico</h3>
                <div className="rc-sheet rc-sheet-3cols">
                  {[0, 1, 2].map((i) => {
                    const c = arqueoData[i] || {};
                    const totalCaja = totalEfectivoCaja(c);
                    const apertura = n(c.apertura ?? 1000);
                    const totalMenosApertura = totalCaja - apertura;

                    return (
                      <div className="rc-col" key={`arq-${i}`}>
                        <div className="rc-col-hd">Caja {i + 1}</div>

                        {[
                          ['q100', 'Q 100'],
                          ['q50',  'Q 50'],
                          ['q20',  'Q 20'],
                          ['q10',  'Q 10'],
                          ['q5',   'Q 5' ],
                          ['q1',   'Q 1' ],
                        ].map(([field, label]) => (
                          <div className="rc-row" key={field}>
                            <span className="rc-cell-label">{label}</span>
                            <input
                              className="rc-input"
                              inputMode="numeric"
                              value={c[field] ?? ''}
                              onChange={(e) => setArq(i, field, e.target.value)}
                              placeholder="0.00"
                              disabled={!isEditing}
                              readOnly={!isEditing}
                            />
                          </div>
                        ))}

                        <div className="rc-row rc-total-caja">
                          <span className="rc-cell-label strong">Total de caja</span>
                          <b>Q {Number.isFinite(totalCaja) ? totalCaja.toFixed(2) : '0.00'}</b>
                        </div>

                        {/* 🔹 Apertura de caja (editable, default Q 1,000) */}
                        <div className="rc-row">
                          <span className="rc-cell-label">Apertura de caja</span>
                          <input
                            className="rc-input"
                            inputMode="numeric"
                            value={c.apertura ?? 1000}
                            onChange={(e) => setArq(i, 'apertura', e.target.value)}
                            placeholder="1000.00"
                            disabled={!isEditing}
                            readOnly={!isEditing}
                          />
                        </div>

                        {/* 🔹 Total menos apertura (solo lectura) */}
                        <div className="rc-row rc-total-caja">
                          <span className="rc-cell-label strong">Total menos apertura</span>
                          <b>Q {Number.isFinite(totalMenosApertura) ? totalMenosApertura.toFixed(2) : '0.00'}</b>
                        </div>

                        <div className="rc-row rc-row-sep" />

                        <div className="rc-row">
                          <span className="rc-cell-label">Tarjeta</span>
                          <input
                            className="rc-input"
                            inputMode="numeric"
                            value={c.tarjeta ?? ''}
                            onChange={(e) => setArq(i, 'tarjeta', e.target.value)}
                            placeholder="0.00"
                            disabled={!isEditing}
                            readOnly={!isEditing}
                          />
                        </div>
                        <div className="rc-row">
                          <span className="rc-cell-label">A domicilio (Motorista)</span>
                          <input
                            className="rc-input"
                            inputMode="numeric"
                            value={c.motorista ?? ''}
                            onChange={(e) => setArq(i, 'motorista', e.target.value)}
                            placeholder="0.00"
                            disabled={!isEditing}
                            readOnly={!isEditing}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Cierre de Sistema */}
              <section className="rc-card">
                <h3>Cierre de Sistema</h3>
                <div className="rc-sheet rc-sheet-3cols">
                  {[0, 1, 2].map((i) => {
                    const c = cierreData[i] || {};
                    return (
                      <div className="rc-col" key={`cier-${i}`}>
                        <div className="rc-col-hd">Caja {i + 1}</div>

                        {[
                          ['efectivo', 'Efectivo'],
                          ['tarjeta',  'Tarjeta'],
                          ['motorista','A domicilio (Motorista)'],
                        ].map(([field, label]) => (
                          <div className="rc-row" key={field}>
                            <span className="rc-cell-label">{label}</span>
                            <input
                              className="rc-input"
                              inputMode="numeric"
                              value={c[field] ?? ''}
                              onChange={(e) => setCier(i, field, e.target.value)}
                              placeholder="0.00"
                              disabled={!isEditing}
                              readOnly={!isEditing}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* GASTOS + RESUMEN */}
            <div className="rc-grid rc-grid-bottom">
              {/* Gastos */}
              <section className="rc-card">
                <h3>Gastos</h3>
                <div className="rc-gastos">
                  {gastosData.map((g, i) => (
                    <div className="rc-gasto-row" key={i}>
                      <input
                        className="rc-input rc-desc"
                        placeholder="Categoría"
                        value={g.categoria ?? ''}
                        onChange={(e) => setGasto(i, 'categoria', e.target.value)}
                        disabled={!isEditing}
                        readOnly={!isEditing}
                      />
                      <input
                        className="rc-input rc-desc"
                        placeholder="Descripción"
                        value={g.descripcion ?? ''}
                        onChange={(e) => setGasto(i, 'descripcion', e.target.value)}
                        disabled={!isEditing}
                        readOnly={!isEditing}
                      />
                      <input
                        className="rc-input rc-qty"
                        placeholder="Cantidad"
                        inputMode="numeric"
                        value={g.cantidad ?? ''}
                        onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
                        disabled={!isEditing}
                        readOnly={!isEditing}
                      />
                    </div>
                  ))}
                  {!gastosData.length && <div className="rc-tab-empty">Sin gastos</div>}
                </div>
              </section>

              {/* Resumen / Totales */}
              <section className="rc-card">
                <h3>Resumen</h3>

                <div className="rc-resumen-grid">
                  {/* IZQ - Ventas Total Sistema */}
                  <div className="rc-res-col">
                    <div className="rc-res-title">Ventas Total Sistema</div>

                    <div className="rc-res-item">
                      <span>Efectivo</span>
                      <b>Q {totalCieEf.toFixed(2)}</b>
                    </div>
                    <div className="rc-res-item">
                      <span>Tarjeta</span>
                      <b>Q {totalCieTar.toFixed(2)}</b>
                    </div>
                    <div className="rc-res-item">
                      <span>A domicilio</span>
                      <b>Q {totalCieMot.toFixed(2)}</b>
                    </div>

                    <div className="rc-res-item">
                      <span>Caja chica (usada)</span>
                      {isEditing ? (
                        <input
                          className="rc-input"
                          inputMode="numeric"
                          value={fuente.cajaChicaUsada ?? ''}
                          onChange={(e) => setCampo('cajaChicaUsada', e.target.value)}
                          placeholder="0.00"
                        />
                      ) : (
                        <b>Q {cajaChicaUsada.toFixed(2)}</b>
                      )}
                    </div>

                    <div className={`rc-res-item ${diffEsPositivo ? 'ok' : 'bad'}`}>
                      <span>{diffLabel}</span>
                      <b>Q {diffAbs.toFixed(2)}</b>
                    </div>

                    <div className="rc-res-item" style={{ alignItems: 'center', gap: 8 }}>
                      <span>Faltante pagado</span>
                      {isEditing ? (
                        <>
                          <input
                            className="rc-input"
                            inputMode="numeric"
                            value={fuente.faltantePagado ?? ''}
                            onChange={(e) => setCampo('faltantePagado', e.target.value)}
                            placeholder="0.00"
                          />
                          <button className="btn btn-min" onClick={() => setCampo('faltantePagado', 0)}>
                            Revertir
                          </button>
                        </>
                      ) : (
                        <b>Q {faltantePagado.toFixed(2)}</b>
                      )}
                    </div>
                  </div>

                  {/* DER - Control Administración */}
                  <div className="rc-res-col">
                    <div className="rc-res-title">Control Administración</div>

                    <div className="rc-res-item">
                      <span>Efectivo</span>
                      <b>Q {totalArqEfBruto.toFixed(2)}</b>
                    </div>
                    <div className="rc-res-item">
                      <span>Tarjeta</span>
                      <b>Q {totalArqTar.toFixed(2)}</b>
                    </div>
                    <div className="rc-res-item">
                      <span>A domicilio</span>
                      <b>Q {totalArqMot.toFixed(2)}</b>
                    </div>
                    <div className="rc-res-item">
                      <span>Gastos</span>
                      <b>Q {totalGastos.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                {/* Total a depositar */}
                <div className={`rc-total-deposit ${isDepositNegative ? 'bad' : ''}`}>
                  <span className="money">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 7h18v10H3V7zm2 2v6h14V9H5zm3 1h4v4H8v-4zM4 6h16V5H4v1z" />
                    </svg>
                    Total a depositar
                  </span>
                  <b>Q {totalGeneral.toFixed(2)}</b>
                </div>

                {/* Comentario */}
                <div className="rc-comentario">
                  <label htmlFor="rc-com">Comentario</label>
                  <textarea
                    id="rc-com"
                    value={comentario}
                    onChange={(e) => setCampo('comentario', e.target.value)}
                    placeholder="Agrega un comentario"
                    rows={3}
                    disabled={!isEditing}
                    readOnly={!isEditing}
                  />
                </div>

                {/* Acciones footer */}
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {isEditing ? (
                    <>
                      <button className="rc-btn" onClick={onClose}>Cancelar edición</button>
                      <button className="rc-btn rc-btn-primary" onClick={onGuardar}>Guardar cambios</button>
                    </>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
        {/* fin modal-body */}
      </div>
    </div>
  );
}
