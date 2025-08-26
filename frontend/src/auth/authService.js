// src/auth/authService.js
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

console.log('API base =', process.env.REACT_APP_API_URL);

const API = process.env.REACT_APP_API_URL || 'https://sistemafinanzas2.onrender.com/api';

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
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  localStorage.setItem('email', user.email);

  // Token fresco de Firebase
  const idToken = await user.getIdToken(true);

  // Envía el token en Authorization
  const resp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    credentials: 'omit',
    body: JSON.stringify({ idToken }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  if (!data?.token) throw new Error(data?.message || 'Respuesta inválida del servidor');

  localStorage.setItem('token', data.token);

  return {
    user,
    token: data.token,
    role: data.role || data.rol,
    backend: data,
  };
}

/** (Opcional) Obtiene doc de usuario */
export async function getUserDoc(uid) {
  const ref = doc(db, 'usuarios', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ✅ Export por defecto con identificador (no anónimo)
const authService = { fetchUsersForSelect, loginAndGetBackendToken, getUserDoc };
export default authService;
