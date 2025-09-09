// src/components/registrar-cierre/ArqueoGrid.jsx
import React from 'react';
import { n, toMoney } from '../../utils/numbers';

/* === Rutas de íconos (REEMPLAZA con tus archivos) === */
const ICONS = {
  money: '/img/billetes-de-banco.png',
  bill:  '/img/billetes-de-banco.png',
  card:  '/img/pago-tarjeta.png',
  moto:  '/img/repartidor.png',
};

/* === Utilidades === */
const isEmpty = (v) => v === '' || v === null || v === undefined;

/* Formatea dinero SIN símbolo para inputs; vacío => '' (placeholder visible) */
const formatMoneyNoSymbol = (val) => {
  if (isEmpty(val)) return '';
  const num = Number(String(val).replace(/,/g, ''));
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* Limpia a número con decimales (para dinero) */
const sanitizeToNumberString = (str) => {
  const cleaned = String(str ?? '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join('')}`;
  return cleaned;
};

/* Solo dígitos (enteros) para denominaciones ≠ q1 */
const sanitizeInts = (str) => String(str ?? '').replace(/\D/g, '');

/* Número con un solo punto decimal para q1 */
const sanitizeDecimal = (str) => {
  const cleaned = String(str ?? '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join('')}`;
  return cleaned;
};

/* === Input monetario SIN prefijo (el Q. va afuera) === */
const MoneyInput = ({
  value,
  onChange,
  placeholder = '0.00',
  ariaLabel,
  disabled,
  width = 200,
}) => (
  <input
    className="rc-input no-spin"
    type="text"
    inputMode="decimal"
    value={formatMoneyNoSymbol(value)}
    onChange={(e) => onChange(sanitizeToNumberString(e.target.value))}
    onKeyDown={(e) => {
      if (['ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key)) e.preventDefault();
    }}
    onWheel={(e) => e.currentTarget.blur()}
    placeholder={placeholder}
    aria-label={ariaLabel}
    disabled={disabled}
    style={{ width, textAlign: 'right' }}
  />
);

export default function ArqueoGrid({
  arqueo,
  setArq,
  cajaChicaDisponible = 0,
  totalNeto,
  readOnly = false,
}) {
  const DENOMS = [
    ['q200', 200],
    ['q100', 100],
    ['q50', 50],
    ['q20', 20],
    ['q10', 10],
    ['q5', 5],
    ['q1', 1],     // <- SOLO esta permite decimales en cantidad
  ];

  const totalEfectivoCaja = (c = {}) =>
    DENOMS.reduce((acc, [field, val]) => acc + n(c[field]) * val, 0);

  const inputsDisabled = readOnly;

  return (
    <section className="rc-card">
      {/* Encabezado general */}
      <div className="rc-card-hd">
        <h3 style={{ margin: 0 }}>Arqueo Físico</h3>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="rc-cell-label strong"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--dark)' }}
              title="Caja Chica disponible"
            >
              <img src={ICONS.money} alt="Dinero" width={35} height={35} style={{ display: 'inline-block', objectFit: 'contain' }} />
              Caja Chica disponible:
            </span>
            <b>{toMoney(cajaChicaDisponible)}</b>
          </div>
        </div>
      </div>

      {/* 3 columnas de cajas */}
      <div className="rc-sheet rc-sheet-3cols">
        {[0, 1, 2].map((i) => {
          const c = arqueo[i] || {};
          const apertura = n(c.apertura ?? 0);
          const totalBruto = totalEfectivoCaja(c);
          const totalNetoCalc = totalBruto - apertura;

          return (
            <div className="rc-col" key={`arq-${i}`}>
              {/* Cabecera de la caja + Apertura */}
              <div className="rc-col-hd rc-col-hd--stack">
                <span>Caja {i + 1}</span>

                <div className="rc-col-open">
                  <span className="rc-cell-label" style={{ color: '#6b7280' }}>Apertura</span>
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Q.</span>
                  <MoneyInput
                    value={c.apertura ?? ''}   // vacío para que se vea placeholder 0.00
                    onChange={(val) => setArq(i, 'apertura', val)}
                    placeholder="0.00"
                    ariaLabel={`Apertura caja ${i + 1}`}
                    disabled={inputsDisabled}
                    width={220}
                  />
                </div>
              </div>

              {/* Encabezados de denominaciones */}
              <div className="rc-row" style={{ fontWeight: 600, opacity: 0.9 }}>
                <span
                  className="rc-cell-label rc-bill-ico"
                  style={{ flex: '0 0 40px', display: 'inline-flex', alignItems: 'left', justifyContent: 'left', marginLeft: 16 }}
                  title="Denominaciones"
                >
                  <img src={ICONS.bill} alt="Billete" width={35} height={35} style={{ display: 'inline-block', objectFit: 'contain', marginTop: '10px' }} />
                </span>
                <span className="rc-cell-label" style={{ flex: '0 0 auto', textAlign: 'center' }}>Cantidad</span>
                <span className="rc-cell-label" style={{ flex: '0 0 80px', textAlign: 'right' }}>Subtotal</span>
              </div>

              {DENOMS.map(([field, valor]) => {
                const cantidad = n(c[field]);         // <- q1 puede ser decimal
                const subtotal = cantidad * valor;

                return (
                  <div className="rc-row" key={field} style={{ alignItems: 'center', gap: 8 }}>
                    <span className="rc-cell-label" style={{ flex: '0 0 70px' }}>
                      Q {valor}
                    </span>

                    {/* Cantidad: q1 permite decimales; el resto, enteros */}
                    {field === 'q1' ? (
                      <input
                        className="rc-input no-spin"
                        type="text"
                        inputMode="decimal"
                        value={c[field] ?? ''}
                        onChange={(e) => setArq(i, field, sanitizeDecimal(e.target.value))}
                        onKeyDown={(e) => {
                          if (['e','E','+','-'].includes(e.key)) e.preventDefault();
                          if (['ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key)) e.preventDefault();
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0.00"
                        style={{ flex: '1 1 auto', textAlign: 'right' }}
                        aria-label={`Cantidad de Q${valor}`}
                        disabled={inputsDisabled}
                      />
                    ) : (
                      <input
                        className="rc-input no-spin"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={c[field] ?? ''}
                        onChange={(e) => setArq(i, field, sanitizeInts(e.target.value))}
                        onKeyDown={(e) => {
                          if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                          if (['ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key)) e.preventDefault();
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0"
                        style={{ flex: '1 1 auto', textAlign: 'right' }}
                        aria-label={`Cantidad de Q${valor}`}
                        disabled={inputsDisabled}
                      />
                    )}

                    {/* Subtotal con toMoney */}
                    <b style={{ flex: '0 0 90px', textAlign: 'right' }}>{toMoney(subtotal)}</b>
                  </div>
                );
              })}
              
              {/* Total de caja (NETO) con toMoney */}
              <div className="rc-total-caja">
                <div className="rc-total-line">
                  <span className="rc-cell-label strong">Total de caja</span>
                  <div className="rc-money-wrap rc-money-wrap--total">
                    <b className="rc-total-amount">{toMoney(totalNetoCalc)}</b>
                  </div>
                </div>
                <small className="rc-total-note">(menos apertura)</small>
              </div>

              <div className="rc-row rc-row-sep" />

              {/* Tarjeta */}
              <div className="rc-row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="rc-cell-label rc-label-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <img src={ICONS.card} alt="Tarjeta" width={35} height={35} style={{ display: 'inline-block', objectFit: 'contain' }} />
                  Tarjeta
                </span>

                <div className="rc-money-wrap">
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Q.</span>
                  <MoneyInput
                    value={isEmpty(c.tarjeta) ? '' : c.tarjeta}
                    onChange={(val) => setArq(i, 'tarjeta', val)}
                    placeholder="0.00"
                    ariaLabel={`Tarjeta caja ${i + 1}`}
                    disabled={inputsDisabled}
                    width="100%"
                  />
                </div>
              </div>

              {/* A domicilio (motorista) */}
              <div className="rc-row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="rc-cell-label rc-label-moto" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <img src={ICONS.moto} alt="A domicilio" width={35} height={35} style={{ display: 'inline-block', objectFit: 'contain'}} />
                  A domicilio
                </span>

                <div className="rc-money-wrap">
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Q.</span>
                  <MoneyInput
                    value={isEmpty(c.motorista) ? '' : c.motorista}
                    onChange={(val) => setArq(i, 'motorista', val)}
                    placeholder="0.00"
                    ariaLabel={`A domicilio caja ${i + 1}`}
                    disabled={inputsDisabled}
                    width="100%"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
