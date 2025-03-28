// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const admin = require('../firebaseAdmin'); // Asegúrate de que la ruta sea correcta

router.post('/login', async (req, res) => {
  const { idToken } = req.body;
  console.log("Verificando el token de Firebase...");

  try {
    // Verifica el ID token usando Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log("Token decodificado:", decodedToken);

    // Opcional: Genera tu propio JWT para la aplicación
    const token = jwt.sign(
      { uid: decodedToken.uid, email: decodedToken.email, role: decodedToken.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  


    //AGREGAR COOKIE HTTPONLY
    // Configurar la cookie con el token, marcándola como HttpOnly
    //res.cookie('token', token, {
    //  httpOnly: true,
      //secure: process.env.NODE_ENV === 'production', // En producción, true para HTTPS
     // maxAge: 3600000, // Tiempo de vida en milisegundos (ej. 1 hora)
     // sameSite: 'lax'  // O 'strict', dependiendo de tu configuración
   // });
    // Enviar una respuesta sin el token en el cuerpo (ya que está en la cookie)
   // res.json({ message: 'Autenticación exitosa', role: decodedToken.role || 'user' });
 // } catch (error) {
   // console.error("Error verificando el token de Firebase:", error);
  //  res.status(401).json({ message: "Token de Firebase inválido" });
 // }

    res.json({ token, role: decodedToken.role || 'user' });
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    res.status(401).json({ message: "Token de Firebase inválido" });
  }
});

module.exports = router;
