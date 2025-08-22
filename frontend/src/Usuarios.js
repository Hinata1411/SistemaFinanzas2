import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebase.js';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider
} from 'firebase/auth';
import Swal from 'sweetalert2';
import './Usuarios.css';

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
  const [role, setRole]         = useState('viewer');
  const [sucursalId, setSucursalId] = useState(''); // requerido si role === 'viewer'

  // Selección de fila
  const [selectedId, setSelectedId] = useState(null);

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

  // ========= Registrar =========
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!username || !email || !password) {
      Swal.fire('Advertencia', 'Completa todos los campos', 'warning');
      return;
    }
    if (role === 'viewer' && !sucursalId) {
      Swal.fire('Advertencia', 'Selecciona una sucursal para el usuario viewer', 'warning');
      return;
    }

    const adminEmail = auth.currentUser?.email || '';
    if (!adminEmail) {
      Swal.fire('Error', 'No hay sesión de administrador', 'error');
      return;
    }

    const adminPass = prompt('Por seguridad, ingresa tu contraseña actual:');
    if (!adminPass) return;

    try {
      // Crear cuenta (esto cambia la sesión a la del nuevo usuario)
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );
      const newUser = userCred.user;

      // Guardar doc en Firestore
      await setDoc(doc(db, 'usuarios', newUser.uid), {
        username: username.trim(),
        email: email.trim(),
        role,
        sucursalId: role === 'viewer' ? sucursalId : null,
      });

      // Restaurar sesión admin
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);

      Swal.fire('Éxito', 'Usuario registrado', 'success');
      setUsername(''); setEmail(''); setPassword('');
      setRole('viewer'); setSucursalId('');
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    }
  };

  // ========= Selección =========
  const handleSelect = (id) => setSelectedId(id === selectedId ? null : id);

  // ========= Eliminar =========
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
      await deleteDoc(doc(db, 'usuarios', selectedId));
      Swal.fire('Eliminado', 'Usuario eliminado', 'success');
      setSelectedId(null);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo eliminar', 'error');
    }
  };

  // ========= Editar (username, rol, sucursal; opcional cambio de contraseña si es su propia cuenta) =========
  const handleEdit = async () => {
    if (!selectedId) return;
    const u = usuarios.find(x => x.id === selectedId);
    if (!u) return;

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
      await updateDoc(doc(db, 'usuarios', u.id), {
        username: newUsername,
        role: newRole,
        sucursalId: newRole === 'viewer' ? newSucursalId : null
      });

      // Cambio de contraseña (solo si edita su propia cuenta)
      if (u.id === auth.currentUser?.uid) {
        const askPwd = await Swal.fire({
          title: '¿Cambiar tu contraseña?',
          text: 'Requiere tu contraseña actual.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, cambiar',
          cancelButtonText: 'No'
        });
        if (askPwd.isConfirmed) {
          const currentPass = prompt('Ingresa tu contraseña actual:');
          if (!currentPass) return;
          const newPass = prompt('Nueva contraseña:');
          if (!newPass) return;
          const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass.trim());
          await reauthenticateWithCredential(auth.currentUser, cred);
          await updatePassword(auth.currentUser, newPass.trim());
          Swal.fire('Actualizado', 'Contraseña modificada', 'success');
        }
      }

      Swal.fire('Actualizado', 'Usuario modificado', 'success');
      setSelectedId(null);
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo actualizar', 'error');
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
              />
            </div>

            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                placeholder="email@dominio.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label>Rol</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
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
              <button type="submit" className="btn btn-primary">Registrar</button>
            </div>
          </form>
        </section>

        {/* Panel lista */}
        <section className="card">
          <h3 className="card-title">Listado</h3>

          <div className="acciones-usuario">
            <button className="btn-min" onClick={handleEdit} disabled={!selectedId}>Editar</button>
            <button className="btn-min danger" onClick={handleDelete} disabled={!selectedId}>Eliminar</button>
          </div>

          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Sucursal</th>
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
                  </tr>
                ))}
                {!usuarios.length && (
                  <tr><td colSpan={4} className="empty">Sin usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
