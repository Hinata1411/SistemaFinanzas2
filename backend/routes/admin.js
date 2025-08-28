// backend/routes/admin.js
const router = require('express').Router();
const { admin, db } = require('../firebaseAdmin');

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

async function verifyFirebaseToken(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ message: 'Falta Authorization Bearer' });
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

async function isAdminUID(uid) {
  try {
    const user = await admin.auth().getUser(uid);
    if (user?.customClaims?.admin === true) return true;
  } catch {}
  try {
    const snap = await db.collection('usuarios').doc(uid).get();
    if (snap.exists && String((snap.data() || {}).role || '').toLowerCase() === 'admin') {
      return true;
    }
  } catch {}
  return false;
}

router.post('/deleteUser', verifyFirebaseToken, async (req, res) => {
  try {
    const callerUid = req.firebaseUser?.uid;
    if (!callerUid) return res.status(401).json({ message: 'No autenticado' });
    if (!await isAdminUID(callerUid)) return res.status(403).json({ message: 'Solo admin' });

    const { uid } = req.body || {};
    if (typeof uid !== 'string' || !uid.trim()) {
      return res.status(400).json({ message: 'uid requerido' });
    }
    if (uid === callerUid) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      if (e?.errorInfo?.code !== 'auth/user-not-found') throw e;
    }

    try {
      await db.collection('usuarios').doc(uid).delete();
    } catch {}

    return res.json({ ok: true, message: 'Usuario eliminado en Auth y Firestore' });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Error al eliminar usuario' });
  }
});

module.exports = router;
