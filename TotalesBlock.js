import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import './TotalesBlock.css';

const TotalesBlock = forwardRef(
  (
    {
      arqueoData = [],
      cierreData = [],
      gastosData = [],
      sumDifEfectivo = 0,
    },
    ref
  ) => {
    const totalVentaEfectivo = useMemo(
      () => cierreData.reduce((acc, box) => acc + (Number(box.efectivo) || 0), 0),
      [cierreData]
    );
    const totalVentaTarjeta = useMemo(
      () => cierreData.reduce((acc, box) => acc + (Number(box.tarjeta) || 0), 0),
      [cierreData]
    );
    const totalVentaMotorista = useMemo(
      () => cierreData.reduce((acc, box) => acc + (Number(box.motorista) || 0), 0),
      [cierreData]
    );
    const totalSistema = useMemo(
      () => totalVentaEfectivo + totalVentaTarjeta + totalVentaMotorista,
      [totalVentaEfectivo, totalVentaTarjeta, totalVentaMotorista]
    );

    const totalArqueoEfectivo = useMemo(
      () => arqueoData.reduce((acc, box) => acc + (Number(box.efectivo) || 0), 0),
      [arqueoData]
    );
    const totalCierreApertura = useMemo(
      () => cierreData.reduce((acc, box) => acc + (Number(box.apertura) || 0), 0),
      [cierreData]
    );
    const ventaEfectivoControl = useMemo(
      () => totalArqueoEfectivo - totalCierreApertura,
      [totalArqueoEfectivo, totalCierreApertura]
    );
    const totalArqueoMotorista = useMemo(
      () => arqueoData.reduce((acc, box) => acc + (Number(box.motorista) || 0), 0),
      [arqueoData]
    );

    const totalGastos = useMemo(
      () => gastosData.reduce((sum, g) => sum + (Number(g.cantidad) || 0), 0),
      [gastosData]
    );

    const sobrante = useMemo(() => sumDifEfectivo, [sumDifEfectivo]);
    const sobranteLabel = useMemo(
      () =>
        sobrante >= 0
          ? `Sobrante: Q. ${sobrante.toFixed(2)}`
          : `Faltante: Q. ${Math.abs(sobrante).toFixed(2)}`,
      [sobrante]
    );

    const totalDepositar = useMemo(
      () => ventaEfectivoControl - totalGastos,
      [ventaEfectivoControl, totalGastos]
    );

    const [comentario, setComentario] = useState('');

    useImperativeHandle(ref, () => ({
      getData: () => ({ comentario }),
    }));

    return (
      <div className="totales-block panel">
        <div className="toggle-header">
          <div className="line" />
          <div className="header-center">
            <span className="panel-title">Totales</span>
          </div>
          <div className="line" />
        </div>

        <table className="totales-table">
          <tbody>
            <tr>
              <th colSpan="2">Ventas Total Sistema</th>
            </tr>
            <tr>
              <td>Venta Efectivo</td>
              <td>Q. {totalVentaEfectivo.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Venta Tarjeta</td>
              <td>Q. {totalVentaTarjeta.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Venta Motorista</td>
              <td>Q. {totalVentaMotorista.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total Sistema</td>
              <td>Q. {totalSistema.toFixed(2)}</td>
            </tr>

            <tr>
              <th colSpan="2">Control Administración</th>
            </tr>
            <tr>
              <td>Venta en Efectivo</td>
              <td>Q. {ventaEfectivoControl.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Motorista</td>
              <td>Q. {totalArqueoMotorista.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Gastos</td>
              <td>Q. {totalGastos.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Sobrante/Faltante</td>
              <td>{sobranteLabel}</td>
            </tr>
            <tr>
              <td>Total a Depositar</td>
              <td>Q. {totalDepositar.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="comentario">
          <label htmlFor="comentario">Comentario:</label>
          <textarea
            id="comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Agregue un comentario..."
          />
        </div>
      </div>
    );
  }
);

export default TotalesBlock;
