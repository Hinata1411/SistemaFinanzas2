// src/firebase.js
// SDKs Firebase v9 (modular)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

// ⚠️ Usa tus propias credenciales
const firebaseConfig = {
  apiKey: "AIzaSyBL8onIxodd41sUUc8r9JLQg4lLwGPSmzc",
  authDomain: "grafica-ventas.firebaseapp.com",
  projectId: "grafica-ventas",
  storageBucket: "grafica-ventas.firebasestorage.app",
  messagingSenderId: "841964521076",
  appId: "1:841964521076:web:67d2d9d155924e92eeb321",
  measurementId: "G-QE8FMBLSL0"
};

// Inicializa Firebase una sola vez
const app = initializeApp(firebaseConfig);

// Servicios que usas en la app
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


let messaging;
try {
  messaging = getMessaging(app);
} catch (e) {
  // Si el navegador no soporta FCM o no estás en HTTPS/localhost,
  // evita romper la app.
  console.warn('FCM no disponible en este entorno:', e?.message || e);
  messaging = undefined;
}

export {
  app,
  auth,
  db,
  storage,
  // Auth helpers (si prefieres importarlos desde aquí)
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  // FCM (si lo usas)
  messaging,
  getToken,
  onMessage,
};
