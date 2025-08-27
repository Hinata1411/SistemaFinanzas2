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
  canManage = true,   // Editar / Eliminar (true solo para admin en tu lógica actual)
  canDownload = true, // Descargar PDF
  isAdmin = false,    // Opcional: si no lo pasas, se infiere con canManage
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

  // HH:mm (preferimos createdAt; fallback updatedAt). Acepta Timestamp|Date|string
  const toLocalHour = (tsLike) => {
    if (!tsLike) return '—';
    let d = null;
    if (typeof tsLike?.toDate === 'function') d = tsLike.toDate(); // Firestore Timestamp
    else if (typeof tsLike?.seconds === 'number') d = new Date(tsLike.seconds * 1000);
    else d = new Date(tsLike);
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Mostrar columnas de admin si explícitamente isAdmin || si puede gestionar
  const showAdminCols = isAdmin || canManage;
  const EMPTY_COLSPAN = showAdminCols ? 9 : 7;

  return (
    <div className="ventas-tabla-wrap">
      <table className="ventas-tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            {showAdminCols && <th>Sucursal</th>}
            {showAdminCols && <th>Usuario</th>}
            <th>Efectivo</th>
            <th>Tarjeta</th>
            <th>Motorista</th>
            <th>Total a depositar</th>
            <th>Hora</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {cuadres.length === 0 ? (
            <tr>
              <td className="empty" colSpan={EMPTY_COLSPAN}>Sin registros</td>
            </tr>
          ) : (
            cuadres.map((c) => {
              // Totales desde Arqueo Físico
              const arq = Array.isArray(c.arqueo) ? c.arqueo : [];
              const ef  = arq.reduce((acc, x) => acc + totalEfectivoCaja(x), 0);
              const tar = arq.reduce((acc, x) => acc + n(x.tarjeta), 0);
              const mot = arq.reduce((acc, x) => acc + n(x.motorista), 0);

              // Preferir totalGeneral calculado/guardado; si no, EF+TAR
              const savedRaw = c?.totales?.totalGeneral;
              const hasSaved = savedRaw !== undefined && savedRaw !== null && savedRaw !== '';
              const totalDepositar = hasSaved ? n(savedRaw) : (ef + tar);

              // Usuario (evita renderizar objetos)
              const usuario =
                c?.username ||
                c?.createdBy?.username ||
                c?.createdByUsername ||
                '—';

              // Hora (createdAt > updatedAt)
              const hora = toLocalHour(c?.createdAt || c?.updatedAt);

              return (
                <tr key={c.id}>
                  <td>{formatDate(c.fecha)}</td>
                  {showAdminCols && <td>{sucursalesMap[c.sucursalId] || '—'}</td>}
                  {showAdminCols && <td>{usuario}</td>}
                  <td>{toMoney(ef)}</td>
                  <td>{toMoney(tar)}</td>
                  <td>{toMoney(mot)}</td>
                  <td>{toMoney(totalDepositar)}</td>
                  <td>{hora}</td>
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
