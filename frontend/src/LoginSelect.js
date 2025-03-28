// src/LoginSelect.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { auth, signInWithEmailAndPassword } from './firebase';
import { db } from './firebase';
import 'bootstrap/dist/css/bootstrap.min.css';

function LoginSelect() {
  const [users, setUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // Cargar usuarios al montar el componente
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        const usersData = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          usersData.push({
            email: data.email,      // Valor para autenticación
            username: data.username // Nombre a mostrar en el combobox
          });
        });
        setUsers(usersData);
        // Preselecciona el primer usuario, si existe
        if (usersData.length > 0) {
          setSelectedEmail(usersData[0].email);
        }
      } catch (error) {
        console.error("Error al cargar usuarios:", error);
        alert("Error al cargar los usuarios. Intenta de nuevo más tarde.");
      }
    };

    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEmail || !password) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    try {
      // Autentica con Firebase Authentication en el cliente
      const userCredential = await signInWithEmailAndPassword(auth, selectedEmail, password);
      const user = userCredential.user;
      
      // Obtén el ID token de Firebase
      const idToken = await user.getIdToken();

      // Envía el ID token al backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json();

      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.role === "admin") {
          navigate('/paginaadmin');
        } else {
          navigate('/paginavisual');
        }
      } else {
        alert("Error en autenticación: " + data.message);
      }
    } catch (error) {
      console.error("Error en autenticación:", error);
      alert("Error en el login: " + error.message);
    }
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <div className="container" style={{ maxWidth: '450px' }}>
        <div className="card shadow p-4">
          <h2 className="text-center mb-4">Iniciar Sesión</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="userSelect" className="form-label">Seleccione Usuario:</label>
              <select
                id="userSelect"
                className="form-select"
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
              >
                {users.map((user, index) => (
                  <option key={index} value={user.email}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Contraseña:</label>
              <input
                type="password"
                id="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginSelect;
