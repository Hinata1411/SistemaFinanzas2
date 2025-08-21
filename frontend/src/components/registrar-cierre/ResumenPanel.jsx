// src/components/registrar-cierre/ResumenPanel.jsx
import React from 'react';
import { toMoney } from '../../utils/numbers';


export default function ResumenPanel({
  totals,
  flags,
  cajaChicaUsada,
  onUseCajaChica,
  onPagarFaltante,
  faltantePagado,
  activeSucursalNombre,
  cajaChicaDisponible,
}) {
  const {
    totalArqueoEfectivo,
    totalArqueoTarjeta,
    totalArqueoMotorista,
    totalCierreEfectivo,
    totalCierreTarjeta,
    totalCierreMotorista,
    totalGastos,
    diferenciaEfectivo,
    faltanteEfectivo,
    faltantePorGastos,
    totalGeneral,
  } = totals;

  const { diffEsPositivo, diffLabel, diffAbs, isDepositNegative } = flags;
  const showCajaChicaBtn = faltantePorGastos > 0;

  return (
    <section className="rc-card">
      <h3>Resumen</h3>

      <div className="rc-resumen-grid">
        {/* IZQUIERDA - Ventas Total Sistema */}
        <div className="rc-res-col">
          <div className="rc-res-title">Ventas Total Sistema</div>

          <div className="rc-res-item">
            <span>Efectivo</span>
            <b>{toMoney(totalCierreEfectivo)}</b>
          </div>
          <div className="rc-res-item">
            <span>Tarjeta</span>
            <b>{toMoney(totalCierreTarjeta)}</b>
          </div>
          <div className="rc-res-item">
            <span>A domicilio</span>
            <b>{toMoney(totalCierreMotorista)}</b>
          </div>
          <div className="rc-res-item">
            <span>Caja chica (usada)</span>
            <b>{toMoney(cajaChicaUsada)}</b>
          </div>

          <div className={`rc-res-item ${diffEsPositivo ? 'ok' : 'bad'}`}>
            <span>{diffLabel}</span>
            <b>{toMoney(diffAbs)}</b>
          </div>

          {faltanteEfectivo > 0 && faltantePagado === 0 && (
            <div className="rc-res-item">
              <button type="button" className="rc-btn rc-btn-primary" onClick={onPagarFaltante}>
                Pagar faltante ({toMoney(faltanteEfectivo)})
              </button>
            </div>
          )}

          {faltantePagado > 0 && (
            <div className="rc-res-item ok">
              <span>Faltante pagado</span>
              <b>{toMoney(faltantePagado)}</b>
            </div>
          )}
        </div>

        {/* DERECHA - Control Administración */}
        <div className="rc-res-col">
          <div className="rc-res-title">Control Administración</div>

          <div className="rc-res-item">
            <span>Efectivo</span>
            <b>{toMoney(totals.totalArqueoEfectivoNeto ?? totalArqueoEfectivo)}</b>
          </div>
          <div className="rc-res-item">
            <span>Tarjeta</span>
            <b>{toMoney(totalArqueoTarjeta)}</b>
          </div>
          <div className="rc-res-item">
            <span>A domicilio</span>
            <b>{toMoney(totalArqueoMotorista)}</b>
          </div>
          <div className="rc-res-item">
            <span>Gastos</span>
            <b>{toMoney(totalGastos)}</b>
          </div>

          {showCajaChicaBtn && (
            <div className="rc-res-item">
              <button
                type="button"
                className="rc-btn rc-btn-outline"
                onClick={onUseCajaChica}
                title={`Disponible en ${activeSucursalNombre || 'sucursal'}: ${toMoney(
                  cajaChicaDisponible
                )}`}
              >
                Utilizar caja chica
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Total a depositar (contenedor APARTE) */}
      <div className={`rc-total-deposit ${isDepositNegative ? 'bad' : ''}`}>
        <span className="money">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7h18v10H3V7zm2 2v6h14V9H5zm3 1h4v4H8v-4zM4 6h16V5H4v1z" />
          </svg>
          Total a depositar
        </span>
        <b>{toMoney(totalGeneral)}</b>
      </div>
    </section>
  );
}
