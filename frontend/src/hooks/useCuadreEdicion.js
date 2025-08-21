import { useReducer, useMemo } from 'react';
import { n, totalEfectivoCaja } from '../utils/numbers';

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': return { ...action.payload, isEditing: true };
    case 'FIELD_ARQUEO': {
      const { idx, field, value } = action;
      const arq = state.arqueo.map((c, i) => i === idx ? { ...c, [field]: value } : c);
      return { ...state, arqueo: arq };
    }
    case 'FIELD_CIERRE': {
      const { idx, field, value } = action;
      const cier = state.cierre.map((c, i) => i === idx ? { ...c, [field]: value } : c);
      return { ...state, cierre: cier };
    }
    case 'FIELD_GASTO': {
      const { i, field, value } = action;
      const gastos = state.gastos.map((g, idx) => idx === i ? { ...g, [field]: value } : g);
      return { ...state, gastos };
    }
    case 'SET': return { ...state, [action.key]: action.value };
    case 'RESET': return null;
    default: return state;
  }
}

export function useCuadreEdicion(fuente) {
  const [state, dispatch] = useReducer(reducer, null);

  const cargar = (c) => dispatch({ type: 'LOAD', payload: {
    arqueo: (c.arqueo || [{},{},{}]).map(x=>({...x})),
    cierre: (c.cierre || [{},{},{}]).map(x=>({...x})),
    gastos: (c.gastos || []).map(x=>({...x})),
    comentario: c.comentario || '',
    cajaChicaUsada: n(c.cajaChicaUsada),
    faltantePagado: n(c.faltantePagado),
  }});

  const metrics = useMemo(() => {
    const arqueo = state?.arqueo || fuente?.arqueo || [{},{},{}];
    const cierre = state?.cierre || fuente?.cierre || [{},{},{}];
    const gastos = state?.gastos || fuente?.gastos || [];

    const totalArqEf = arqueo.reduce((a,c)=> a + totalEfectivoCaja(c), 0);
    const totalArqTar = arqueo.reduce((a,c)=> a + n(c.tarjeta), 0);
    const totalArqMot = arqueo.reduce((a,c)=> a + n(c.motorista), 0);

    const totalCieEf = cierre.reduce((a,c)=> a + n(c.efectivo), 0);
    const totalCieTar = cierre.reduce((a,c)=> a + n(c.tarjeta), 0);
    const totalCieMot = cierre.reduce((a,c)=> a + n(c.motorista), 0);

    const totalGastos = gastos.reduce((s,g)=> s + n(g.cantidad), 0);
    const cajaChicaUsada = n(state?.cajaChicaUsada ?? fuente?.cajaChicaUsada);
    const faltantePagado = n(state?.faltantePagado ?? fuente?.faltantePagado);

    const diffEf = totalArqEf - totalCieEf;
    const totalGeneral = totalArqEf - totalGastos + cajaChicaUsada + faltantePagado;

    return {
      totalArqEf, totalArqTar, totalArqMot,
      totalCieEf, totalCieTar, totalCieMot,
      totalGastos, diffEf, totalGeneral, cajaChicaUsada, faltantePagado
    };
  }, [state, fuente]);

  return { state, dispatch, cargar, metrics };
}
