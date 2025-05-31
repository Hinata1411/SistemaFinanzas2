// CierreBlock.jsx
import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import './CierreBlock.css';

const CierreBlock = forwardRef(({ title = 'Caja', onDataChange }, ref) => {
  // Estados de entrada
  const [ventaEfectivo, setVentaEfectivo] = useState('');
  const [ventaTarjeta, setVentaTarjeta] = useState('');
  const [ventaMotorista, setVentaMotorista] = useState('');
  const [apertura, setApertura] = useState('1000');
  const [isActive, setIsActive] = useState(true);

  // Parseo numérico con useMemo para eficiencia
  const ventaEfectivoNum = useMemo(() => parseFloat(ventaEfectivo) || 0, [ventaEfectivo]);
  const ventaTarjetaNum  = useMemo(() => parseFloat(ventaTarjeta)  || 0, [ventaTarjeta]);
  const ventaMotoristaNum= useMemo(() => parseFloat(ventaMotorista)|| 0, [ventaMotorista]);
  const aperturaNum      = useMemo(() => parseFloat(apertura)     || 0, [apertura]);

  // Cálculos derivados
  const efectivoTotal = useMemo(
    () => ventaEfectivoNum + aperturaNum,
    [ventaEfectivoNum, aperturaNum]
  );
  const totalSistema = useMemo(
    () => efectivoTotal + ventaTarjetaNum,
    [efectivoTotal, ventaTarjetaNum]
  );

  // Notificar al padre cambios
  useEffect(() => {
    onDataChange?.({
      efectivo: efectivoTotal,
      tarjeta: ventaTarjetaNum,
      motorista: ventaMotoristaNum,
      active: isActive,
    });
  }, [efectivoTotal, ventaTarjetaNum, ventaMotoristaNum, isActive, onDataChange]);

  // Exponer API de ref
  useImperativeHandle(ref, () => ({
    getData: () => ({
      title,
      efectivo: efectivoTotal,
      tarjeta: ventaTarjetaNum,
      motorista: ventaMotoristaNum,
      apertura: aperturaNum,
      total: totalSistema,
      active: isActive,
    }),
  }));

  return (
    <div className="cierre-sistema-block">
      <div className="block-header">{title}</div>

      <div className="input-row">
        <div className="input-field">
          <label htmlFor="ventaEfectivo">Venta Efectivo</label>
          <input
            id="ventaEfectivo"
            type="number"
            min="0"
            step="0.01"
            value={ventaEfectivo}
            onChange={(e) => setVentaEfectivo(e.target.value)}
            disabled={!isActive}
          />
        </div>

        <div className="input-field">
          <label htmlFor="ventaTarjeta">Venta Tarjeta</label>
          <input
            id="ventaTarjeta"
            type="number"
            min="0"
            step="0.01"
            value={ventaTarjeta}
            onChange={(e) => setVentaTarjeta(e.target.value)}
            disabled={!isActive}
          />
        </div>

        <div className="input-field">
          <label htmlFor="ventaMotorista">Venta Motorista</label>
          <input
            id="ventaMotorista"
            type="number"
            min="0"
            step="0.01"
            value={ventaMotorista}
            onChange={(e) => setVentaMotorista(e.target.value)}
            disabled={!isActive}
          />
        </div>

        <div className="input-field">
          <label htmlFor="apertura">Apertura</label>
          <input
            id="apertura"
            type="number"
            min="0"
            step="0.01"
            value={apertura}
            onChange={(e) => setApertura(e.target.value)}
            disabled={!isActive}
          />
        </div>
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

      <div className="total-row">
        <label>Total del Sistema:</label>
        <input
          type="number"
          readOnly
          value={totalSistema.toFixed(2)}
        />
      </div>
    </div>
  );
});

export default CierreBlock;
