// backend/routes/auth.js
const router = require('express').Router();
const { admin, db } = require('../firebaseAdmin');
const jwt = require('jsonwebtoken');

const APP_SECRET = process.env.APP_SECRET || 'cambia-esto';

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

const lower = (s) => (s || '').toString().trim().toLowerCase();

async function resolveRoleDebug({ uid, email }) {

  // 0) ADMIN_EMAILS que ve el proceso
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => lower(s))
    .filter(Boolean);

  // 1) Por UID
  try {
    const docUid = await db.collection('usuarios').doc(uid).get();
    if (docUid.exists) {
      const d = docUid.data() || {};
      const r = lower(d.role || d.rol || (d.isAdmin ? 'admin' : ''));
      if (r === 'admin' || r === 'viewer') {
        return r;
      }
    }
  } catch (e) {
  }

  // 2) Por email (exact match)
  try {
    const qs = await db.collection('usuarios').where('email', '==', email).limit(1).get();
    if (!qs.empty) {
      const d = qs.docs[0].data() || {};
      const r = lower(d.role || d.rol || (d.isAdmin ? 'admin' : ''));
      if (r === 'admin' || r === 'viewer') {
        return r;
      }
    }
  } catch (e) {
  }

  // 3) Fallback ADMIN_EMAILS
  if (admins.includes(lower(email))) {
    return 'admin';
  }

  return 'viewer';
}

router.post('/login', async (req, res) => {
  const idToken = getBearerToken(req) || req.body?.idToken;
  if (!idToken) return res.status(400).json({ message: 'Falta idToken' });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const role = await resolveRoleDebug({ uid: decoded.uid, email: decoded.email });

    const token = jwt.sign({ uid: decoded.uid, email: decoded.email, role }, APP_SECRET, {
      expiresIn: '8h',
    });

    return res.json({ token, role });
  } catch (e) {
    return res.status(401).json({ message: 'Token de Firebase inválido' });
  }
});

module.exports = router;
