// src/Home.js
import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import MyCalendar from './MyCalendar';
import './Home.css';

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Lee sucursales de Firestore
        const qs = await getDocs(collection(db, 'sucursales'));
        const list = qs.docs.map((snap) => {
          const d = snap.data() || {};
          return {
            id: snap.id,
            nombre: d.nombre || d.name || snap.id,
            ubicacion: d.ubicacion || d.location || ''  // 👈 NUEVO: ubicación
          };
        });

        // Guarda en localStorage para que MyCalendar las use en el modal
        if (list.length) {
          localStorage.setItem('sucursales', JSON.stringify(list));
          // Define sucursal activa si no existe
          if (!localStorage.getItem('activeSucursalId')) {
            localStorage.setItem('activeSucursalId', list[0].id);
          }
        } else {
          // Fallback mínimo si no hay docs
          if (!localStorage.getItem('sucursales')) {
            const fallback = [{ id: 'default', nombre: 'Sucursal', ubicacion: '—' }];
            localStorage.setItem('sucursales', JSON.stringify(fallback));
            if (!localStorage.getItem('activeSucursalId')) {
              localStorage.setItem('activeSucursalId', 'default');
            }
          }
        }
      } catch (e) {
        // Fallback si falla Firestore
        if (!localStorage.getItem('sucursales')) {
          const fallback = [
            { id: 's1', nombre: 'Sucursal 1', ubicacion: 'Centro' },
            { id: 's2', nombre: 'Sucursal 2', ubicacion: 'Norte' },
          ];
          localStorage.setItem('sucursales', JSON.stringify(fallback));
          if (!localStorage.getItem('activeSucursalId')) {
            localStorage.setItem('activeSucursalId', 's1');
          }
        }
        console.warn('No se pudieron cargar sucursales:', e?.message || e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-shell">
      <header className="home-header">
        <h1>Sistema Finanzas</h1>
      </header>

      <section className="home-calendar-card">
        {ready ? (
          <MyCalendar />
        ) : (
          <div className="text-muted">Cargando sucursales…</div>
        )}
      </section>
    </div>
  );
}
