// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';


// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBL8onIxodd41sUUc8r9JLQg4lLwGPSmzc",
  authDomain: "grafica-ventas.firebaseapp.com",
  projectId: "grafica-ventas",
  storageBucket: "grafica-ventas.firebasestorage.app",
  messagingSenderId: "841964521076",
  appId: "1:841964521076:web:67d2d9d155924e92eeb321",
  measurementId: "G-QE8FMBLSL0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

export { app, auth, db, signInWithEmailAndPassword };
export {messaging, getToken, onMessage };