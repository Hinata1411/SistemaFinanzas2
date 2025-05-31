import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import './TotalesBlock.css';

const TotalesBlock = forwardRef(
  (
    {
      arqueoData = [],
      cierreData = [],
      gastosData = [],
      sumDifEfectivo = 0,
      sucursalId // ID de sucursal para obtener caja chica
    },
    ref
  ) => {
    // — Ventas Total Sistema —
    const brutoVentaEfectivo = useMemo(
      () => cierreData.reduce((acc, box) => acc + (Number(box.efectivo) || 0), 0),
      [cierreData]
    );
    const totalApertura = useMemo(
      () => cierreData.reduce((acc, box) => acc + (Number(box.apertura) || 0), 0),
      [cierreData]
    );
    const totalVentaEfectivo = useMemo(
      () => brutoVentaEfectivo - totalApertura,
      [brutoVentaEfectivo, totalApertura]
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

    // — Control Administración —
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

    // — Diferencias —
    const difEfectivo = useMemo(
      () => sumDifEfectivo,
      [sumDifEfectivo]
    );
    const difTarjeta = useMemo(
      () =>
        arqueoData.reduce((acc, box) => acc + (Number(box.tarjeta) || 0), 0) -
        cierreData.reduce((acc, box) => acc + (Number(box.tarjeta) || 0), 0),
      [arqueoData, cierreData]
    );
    const diferenciaTotal = useMemo(
      () => difEfectivo + difTarjeta,
      [difEfectivo, difTarjeta]
    );
    const sobranteLabel = useMemo(
      () =>
        diferenciaTotal > 0
          ? `Sobrante: Q. ${diferenciaTotal.toFixed(2)}`
          : diferenciaTotal < 0
          ? `Faltante: Q. ${Math.abs(diferenciaTotal).toFixed(2)}`
          : `0`,
      [diferenciaTotal]
    );

    // — Total a depositar —
    const totalDepositar = useMemo(
    () => ventaEfectivoControl + totalArqueoMotorista - totalGastos,
    [ventaEfectivoControl, totalArqueoMotorista, totalGastos]
  );


    // — Caja Chica —
    const [cajaChica, setCajaChica] = useState(0);
    const [cajaUsada, setCajaUsada] = useState(0);

    useEffect(() => {
  if (!sucursalId) return;

  const fetchCaja = async () => {
    try {
      const refDoc = doc(db, 'sucursales', sucursalId);
      const snap = await getDoc(refDoc);
      if (snap.exists()) {
        const data = snap.data();
        const caja = Number(data.cajaChica);
        console.log('🔥 Caja chica desde Firestore:', caja);
        setCajaChica(isNaN(caja) ? 0 : caja);
      } else {
        console.warn('⚠️ No existe sucursal con ID:', sucursalId);
        setCajaChica(0);
      }
    } catch (error) {
      console.error('❌ Error al cargar caja chica:', error);
      setCajaChica(0);
    }
  };

  fetchCaja();
}, [sucursalId]);


    const handleUsarCajaChica = async () => {
      let monto;
      do {
        const entrada = window.prompt(
          `Caja chica disponible: Q. ${cajaChica.toFixed(2)}. Ingrese monto a usar:`
        );
        if (entrada === null) return;
        monto = parseFloat(entrada);
        if (isNaN(monto) || monto < 0) {
          alert('Ingrese un número válido.');
        } else if (monto > cajaChica) {
          alert('Excede la cantidad de caja chica.');
        } else {
          const refDoc = doc(db, 'sucursales', sucursalId);
          await updateDoc(refDoc, { cajaChica: cajaChica - monto });
          setCajaChica(prev => prev - monto);
          setCajaUsada(monto);
          break;
        }
      } while (true);
    };

    const totalAjustado = useMemo(
      () => totalDepositar + cajaUsada,
      [totalDepositar, cajaUsada]
    );

    const [comentario, setComentario] = useState('');
    useImperativeHandle(ref, () => ({ getData: () => ({ comentario }) }));

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
            <tr><th colSpan="2">Ventas Total Sistema</th></tr>
            <tr><td>Venta Efectivo</td><td>Q. {totalVentaEfectivo.toFixed(2)}</td></tr>
            <tr><td>Venta Tarjeta</td><td>Q. {totalVentaTarjeta.toFixed(2)}</td></tr>
            <tr><td>Venta Motorista</td><td>Q. {totalVentaMotorista.toFixed(2)}</td></tr>
            <tr><td>Total Sistema</td><td>Q. {totalSistema.toFixed(2)}</td></tr>

            <tr><th colSpan="2">Control Administración</th></tr>
            <tr><td>Caja Chica</td><td>Q. {cajaChica.toFixed(2)}</td></tr>
            <tr><td>Venta en Efectivo</td><td>Q. {ventaEfectivoControl.toFixed(2)}</td></tr>
            <tr><td>Venta Motorista</td><td>Q. {totalArqueoMotorista.toFixed(2)}</td></tr>
            <tr><td>Gastos</td><td>Q. {totalGastos.toFixed(2)}</td></tr>
            <tr>
              <td>Sobrante/Faltante</td>
              <td style={{ color: diferenciaTotal > 0 ? 'green' : diferenciaTotal < 0 ? 'red' : 'inherit' }}>
                {sobranteLabel}
              </td>
            </tr>
            <tr>
              <td>Total a Depositar</td>
              <td>
                Q. {totalAjustado.toFixed(2)}
                {totalAjustado < 0 && cajaChica > 0 && (
                  <button className="usar-caja-btn" onClick={handleUsarCajaChica}>
                    Usar Caja Chica
                  </button>
                )}
              </td>
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