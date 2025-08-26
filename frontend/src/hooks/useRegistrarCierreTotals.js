// src/hooks/useRegistrarCierreTotals.js
import { useMemo } from 'react';
import { n } from '../utils/numbers';

// === Constantes y helpers a nivel de módulo (estables entre renders) ===
const DENOMS = [
  ['q200', 200],
  ['q100', 100],
  ['q50',  50],
  ['q20',  20],
  ['q10',  10],
  ['q5',    5],
  ['q1',    1],
];

const efectivoBrutoCaja = (c = {}) =>
  DENOMS.reduce((acc, [field, valor]) => acc + (n(c[field]) * valor), 0);

const aperturaCaja = (c = {}) => {
  const ap = c?.apertura;
  return Number.isFinite(+ap) ? +ap : 1000; // default 1000
};

const isAjusteCajaChica = (name) =>
  (name || '').toString().trim().toLowerCase() === 'ajuste de caja chica';

export function useRegistrarCierreTotals({
  arqueo = [],
  cierre = [],
  gastos = [],
  cajaChicaUsada = 0,
  faltantePagado = 0,
}) {
  // Arqueo (bruto / aperturas / neto)
  const totalArqueoEfectivoBruto = useMemo(
    () => (arqueo || []).reduce((acc, c) => acc + efectivoBrutoCaja(c), 0),
    [arqueo]
  );

  const totalAperturas = useMemo(
    () => (arqueo || []).reduce((s, c) => s + aperturaCaja(c), 0),
    [arqueo]
  );

  const totalArqueoEfectivoNeto = useMemo(
    () => (totalArqueoEfectivoBruto - totalAperturas),
    [totalArqueoEfectivoBruto, totalAperturas]
  );

  const totalArqueoTarjeta = useMemo(
    () => (arqueo || []).reduce((s, c) => s + n(c.tarjeta), 0),
    [arqueo]
  );

  const totalArqueoMotorista = useMemo(
    () => (arqueo || []).reduce((s, c) => s + n(c.motorista), 0),
    [arqueo]
  );

  // Cierre (sistema)
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

  // Gastos
  const totalGastos = useMemo(
    () => (gastos || []).reduce((s, g) => s + n(g.cantidad), 0),
    [gastos]
  );

  const totalAjusteCajaChica = useMemo(
    () => (gastos || []).reduce(
      (s, g) => s + (isAjusteCajaChica(g.categoria) ? n(g.cantidad) : 0),
      0
    ),
    [gastos]
  );

  // Diferencias (con efectivo NETO)
  const diferenciaEfectivo = useMemo(
    () => totalArqueoEfectivoNeto - totalCierreEfectivo,
    [totalArqueoEfectivoNeto, totalCierreEfectivo]
  );

  const faltanteEfectivo = useMemo(
    () => Math.max(0, -diferenciaEfectivo),
    [diferenciaEfectivo]
  );

  // Faltante por gastos (con neto)
  const faltantePorGastos = useMemo(() => {
    const diff =
      totalGastos - totalArqueoEfectivoNeto - n(cajaChicaUsada) - n(faltantePagado);
    return diff > 0 ? diff : 0;
  }, [totalGastos, totalArqueoEfectivoNeto, cajaChicaUsada, faltantePagado]);

  // Total a depositar (con neto)
  const totalGeneral = useMemo(
    () => totalArqueoEfectivoNeto - totalGastos + n(cajaChicaUsada) + n(faltantePagado),
    [totalArqueoEfectivoNeto, totalGastos, cajaChicaUsada, faltantePagado]
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
      totalAperturas,
      totalArqueoEfectivo: totalArqueoEfectivoBruto, // compat
      totalArqueoEfectivoBruto,
      totalArqueoEfectivoNeto,
      totalArqueoTarjeta,
      totalArqueoMotorista,

      totalCierreEfectivo,
      totalCierreTarjeta,
      totalCierreMotorista,

      totalGastos,
      totalAjusteCajaChica,

      diferenciaEfectivo,
      faltanteEfectivo,
      faltantePorGastos,

      totalGeneral,
    },
    flags,
  };
}
