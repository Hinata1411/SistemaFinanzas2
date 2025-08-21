// src/pages/ventas/components/KpiCards.jsx
import React from 'react';

export default function KpiCards({ totalVentas = 0, promedioVentas = 0, diaMasVenta = '-', fmtQ }) {
  const fmt = (v) =>
    typeof fmtQ === 'function'
      ? fmtQ(v)
      : (typeof v === 'number' ? v : parseFloat(v || 0)).toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' });

  return (
    <section className="ventas-kpis">
      {/* Total de ventas */}
      <div className="kpi-card">
        <div className="kpi-icon kpi-money" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M7 3c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v1H7V3Zm-1 4h12l.9 1.8c.7 1.3 1.1 2.8 1.1 4.2 0 4.4-3.6 8-8 8s-8-3.6-8-8c0-1.5.4-2.9 1.1-4.2L6 7Zm6 3c-.6 0-1 .4-1 1v.3c-.6.1-1.2.3-1.7.6-.5.3-.8.8-.8 1.5 0 .6.2 1.1.7 1.4.4.3 1 .6 1.8.7v1.5h2V16c.6-.1 1.2-.3 1.6-.6.5-.3.7-.8.7-1.5 0-.6-.2-1.1-.7-1.4-.4-.3-1-.5-1.6-.6V11c0-.6-.4-1-1-1Zm-1.1 3.1c0-.2.1-.3.3-.4.2-.1.5-.2.8-.2v1.3c-.3-.1-.6-.2-.8-.3-.2-.1-.3-.2-.3-.4Zm2.9 1.9c-.2.1-.5.2-.8.2v-1.2c.3.1.6.2.8.3.2.1.3.2.3.4 0 .2-.1.3-.3.3Z"/>
          </svg>
        </div>
        <div className="kpi-text">
          <span className="kpi-title">Total de ventas</span>
          <div className="kpi-value">{fmt(totalVentas)}</div>
        </div>
      </div>

      {/* Promedio de ventas */}
      <div className="kpi-card">
        <div className="kpi-icon kpi-avg" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M3 17h18v2H3v-2Zm2-6 4 4 3-3 4 4 5-5-1.4-1.4-3.6 3.6-4-4-3 3-2.6-2.6L5 11Z"/>
          </svg>
        </div>
        <div className="kpi-text">
          <span className="kpi-title">Promedio de ventas</span>
          <div className="kpi-value">{fmt(promedioVentas)}</div>
        </div>
      </div>

      {/* Día de más venta */}
      <div className="kpi-card">
        <div className="kpi-icon kpi-best" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a5 5 0 0 0 4 4.9V14a3 3 0 0 0 2 2.83V19H8v2h8v-2h-2.17A3 3 0 0 0 16 14v-2.1A5 5 0 0 0 20 7V5a1 1 0 0 0-1-1ZM6 7V6h1v3.92A3 3 0 0 1 6 7Zm12 0a3 3 0 0 1-1 2.92V6h1v1Z"/>
          </svg>
        </div>
        <div className="kpi-text">
          <span className="kpi-title">Día de más venta</span>
          <div className="kpi-value">{diaMasVenta || '-'}</div>
        </div>
      </div>
    </section>
  );
}
