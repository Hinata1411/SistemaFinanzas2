// src/DashboardLayout.js
import React, { useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import './DashboardLayout.css';

function DashboardLayout({ userEmail }) {
  const navigate = useNavigate();
  const [openCuadres, setOpenCuadres] = useState(false);
  const [openEfectivo, setOpenEfectivo] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const email = userEmail || localStorage.getItem('email') || 'user@example.com';

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login'); // usa minúsculas para consistencia con App.js
  };

  return (
    <div className="admin-container">
      <Helmet>
        <link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;700&display=swap" />
      </Helmet>

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="header">
          <button
            type="button"
            className={`menu-btn ${!isSidebarOpen ? 'closed' : ''}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-expanded={isSidebarOpen}
            aria-controls="sidebar-menu"
          >
            <img src="/flechaizq.png" alt="Toggle" width="40" />
          </button>
          <div className="brand">
            <img src="/vipizzaamericanp.png" alt="Logo" />
          </div>
        </div>

        <div id="sidebar-menu" className="menu-container">
          <div className="search">
            <img src="/lupa.png" alt="Buscar" width="35" />
            <input type="search" placeholder="Search" />
          </div>

          <ul className="menu">
            <li className="menu-item menu-item-static">
              <Link to="/home" className="menu-link">
                <img src="/casa.png" alt="Inicio" width="40" />
                <span>Home</span>
              </Link>
            </li>

            <li className="menu-item menu-item-dropdown">
              <button
                type="button"
                className="menu-link as-button"  // dale estilos .as-button { all: unset; display:flex; ...}
                onClick={() => setOpenCuadres(!openCuadres)}
                aria-expanded={openCuadres}
                aria-controls="submenu-cuadres"
              >
                <img src="/factura.png" alt="Cuadres" width="43" />
                <span>Cuadres</span>
                <img src="/down.png" alt="Desplegar" width="30" />
              </button>
              <ul id="submenu-cuadres" className={`sub-menu ${openCuadres ? 'visible' : ''}`}>
                <li>
                  <Link to="RegistrarCierre" className="sub-menu-link">
                    <img src="/mas.png" alt="Registrar Cuadre" width="22" />
                    <span>Registrar Cuadre</span>
                  </Link>
                </li>
                <li>
                  <Link to="HistorialCuadres" className="sub-menu-link">
                    <img src="/expediente.png" alt="Historial" width="22" />
                    <span>Historial de Cuadres</span>
                  </Link>
                </li>
              </ul>
            </li>

            <li className="menu-item menu-item-static">
              <Link to="Sucursales" className="menu-link">
                <img src="/pizza3.png" alt="Sucursales" width="43" />
                <span>Sucursales</span>
              </Link>
            </li>

            <li className="menu-item menu-item-static">
              <Link to="Usuarios" className="menu-link">
                <img src="/agregaru.png" alt="Usuarios" width="43" />
                <span>Usuarios</span>
              </Link>
            </li>

            {/* Descomenta cuando tengas la ruta */}
            {/* <li className="menu-item menu-item-static">
              <Link to="reportes" className="menu-link">
                <img src="/reporte.png" alt="Reportes" width="43" />
                <span>Reportes</span>
              </Link>
            </li> */}

            {/* Igual: crea ruta /home/graficas o comenta temporalmente */}
            {/* <li className="menu-item menu-item-static">
              <Link to="graficas" className="menu-link">
                <img src="/grafica.png" alt="Gráficas" width="43" />
                <span>Gráficas</span>
              </Link>
            </li> */}
          </ul>
        </div>

        <div className="footer">
          <ul className="menu">
            {/* Descomenta cuando exista /home/notificaciones */}
            {/* <li className="footer-item menu-item-static">
              <Link to="notificaciones" className="menu-link">
                <img src="/notificacion.png" alt="Notificaciones" width="43" />
                <span>Notificaciones</span>
              </Link>
            </li> */}
          </ul>
          <div className="user">
            <div className="user-img">
              <img src="/perfilusuario.png" alt="Usuario" width="43" />
            </div>
            <div className="user-data">
              <span className="name">{email.split('@')[0] || 'Usuario'}</span>
              <span className="email">{email}</span>
            </div>
            <div className="user-icon">
              <button onClick={handleLogout} className="logout-button" type="button">
                <img src="/cerrarsesion.png" alt="Cerrar sesión" width="30" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido central */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
