// src/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, signInWithEmailAndPassword } from './firebase-config';
import { db } from "./firebase-config";
import { doc, getDoc } from 'firebase/firestore';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Login.css';
import logo from './Logosempresa.png'; // Asegúrate de que la imagen esté en la carpeta src

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    if (email && password) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          localStorage.setItem('email', user.email);

          // Navega a diferentes rutas según el rol
          if (userData.role === "admin") {
            navigate('/paginaadmin');
          } else {
            // Puedes redirigir a otra ruta según el rol
            navigate('/dashboard');
          }
        } else {
          alert("No existe información del usuario en Firestore.");
        }
      } catch (error) {
        console.error("Error en autenticación:", error);
        alert("Usuario o contraseña incorrectos.");
      }
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <div className="container" style={{ maxWidth: '450px' }}>
        <div className="card shadow p-4">
          <div className="text-center">
            {/* Se asigna la clase "logo" para que se apliquen los estilos definidos en tu CSS */}
            <img src={logo} alt="logo" className="logo" width="43px" />
          </div>
          <h2 className="text-center mb-4">Tracking Ventas</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Correo Electrónico:</label>
              <input
                type="email"
                id="email"
                className="form-control form-control-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Contraseña:</label>
              <input
                type="password"
                id="password"
                className="form-control form-control-lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">Iniciar Sesión</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
