import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import './DashboardLayout.css';

function DashboardLayout({ userEmail, userRole }) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Email mostrado
  const email = userEmail || localStorage.getItem('email') || 'user@example.com';

  // Rol
  const getRole = () =>
    String(userRole || localStorage.getItem('role') || 'viewer').toLowerCase();
  const [role, setRole] = useState(getRole());
  const isAdmin = role === 'admin';

  // Tema
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    setRole(getRole());

    const onStorage = (e) => {
      if (e.key === 'role') setRole(String(e.newValue || 'viewer').toLowerCase());
      if (e.key === 'theme') {
        const val = e.newValue || 'light';
        setTheme(val);
        document.documentElement.classList.toggle('alt-theme', val === 'dark');
      }
    };
    const onFocus = () => setRole(getRole());

    // aplicar tema al cargar
    document.documentElement.classList.toggle('alt-theme', theme === 'dark');

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Bloqueo de scroll cuando el drawer móvil está abierto
  useEffect(() => {
    document.documentElement.classList.toggle('drawer-open', isSidebarOpen);
  }, [isSidebarOpen]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('alt-theme', next === 'dark');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-container">
      <Helmet>
        <link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap"
        />
      </Helmet>

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sb-header">
          {/* Cerrar drawer en móvil */}
          <button
            type="button"
            className="menu-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <i className="bx bx-chevron-left"></i>
          </button>

          <div className="brand">
            <img src="/Logosinfondo.png" alt="American Pizza" />
          </div>
        </div>

        <nav id="sidebar-menu" className="menu-container">
          <ul className="menu">
            <li className="menu-item">
              <NavLink
                to="/home"
                end
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <img src="/casa.png" alt="" />
                <span>Home</span>
              </NavLink>
            </li>

            <li className="menu-item">
              <NavLink
                to="Ventas"
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <img src="/factura.png" alt="" />
                <span>Ventas</span>
              </NavLink>
            </li>

            <li className="menu-item">
              <NavLink
                to="Sucursales"
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <img src="/pizza3.png" alt="" />
                <span>Sucursales</span>
              </NavLink>
            </li>

            {isAdmin && (
              <li className="menu-item">
                <NavLink
                  to="Usuarios"
                  className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
                >
                  <img src="/agregaru.png" alt="" />
                  <span>Usuarios</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        {/* Footer del sidebar: cambiar tema + cerrar sesión */}
        <div className="sb-footer">
          <div className="footer-actions">
           
            <button
              onClick={handleLogout}
              className="logout-button"
              type="button"
              title="Cerrar sesión"
            >
              <i className="bx bx-log-out" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop para cerrar tocando fuera (solo en móvil) */}
      <div
        className={`backdrop ${isSidebarOpen ? 'show' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Botón hamburguesa (solo móvil) */}
      <button
        type="button"
        className="mobile-trigger"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Abrir menú"
      >
        <i className="bx bx-menu"></i>
      </button>

      {/* Contenido */}
      <main className="admin-content">
        {/* Barra de usuario arriba */}
        <header className="userbar">

          <div className="theme">
             <button type="button" className="theme-button" onClick={toggleTheme} title="Cambiar tema">
              <i className={`bx ${theme === 'dark' ? 'bx-sun' : 'bx-moon'}`} />
              <span>{theme === 'dark' ? ' ' : ' '}</span>
            </button>
          </div>
          <div className="actions">
            <button className="icon-btn" title="Notificaciones">
              <i className="bx bx-bell"></i>
            </button>
          </div>
          <div className="user-chip">
            <img src="/perfilusuario.png" alt="perfil-usuario" />
            <div className="meta">
              <strong>{email.split('@')[0] || 'Usuario'}</strong>
              <small>{email}</small>
            </div>
          </div>
          
        </header>

        <div className="content-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
