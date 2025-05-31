import React from 'react';
import './CuadreBlock.css';

const CuadreBlock = ({ arqueoData, cierreData }) => {
  // Suponemos que cada elemento de arqueoData es un objeto con:
  // { totalEffective, tarjeta, motorista }
  // Y cada elemento de cierreData es un objeto con:
  // { ventaEfectivo, ventaTarjeta, ventaMotorista }
  
  const rows = arqueoData.map((arqueo, i) => {
    const cierre = cierreData[i] || {};
    const efectivoArq = parseFloat(arqueo.totalEffective) || 0;
    const efectivoCierre = parseFloat(cierre.ventaEfectivo) || 0;
    const difEfectivo = efectivoArq - efectivoCierre;
    
    const tarjetaArq = parseFloat(arqueo.tarjeta) || 0;
    const tarjetaCierre = parseFloat(cierre.ventaTarjeta) || 0;
    const difTarjeta = tarjetaArq - tarjetaCierre;
    
    const motoristaArq = parseFloat(arqueo.motorista) || 0;
    const motoristaCierre = parseFloat(cierre.ventaMotorista) || 0;
    const difMotorista = motoristaArq - motoristaCierre;
    
    return {
      caja: `Caja ${i + 1}`,
      difEfectivo,
      difTarjeta,
      difMotorista,
    };
  });

  const totalDifEfectivo = rows.reduce((sum, row) => sum + row.difEfectivo, 0);
  const totalDifTarjeta = rows.reduce((sum, row) => sum + row.difTarjeta, 0);
  const totalDifMotorista = rows.reduce((sum, row) => sum + row.difMotorista, 0);

  return (
    <div className="cuadre-block">
      <h2>Diferencias</h2>
      <table>
        <thead>
          <tr>
            <th>Caja</th>
            <th>Venta Efectivo</th>
            <th>Venta Tarjeta</th>
            <th>Venta Motorista</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.caja}</td>
              <td>{row.difEfectivo}</td>
              <td>{row.difTarjeta}</td>
              <td>{row.difMotorista}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td>Total</td>
            <td>{totalDifEfectivo}</td>
            <td>{totalDifTarjeta}</td>
            <td>{totalDifMotorista}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CuadreBlock;
