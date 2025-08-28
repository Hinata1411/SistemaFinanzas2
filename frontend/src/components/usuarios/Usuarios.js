// src/pages/usuarios/Usuarios.js
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../services/firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  setDoc
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signOut as signOutAuth,
  sendPasswordResetEmail
} from 'firebase/auth';
import Swal from 'sweetalert2';
import { getSecondaryAuth } from '../../services/secondaryAuth';
import './Usuarios.css';

const API = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

// === Helper: refresca ID token hasta que vea el claim admin ===
async function refreshClaimsUntil(timeoutMs = 3500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await auth.currentUser?.getIdToken(true);
      const r = await auth.currentUser?.getIdTokenResult();
      if (r?.claims && ('admin' in r.claims)) return r.claims;
    } catch {}
    await new Promise(res => setTimeout(res, 250));
  }
  try {
    const r = await auth.currentUser?.getIdTokenResult();
    return r?.claims || {};
  } catch {
    return {};
  }
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState('');

  const sucMap = useMemo(
    () => Object.fromEntries(sucursales.map(s => [s.id, s.nombre])),
    [sucursales]
  );

  // Form registro
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [role, setRole]         = useState('viewer');
  const [sucursalId, setSucursalId] = useState(''); // requerido si role === 'viewer'

  // UI state
  const [selectedId, setSelectedId] = useState(null);
  const [working, setWorking] = useState(false);

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());

  // ========= Cargas (con refresh de claims al entrar) =========
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setPermError('');

        await refreshClaimsUntil(3500);

        // Cargar usuarios
        try {
          const snap = await getDocs(collection(db, 'usuarios'));
          setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.error('Error al cargar usuarios:', e);
          setPermError(e?.message || 'Error al cargar usuarios');
          Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
        }

        // Cargar sucursales (⚠️ nombre exacto)
        try {
          const snap = await getDocs(collection(db, 'sucursales'));
          setSucursales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.error('Error al cargar sucursales:', e);
          setPermError(prev => prev || e?.message || '');
          Swal.fire('Error', 'No se pudieron cargar las sucursales', 'error');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    if (usuarios.some(u => String(u.email).toLowerCase() === String(email).toLowerCase())) {
      return Swal.fire('Advertencia', 'Ese email ya está registrado', 'warning');
    }
    if (role === 'viewer' && !sucursalId) {
      return Swal.fire('Advertencia', 'Selecciona una sucursal para el usuario viewer', 'warning');
    }

    try {
      setWorking(true);
      await refreshClaimsUntil(3500);
      const claims = await auth.currentUser?.getIdTokenResult();
      if (!(claims?.claims?.admin === true)) {
        return Swal.fire('Permiso denegado', 'Necesitas ser administrador para registrar usuarios.', 'info');
      }

      const secondaryAuth = getSecondaryAuth();

      // 1) Crear cuenta
      const { user: newUser } = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password.trim()
      );

      // 2) Guardar doc en Firestore
      await setDoc(doc(db, 'usuarios', newUser.uid), {
        username: username.trim(),
        email: email.trim(),
        role,
        // 👇 admin => null; viewer => sucursalId elegido
        sucursalId: role === 'viewer' ? sucursalId : null,
        disabled: false,
        createdAt: Date.now(),
      });

      // 3) Signout del secundario
      await signOutAuth(secondaryAuth).catch(() => {});

      Swal.fire('Éxito', 'Usuario registrado', 'success');
      setUsername(''); setEmail(''); setPassword(''); setShowRegPwd(false);
      setRole('viewer'); setSucursalId('');

      // Recarga lista
      const snapU = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snapU.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo registrar', 'error');
    } finally {
      setWorking(false);
    }
  };

  // ========= Selección =========
  const handleSelect = (id) => setSelectedId(id === selectedId ? null : id);

  // ========= Activar/Desactivar =========
  const handleToggleDisabled = async () => {
    if (!selectedId) return;
    const u = usuarios.find(x => x.id === selectedId);
    if (!u) return;
    try {
      setWorking(true);
      await refreshClaimsUntil(3500);
      const claims = await auth.currentUser?.getIdTokenResult();
      if (!(claims?.claims?.admin === true)) {
        return Swal.fire('Permiso denegado', 'Necesitas ser administrador.', 'info');
      }

      const next = !u.disabled;
      await updateDoc(doc(db, 'usuarios', u.id), { disabled: next });
      Swal.fire('OK', next ? 'Usuario deshabilitado' : 'Usuario activado', 'success');

      const snap = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
    } finally {
      setWorking(false);
    }
  };

  // ========= Eliminar (vía backend) =========
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
      await refreshClaimsUntil(3500);
      const claims = await auth.currentUser?.getIdTokenResult();
      if (!(claims?.claims?.admin === true)) {
        return Swal.fire('Permiso denegado', 'Necesitas ser administrador.', 'info');
      }

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
      const snap = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Delete via backend falló:', err);
      Swal.fire('Error', err.message || 'No se pudo eliminar', 'error');
    } finally {
      setWorking(false);
    }
  };

  // ========= Editar (username, rol, sucursal, email y contraseña) =========
  const handleEdit = async () => {
    if (!selectedId) return;
    const u = usuarios.find(x => x.id === selectedId);
    if (!u) return;

    await refreshClaimsUntil(3500);
    const claims = await auth.currentUser?.getIdTokenResult();
    if (!(claims?.claims?.admin === true)) {
      return Swal.fire('Permiso denegado', 'Necesitas ser administrador.', 'info');
    }

    // 1) Username
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

    // 2) Rol
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

    // 3) Sucursal si viewer
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
        confirmButtonText: 'Siguiente'
      });
      if (!rSuc.isConfirmed) return;
      newSucursalId = rSuc.value;
      if (!newSucursalId) {
        Swal.fire('Advertencia', 'Debes seleccionar una sucursal para viewer', 'warning');
        return;
      }
    } else {
      // admin => todas
      newSucursalId = null;
    }

    // 4) ¿Cambiar email?
    let newEmail = u.email || '';
    const changeEmail = await Swal.fire({
      title: '¿Cambiar email?',
      text: `Email actual: ${u.email || '—'}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'No'
    });
    if (changeEmail.isConfirmed) {
      const rEmail = await Swal.fire({
        title: 'Nuevo email',
        input: 'email',
        inputValue: u.email || '',
        inputValidator: (v) => (!isEmail(v) ? 'Email inválido' : undefined),
        showCancelButton: true,
        confirmButtonText: 'Guardar email'
      });
      if (!rEmail.isConfirmed) return;
      newEmail = rEmail.value.trim();
    }

    // 5) ¿Cambiar contraseña?
    let tempPassword = '';
    const changePwd = await Swal.fire({
      title: 'Contraseña',
      text: '¿Deseas restablecer la contraseña de este usuario?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Opciones',
      cancelButtonText: 'No'
    });

    let doSendReset = false;
    if (changePwd.isConfirmed) {
      const rPwdMode = await Swal.fire({
        title: 'Restablecer contraseña',
        input: 'select',
        inputOptions: {
          send: 'Enviar email de restablecimiento',
          set: 'Establecer contraseña temporal ahora'
        },
        inputPlaceholder: 'Selecciona una opción',
        showCancelButton: true,
        confirmButtonText: 'Continuar'
      });
      if (!rPwdMode.isConfirmed) return;
      const mode = rPwdMode.value;
      if (mode === 'send') {
        doSendReset = true;
      } else {
        const rTemp = await Swal.fire({
          title: 'Contraseña temporal',
          input: 'text',
          inputPlaceholder: 'Mínimo 6 caracteres',
          inputValidator: (v) => (!v || v.length < 6 ? 'Mínimo 6 caracteres' : undefined),
          showCancelButton: true,
          confirmButtonText: 'Establecer'
        });
        if (!rTemp.isConfirmed) return;
        tempPassword = rTemp.value;
      }
    }

    // === Guardar todo ===
    try {
      setWorking(true);

      // A) Actualizar doc Firestore (username, rol, sucursalId, email si cambió)
      await updateDoc(doc(db, 'usuarios', u.id), {
        username: newUsername,
        role: newRole,
        // admin => null, viewer => id
        sucursalId: newRole === 'viewer' ? newSucursalId : null,
        ...(newEmail && newEmail !== u.email ? { email: newEmail } : {})
      });

      // B) Si hay cambio de email y/o temp password, usar backend admin
      if ((newEmail && newEmail !== u.email) || tempPassword) {
        const idToken = await auth.currentUser.getIdToken(true);
        const resp = await fetch(`${API}/admin/updateUser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            uid: u.id,
            email: (newEmail && newEmail !== u.email) ? newEmail : undefined,
            password: tempPassword || undefined
          })
        });
        if (!resp.ok) {
          const data = await resp.json().catch(()=>({}));
          throw new Error(data?.message || 'No se pudo actualizar email/contraseña en Auth');
        }
      }

      // C) Si eligió enviar email de restablecimiento
      if (doSendReset) {
        await sendPasswordResetEmail(auth, newEmail || u.email);
      }

      Swal.fire('Actualizado', 'Usuario modificado', 'success');
      setSelectedId(null);

      // Recarga lista
      const snap = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo actualizar', 'error');
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

          {permError && (
            <div className="alert alert-warning small" role="alert">
              {permError}
            </div>
          )}

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
                {loading ? (
                  <tr><td colSpan={5} className="empty">Cargando…</td></tr>
                ) : usuarios.length ? (
                  usuarios.map(u => (
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
                  ))
                ) : (
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
