export const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

export const clamp = (x, min=0, max=Infinity) => Math.max(min, Math.min(max, x));

export const toMoney = (x) => `Q ${Number(x || 0).toFixed(2)}`;

// permite vacío o número
export const isNumericOrEmpty = (v) =>
  v === '' || v === null || v === undefined || !isNaN(parseFloat(v));

export const totalEfectivoCaja = (c = {}) =>
  n(c.q100) + n(c.q50) + n(c.q20) + n(c.q10) + n(c.q5) + n(c.q1);
