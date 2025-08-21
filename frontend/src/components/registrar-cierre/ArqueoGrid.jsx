// src/components/registrar-cierre/ArqueoGrid.jsx
import React from 'react';
import { n } from '../../utils/numbers';

export default function ArqueoGrid({ arqueo, setArq }) {
  const totalEfectivoCaja = (c = {}) =>
    n(c.q100) + n(c.q50) + n(c.q20) + n(c.q10) + n(c.q5) + n(c.q1);

  return (
    <section className="rc-card">
      <h3>Arqueo Físico</h3>
      <div className="rc-sheet rc-sheet-3cols">
        {[0, 1, 2].map((i) => {
          const c = arqueo[i] || {};
          const totalCaja = totalEfectivoCaja(c);
          const apertura = n(c.apertura ?? 1000);
          const totalMenosApertura = totalCaja - apertura;

          return (
            <div className="rc-col" key={`arq-${i}`}>
              <div className="rc-col-hd">Caja {i + 1}</div>

              {[
                ['q100', 'Q 100'],
                ['q50', 'Q 50'],
                ['q20', 'Q 20'],
                ['q10', 'Q 10'],
                ['q5',  'Q 5' ],
                ['q1',  'Q 1' ],
              ].map(([field, label]) => (
                <div className="rc-row" key={field}>
                  <span className="rc-cell-label">{label}</span>
                  <input
                    className="rc-input"
                    inputMode="numeric"
                    value={c[field] || ''}
                    onChange={(e) => setArq(i, field, e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              ))}

              <div className="rc-row rc-total-caja">
                <span className="rc-cell-label strong">Total de caja</span>
                <b>Q {totalCaja.toFixed(2)}</b>
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
               />
             </div>

             {/* 🔹 Total menos apertura (sólo lectura) */}
             <div className="rc-row rc-total-caja">
               <span className="rc-cell-label strong">Total menos apertura</span>
               <b>Q {totalMenosApertura.toFixed(2)}</b>
             </div>

              <div className="rc-row rc-row-sep" />

              <div className="rc-row">
                <span className="rc-cell-label">Tarjeta</span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.tarjeta || ''}
                  onChange={(e) => setArq(i, 'tarjeta', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="rc-row">
                <span className="rc-cell-label">A domicilio (Motorista)</span>
                <input
                  className="rc-input"
                  inputMode="numeric"
                  value={c.motorista || ''}
                  onChange={(e) => setArq(i, 'motorista', e.target.value)}
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
