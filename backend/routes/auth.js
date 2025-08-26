const router = require('express').Router();
const { admin } = require('../firebaseAdmin');
const jwt = require('jsonwebtoken');
const APP_SECRET = process.env.APP_SECRET || 'cambia-esto';

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

router.post('/login', async (req, res) => {
  const idToken = getBearerToken(req) || req.body?.idToken; // 👈 lee header o body

  if (!idToken) return res.status(400).json({ message: 'Falta idToken' });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const token = jwt.sign(
      { uid: decoded.uid, email: decoded.email, role: 'viewer' },
      APP_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token, role: 'viewer' });
  } catch (e) {
    console.error('verifyIdToken error:', e?.errorInfo?.code || e.message);
    return res.status(401).json({ message: 'Token de Firebase inválido' });
  }
});

module.exports = router;
