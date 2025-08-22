import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import './DashboardLayout.css';

function DashboardLayout({ userEmail, userRole }) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // drawer solo en móvil

  const email = userEmail || localStorage.getItem('email') || 'user@example.com';

  // === Rol: 'admin' o 'viewer' ===
  const role = (userRole || localStorage.getItem('role') || 'viewer').toLowerCase();
  const isAdmin = role === 'admin';

 const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('email');
  navigate('/login');
};
  return (
    <div className="admin-container">
      <Helmet>
        <link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" />
      </Helmet>

      {/* Sidebar fija en desktop / drawer en móvil */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sb-header">
          {/* Cerrar drawer (solo móvil) */}
          <button
            type="button"
            className="menu-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <img src="/flechaizq.png" alt="" width="20" height="20" />
          </button>

          <div className="brand">
            <img src="/Logosinfondo.png" alt="American Pizza" />
          </div>
        </div>

        <nav id="sidebar-menu" className="menu-container">
          <ul className="menu">
            <li className="menu-item">
              {/* end => activo SOLO en /home exacto */}
              <NavLink to="/home" end className={({isActive}) => `menu-link ${isActive ? 'active' : ''}`}>
                <img src="/casa.png" alt="" />
                <span>Home</span>
              </NavLink>
            </li>

            {/* ✅ Ventas SIN submenú */}
            <li className="menu-item">
              <NavLink to="Ventas" className={({isActive}) => `menu-link ${isActive ? 'active' : ''}`}>
                <img src="/factura.png" alt="" />
                <span>Ventas</span>
              </NavLink>
            </li>

            <li className="menu-item">
              <NavLink to="Sucursales" className={({isActive}) => `menu-link ${isActive ? 'active' : ''}`}>
                <img src="/pizza3.png" alt="" />
                <span>Sucursales</span>
              </NavLink>
            </li>

            {/* 👇 Solo administradores ven "Usuarios" */}
            {isAdmin && (
              <li className="menu-item">
                <NavLink to="Usuarios" className={({isActive}) => `menu-link ${isActive ? 'active' : ''}`}>
                  <img src="/agregaru.png" alt="" />
                  <span>Usuarios</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div className="sb-footer">
          <div className="user">
            <div className="user-img">
              <img src="/perfilusuario.png" alt="" width="38" height="38" />
            </div>
            <div className="user-data">
              <span className="name">{email.split('@')[0] || 'Usuario'}</span>
              <span className="email">{email}</span>
            </div>
            <button onClick={handleLogout} className="logout-button" type="button" title="Cerrar sesión">
              <img src="/cerrarsesion.png" alt="" width="22" height="22" />
            </button>
          </div>
        </div>
      </aside>

      {/* Botón para abrir drawer en móvil (no hay overlay) */}
      <button
        type="button"
        className="mobile-trigger"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Abrir menú"
      >
        <i className="bx bx-menu"></i>
      </button>

      {/* Contenido central */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
