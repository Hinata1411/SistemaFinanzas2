import React, { useMemo } from 'react';
import './DiferenciasTable.css';

const DiferenciasTable = ({ arqueoData = [], cierreData = [] }) => {
  const rows = useMemo(() =>
    arqueoData.map((arqueo, idx) => {
      const cierre = cierreData[idx] || {};
      const efectivoA = Number(arqueo.efectivo) || 0;
      const efectivoC = Number(cierre.efectivo) || 0;
      const tarjetaA = Number(arqueo.tarjeta) || 0;
      const tarjetaC = Number(cierre.tarjeta) || 0;
      const motoristaA = Number(arqueo.motorista) || 0;
      const motoristaC = Number(cierre.motorista) || 0;

      return {
        caja: `Caja ${idx + 1}`,
        difEfectivo: efectivoA - efectivoC,
        difTarjeta: tarjetaA - tarjetaC,
        difMotorista: motoristaA - motoristaC,
      };
    }),
    [arqueoData, cierreData]
  );

  const totals = useMemo(() =>
    rows.reduce(
      (acc, { difEfectivo, difTarjeta, difMotorista }) => ({
        difEfectivo: acc.difEfectivo + difEfectivo,
        difTarjeta: acc.difTarjeta + difTarjeta,
        difMotorista: acc.difMotorista + difMotorista,
      }),
      { difEfectivo: 0, difTarjeta: 0, difMotorista: 0 }
    ),
    [rows]
  );

  const getColor = (val) =>
    val < 0 ? 'red' : val > 0 ? 'green' : 'inherit';

  const fmt = (val) => val.toFixed(2);

  return (
    <div className="diferencias-table panel">
      <div className="toggle-header">
        <div className="line" />
        <div className="header-center">
          <span className="panel-title">Diferencias</span>
        </div>
        <div className="line" />
      </div>

      <table className="table-fixed">
        <thead>
          <tr>
            <th>Caja</th>
            <th>Dif. Efectivo</th>
            <th>Dif. Tarjeta</th>
            <th>Dif. Motorista</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            <>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.caja}</td>
                  <td style={{ color: getColor(row.difEfectivo) }}>
                    {fmt(row.difEfectivo)}
                  </td>
                  <td style={{ color: getColor(row.difTarjeta) }}>
                    {fmt(row.difTarjeta)}
                  </td>
                  <td style={{ color: getColor(row.difMotorista) }}>
                    {fmt(row.difMotorista)}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td style={{ color: getColor(totals.difEfectivo), fontWeight: 'bold' }}>
                  {fmt(totals.difEfectivo)}
                </td>
                <td style={{ color: getColor(totals.difTarjeta), fontWeight: 'bold' }}>
                  {fmt(totals.difTarjeta)}
                </td>
                <td style={{ color: getColor(totals.difMotorista), fontWeight: 'bold' }}>
                  {fmt(totals.difMotorista)}
                </td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan="4" className="text-center">
                No hay datos para mostrar
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DiferenciasTable;
