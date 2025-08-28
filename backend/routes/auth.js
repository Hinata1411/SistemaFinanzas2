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

async function getUserDocByUid(uid) {
  try {
    const snap = await db.collection('usuarios').doc(uid).get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    return {
      role: lower(d.role || d.rol || (d.isAdmin ? 'admin' : '')),
      disabled: !!d.disabled,
      username: d.username,
      email: d.email,
    };
  } catch {
    return null;
  }
}

async function getUserDocByEmailExact(email) {
  try {
    const qs = await db.collection('usuarios').where('email', '==', email).limit(1).get();
    if (!qs.empty) {
      const d = qs.docs[0].data() || {};
      return {
        role: lower(d.role || d.rol || (d.isAdmin ? 'admin' : '')),
        disabled: !!d.disabled,
        username: d.username,
        email: d.email,
      };
    }
  } catch {}
  return null;
}

async function resolveRoleAndDisabled({ uid, email }) {
  const byUid = await getUserDocByUid(uid);
  if (byUid) {
    const role = (byUid.role === 'admin' || byUid.role === 'viewer') ? byUid.role : '';
    return { role: role || '', disabled: !!byUid.disabled };
  }

  const byEmail = await getUserDocByEmailExact(email);
  if (byEmail) {
    const role = (byEmail.role === 'admin' || byEmail.role === 'viewer') ? byEmail.role : '';
    return { role: role || '', disabled: !!byEmail.disabled };
  }

  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(lower).filter(Boolean);
  if (admins.includes(lower(email))) return { role: 'admin', disabled: false };

  return { role: 'viewer', disabled: false };
}

// Sincroniza el custom claim { admin: true/false } preservando otros claims
async function syncAdminClaim(uid, shouldBeAdmin) {
  try {
    const u = await admin.auth().getUser(uid);
    const current = !!(u.customClaims && u.customClaims.admin);
    const desired = !!shouldBeAdmin;
    if (current === desired) return false; // sin cambios

    const nextClaims = { ...(u.customClaims || {}), admin: desired };
    await admin.auth().setCustomUserClaims(uid, nextClaims);
    return true;
  } catch {
    return false;
  }
}

router.post('/login', async (req, res) => {
  const idToken = getBearerToken(req) || req.body?.idToken;
  if (!idToken) return res.status(400).json({ message: 'Falta idToken' });

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || '';

    const { role, disabled } = await resolveRoleAndDisabled({ uid, email });
    if (disabled) return res.status(403).json({ message: 'Cuenta deshabilitada' });

    // 👉 escribe/actualiza el claim admin en Firebase
    await syncAdminClaim(uid, role === 'admin');

    // Tu JWT de app (para tus rutas protegidas propias)
    const token = jwt.sign({ uid, email, role }, APP_SECRET, { expiresIn: '8h' });
    return res.json({ token, role });
  } catch {
    return res.status(401).json({ message: 'Token de Firebase inválido' });
  }
});

module.exports = router;
