// src/components/registrar-cierre/CierreGrid.jsx
import React from 'react';

/* === Iconos inline (SVG) === */
const IcoBill = ({ size = 18, style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ display: 'inline-block', ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="7" width="20" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="2.25" stroke="currentColor" strokeWidth="2" />
    <path d="M5 10h1M18 10h1M5 14h1M18 14h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcoCard = ({ size = 18, style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ display: 'inline-block', ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
    <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcoMoto = ({ size = 18, style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ display: 'inline-block', ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="6" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
    <path
      d="M6 17l5-7h4l3 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M13 10l-1-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function CierreGrid({ cierre, setCier }) {
  return (
    <section className="rc-card">
      <h3>Cierre de Sistema</h3>
      <div className="rc-sheet rc-sheet-3cols">
        {[0, 1, 2].map((i) => {
          const c = cierre[i] || {};
          return (
            <div className="rc-col" key={`cier-${i}`}>
              <div className="rc-col-hd">Caja {i + 1}</div>

              {/* Efectivo con icono de billete */}
              <div className="rc-row">
                <span
                  className="rc-cell-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IcoBill />
                  Efectivo
                </span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.efectivo ?? ''}
                  onChange={(e) => setCier(i, 'efectivo', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Tarjeta con icono */}
              <div className="rc-row">
                <span
                  className="rc-cell-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IcoCard />
                  Tarjeta
                </span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.tarjeta ?? ''}
                  onChange={(e) => setCier(i, 'tarjeta', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* A domicilio (Motorista) con icono */}
              <div className="rc-row">
                <span
                  className="rc-cell-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IcoMoto />
                  A domicilio
                </span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.motorista ?? ''}
                  onChange={(e) => setCier(i, 'motorista', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
