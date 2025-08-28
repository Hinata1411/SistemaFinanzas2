// src/auth/authService.js
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Base del API
const API = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');
console.log('API base =', API);

/** Lee la colección 'usuarios' y devuelve [{email, username, role?, disabled?, emailLower?}] */
export async function fetchUsersForSelect() {
  const qs = await getDocs(collection(db, 'usuarios'));
  return qs.docs.map((snap) => {
    const d = snap.data();
    return {
      email: d.email,
      emailLower: d.emailLower || (d.email ? String(d.email).toLowerCase() : undefined),
      username: d.username || d.email,
      role: d.role || d.rol || (d.isAdmin ? 'admin' : undefined),
      disabled: !!d.disabled,
    };
  });
}

/** Login con Firebase y canje en backend */
export async function loginAndGetBackendToken(email, password) {
  // 1) Login Firebase
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // 2) Validar que NO esté deshabilitado (Firestore)
  const ref = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (data?.disabled) {
      await signOut(auth).catch(()=>{});
      const err = new Error('Tu cuenta está deshabilitada. Contacta al administrador.');
      err.code = 'auth/user-disabled';
      throw err;
    }
  }

  // 3) ID token fresco de Firebase
  const idToken = await user.getIdToken(true);

  // 4) Intercambio con backend
  const url = `${API}/auth/login`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'omit',
    body: JSON.stringify({ idToken }),
  });

  // 👇 Patch importante: mapear 403 a user-disabled
  if (!resp.ok) {
    let msg = '';
    try { msg = await resp.text(); } catch {}
    await signOut(auth).catch(()=>{});
    if (resp.status === 403 && (msg || '').toLowerCase().includes('deshabilit')) {
      const err = new Error('Tu cuenta está deshabilitada. Contacta al administrador.');
      err.code = 'auth/user-disabled';
      throw err;
    }
    throw new Error(`HTTP ${resp.status} en ${url}: ${msg || 'Error de autenticación'}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await resp.json()
    : { raw: await resp.text().catch(() => '') };

  if (!data?.token) {
    await signOut(auth).catch(()=>{});
    throw new Error(data?.message || 'Respuesta inválida del servidor (falta token)');
  }

  // 5) Persistir
  localStorage.setItem('email', user.email || '');
  localStorage.setItem('token', data.token);
  if (data.role) localStorage.setItem('role', String(data.role).toLowerCase());

  return {
    user,
    token: data.token,
    role: data.role || data.rol,
    backend: data,
  };
}

/** (Opcional) Obtiene doc de usuario por UID */
export async function getUserDoc(uid) {
  const ref = doc(db, 'usuarios', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

const authService = { fetchUsersForSelect, loginAndGetBackendToken, getUserDoc };
export default authService;
