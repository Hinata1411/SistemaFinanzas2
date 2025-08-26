// backend/firebaseAdmin.js
const path = require('path');
const admin = require('firebase-admin');

// Carga .env en local (en Render no hace falta, pero no estorba)
require('dotenv').config({ path: path.join(__dirname, '.env') });

let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT no está definida. Configúrala en Render → Environment.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
  // Convierte \\n del .env a saltos reales
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (err) {
  console.error('❌ Error al parsear FIREBASE_SERVICE_ACCOUNT:', err);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: 'https://TU_PROYECTO.firebaseio.com'
  });
}

const db = admin.firestore();
const auth = admin.auth();
module.exports = { admin, db, auth };
