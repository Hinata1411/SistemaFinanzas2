// src/components/registrar-cierre/GastosList.jsx
import React from 'react';
import { toMoney } from '../../utils/numbers';

export default function GastosList({
  gastos,
  categorias,
  setGasto,
  addGasto,
  removeGasto,
  onOpenCategorias,
  // NUEVAS PROPS para caja chica:
  onUseCajaChica,
  activeSucursalNombre,
  cajaChicaDisponible,
  faltantePorGastos,
}) {
  const showCajaChicaBtn = Number(faltantePorGastos) > 0;

  return (
    <section className="rc-card">
      <div className="rc-card-hd" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: '1 1 auto' }}>Gastos</h3>

        {/* Botón mover a este componente */}
        {showCajaChicaBtn && (
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
        )}

        <button type="button" className="rc-btn rc-btn-outline" onClick={onOpenCategorias}>
          Categorías
        </button>
      </div>

      <div className="rc-gastos">
        {gastos.map((g, i) => (
          <div className="rc-gasto-row" key={i}>
            <select
              className="rc-input rc-select"
              value={g.categoria}
              onChange={(e) => setGasto(i, 'categoria', e.target.value)}
            >
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              className="rc-input rc-desc"
              placeholder="Descripción"
              value={g.descripcion}
              onChange={(e) => setGasto(i, 'descripcion', e.target.value)}
            />

            <input
              className="rc-input rc-qty"
              placeholder="Cantidad"
              inputMode="numeric"
              value={g.cantidad}
              onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
            />

            <button
              type="button"
              className="rc-btn rc-btn-ghost"
              onClick={() => removeGasto(i)}
              title="Eliminar gasto"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="rc-gastos-actions">
        <button type="button" className="rc-btn rc-btn-outline" onClick={addGasto}>
          + Agregar gasto
        </button>
      </div>
    </section>
  );
}
