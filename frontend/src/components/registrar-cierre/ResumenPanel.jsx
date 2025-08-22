import React from 'react';
import { toMoney } from '../../utils/numbers';


export default function ResumenPanel({
  totals = {},          // 👈 default para evitar crash
  flags = {},           // 👈 default para evitar crash
  cajaChicaUsada = 0,
  onPagarFaltante,
  faltantePagado = 0,

  pedidosYaCantidad = 0,
  amexTotal = 0,
  showPedidosYa = false,
  showAmex = false,

  totalAperturas = 0,
}) {
  const {
    totalArqueoEfectivoNeto = 0,
    totalArqueoTarjeta = 0,
    totalArqueoMotorista = 0,

    totalCierreEfectivo = 0,
    totalCierreTarjeta = 0,
    totalCierreMotorista = 0,

    totalGastos = 0,
    diferenciaEfectivo = 0,
    faltanteEfectivo = 0,

    totalGeneral = 0,
    totalArqueoEfectivo = 0, // compat si hiciera falta
  } = totals;

  const {
    diffEsPositivo = true,
    diffLabel = 'Sobrante',
    diffAbs = 0,
    isDepositNegative = false,
  } = flags;

  const efectivoAdmin = Number.isFinite(totalArqueoEfectivoNeto)
    ? totalArqueoEfectivoNeto
    : Math.max(0, (totalArqueoEfectivo || 0) - (totalAperturas || 0));

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
              <button
                type="button"
                className="rc-btn rc-btn-primary"
                onClick={onPagarFaltante}
              >
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
            <b>{toMoney(efectivoAdmin)}</b> {/* 👈 NETO */}
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

          {/* Extras por sucursal */}
          {showPedidosYa && (
            <div className="rc-res-item">
              <span>Total Pedidos Ya</span>
              <b>{toMoney(pedidosYaCantidad)}</b>
            </div>
          )}
          {showAmex && (
            <div className="rc-res-item">
              <span>Total American Express</span>
              <b>{toMoney(amexTotal)}</b>
            </div>
          )}
        </div>
      </div>

      {/* Total a depositar (ya viene calculado en el hook con NETO) */}
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
