// src/components/registrar-cierre/CierreGrid.jsx
import React from 'react';

export default function CierreGrid({ cierre, setCier }) {
  return (
    <section className="rc-card">
      <h3>Cierre de Sistema</h3>
      <div className="rc-sheet rc-sheet-3cols">
        {[0, 1, 2].map((i) => (
          <div className="rc-col" key={`cier-${i}`}>
            <div className="rc-col-hd">Caja {i + 1}</div>

            {[
              ['efectivo', 'Efectivo'],
              ['tarjeta', 'Tarjeta'],
              ['motorista', 'A domicilio (Motorista)'],
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
  );
}
