// src/auth/authService.js
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

/**
 * Login con Firebase, postea idToken a tu backend y guarda token/email.
 * Devuelve { user, token, role?, backend }
 */
export async function loginAndGetBackendToken(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Guarda el email para el layout
  localStorage.setItem('email', user.email);

  // ID token de Firebase
  const idToken = await user.getIdToken();

  // Envía el token al backend
  const resp = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({ idToken }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  if (!data?.token) throw new Error(data?.message || 'Respuesta inválida del servidor');

  // Guarda el token para PrivateRoute
  localStorage.setItem('token', data.token);

  return {
    user,
    token: data.token,
    role: data.role || data.rol, // si tu backend lo manda
    backend: data,
  };
}

/** (Opcional) Obtiene doc de usuario para rol u otros datos */
export async function getUserDoc(uid) {
  const ref = doc(db, 'usuarios', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export default { fetchUsersForSelect, loginAndGetBackendToken, getUserDoc };
