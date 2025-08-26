// backend/routes/auth.js
const router = require('express').Router();
const { admin, db } = require('../firebaseAdmin');
const jwt = require('jsonwebtoken');

const APP_SECRET = process.env.APP_SECRET || 'cambia-esto';

// helper: "Bearer <token>"
function getBearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

// Deriva 'admin' | 'viewer' desde claims, Firestore y fallback de correos
async function resolveRole(decoded) {
  // 1) Custom claims (si algún día las usas)
  const claimRole =
    (decoded.role || decoded.rol || (decoded.isAdmin ? 'admin' : undefined));
  if (claimRole) return claimRole === 'admin' ? 'admin' : 'viewer';

  // 2) Firestore: doc por uid o por email
  // a) Doc con id = uid
  try {
    const byUid = await db.collection('usuarios').doc(decoded.uid).get();
    if (byUid.exists) {
      const d = byUid.data() || {};
      const r = (d.role || d.rol || (d.isAdmin ? 'admin' : 'viewer') || '').toString().toLowerCase();
      if (r === 'admin' || r === 'viewer') return r;
    }
  } catch {}

  // b) Doc por email
  try {
    const qs = await db.collection('usuarios').where('email', '==', decoded.email).limit(1).get();
    if (!qs.empty) {
      const d = qs.docs[0].data() || {};
      const r = (d.role || d.rol || (d.isAdmin ? 'admin' : 'viewer') || '').toString().toLowerCase();
      if (r === 'admin' || r === 'viewer') return r;
    }
  } catch {}

  // 3) Fallback: lista de admins por .env
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (decoded.email && admins.includes(decoded.email.toLowerCase())) return 'admin';

  return 'viewer';
}

router.post('/login', async (req, res) => {
  const idToken = getBearerToken(req) || req.body?.idToken;
  if (!idToken) return res.status(400).json({ message: 'Falta idToken' });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);

    const role = await resolveRole(decoded);

    // JWT propio de tu app con el rol dentro
    const token = jwt.sign(
      { uid: decoded.uid, email: decoded.email, role },
      APP_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token, role });
  } catch (e) {
    console.error('verifyIdToken error:', e?.errorInfo?.code || e.message);
    return res.status(401).json({ message: 'Token de Firebase inválido' });
  }
});

module.exports = router;
