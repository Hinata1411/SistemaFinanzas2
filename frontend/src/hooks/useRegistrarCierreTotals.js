import { useMemo, useEffect } from 'react';
import { n } from '../utils/numbers';

export function useRegistrarCierreTotals({ arqueo, cierre, gastos, cajaChicaUsada, faltantePagado }) {
  const totalEfectivoCaja = (c) =>
    n(c.q100) + n(c.q50) + n(c.q20) + n(c.q10) + n(c.q5) + n(c.q1);

  const totalArqueoEfectivo = useMemo(
    () => arqueo.reduce((acc, c) => acc + totalEfectivoCaja(c), 0),
    [arqueo]
  );
  const totalArqueoTarjeta = useMemo(() => arqueo.reduce((s,c)=>s+n(c.tarjeta),0), [arqueo]);
  const totalArqueoMotorista = useMemo(() => arqueo.reduce((s,c)=>s+n(c.motorista),0), [arqueo]);

  const totalCierreEfectivo = useMemo(() => cierre.reduce((s,c)=>s+n(c.efectivo),0), [cierre]);
  const totalCierreTarjeta  = useMemo(() => cierre.reduce((s,c)=>s+n(c.tarjeta),0), [cierre]);
  const totalCierreMotorista= useMemo(() => cierre.reduce((s,c)=>s+n(c.motorista),0), [cierre]);

  const totalGastos = useMemo(() => gastos.reduce((s,g)=>s+n(g.cantidad),0), [gastos]);

  // Diferencia de EFECTIVO (según tu regla):
  const diferenciaEfectivo = useMemo(
    () => totalArqueoEfectivo - totalCierreEfectivo,
    [totalArqueoEfectivo, totalCierreEfectivo]
  );
  const faltanteEfectivo = useMemo(() => Math.max(0, -diferenciaEfectivo), [diferenciaEfectivo]);

  // >>> faltante por gastos que debe contemplar cajaChicaUsada y faltantePagado
  const faltantePorGastos = useMemo(() => {
    const diff = totalGastos - totalArqueoEfectivo - cajaChicaUsada - faltantePagado;
    return diff > 0 ? diff : 0;
  }, [totalGastos, totalArqueoEfectivo, cajaChicaUsada, faltantePagado]);

  // Total a depositar = Efectivo(Admin) – Gastos + CajaChicaUsada + FaltantePagado
  const totalGeneral = useMemo(
    () => totalArqueoEfectivo - totalGastos + cajaChicaUsada + faltantePagado,
    [totalArqueoEfectivo, totalGastos, cajaChicaUsada, faltantePagado]
  );

  const flags = useMemo(() => ({
    diffEsPositivo: diferenciaEfectivo >= 0,
    diffLabel: diferenciaEfectivo >= 0 ? 'Sobrante' : 'Faltante',
    diffAbs: Math.abs(diferenciaEfectivo),
    isDepositNegative: totalGeneral < 0,
  }), [diferenciaEfectivo, totalGeneral]);

  return {
    totals: {
      totalArqueoEfectivo, totalArqueoTarjeta, totalArqueoMotorista,
      totalCierreEfectivo, totalCierreTarjeta, totalCierreMotorista,
      totalGastos, diferenciaEfectivo, faltanteEfectivo, faltantePorGastos, totalGeneral,
    },
    flags
  };
}
