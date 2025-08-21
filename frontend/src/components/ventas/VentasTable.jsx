import React from 'react';
import { formatDate } from '../../utils/dates';

export default function VentasTable({ cuadres, sucursalesMap, onVer, onEditar, onDescargar, onEliminar }) {
  return (
    <section className="ventas-tabla-wrap">
      <table className="ventas-tabla">
        <thead><tr><th>Fecha</th><th>Sucursal</th><th>Acciones</th></tr></thead>
        <tbody>
          {cuadres.map(c => (
            <tr key={c.id}>
              <td>{formatDate(c.fecha)}</td>
              <td>{sucursalesMap[c.sucursalId] || 'Sin sucursal'}</td>
              <td className="acciones">
                <button className="btn btn-min" onClick={() => onVer(c)}>Ver</button>
                <button className="btn btn-min" onClick={() => onEditar(c)}>Editar</button>
                <button className="btn btn-min" onClick={() => onDescargar(c)}>Descargar</button>
                <button className="btn btn-min danger" onClick={() => onEliminar(c.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {!cuadres.length && (
            <tr><td colSpan="3" className="empty">Sin registros para la selección.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
