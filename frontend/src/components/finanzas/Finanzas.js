// src/Finanzas.js
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { collection, getDocs, getDoc, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../services/firebase';
import MyCalendar from '../calendario/MyCalendar';
import './Finanzas.css';

/* ========= Helpers estables (fuera del componente) ========= */
const nnum = (v) => (typeof v === 'number' ? v : parseFloat(v || 0)) || 0;

/** Extractor robusto de “Total a depositar” (mismo criterio que Resumen y compat con alias) */
const extractTotalADepositar = (d) => {
  const t = d?.totales || {};

  // 1) MISMO CAMPO QUE MUESTRAS EN ResumenPanel
  const fromTotalsGeneral =
    t?.totalGeneral ??
    t?.total_general ??
    null;

  if (fromTotalsGeneral != null && !isNaN(fromTotalsGeneral)) {
    const val = nnum(fromTotalsGeneral);
    if (val !== 0) return val; // si es 0 legítimo, seguimos probando alias (por compat)
  }

  // 2) ALIAS COMUNES DE "TOTAL A DEPOSITAR"
  const aliases =
    d?.totalADepositar ??
    d?.total_a_depositar ??
    d?.totalDepositar ??
    d?.total_depositar ??
    t?.totalADepositar ??
    t?.total_a_depositar ??
    t?.totalDepositar ??
    t?.total_depositar ??
    t?.depositoEfectivo ??
    t?.efectivoParaDepositos ??
    t?.efectivo_para_depositos ??
    t?.totalDeposito ??
    t?.total_deposito ??
    null;

  if (aliases != null && !isNaN(aliases)) {
    const val = nnum(aliases);
    if (val !== 0) return val;
  }

  // 3) FALLBACK (solo si no hay nada previo): sumar EFECTIVO de cierre/arques
  if (Array.isArray(d?.cierre) && d.cierre.length) {
    return d.cierre.reduce((acc, c) => acc + nnum(c?.efectivo), 0);
  }
  if (Array.isArray(d?.arqueo) && d.arqueo.length) {
    return d.arqueo.reduce((acc, c) => acc + nnum(c?.efectivo), 0);
  }
  return 0;
};

export default function Finanzas() {
  const [ready, setReady] = useState(false);

  // KPI totales (compat) -> solo setters para evitar warning "unused var"
  const [, setCajaChica] = useState(0);
  const [, setEfectivoDepositos] = useState(0);

  // KPI por sucursal: { [id]: { cajaChica: number, ventas: number } }
  const [kpiBySucursal, setKpiBySucursal] = useState({});

  // Sucursales
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState('all'); // 'all' | sucursalId

  // Abrir modal de calendario
  const calendarRef = useRef(null);

  // Rol
  const role = (localStorage.getItem('role') || 'viewer').toLowerCase();
  const isAdmin = role === 'admin';

  // Perfil (para fijar la sucursal del viewer)
  const [userLoaded, setUserLoaded] = useState(false);
  const [userSucursalId, setUserSucursalId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserSucursalId(null);
        setUserLoaded(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const data = snap.exists() ? snap.data() : {};
        setUserSucursalId(data.sucursalId || null);
      } catch {
        setUserSucursalId(null);
      } finally {
        setUserLoaded(true);
      }
    });
    return () => unsub();
  }, []);

  // Utils
  const todayISO = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const money = (n) =>
    new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 }).format(n || 0);

  // Cargar sucursales y set defaults
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = await getDocs(collection(db, 'sucursales'));
        const list = qs.docs.map((snap) => {
          const d = snap.data() || {};
          return {
            id: snap.id,
            nombre: d.nombre || d.name || snap.id,
            ubicacion: d.ubicacion || d.location || '',   // ubicación visible
          };
        });

        if (!cancelled) {
          setSucursales(list);

          // Persistimos para MyCalendar
          if (list.length) {
            localStorage.setItem('sucursales', JSON.stringify(list));
          }

          // Selección inicial
          if (isAdmin) {
            setSelectedSucursal('all');
            localStorage.setItem('activeSucursalId', 'all');
          } else {
            // Preferimos la sucursal del perfil; fallback a lo almacenado o primera
            const stored = localStorage.getItem('activeSucursalId');
            const first = list[0]?.id;
            const initial = (userSucursalId && list.some(s => s.id === userSucursalId))
              ? userSucursalId
              : (stored && stored !== 'all' ? stored : (first || ''));
            setSelectedSucursal(initial || '');
            localStorage.setItem('activeSucursalId', initial || '');
          }
        }
      } catch (e) {
        console.warn('No se pudieron cargar sucursales:', e?.message || e);
        if (!cancelled) setSucursales([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  // 👇 incluimos userSucursalId para que, si llega después de las sucursales, reevalúe selección
  }, [isAdmin, userSucursalId]);

  // Si el perfil llega después y soy viewer, forzar selección a su sucursal
  useEffect(() => {
    if (!isAdmin && userLoaded && userSucursalId && sucursales.length) {
      if (selectedSucursal !== userSucursalId && sucursales.some(s => s.id === userSucursalId)) {
        setSelectedSucursal(userSucursalId);
        localStorage.setItem('activeSucursalId', userSucursalId);
      }
    }
  }, [isAdmin, userLoaded, userSucursalId, sucursales, selectedSucursal]);

  // Recalcular KPIs (totales + por sucursal) y ajustar filtro del calendario
  useEffect(() => {
    if (!ready) return;

    // Para MyCalendar: 'all' = todas las sucursales (solo útil a admin)
    localStorage.setItem('activeSucursalId', selectedSucursal);

    const recalc = async () => {
      const ids = selectedSucursal === 'all'
        ? (isAdmin ? sucursales.map(s => s.id) : [localStorage.getItem('activeSucursalId') || ''])
        : [selectedSucursal];

      const sucIds = ids.filter(Boolean);
      if (!sucIds.length) {
        setCajaChica(0);
        setEfectivoDepositos(0);
        setKpiBySucursal({});
        return;
      }

      const hoy = todayISO();

      // Para cada sucursal: caja chica + KPI (base último pago + cierres desde entonces)
      const results = await Promise.all(sucIds.map(async (id) => {
        try {
          // 1) Doc sucursal (caja chica)
          const sSnap = await getDoc(doc(db, 'sucursales', id));
          const sData = sSnap.exists() ? (sSnap.data() || {}) : {};
          const cajaChica = Number(sData.cajaChica || 0);

          // 2) Último pago (base KPI)
          const pagosRef = collection(db, 'pagos');
          const qPago = query(
            pagosRef,
            where('sucursalId', '==', id),
            orderBy('fecha', 'desc'),
            limit(1)
          );
          const pagoSnap = await getDocs(qPago);
          const lastPago = pagoSnap.docs[0]?.data() || null;
          const lastFechaPago = lastPago?.fecha || null;
          const base = Number(lastPago?.sobranteParaManana || 0);

          // 3) Cierres desde > lastFechaPago hasta <= hoy
          const cierresRef = collection(db, 'cierres');
          let qCierres;
          if (lastFechaPago) {
            qCierres = query(
              cierresRef,
              where('sucursalId','==', id),
              where('fecha','>', lastFechaPago),
              where('fecha','<=', hoy)
            );
          } else {
            qCierres = query(
              cierresRef,
              where('sucursalId','==', id),
              where('fecha','<=', hoy)
            );
          }
          const cierresSnap = await getDocs(qCierres);
          let sumaCierres = 0;
          cierresSnap.forEach(d => { sumaCierres += extractTotalADepositar(d.data() || {}); });

          // KPI final
          const ventas = base + sumaCierres;

          return { id, cajaChica, ventas };
        } catch {
          return { id, cajaChica: 0, ventas: 0 };
        }
      }));

      // Construir mapas y totales
      const map = {};
      let totalCaja = 0;
      let totalVentas = 0;
      results.forEach(({ id, cajaChica, ventas }) => {
        map[id] = { cajaChica, ventas };
        totalCaja += cajaChica;
        totalVentas += ventas;
      });

      setKpiBySucursal(map);
      setCajaChica(totalCaja);
      setEfectivoDepositos(totalVentas);
    };

    recalc();
  // ❌ NO incluir extractTotalADepositar en deps (es helper estable fuera)
  }, [selectedSucursal, sucursales, ready, isAdmin]);

  const abrirModalActividad = () => {
    calendarRef.current?.openAddModal?.();
  };

  // Etiqueta visible: ubicación (fallback a nombre/id)
  const branchLabel = (s) => s.ubicacion || s.nombre || s.id;

  // Opciones del selector: admin ve "Todas"; viewer solo su sucursal
  const branchOptions = useMemo(() => {
    if (isAdmin) {
      return [{ id: 'all', nombre: 'Todas las ubicaciones', ubicacion: '' }, ...sucursales];
    }
    // viewer: solo la sucursal del perfil (si existe) o la actualmente seleccionada
    const viewerId = userSucursalId || selectedSucursal;
    const only = sucursales.filter(s => s.id === viewerId);
    return only.length ? only : sucursales.slice(0, 1);
  }, [isAdmin, sucursales, selectedSucursal, userSucursalId]);

  // Qué sucursales mostrar como tarjetas KPI (depende del filtro)
  const visibleCards = useMemo(() => {
    if (selectedSucursal === 'all') {
      // Admin con "todas": todas las sucursales
      return isAdmin ? sucursales : sucursales.filter(s => s.id === (localStorage.getItem('activeSucursalId') || ''));
    }
    // Específica: solo esa
    return sucursales.filter(s => s.id === selectedSucursal);
  }, [selectedSucursal, sucursales, isAdmin]);

  return (
    <div className="home-shell">
      {/* TOPBAR: título izq + filtro + botón der */}
      <section className="topbar">
        <header className="home-header">
          <h1>Sistema Finanzas</h1>
        </header>

        {/* FILTRO DE SUCURSAL (muestra UBICACIÓN) */}
        <div className="branch-filter">
          <label htmlFor="branchSel">Sucursal:</label>
          <select
            id="branchSel"
            value={selectedSucursal}
            onChange={(e) => setSelectedSucursal(e.target.value)}
            disabled={!isAdmin}  // viewer bloqueado
          >
            {branchOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === 'all' ? 'Todas las ubicaciones' : branchLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <button className="add-task-btn" onClick={abrirModalActividad}>
            ➕ Añadir tarea
          </button>
        )}
      </section>

      {/* CONTENIDO: KPIs por sucursal (izq) + calendario (der) */}
      <section className="content-row">
        <div className="kpi-left">
          {/* === KPI por sucursal === */}
          {visibleCards.map((s) => {
            const stats = kpiBySucursal[s.id] || { cajaChica: 0, ventas: 0 };
            return (
              <div className="kpi-card" key={s.id}>
                <div className="kpi-title">Sucursal: {branchLabel(s)}</div>

                <div className="kpi-title">Caja chica disponible</div>
                <div className="kpi-value">{money(stats.cajaChica)}</div>

                <div className="kpi-title">Dinero para depósitos</div>
                <div className="kpi-value">{money(stats.ventas)}</div>
              </div>
            );
          })}
        </div>

        <div className="home-calendar-card">
          {ready ? (
            <MyCalendar ref={calendarRef} showAddButton={false} />
          ) : (
            <div className="text-muted">Cargando sucursales…</div>
          )}
        </div>
      </section>
    </div>
  );
}
