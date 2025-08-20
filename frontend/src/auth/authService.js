// src/auth/authService.js
// Ajusta la ruta si tu firebase está en otro lugar o requiere extensión .js
import { auth, db, signInWithEmailAndPassword } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

/** Lee la colección 'usuarios' y devuelve [{email, username}] */
export async function fetchUsersForSelect() {
  const qs = await getDocs(collection(db, 'usuarios'));
  return qs.docs.map((snap) => {
    const d = snap.data();
    return {
      email: d.email,
      username: d.username || d.email,
    };
  });
}

/**
 * Login con Firebase, obtiene idToken, lo manda al backend y guarda token/email en localStorage.
 * Devuelve { user, backend }
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
  if (data?.token) {
    localStorage.setItem('token', data.token);
  } else {
    throw new Error(data?.message || 'Respuesta inválida del servidor');
  }

  return { user, backend: data };
}

/** (Opcional) Obtiene doc de usuario para rol u otros datos */
export async function getUserDoc(uid) {
  const ref = doc(db, 'usuarios', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Export default opcional
export default { fetchUsersForSelect, loginAndGetBackendToken, getUserDoc };
