// ArqueoBlock.jsx
import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import './DenominationBlock.css';

const denominations = [
  { label: 'Q. 100', id: 'q100' },
  { label: 'Q. 50',  id: 'q50' },
  { label: 'Q. 20',  id: 'q20' },
  { label: 'Q. 10',  id: 'q10' },
  { label: 'Q. 5',   id: 'q5' },
  { label: 'Q. 1',   id: 'q1' },
];

const ArqueoBlock = forwardRef(({ title = 'Caja', onDataChange }, ref) => {
  /* ─────────── Estado ─────────── */
  const [values, setValues] = useState(() =>
    denominations.reduce((acc, { id }) => ({ ...acc, [id]: '' }), {})
  );
  const [tarjeta,    setTarjeta]    = useState('');
  const [motorista,  setMotorista]  = useState('');
  const [isActive,   setIsActive]   = useState(true);

  /* ─────────── Cálculos ─────────── */
  const efectivo = useMemo(
    () =>
      Object.values(values).reduce(
        (acc, val) => acc + (parseFloat(val) || 0),
        0
      ),
    [values]
  );

  /* ─────────── Callbacks ─────────── */
  const handleDenominationChange = ({ target: { id, value } }) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  /* ─────────── Notificar al padre ─────────── */
  useEffect(() => {
    onDataChange?.({
      efectivo,
      tarjeta:   parseFloat(tarjeta)   || 0,
      motorista: parseFloat(motorista) || 0,
      active:    isActive,
    });
  }, [efectivo, tarjeta, motorista, isActive, onDataChange]);

  /* ─────────── Ref API ─────────── */
  useImperativeHandle(ref, () => ({
    getData: () => ({
      title,
      efectivo,
      tarjeta:   parseFloat(tarjeta)   || 0,
      motorista: parseFloat(motorista) || 0,
      active:    isActive,
    }),
  }));

  /* ─────────── UI ─────────── */
  return (
    <div className="denomination-block">
      <div className="box-title">{title}</div>

      <div className="denomination-list">
        {denominations.map(({ label, id }) => (
          <div key={id} className="input-item">
            <label htmlFor={id}>{label}</label>
            <input
              type="number"
              id={id}
              min="0"
              step="0.01"
              value={values[id]}
              onChange={handleDenominationChange}
              placeholder="0"
              disabled={!isActive}
              className="denomination-input"
            />
          </div>
        ))}
      </div>

      <div className="total">
        <label>Total&nbsp;Q.</label>
        <input
          type="number"
          readOnly
          value={efectivo.toFixed(2)}
          className="cash-input"
        />
      </div>

      <div className="input-item extra-field">
        <label htmlFor="tarjeta">Tarjeta:</label>
        <input
          type="number"
          id="tarjeta"
          min="0"
          step="0.01"
          value={tarjeta}
          onChange={(e) => setTarjeta(e.target.value)}
          placeholder="0"
          disabled={!isActive}
          className="denomination-input"
        />
      </div>

      <div className="input-item extra-field">
        <label htmlFor="motorista">Motorista:</label>
        <input
          type="number"
          id="motorista"
          min="0"
          step="0.01"
          value={motorista}
          onChange={(e) => setMotorista(e.target.value)}
          placeholder="0"
          disabled={!isActive}
          className="denomination-input"
        />
      </div>

      <div className="toggle-row">
        <button
          type="button"
          onClick={() => setIsActive((prev) => !prev)}
          className={`toggle-button ${isActive ? 'active' : 'inactive'}`}
        >
          {isActive ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
});

export default ArqueoBlock;
