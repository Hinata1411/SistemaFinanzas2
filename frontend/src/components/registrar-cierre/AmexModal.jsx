import React, { useEffect, useMemo, useState } from "react";
import { toMoney } from "../../utils/numbers";

/* === Constantes === */
const FLAVORS = [
  // Columna izquierda
  "Pepperoni",
  "Jamón",
  "Only Cheese",
  "Hawaiana",
  "Magnífica",
  "Dúo dinámico",
  "No meat",
  "4 estaciones",
  "Cheese fingers",
  // Columna derecha
  "Border cheese",
  "Suprema",
  "Full meat",
  "Super chilly",
  "Tejana",
  "Border champiñones",
  "Americana",
  "Italiana",
];

const priceFor = (name) => {
  if (name === "Pepperoni" || name === "Jamón") return 65;
  if (name === "Cheese fingers") return 40;
  return 85; // las demás
};

export default function AmexModal({
  open,
  onClose,
  onSave,
  initialItems = {},
  readOnly = false,
}) {
  /* Hooks SIEMPRE al inicio (sin returns antes) */
  const [qty, setQty] = useState(() => {
    const base = {};
    FLAVORS.forEach((f) => (base[f] = Number.isFinite(initialItems[f]) ? initialItems[f] : 0));
    return base;
  });

  // Sincroniza cantidades cuando el modal abre o cambian los datos iniciales
  useEffect(() => {
    if (!open) return; // se llama igual el hook, pero corta el efecto
    const next = {};
    FLAVORS.forEach((f) => (next[f] = Number.isFinite(initialItems[f]) ? initialItems[f] : 0));
    setQty(next);
  }, [open, initialItems]);

  const total = useMemo(
    () =>
      FLAVORS.reduce((acc, f) => {
        const q = Number(qty[f]) || 0;
        return acc + q * priceFor(f);
      }, 0),
    [qty]
  );

  const handleChange = (flavor, val) => {
    if (readOnly) return;
    const clean = String(val).replace(/[^\d]/g, ""); // solo enteros >= 0
    setQty((prev) => ({ ...prev, [flavor]: clean === "" ? 0 : parseInt(clean, 10) }));
  };

  const renderCol = (arr) => (
    <div className="amex-col">
      {arr.map((f) => (
        <div className="amex-row" key={f}>
          <div className="amex-label">{f}</div>
          <input
            className="rc-input amex-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={qty[f] ?? 0}
            onChange={(e) => handleChange(f, e.target.value)}
            placeholder="0"
            disabled={readOnly}
            aria-label={`Cantidad ${f}`}
          />
        </div>
      ))}
    </div>
  );

  const left = FLAVORS.slice(0, 9);
  const right = FLAVORS.slice(9);

  const onConfirm = () => {
    if (readOnly) return;
    const items = {};
    Object.keys(qty).forEach((k) => {
      const v = Number(qty[k]) || 0;
      if (v > 0) items[k] = v;
    });
    onSave?.({ items, total });
  };

  /* Recién aquí cortamos el render si está cerrado */
  if (!open) return null;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card amex-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="card-title" style={{ textAlign: "center" }}>
          Venta American Express
        </h3>

        <div className="amex-grid">
          {renderCol(left)}
          {renderCol(right)}
        </div>

        <div className="amex-footer">
          <div className="amex-total">
            <span>Total</span>
            <b>{toMoney(total)}</b>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancelar</button>
            {!readOnly && (
              <button className="btn btn-primary" onClick={onConfirm}>Guardar</button>
            )}
          </div>
        </div>
      </div>

      {/* estilos mínimos del modal */}
      <style>{`
        .amex-modal { max-width: 900px; width: 95%; }
        .amex-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin: 12px 0 8px;
        }
        .amex-col { display: grid; gap: 12px; }
        .amex-row {
          display: grid;
          grid-template-columns: 1fr 140px;
          align-items: center;
          gap: 16px;
        }
        .amex-label { font-weight: 700; font-size: 18px; }
        .amex-input {
          background: #c0e2d0;
          font-weight: 700;
          text-align: center;
        }
        .amex-footer {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          margin-top: 12px;
        }
        .amex-total { display: flex; align-items: center; gap: 12px; font-size: 20px; }
        .amex-total > span { font-weight: 700; }
      `}</style>
    </div>
  );
}
