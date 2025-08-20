// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from "firebase/messaging";


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

export { app, auth, db, messaging, signInWithEmailAndPassword, sendPasswordResetEmail };
export { getToken, onMessage };