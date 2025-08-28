// src/pages/usuarios/Usuarios.js
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../services/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signOut as signOutAuth
} from 'firebase/auth';
import Swal from 'sweetalert2';
import { getSecondaryAuth } from '../../services/secondaryAuth';
import './Usuarios.css';

const API = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  const sucMap = useMemo(
    () => Object.fromEntries(sucursales.map(s => [s.id, s.nombre])),
    [sucursales]
  );

  // Form registro
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false); // 👈 ver/ocultar
  const [role, setRole]         = useState('viewer');
  const [sucursalId, setSucursalId] = useState(''); // requerido si role === 'viewer'

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [working, setWorking] = useState(false);

  // ========= Cargas =========
  const cargarUsuarios = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
    }
  };

  const cargarSucursales = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'sucursales'));
      setSucursales(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error al cargar sucursales:', err);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    cargarSucursales();
  }, []);

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());

  // ========= Registrar (auth secundario, no cambia sesión admin) =========
  const handleRegister = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!username.trim() || !email.trim() || !password.trim()) {
      return Swal.fire('Advertencia', 'Completa todos los campos', 'warning');
    }
    if (!isEmail(email)) {
      return Swal.fire('Advertencia', 'Email inválido', 'warning');
    }
    if (password.length < 6) {
      return Swal.fire('Advertencia', 'La contraseña debe tener al menos 6 caracteres', 'warning');
    }
    // Duplicados robusto (usa email o emailLower si ya existiera)
    const emailLowerIncoming = String(email).toLowerCase().trim();
    if (usuarios.some(u =>
      String(u.email?.toLowerCase?.() || u.emailLower || '').trim() === emailLowerIncoming
    )) {
      return Swal.fire('Advertencia', 'Ese email ya está registrado', 'warning');
    }
    if (role === 'viewer' && !sucursalId) {
      return Swal.fire('Advertencia', 'Selecciona una sucursal para el usuario viewer', 'warning');
    }

    try {
      setWorking(true);
      const secondaryAuth = getSecondaryAuth();

      // 1) Crear cuenta SIN afectar la sesión principal
      const { user: newUser } = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password.trim()
      );

      // 2) Guardar doc en Firestore (con emailLower + serverTimestamp)
      await setDoc(doc(db, 'usuarios', newUser.uid), {
        username: username.trim(),
        email: email.trim(),
        emailLower: emailLowerIncoming,
        role,
        sucursalId: role === 'viewer' ? sucursalId : null,
        disabled: false,
        createdAt: serverTimestamp(),
      });

      // 3) Cerrar sesión del auth secundario (higiene)
      await signOutAuth(secondaryAuth).catch(() => {});

      Swal.fire('Éxito', 'Usuario registrado', 'success');
      setUsername(''); setEmail(''); setPassword('');
      setShowRegPwd(false);
      setRole('viewer'); setSucursalId('');
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      const code = err?.code;
      if (code === 'auth/email-already-in-use') {
        Swal.fire('Advertencia', 'Ese email ya está registrado en Auth', 'warning');
      } else {
        Swal.fire('Error', err.message || 'No se pudo registrar', 'error');
      }
    } finally {
      setWorking(false);
    }
  };

  // ========= Selección =========
  const handleSelect = (id) => setSelectedId(id === selectedId ? null : id);

  // ========= Activar/Desactivar =========
  const handleToggleDisabled = async () => {
    if (!selectedId) return;
    // Evita auto-deshabilitar la cuenta actual
    if (selectedId === auth.currentUser?.uid) {
      Swal.fire('No permitido', 'No puedes deshabilitar tu propia cuenta', 'info');
      return;
    }
    const u = usuarios.find(x => x.id === selectedId);
    if (!u) return;
    try {
      setWorking(true);
      const next = !u.disabled;
      await updateDoc(doc(db, 'usuarios', u.id), { disabled: next });
      Swal.fire('OK', next ? 'Usuario deshabilitado' : 'Usuario activado', 'success');
      cargarUsuarios();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
    } finally {
      setWorking(false);
    }
  };

  // ========= Eliminar (Auth + Firestore vía backend). Fallback: disabled =========
  const handleDelete = async () => {
    if (!selectedId) return;
    if (selectedId === auth.currentUser?.uid) {
      Swal.fire('No permitido', 'No puedes eliminar tu propia cuenta', 'info');
      return;
    }
    const confirm = await Swal.fire({
      title: '¿Eliminar usuario?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí'
    });
    if (!confirm.isConfirmed) return;

    try {
      setWorking(true);
      // 1) Intentar borrado REAL via backend (Auth + Firestore)
      const idToken = await auth.currentUser.getIdToken(true);
      const resp = await fetch(`${API}/admin/deleteUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ uid: selectedId })
      });

      if (!resp.ok) {
        let msg = 'Fallo al borrar en Auth';
        try {
          const data = await resp.json();
          if (data?.message) msg = data.message;
        } catch {}
        throw new Error(msg);
      }

      Swal.fire('Eliminado', 'Usuario eliminado', 'success');
      setSelectedId(null);
      cargarUsuarios();
    } catch (err) {
      console.warn('Delete via backend falló, se aplica fallback disabled.', err);
      try {
        await updateDoc(doc(db, 'usuarios', selectedId), { disabled: true });
        Swal.fire('Marcado', 'Usuario marcado como deshabilitado', 'success');
        setSelectedId(null);
        cargarUsuarios();
      } catch (e2) {
        console.error(e2);
        Swal.fire('Error', e2.message || 'No se pudo eliminar', 'error');
      }
    } finally {
      setWorking(false);
    }
  };

  // ========= Editar (username, rol, sucursal) =========
  const handleEdit = async () => {
    if (!selectedId) return;
    const u = usuarios.find(x => x.id === selectedId);
    if (!u) return;

    const rUser = await Swal.fire({
      title: 'Editar usuario',
      input: 'text',
      inputLabel: 'Nombre de usuario',
      inputValue: u.username || '',
      showCancelButton: true,
      confirmButtonText: 'Siguiente',
      inputValidator: (v) => (!v || !v.trim() ? 'Requerido' : undefined)
    });
    if (!rUser.isConfirmed) return;
    const newUsername = rUser.value.trim();

    const rRole = await Swal.fire({
      title: 'Rol',
      input: 'select',
      inputOptions: {
        admin: 'Admin (todas las sucursales)',
        viewer: 'Viewer (solo ver, requiere sucursal)'
      },
      inputValue: u.role || 'viewer',
      showCancelButton: true,
      confirmButtonText: 'Siguiente'
    });
    if (!rRole.isConfirmed) return;
    const newRole = rRole.value;

    let newSucursalId = u.sucursalId || '';
    if (newRole === 'viewer') {
      const inputOptions = Object.fromEntries(
        sucursales.map(s => [s.id, s.nombre + (s.ubicacion ? ` – ${s.ubicacion}` : '')])
      );
      const rSuc = await Swal.fire({
        title: 'Sucursal asignada',
        input: 'select',
        inputOptions,
        inputValue: newSucursalId || '',
        inputPlaceholder: 'Selecciona sucursal',
        showCancelButton: true,
        confirmButtonText: 'Guardar'
      });
      if (!rSuc.isConfirmed) return;
      newSucursalId = rSuc.value;
      if (!newSucursalId) {
        Swal.fire('Advertencia', 'Debes seleccionar una sucursal para viewer', 'warning');
        return;
      }
    }

    try {
      setWorking(true);
      await updateDoc(doc(db, 'usuarios', u.id), {
        username: newUsername,
        role: newRole,
        sucursalId: newRole === 'viewer' ? newSucursalId : null
      });

      Swal.fire('Actualizado', 'Usuario modificado', 'success');
      setSelectedId(null);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo actualizar', 'error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="usuarios-shell">
      <header className="usuarios-header">
        <h1>Usuarios</h1>
      </header>

      <div className="usuarios-panels">
        {/* Panel Registrar */}
        <section className="card">
          <h3 className="card-title">Registrar usuario</h3>
          <form onSubmit={handleRegister} className="form-usuario">
            <div className="form-row">
              <label>Nombre de usuario</label>
              <input
                type="text"
                placeholder="Nombre"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={working}
              />
            </div>

            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                placeholder="email@dominio.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={working}
              />
            </div>

            <div className="form-row">
              <label>Contraseña</label>
              <div className="input-with-icon">
                <input
                  type={showRegPwd ? 'text' : 'password'}
                  inputMode="text"
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={working}
                />
                <button
                  type="button"
                  className="btn-min"
                  onClick={() => setShowRegPwd(s => !s)}
                  disabled={working}
                  aria-label={showRegPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showRegPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showRegPwd ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="form-row">
              <label>Rol</label>
              <select value={role} onChange={e => setRole(e.target.value)} disabled={working}>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {role === 'viewer' && (
              <div className="form-row">
                <label>Sucursal asignada</label>
                <select
                  value={sucursalId}
                  onChange={(e)=> setSucursalId(e.target.value)}
                  disabled={working}
                >
                  <option value="">Selecciona sucursal</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}{s.ubicacion ? ` – ${s.ubicacion}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={working}>
                {working ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </form>
        </section>

        {/* Panel lista */}
        <section className="card">
          <h3 className="card-title">Listado</h3>

          <div className="acciones-usuario">
            <button className="btn-min" onClick={handleEdit} disabled={!selectedId || working}>Editar</button>
            <button className="btn-min" onClick={handleToggleDisabled} disabled={!selectedId || working}>
              Activar/Desactivar
            </button>
            <button className="btn-min danger" onClick={handleDelete} disabled={!selectedId || working}>
              Eliminar
            </button>
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Sucursal</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr
                    key={u.id}
                    className={u.id === selectedId ? 'selected' : ''}
                    onClick={() => handleSelect(u.id)}
                  >
                    <td>{u.username || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.role || '—'}</td>
                    <td>{u.role === 'admin' ? 'Todas' : (sucMap[u.sucursalId] || '—')}</td>
                    <td>{u.disabled ? 'Deshabilitado' : 'Activo'}</td>
                  </tr>
                ))}
                {!usuarios.length && (
                  <tr><td colSpan={5} className="empty">Sin usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
