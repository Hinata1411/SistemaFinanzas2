// src/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from './firebase-config'; // Asegúrate de exportar sendPasswordResetEmail desde tu configuración de Firebase
import { db } from './firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Login.css';
import logo from './Logosempresa.png';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!email || !password) {
      setFeedback({ type: 'error', message: 'Por favor, completa todos los campos.' });
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const docRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        localStorage.setItem('email', user.email);

        if (userData.role === 'admin') {
          navigate('/paginaadmin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setFeedback({ type: 'error', message: 'No existe información del usuario en Firestore.' });
      }
    } catch (error) {
      console.error('Error en autenticación:', error);
      setFeedback({ type: 'error', message: 'Usuario o contraseña incorrectos.' });
    }
  };

  const handleForgotPassword = async () => {
    setFeedback({ type: '', message: '' });

    if (!email) {
      setFeedback({ type: 'error', message: 'Ingresa tu correo electrónico para recuperar tu contraseña.' });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setFeedback({
        type: 'success',
        message: `Hemos enviado un correo a ${email} con instrucciones para restablecer tu contraseña.`
      });
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);
      let mensajeError = 'Ocurrió un error al intentar enviar el correo de recuperación.';
      // Puedes personalizar mensajes según el código de error
      if (error.code === 'auth/user-not-found') {
        mensajeError = 'No existe ningún usuario registrado con ese correo.';
      } else if (error.code === 'auth/invalid-email') {
        mensajeError = 'El correo electrónico ingresado no es válido.';
      }
      setFeedback({ type: 'error', message: mensajeError });
    }
  };

  return (
    <div className="login-wrapper">
      <div id="loginForm" className="p-4 rounded shadow-sm bg-white">
        <div className="text-center mb-4">
          <img src={logo} alt="logo" className="logo" width="43px" />
        </div>
        <h2 className="text-center mb-4">Tracking Ventas</h2>

        {/* Feedback (alertas) */}
        {feedback.message && (
          <div
            className={`alert ${
              feedback.type === 'success' ? 'alert-success' : 'alert-danger'
            }`}
            role="alert"
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Correo Electrónico:
            </label>
            <input
              type="email"
              id="email"
              className="form-control form-control-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Contraseña:
            </label>
            <input
              type="password"
              id="password"
              className="form-control form-control-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100 mb-2">
            Iniciar Sesión
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            className="btn btn-link p-0"
            onClick={handleForgotPassword}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
