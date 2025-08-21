import React, { useState, useEffect } from 'react';
import { clamp } from '../../utils/numbers';
import { toMoney } from '../../utils/numbers';

export default function CajaChicaModal({
  open,
  onClose,
  cajaChicaDisponible,
  faltantePorGastos, // ¡ya contempla faltantePagado!
  onApply,           // (monto) => void
}) {
  const [monto, setMonto] = useState('');

  useEffect(() => {
    if (!open) setMonto('');
  }, [open]);

  if (!open) return null;

  const maxPermitido = Math.min(cajaChicaDisponible, faltantePorGastos);

  const handleGuardar = () => {
    const val = parseFloat(monto);
    if (!val || isNaN(val) || val <= 0) {
      alert('Ingresa un monto válido (> 0)');
      return;
    }
    if (val > cajaChicaDisponible) {
      alert('El monto supera la caja chica disponible');
      return;
    }
    if (val > maxPermitido) {
      alert(`No puedes usar más de ${toMoney(maxPermitido)}`);
      return;
    }
    onApply(val);
    onClose();
  };

  return (
    <div className="rc-modal-mask" role="dialog" aria-modal="true">
      <div className="rc-modal-card">
        <div className="rc-modal-hd">
          <h4>Utilizar caja chica</h4>
          <div className="rc-modal-actions">
            <button className="rc-btn rc-btn-outline" onClick={onClose}>Cerrar</button>
            <button className="rc-btn rc-btn-primary" onClick={handleGuardar}>Aplicar</button>
          </div>
        </div>

        <div className="rc-modal-body">
          <p><b>Disponible:</b> {toMoney(cajaChicaDisponible)}</p>
          <p><b>Faltante por gastos:</b> {toMoney(faltantePorGastos)}</p>

          <div style={{ marginTop: 8 }}>
            <label className="rc-cell-label">Monto a usar (Q)</label>
            <input
              className="rc-input"
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
            />
            <div className="rc-help">Máximo permitido: {toMoney(maxPermitido)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
