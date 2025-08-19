// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const admin = require('../firebaseAdmin'); // tu init de admin

router.post('/login', async (req, res) => {
  const { idToken } = req.body || {};
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('idToken length:', idToken ? idToken.length : 0);

  if (!idToken) {
    return res.status(400).json({ message: 'Falta idToken' });
  }

  try {
    // Valida el token emitido por Firebase Auth
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Aquí ya estás autenticado: arma tu token interno o sesión
    // Ejemplo: JWT de la app (opcional)
    // const appToken = jwt.sign({ uid: decoded.uid, email: decoded.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.json({
      message: 'ok',
      user: { uid: decoded.uid, email: decoded.email, name: decoded.name || null },
      token: 'dummy-app-token', // remplaza por tu JWT si lo usas
    });
  } catch (err) {
    console.error('verifyIdToken error:', err.code, err.message);
    return res.status(401).json({ message: 'Token de Firebase inválido', code: err.code });
  }
});

module.exports = router;
