// src/CierreBlock.jsx
import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import './CierreBlock.css';

const CierreBlock = forwardRef(
  (
    {
      title = 'Caja',
      onDataChange,
      inicialData = null, // { ventaEfectivo, ventaTarjeta, ventaMotorista, apertura, active }
      readonly = false,
    },
    ref
  ) => {
    // ─────────── Estados ───────────
    const [ventaEfectivo, setVentaEfectivo]   = useState('');
    const [ventaTarjeta, setVentaTarjeta]     = useState('');
    const [ventaMotorista, setVentaMotorista] = useState('');
    const [apertura, setApertura]             = useState('');
    const [isActive, setIsActive]             = useState(true);

    // ─────────── Carga de datos iniciales (modo lectura) ───────────
    useEffect(() => {
      if (inicialData) {
        setVentaEfectivo(
          inicialData.ventaEfectivo !== undefined
            ? inicialData.ventaEfectivo.toString()
            : ''
        );
        setVentaTarjeta(
          inicialData.ventaTarjeta !== undefined
            ? inicialData.ventaTarjeta.toString()
            : ''
        );
        setVentaMotorista(
          inicialData.ventaMotorista !== undefined
            ? inicialData.ventaMotorista.toString()
            : ''
        );
        setApertura(
          inicialData.apertura !== undefined
            ? inicialData.apertura.toString()
            : ''
        );
        setIsActive(inicialData.active === false ? false : true);
      }
    }, [inicialData]);

    // ─────────── Parsers numéricos ───────────
    const ventaEfectivoNum = useMemo(
      () => parseFloat(ventaEfectivo) || 0,
      [ventaEfectivo]
    );
    const ventaTarjetaNum = useMemo(
      () => parseFloat(ventaTarjeta) || 0,
      [ventaTarjeta]
    );
    const ventaMotoristaNum = useMemo(
      () => parseFloat(ventaMotorista) || 0,
      [ventaMotorista]
    );
    const aperturaNum = useMemo(() => parseFloat(apertura) || 0, [apertura]);

    // ─────────── Cálculos derivados ───────────
    // Efectivo real de cierre = ventaEfectivo + apertura
    const efectivoTotal = useMemo(
      () => ventaEfectivoNum + aperturaNum,
      [ventaEfectivoNum, aperturaNum]
    );
    // TotalSistema = efectivoTotal + tarjeta + motorista
    const totalSistema = useMemo(
      () => efectivoTotal + ventaTarjetaNum + ventaMotoristaNum,
      [efectivoTotal, ventaTarjetaNum, ventaMotoristaNum]
    );

    // ─────────── Notificar al padre (onDataChange) ───────────
    useEffect(() => {
      if (readonly && inicialData) {
        // Modo lectura: enviamos exactamente lo guardado
        onDataChange?.({
          ventaEfectivo: inicialData.ventaEfectivo || 0,
          ventaTarjeta: inicialData.ventaTarjeta || 0,
          ventaMotorista: inicialData.ventaMotorista || 0,
          apertura: inicialData.apertura || 0,
          efectivo: inicialData.ventaEfectivo + inicialData.apertura,
          tarjeta: inicialData.ventaTarjeta || 0,
          motorista: inicialData.ventaMotorista || 0,
          total:
            inicialData.total !== undefined
              ? inicialData.total
              : inicialData.ventaEfectivo +
                inicialData.apertura +
                (inicialData.ventaTarjeta || 0) +
                (inicialData.ventaMotorista || 0),
          active: inicialData.active,
        });
      } else {
        // Modo edición: enviamos los valores calculados en tiempo real
        onDataChange?.({
          ventaEfectivo: ventaEfectivoNum,
          ventaTarjeta: ventaTarjetaNum,
          ventaMotorista: ventaMotoristaNum,
          apertura: aperturaNum,
          // “efectivo” para la resta con Arqueo:
          efectivo: efectivoTotal,
          // Exponemos tarjeta y motorista por separado también:
          tarjeta: ventaTarjetaNum,
          motorista: ventaMotoristaNum,
          total: totalSistema,
          active: isActive,
        });
      }
    }, [
      ventaEfectivoNum,
      ventaTarjetaNum,
      ventaMotoristaNum,
      aperturaNum,
      efectivoTotal,
      totalSistema,
      isActive,
      onDataChange,
      readonly,
      inicialData,
    ]);

    // ─────────── Exponer API de ref: getData() ───────────
    useImperativeHandle(ref, () => ({
      getData: () => {
        if (readonly && inicialData) {
          return {
            title,
            ventaEfectivo: inicialData.ventaEfectivo || 0,
            ventaTarjeta: inicialData.ventaTarjeta || 0,
            ventaMotorista: inicialData.ventaMotorista || 0,
            apertura: inicialData.apertura || 0,
            efectivo: inicialData.ventaEfectivo + inicialData.apertura,
            tarjeta: inicialData.ventaTarjeta || 0,
            motorista: inicialData.ventaMotorista || 0,
            total:
              inicialData.total !== undefined
                ? inicialData.total
                : inicialData.ventaEfectivo +
                  inicialData.apertura +
                  (inicialData.ventaTarjeta || 0) +
                  (inicialData.ventaMotorista || 0),
            active: inicialData.active,
          };
        }
        return {
          title,
          ventaEfectivo: ventaEfectivoNum,
          ventaTarjeta: ventaTarjetaNum,
          ventaMotorista: ventaMotoristaNum,
          apertura: aperturaNum,
          efectivo: efectivoTotal,
          tarjeta: ventaTarjetaNum,
          motorista: ventaMotoristaNum,
          total: totalSistema,
          active: isActive,
        };
      },
    }));

    // ─────────── Renderizado ───────────
    return (
      <div className="cierre-sistema-block">
        <div className="block-header">{title}</div>

        <div className="input-row">
          {/* Venta Efectivo */}
          <div className="input-field">
            <label htmlFor="ventaEfectivo">
              {readonly ? 'Efectivo:' : 'Venta Efectivo'}
            </label>
            <input
              id="ventaEfectivo"
              type="number"
              min="0"
              step="0.01"
              value={ventaEfectivo}
              onChange={(e) => setVentaEfectivo(e.target.value)}
              disabled={readonly || !isActive}
            />
          </div>

          {/* Venta Tarjeta */}
          <div className="input-field">
            <label htmlFor="ventaTarjeta">
              {readonly ? 'Tarjeta:' : 'Venta Tarjeta'}
            </label>
            <input
              id="ventaTarjeta"
              type="number"
              min="0"
              step="0.01"
              value={ventaTarjeta}
              onChange={(e) => setVentaTarjeta(e.target.value)}
              disabled={readonly || !isActive}
            />
          </div>

          {/* Venta Motorista */}
          <div className="input-field">
            <label htmlFor="ventaMotorista">
              {readonly ? 'Motorista:' : 'Venta Motorista'}
            </label>
            <input
              id="ventaMotorista"
              type="number"
              min="0"
              step="0.01"
              value={ventaMotorista}
              onChange={(e) => setVentaMotorista(e.target.value)}
              disabled={readonly || !isActive}
            />
          </div>

          {/* Apertura */}
          <div className="input-field">
            <label htmlFor="apertura">{readonly ? 'Apertura:' : 'Apertura'}</label>
            <input
              id="apertura"
              type="number"
              min="0"
              step="0.01"
              value={apertura}
              onChange={(e) => setApertura(e.target.value)}
              disabled={readonly || !isActive}
            />
          </div>
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

        <div className="total-row">
          <label>Total del Sistema:</label>
          <input
            type="number"
            readOnly
            value={
              readonly && inicialData
                ? parseFloat(
                    inicialData.total !== undefined
                      ? inicialData.total
                      : inicialData.ventaEfectivo +
                        inicialData.apertura +
                        (inicialData.ventaTarjeta || 0) +
                        (inicialData.ventaMotorista || 0)
                  ).toFixed(2)
                : totalSistema.toFixed(2)
            }
          />
        </div>
      </div>
    );
  }
);

export default CierreBlock;
