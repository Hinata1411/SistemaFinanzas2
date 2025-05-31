import React, { useState, useEffect } from 'react';
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
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');
  const [selectedId, setSelectedId] = useState(null);

  // Carga todos los usuarios desde Firestore
  const cargarUsuarios = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // Registrar nuevo usuario
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      Swal.fire('Advertencia', 'Completa todos los campos', 'warning');
      return;
    }

    const adminEmail = auth.currentUser.email;
    const adminPass = prompt('Por seguridad, ingresa tu contraseña actual:');
    if (!adminPass) return;

    try {
      // Crear en Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCred.user;

      // Guardar datos en Firestore
      await setDoc(doc(db, 'usuarios', newUser.uid), {
        username,
        email,
        role
      });

      // Restaurar sesión de admin
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);

      Swal.fire('Éxito', 'Usuario registrado', 'success');
      setUsername(''); setEmail(''); setPassword(''); setRole('viewer');
      cargarUsuarios();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
    }
  };

  // Seleccionar fila
  const handleSelect = (id) => {
    setSelectedId(id === selectedId ? null : id);
  };

  // Eliminar usuario
  const handleDelete = async () => {
    if (!selectedId) return;
    const confirm = await Swal.fire({
      title: '¿Eliminar usuario?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí'
    });
    if (confirm.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'usuarios', selectedId));
        Swal.fire('Eliminado', 'Usuario eliminado', 'success');
        setSelectedId(null);
        cargarUsuarios();
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo eliminar', 'error');
      }
    }
  };

  // Editar usuario (username y password)
  const handleEdit = async () => {
    if (!selectedId) return;
    const usuario = usuarios.find(u => u.id === selectedId);
    const newUsername = prompt('Nuevo nombre de usuario:', usuario.username || '');
    if (!newUsername) return Swal.fire('Advertencia', 'Nombre requerido', 'warning');
    const newPassword = prompt('Nueva contraseña:');
    if (!newPassword) return Swal.fire('Advertencia', 'Contraseña requerida', 'warning');

    try {
      // Actualiza username en Firestore
      await updateDoc(doc(db, 'usuarios', selectedId), { username: newUsername.trim() });

      // Si edita su propia cuenta, reautentica y actualiza contraseña
      if (selectedId === auth.currentUser.uid) {
        const currentPass = prompt('Ingresa tu contraseña actual para confirmar:');
        if (!currentPass) return;
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, newPassword.trim());
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
    <div className="usuarios-container">
      <h2>Administración de Usuarios</h2>
      <form onSubmit={handleRegister} className="form-usuario">
        <input
          type="text" placeholder="Nombre de usuario"
          value={username}
          onChange={e => setUsername(e.target.value)} />
        <input
          type="email" placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)} />
        <input
          type="password" placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)} />
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        <button type="submit">Registrar</button>
      </form>

      <div className="acciones-usuario">
        <button onClick={handleEdit} disabled={!selectedId}>Editar usuario</button>
        <button onClick={handleDelete} disabled={!selectedId}>Eliminar usuario</button>
      </div>

      <table className="tabla-usuarios">
        <thead>
          <tr>
            <th>Nombre</th><th>Email</th><th>Rol</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map(u => (
            <tr
              key={u.id}
              className={u.id === selectedId ? 'selected' : ''}
              onClick={() => handleSelect(u.id)}
            >
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}