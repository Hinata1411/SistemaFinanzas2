// src/utils/kpi.js
import {
  collection, getDocs, query, where, orderBy, limit, doc, updateDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';

// ---- Helpers
const toMillis = (tsLike) => {
  if (!tsLike) return 0;
  if (typeof tsLike?.toDate === 'function') return tsLike.toDate().getTime();
  if (typeof tsLike?.seconds === 'number') return tsLike.seconds * 1000;
  const d = new Date(tsLike);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const getKpiFromCuadre = (c) => {
  const raw = c?.totales?.totalGeneral;
  const v = typeof raw === 'number' ? raw : parseFloat(raw || 0);
  return Number.isFinite(v) ? v : 0;
};

const getKpiFromPago = (p) =>
  Number(p?.sobranteParaManana ?? p?.kpiDepositosAtSave ?? 0);

// ---- Recalcular KPI tomando el doc más reciente entre pagos/cierres
export const recomputeSucursalKPI = async (sucursalId) => {
  const candidatos = [];
  const pagosRef = collection(db, 'pagos');
  const cierresRef = collection(db, 'cierres');
  const sucRef = doc(db, 'sucursales', sucursalId);

  const pushPago = (p) => p && candidatos.push({
    ts: toMillis(p.createdAt || p.updatedAt || p.fecha),
    val: getKpiFromPago(p),
  });
  const pushCierre = (c) => c && candidatos.push({
    ts: toMillis(c.createdAt || c.updatedAt || c.fecha),
    val: getKpiFromCuadre(c),
  });

  const tryQuery = async (q, onDoc) => {
    try {
      const s = await getDocs(q);
      s.forEach(d => onDoc(d.data() || {}));
      return true;
    } catch (e) {
      console.warn('recomputeSucursalKPI query failed:', e?.code, e?.message);
      return false;
    }
  };

  const anyPreferredWorked = (await Promise.all([
    tryQuery(query(pagosRef,  where('sucursalId','==',sucursalId), orderBy('createdAt','desc'), limit(1)), pushPago),
    tryQuery(query(pagosRef,  where('sucursalId','==',sucursalId), orderBy('fecha','desc'),     limit(1)), pushPago),
    tryQuery(query(cierresRef, where('sucursalId','==',sucursalId), orderBy('createdAt','desc'), limit(1)), pushCierre),
    tryQuery(query(cierresRef, where('sucursalId','==',sucursalId), orderBy('fecha','desc'),     limit(1)), pushCierre),
  ])).some(Boolean);

  if (!anyPreferredWorked || candidatos.length === 0) {
    try {
      const sPagos   = await getDocs(query(pagosRef,  where('sucursalId','==',sucursalId)));
      const sCierres = await getDocs(query(cierresRef, where('sucursalId','==',sucursalId)));
      sPagos.forEach(d => pushPago(d.data() || {}));
      sCierres.forEach(d => pushCierre(d.data() || {}));
    } catch (e) {
      console.warn('recomputeSucursalKPI fallback failed:', e?.code, e?.message);
    }
  }

  if (candidatos.length === 0) {
    console.warn('recomputeSucursalKPI: sin candidatos; KPI se mantiene igual.');
    return;
  }

  const best = candidatos.sort((a,b) => (b.ts||0)-(a.ts||0))[0];
  const newKpi = Number(best?.val || 0);
  await updateDoc(sucRef, { kpiDepositos: newKpi });
};
