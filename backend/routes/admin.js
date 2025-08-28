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
    res.status(401).json({ message: 'Token inválido' });
  }
}

async function isAdminUID(uid) {
  try {
    const user = await admin.auth().getUser(uid);
    if (user?.customClaims?.admin === true) return true;
  } catch {}
  try {
    const snap = await db.collection('usuarios').doc(uid).get();
    if (snap.exists && String((snap.data()||{}).role || '').toLowerCase() === 'admin') return true;
  } catch {}
  return false;
}

// POST /admin/deleteUser { uid }  (ya lo tienes)
router.post('/deleteUser', verifyFirebaseToken, async (req, res) => {
  try {
    const callerUid = req.firebaseUser?.uid;
    if (!callerUid) return res.status(401).json({ message: 'No autenticado' });
    if (!await isAdminUID(callerUid)) return res.status(403).json({ message: 'Solo admin' });

    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ message: 'uid requerido' });

    await admin.auth().deleteUser(uid).catch((e) => {
      if (e?.errorInfo?.code !== 'auth/user-not-found') throw e;
    });

    await db.collection('usuarios').doc(uid).delete().catch(()=>{});

    res.json({ ok: true, message: 'Usuario eliminado en Auth y Firestore' });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Error al eliminar usuario' });
  }
});

// ✅ NUEVO: actualizar email y/o password de un usuario
// body: { uid, email?, password? }
router.post('/updateUser', verifyFirebaseToken, async (req, res) => {
  try {
    const callerUid = req.firebaseUser?.uid;
    if (!callerUid) return res.status(401).json({ message: 'No autenticado' });
    if (!await isAdminUID(callerUid)) return res.status(403).json({ message: 'Solo admin' });

    const { uid, email, password } = req.body || {};
    if (!uid) return res.status(400).json({ message: 'uid requerido' });
    if (!email && !password) return res.status(400).json({ message: 'Nada para actualizar' });

    const updateObj = {};
    if (email) updateObj.email = String(email).trim();
    if (password) updateObj.password = String(password);

    const updated = await admin.auth().updateUser(uid, updateObj);

    // Si cambiamos email, sincroniza en Firestore
    if (email) {
      await db.collection('usuarios').doc(uid).set(
        { email: String(email).trim() },
        { merge: true }
      );
    }

    res.json({ ok: true, user: { uid: updated.uid, email: updated.email } });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Error al actualizar usuario' });
  }
});

module.exports = router;
