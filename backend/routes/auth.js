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
  console.log('--- ROLE DEBUG START ---');
  console.log('decoded uid:', uid);
  console.log('decoded email:', email);

  // 0) ADMIN_EMAILS que ve el proceso
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => lower(s))
    .filter(Boolean);
  console.log('ENV ADMIN_EMAILS:', admins);

  // 1) Por UID
  try {
    const docUid = await db.collection('usuarios').doc(uid).get();
    console.log('[by UID] exists:', docUid.exists);
    if (docUid.exists) {
      const d = docUid.data() || {};
      console.log('[by UID] data:', d);
      const r = lower(d.role || d.rol || (d.isAdmin ? 'admin' : ''));
      if (r === 'admin' || r === 'viewer') {
        console.log('ROLE from UID:', r);
        console.log('--- ROLE DEBUG END (UID) ---');
        return r;
      }
    }
  } catch (e) {
    console.log('[by UID] error:', e.message);
  }

  // 2) Por email (exact match)
  try {
    const qs = await db.collection('usuarios').where('email', '==', email).limit(1).get();
    console.log('[by email] size:', qs.size);
    if (!qs.empty) {
      const d = qs.docs[0].data() || {};
      console.log('[by email] data:', d);
      const r = lower(d.role || d.rol || (d.isAdmin ? 'admin' : ''));
      if (r === 'admin' || r === 'viewer') {
        console.log('ROLE from email:', r);
        console.log('--- ROLE DEBUG END (EMAIL) ---');
        return r;
      }
    }
  } catch (e) {
    console.log('[by email] error:', e.message);
  }

  // 3) Fallback ADMIN_EMAILS
  if (admins.includes(lower(email))) {
    console.log('ROLE from ADMIN_EMAILS: admin');
    console.log('--- ROLE DEBUG END (ADMIN_EMAILS) ---');
    return 'admin';
  }

  console.log('ROLE default: viewer');
  console.log('--- ROLE DEBUG END (DEFAULT) ---');
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
    console.error('verifyIdToken error:', e?.errorInfo?.code || e.message);
    return res.status(401).json({ message: 'Token de Firebase inválido' });
  }
});

module.exports = router;
