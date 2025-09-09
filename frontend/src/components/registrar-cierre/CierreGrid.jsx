// src/components/registrar-cierre/CierreGrid.jsx
import React from 'react';

const ICONS = {
  bill:  '/img/billetes-de-banco.png',
  card:  '/img/pago-tarjeta.png',
  moto:  '/img/repartidor.png',
};

const isEmpty = (v) => v === '' || v === null || v === undefined;

const formatMoneyNoSymbol = (val) => {
  if (isEmpty(val)) return '';
  const num = Number(String(val).replace(/,/g, ''));
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const sanitizeToNumberString = (str) => {
  const cleaned = String(str ?? '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join('')}`;
  return cleaned;
};

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
      if (['e','E','+','-'].includes(e.key)) e.preventDefault();
    }}
    onWheel={(e) => e.currentTarget.blur()}
    placeholder={placeholder}
    aria-label={ariaLabel}
    disabled={disabled}
    style={{ width, textAlign: 'right' }}
  />
);

export default function CierreGrid({ cierre, setCier, readOnly = false }) {
  const inputsDisabled = readOnly;

  return (
    <section className="rc-card">
      {/* ✅ Igual que en Arqueo */}
      <div className="rc-card-hd">
        <h3 style={{ margin: 0 }}>Cierre de Sistema</h3>
      </div>

      <div className="rc-sheet rc-sheet-3cols">
        {[0, 1, 2].map((i) => {
          const c = cierre[i] || {};
          return (
            <div className="rc-col" key={`cier-${i}`}>
              <div className="rc-col-hd rc-col-hd--stack">
                <span>{`Caja ${i + 1}`}</span>
              </div>

              {/* Efectivo */}
              <div className="rc-row" style={{ alignItems: 'center', gap: 8 }}>
                <span
                  className="rc-cell-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <img src={ICONS.bill} alt="Efectivo" width={35} height={35} style={{ objectFit: 'contain' }} />
                  Efectivo
                </span>

                <div className="rc-money-wrap">
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Q.</span>
                  <MoneyInput
                    value={isEmpty(c.efectivo) ? '' : c.efectivo}
                    onChange={(val) => setCier(i, 'efectivo', val)}
                    placeholder="0.00"
                    ariaLabel={`Efectivo caja ${i + 1}`}
                    disabled={inputsDisabled}
                    width="100%"
                  />
                </div>
              </div>

              {/* Tarjeta */}
              <div className="rc-row" style={{ alignItems: 'center', gap: 8 }}>
                <span
                  className="rc-cell-label rc-label-card"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <img src={ICONS.card} alt="Tarjeta" width={35} height={35} style={{ objectFit: 'contain' }} />
                  Tarjeta
                </span>

                <div className="rc-money-wrap">
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Q.</span>
                  <MoneyInput
                    value={isEmpty(c.tarjeta) ? '' : c.tarjeta}
                    onChange={(val) => setCier(i, 'tarjeta', val)}
                    placeholder="0.00"
                    ariaLabel={`Tarjeta caja ${i + 1}`}
                    disabled={inputsDisabled}
                    width="100%"
                  />
                </div>
              </div>

              {/* A domicilio */}
              <div className="rc-row" style={{ alignItems: 'center', gap: 8 }}>
                <span
                  className="rc-cell-label rc-label-moto"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                  <img src={ICONS.moto} alt="A domicilio" width={35} height={35} style={{ objectFit: 'contain' }} />
                  A domicilio
                </span>

                <div className="rc-money-wrap">
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Q.</span>
                  <MoneyInput
                    value={isEmpty(c.motorista) ? '' : c.motorista}
                    onChange={(val) => setCier(i, 'motorista', val)}
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
