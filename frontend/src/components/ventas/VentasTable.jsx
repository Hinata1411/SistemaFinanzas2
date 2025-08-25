// src/components/ventas/VentasTable.jsx
import React from 'react';
import { n, totalEfectivoCaja, toMoney } from '../../utils/numbers';
import { formatDate } from '../../utils/dates';

export default function VentasTable({
  cuadres = [],
  sucursalesMap = {},
  onVer,
  onEditar,
  onDescargar,
  onEliminar,
  // Flags (por defecto true para compatibilidad hacia atrás)
  canManage = true,     // controla Editar / Eliminar
  canDownload = true,   // controla Descargar PDF
}) {
  const Acciones = ({ c }) => (
    <div className="acciones">
      <button className="btn-min" onClick={() => onVer && onVer(c)}>Ver</button>

      {canManage && (
        <button className="btn-min" onClick={() => onEditar && onEditar(c)}>Editar</button>
      )}

      {canDownload && (
        <button className="btn-min" onClick={() => onDescargar && onDescargar(c)}>
          Descargar
        </button>
      )}

      {canManage && (
        <button className="btn-min danger" onClick={() => onEliminar && onEliminar(c.id)}>
          Eliminar
        </button>
      )}
    </div>
  );

  return (
    <div className="ventas-tabla-wrap">
      <table className="ventas-tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Sucursal</th>
            <th>Efectivo</th>
            <th>Tarjeta</th>
            <th>Motorista</th>
            <th>Total a depositar</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {cuadres.length === 0 ? (
            <tr>
              <td className="empty" colSpan={7}>Sin registros</td>
            </tr>
          ) : (
            cuadres.map((c) => {
              // Arqueo Físico
              const arq = Array.isArray(c.arqueo) ? c.arqueo : [];

              // Montos base (n fuerza número)
              const ef  = arq.reduce((acc, x) => acc + totalEfectivoCaja(x), 0);
              const tar = arq.reduce((acc, x) => acc + n(x.tarjeta), 0);
              const mot = arq.reduce((acc, x) => acc + n(x.motorista), 0);

              // Preferir total a depositar guardado; si no viene, usar ef + tar
              const savedRaw = c?.totales?.totalGeneral;
              const hasSaved = savedRaw !== undefined && savedRaw !== null && savedRaw !== '';
              const totalDepositar = hasSaved ? n(savedRaw) : (ef + tar);

              return (
                <tr key={c.id}>
                  <td>{formatDate(c.fecha)}</td>
                  <td>{sucursalesMap[c.sucursalId] || '—'}</td>
                  <td>{toMoney(ef)}</td>
                  <td>{toMoney(tar)}</td>
                  <td>{toMoney(mot)}</td>
                  <td>{toMoney(totalDepositar)}</td>
                  <td><Acciones c={c} /></td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
