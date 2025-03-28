// firebaseAdmin.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Asegúrate de que este archivo exista en la ruta

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Si usas Realtime Database, añade databaseURL, de lo contrario puedes omitirlo:
  // databaseURL: "https://TU_PROYECTO.firebaseio.com"
});

module.exports = admin;
