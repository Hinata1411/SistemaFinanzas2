// src/auth/authService.js
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db } from './../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Base del API (usa proxy /api en Netlify si no hay env)
const API = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');
console.log('API base =', API);

/** Lee la colección 'usuarios' y devuelve [{email, username, role?}] */
export async function fetchUsersForSelect() {
  const qs = await getDocs(collection(db, 'usuarios'));
  return qs.docs.map((snap) => {
    const d = snap.data();
    return {
      email: d.email,
      username: d.username || d.email,
      role: d.role || d.rol || (d.isAdmin ? 'admin' : undefined),
    };
  });
}

/** Login con Firebase y canje en backend */
export async function loginAndGetBackendToken(email, password) {
  // 1) Login Firebase
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Guarda email para tu app
  localStorage.setItem('email', user.email || '');

  // 2) ID token fresco de Firebase
  const idToken = await user.getIdToken(true);

  // 3) Intercambio con tu backend
  const url = `${API}/auth/login`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'omit', // cambia a 'include' si usas cookies/sesión en backend
    body: JSON.stringify({ idToken }),
  });

  // 4) Manejo de errores HTTP
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} en ${url}: ${txt || 'Error de autenticación'}`);
  }

  // 5) Parseo seguro de respuesta
  const contentType = resp.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await resp.json()
    : { raw: await resp.text().catch(() => '') };

  if (!data?.token) {
    throw new Error(data?.message || 'Respuesta inválida del servidor (falta token)');
  }

  // 6) Persistir token/rol
  localStorage.setItem('token', data.token);

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

// Export por defecto
const authService = { fetchUsersForSelect, loginAndGetBackendToken, getUserDoc };
export default authService;
