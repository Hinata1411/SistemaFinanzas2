// src/ArqueoBlock.jsx
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

const ArqueoBlock = forwardRef(
  (
    {
      title = 'Caja',
      onDataChange,
      inicialData = null, // { values: {q100,q50,...}, tarjeta, motorista, active }
      readonly = false,
    },
    ref
  ) => {
    /* ─────────── Estado ─────────── */

    // 1) Mantener un objeto “values” con cada denominación (solo en editable)
    const [values, setValues] = useState(() =>
      denominations.reduce((acc, { id }) => ({ ...acc, [id]: '' }), {})
    );

    // 2) Campos “tarjeta” y “motorista”
    const [tarjeta,   setTarjeta]   = useState('');
    const [motorista, setMotorista] = useState('');

    // 3) “isActive” para marcar ON/OFF de la caja
    const [isActive, setIsActive] = useState(true);

    /* ─────────── Cálculo del efectivo total ─────────── */
    // Solo sumamos las “values” si estamos en modo editable.
    // En modo readonly, confiamos en `inicialData.efectivo`.
    const computedEfectivo = useMemo(
      () =>
        Object.values(values).reduce(
          (acc, val) => acc + (parseFloat(val) || 0),
          0
        ),
      [values]
    );

    /* ─────────── Cargar “inicialData” en modo readonly ─────────── */
    useEffect(() => {
      if (inicialData) {
        // 1) Rellenar cada denominación si inicialData.values existe
        if (inicialData.values) {
          setValues(inicialData.values);
        }
        // 2) Rellenar tarjeta/motorista
        setTarjeta(inicialData.tarjeta?.toString() ?? '');
        setMotorista(inicialData.motorista?.toString() ?? '');
        // 3) Rellenar el estado ON/OFF
        setIsActive(inicialData.active === false ? false : true);
      }
    }, [inicialData]);

    /* ─────────── Notificar al padre ─────────── */
    useEffect(() => {
      if (readonly && inicialData) {
        // En readonly, devolvemos exactamente lo que vino de Firestore
        onDataChange?.({
          values: inicialData.values ?? {},       // objeto con cantidades por billete
          efectivo: inicialData.efectivo,         // el total que guardamos
          tarjeta: inicialData.tarjeta,
          motorista: inicialData.motorista,
          active: inicialData.active,
        });
      } else {
        // Modo completamente editable: reenviamos “values” +
        // el total calculado + tarjeta + motorista + active
        onDataChange?.({
          values,                                  // el objeto con cada denominación
          efectivo: computedEfectivo,
          tarjeta: parseFloat(tarjeta) || 0,
          motorista: parseFloat(motorista) || 0,
          active: isActive,
        });
      }
    }, [
      values,
      computedEfectivo,
      tarjeta,
      motorista,
      isActive,
      onDataChange,
      readonly,
      inicialData,
    ]);

    /* ─────────── Handler denominación ─────────── */
    const handleDenominationChange = ({ target: { id, value } }) => {
      setValues((prev) => ({ ...prev, [id]: value }));
    };

    /* ─────────── Ref API: exponer getData() ─────────── */
    useImperativeHandle(ref, () => ({
      getData: () => {
        if (readonly && inicialData) {
          // En readonly devolvemos EXACTAMENTE la misma forma que vino de Firestore:
          // { title, values, efectivo, tarjeta, motorista, active }
          return {
            title,
            values: inicialData.values ?? {},
            efectivo: inicialData.efectivo,
            tarjeta: inicialData.tarjeta,
            motorista: inicialData.motorista,
            active: inicialData.active,
          };
        }
        // En editable devolvemos el estado actual:
        return {
          title,
          values,                        // objeto con { q100, q50, ... }
          efectivo: computedEfectivo,    // suma automática de “values”
          tarjeta: parseFloat(tarjeta) || 0,
          motorista: parseFloat(motorista) || 0,
          active: isActive,
        };
      },
    }));

    /* ─────────── Renderizado ─────────── */
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
                disabled={readonly || !isActive}
                className="denomination-input"
              />
            </div>
          ))}
        </div>

        <div className="total">
          <label>Total Q.</label>
          <input
            type="number"
            readOnly
            value={
              readonly && inicialData
                ? parseFloat(inicialData.efectivo).toFixed(2)
                : computedEfectivo.toFixed(2)
            }
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
            disabled={readonly || !isActive}
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
            disabled={readonly || !isActive}
            className="denomination-input"
          />
        </div>

        <div className="toggle-row">
          <button
            type="button"
            onClick={() => setIsActive((prev) => !prev)}
            disabled={readonly}
            className={`toggle-button ${isActive ? 'active' : 'inactive'}`}
          >
            {isActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    );
  }
);

export default ArqueoBlock;
