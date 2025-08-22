// src/hooks/useRegistrarCierreTotals.js
import { useMemo } from 'react';
import { n } from '../utils/numbers';

const isAjusteCajaChica = (name) =>
  (name || '').toString().trim().toLowerCase() === 'ajuste de caja chica';

export function useRegistrarCierreTotals({
  arqueo,
  cierre,
  gastos,
  cajaChicaUsada,
  faltantePagado,
}) {
  const totalEfectivoCaja = (c = {}) =>
    n(c.q100) + n(c.q50) + n(c.q20) + n(c.q10) + n(c.q5) + n(c.q1);

  // ---- ARQUEO (ADMIN)
  const totalArqueoEfectivo = useMemo(
    () => (arqueo || []).reduce((acc, c) => acc + totalEfectivoCaja(c), 0),
    [arqueo]
  );
  const totalArqueoTarjeta = useMemo(
    () => (arqueo || []).reduce((s, c) => s + n(c.tarjeta), 0),
    [arqueo]
  );
  const totalArqueoMotorista = useMemo(
    () => (arqueo || []).reduce((s, c) => s + n(c.motorista), 0),
    [arqueo]
  );

  // ---- CIERRE (SISTEMA)
  const totalCierreEfectivo = useMemo(
    () => (cierre || []).reduce((s, c) => s + n(c.efectivo), 0),
    [cierre]
  );
  const totalCierreTarjeta = useMemo(
    () => (cierre || []).reduce((s, c) => s + n(c.tarjeta), 0),
    [cierre]
  );
  const totalCierreMotorista = useMemo(
    () => (cierre || []).reduce((s, c) => s + n(c.motorista), 0),
    [cierre]
  );

  // ---- GASTOS
  const totalGastos = useMemo(
    () => (gastos || []).reduce((s, g) => s + n(g.cantidad), 0),
    [gastos]
  );

  // Ajuste de caja chica (si lo sigues usando como referencia)
  const totalAjusteCajaChica = useMemo(
    () =>
      (gastos || []).reduce(
        (s, g) => s + (isAjusteCajaChica(g.categoria) ? n(g.cantidad) : 0),
        0
      ),
    [gastos]
  );

  // ---- DIFERENCIAS (usando DIRECTAMENTE el efectivo de arqueo)
  // Regla: efectivo de arqueo - efectivo del sistema
  const diferenciaEfectivo = useMemo(
    () => totalArqueoEfectivo - totalCierreEfectivo,
    [totalArqueoEfectivo, totalCierreEfectivo]
  );
  const faltanteEfectivo = useMemo(
    () => Math.max(0, -diferenciaEfectivo),
    [diferenciaEfectivo]
  );

  // Para cubrir gastos considerando caja chica y faltante pagado
  const faltantePorGastos = useMemo(() => {
    const diff = totalGastos - totalArqueoEfectivo - n(cajaChicaUsada) - n(faltantePagado);
    return diff > 0 ? diff : 0;
  }, [totalGastos, totalArqueoEfectivo, cajaChicaUsada, faltantePagado]);

  // ---- TOTAL A DEPOSITAR
  //   efectivo de arqueo − gastos + cajaChicaUsada + faltantePagado
  const totalGeneral = useMemo(
    () => totalArqueoEfectivo - totalGastos + n(cajaChicaUsada) + n(faltantePagado),
    [totalArqueoEfectivo, totalGastos, cajaChicaUsada, faltantePagado]
  );

  const flags = useMemo(
    () => ({
      diffEsPositivo: diferenciaEfectivo >= 0,
      diffLabel: diferenciaEfectivo >= 0 ? 'Sobrante' : 'Faltante',
      diffAbs: Math.abs(diferenciaEfectivo),
      isDepositNegative: totalGeneral < 0,
    }),
    [diferenciaEfectivo, totalGeneral]
  );

  return {
    totals: {
      // Arqueo
      totalArqueoEfectivo, // 👈 valor único de referencia
      totalArqueoTarjeta,
      totalArqueoMotorista,

      // Cierre
      totalCierreEfectivo,
      totalCierreTarjeta,
      totalCierreMotorista,

      // Gastos / ajustes
      totalGastos,
      totalAjusteCajaChica,

      // Diferencias
      diferenciaEfectivo,
      faltanteEfectivo,
      faltantePorGastos,

      // Depósito
      totalGeneral,
    },
    flags,
  };
}
