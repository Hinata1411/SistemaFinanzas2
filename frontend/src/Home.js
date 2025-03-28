// Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home({ userEmail, role }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="admin-container">
      <aside className="sidebar">
        <nav className="nav-menu">
          <ul>
            <li><a href="#cuadres">Cuadres</a></li>
            <li><a href="#ventas">Ventas Detalladas</a></li>
            <li><a href="#reporte">Reporte General</a></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <p>{userEmail}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="admin-content">
        <h1>Panel de Administración</h1>
        <p>Contenido de la vista seleccionada se mostrará aquí.</p>
      </main>
    </div>
  );
}

export default Home;
