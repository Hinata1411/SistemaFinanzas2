export const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
export const clamp = (x, min=0, max=Infinity) => Math.max(min, Math.min(max, x));
export const toMoney = (x) => `Q ${Number(x || 0).toFixed(2)}`;
