// src/components/ventas/VentasTable.jsx
import React from 'react';
import { n, totalEfectivoCaja } from '../../utils/numbers';
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
  // Render auxiliar de acciones por fila
  const Acciones = ({ c }) => {
    return (
      <div className="acciones">
        <button className="btn-min" onClick={() => onVer && onVer(c)}>
          Ver
        </button>

        {canManage && (
          <button className="btn-min" onClick={() => onEditar && onEditar(c)}>
            Editar
          </button>
        )}

        {canDownload && (
          <button className="btn-min" onClick={() => onDescargar && onDescargar(c)}>
            Descargar
          </button>
        )}

        {canManage && (
          <button
            className="btn-min danger"
            onClick={() => onEliminar && onEliminar(c.id)}
          >
            Eliminar
          </button>
        )}
      </div>
    );
  };

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
            <th>Total</th>
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
              // Usar SIEMPRE Arqueo Físico
              const arq = Array.isArray(c.arqueo) ? c.arqueo : [];

              const ef  = arq.reduce((acc, x) => acc + totalEfectivoCaja(x), 0);
              const tar = arq.reduce((acc, x) => acc + n(x.tarjeta), 0);
              const mot = arq.reduce((acc, x) => acc + n(x.motorista), 0);

              // Total solo incluye EFECTIVO + TARJETA (motorista es referencia)
              const tot = ef + tar;

              return (
                <tr key={c.id}>
                  <td>{formatDate(c.fecha)}</td>
                  <td>{sucursalesMap[c.sucursalId] || '—'}</td>
                  <td>{ef.toFixed(2)}</td>
                  <td>{tar.toFixed(2)}</td>
                  <td>{mot.toFixed(2)}</td>
                  <td>{tot.toFixed(2)}</td>
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
