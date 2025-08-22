import React from 'react';
import { n, toMoney } from '../../utils/numbers';

/* === Iconos inline (SVG) === */
const IcoMoney = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', ...style }} xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
    <path d="M6 12h1M17 12h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcoBill = ({ size = 20, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', ...style }} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="7" width="20" height="10" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="2.25" stroke="currentColor" strokeWidth="2" />
    <path d="M5 10h1M18 10h1M5 14h1M18 14h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcoCard = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', ...style }} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
    <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IcoMoto = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', ...style }} xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M6 17l5-7h4l3 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 10l-1-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function ArqueoGrid({
  arqueo,
  setArq,
  cajaChicaDisponible = 0,
  readOnly = false,
  extras = {},
}) {
  const {
    showPedidosYaBtn = false,
    showAmexBtn = false,
    onPedidosYa,
    onAmex,
    disabled: extrasDisabled = false,
  } = extras;

  const DENOMS = [
    ['q200', 200],
    ['q100', 100],
    ['q50', 50],
    ['q20', 20],
    ['q10', 10],
    ['q5', 5],
    ['q1', 1],
  ];

  const totalEfectivoCaja = (c = {}) =>
    DENOMS.reduce((acc, [field, val]) => acc + n(c[field]) * val, 0);

  const inputsDisabled = readOnly;

  return (
    <section className="rc-card">
      <div className="rc-card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Arqueo Físico</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="rc-cell-label strong" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--dark)' }} title="Caja Chica disponible">
              <IcoMoney size={18} style={{ color: 'var(--primary)' }} />
              Caja Chica disponible:
            </span>
            <b>{toMoney(cajaChicaDisponible)}</b>
          </div>

         
        </div>
      </div>

      <div className="rc-sheet rc-sheet-3cols">
        {[0, 1, 2].map((i) => {
          const c = arqueo[i] || {};
          const totalCaja = totalEfectivoCaja(c);

          return (
            <div className="rc-col" key={`arq-${i}`}>
              <div className="rc-col-hd">Caja {i + 1}</div>

              <div className="rc-row" style={{ fontWeight: 600, opacity: 0.9 }}>
                <span className="rc-cell-label rc-bill-ico" style={{ flex: '0 0 60px', display: 'inline-flex', alignItems: 'left', justifyContent: 'left', marginLeft: '16px' }} title="Denominaciones">
                  <IcoBill />
                </span>
                <span className="rc-cell-label" style={{ flex: '0 0 auto', textAlign: 'center' }}>Cantidad</span>
                <span className="rc-cell-label" style={{ flex: '0 0 80px', textAlign: 'right' }}>Subtotal</span>
              </div>

              {DENOMS.map(([field, valor]) => {
                const cantidad = n(c[field]);
                const subtotal = cantidad * valor;

                return (
                  <div className="rc-row" key={field} style={{ alignItems: 'center', gap: 8 }}>
                    <span className="rc-cell-label" style={{ flex: '0 0 80px' }}>
                      Q {valor}
                    </span>

                    <input
                      className="rc-input"
                      inputMode="numeric"
                      type="number"
                      min="0"
                      step="1"
                      value={c[field] ?? ''}
                      onChange={(e) => setArq(i, field, e.target.value)}
                      placeholder="0"
                      style={{ flex: '1 1 auto' }}
                      aria-label={`Cantidad de Q${valor}`}
                      disabled={inputsDisabled}
                    />

                    <b style={{ flex: '0 0 80px', textAlign: 'right' }}>{toMoney(subtotal)}</b>
                  </div>
                );
              })}

              <div className="rc-row rc-total-caja" style={{ marginTop: 6 }}>
                <span className="rc-cell-label strong">Total de caja</span>
                <b>{toMoney(totalCaja)}</b>
              </div>

              <div className="rc-row rc-row-sep" />

              <div className="rc-row">
                <span className="rc-cell-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IcoCard />
                  Tarjeta
                </span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.tarjeta || ''}
                  onChange={(e) => setArq(i, 'tarjeta', e.target.value)}
                  placeholder="0.00"
                  disabled={inputsDisabled}
                />
              </div>

              <div className="rc-row">
                <span className="rc-cell-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IcoMoto />
                  A domicilio
                </span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.motorista || ''}
                  onChange={(e) => setArq(i, 'motorista', e.target.value)}
                  placeholder="0.00"
                  disabled={inputsDisabled}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
