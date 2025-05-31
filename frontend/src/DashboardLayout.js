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

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
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
          >
            <img src="/flechaizq.png" alt="Toggle" width="40px" />
          </button>
          <div className="brand">
            <img src="/vipizzaamericanp.png" alt="Logo" />
          </div>
        </div>

        <div className="menu-container">
          <div className="search">
            <img src="/lupa.png" alt="Buscar" width="35px" />
            <input type="search" placeholder="Search" />
          </div>

          <ul className="menu">
            <li className="menu-item menu-item-static">
              <Link to="/home" className="menu-link">
                <img src="/casa.png" alt="Inicio" width="40px" />
                <span>Home</span>
              </Link>
            </li>

            <li className="menu-item menu-item-dropdown">
              <Link className="menu-link" onClick={() => setOpenCuadres(!openCuadres)}>
                <img src="/factura.png" alt="Cuadres" width="43px" />
                <span>Cuadres</span>
                <img src="/down.png" alt="Desplegar" width="30px" />
              </Link>
              <ul className={`sub-menu ${openCuadres ? 'visible' : ''}`}>
                <li>
                  <Link to="/home/RegistrarCierre" className="sub-menu-link">
                    <img src="/mas.png" alt="Registrar Cuadre" width="22px" />
                    <span>Registrar Cuadre</span>
                  </Link>
                </li>
                <li>
                  <Link to="/home/HistorialCuadres" className="sub-menu-link">
                    <img src="/expediente.png" alt="Historial" width="22px" />
                    <span>Historial de Cuadres</span>
                  </Link>
                </li>
              </ul>
            </li>

            <li className="menu-item menu-item-dropdown">
              <Link className="menu-link" onClick={() => setOpenEfectivo(!openEfectivo)}>
                <img src="/transferencia.png" alt="Efectivo" width="43px" />
                <span>Efectivo</span>
                <img src="/down.png" alt="Desplegar" width="30px" />
              </Link>
              <ul className={`sub-menu ${openEfectivo ? 'visible' : ''}`}>
                <li>
                  <Link to="/Movimientos" className="sub-menu-link">
                    <img src="/mas.png" alt="Registrar Movimientos" width="22px" />
                    <span>Registrar Movimientos</span>
                  </Link>
                </li>
                <li>
                  <Link to="/HistorialMov" className="sub-menu-link">
                    <img src="/expediente.png" alt="Historial de Movimientos" width="22px" />
                    <span>Historial de Movimientos</span>
                  </Link>
                </li>
              </ul>
            </li>

            <li className="menu-item menu-item-static">
              <Link to="Sucursales" className="menu-link">
                <img src="/pizza3.png" alt="Sucursales" width="43px" />
                <span>Sucursales</span>
              </Link>
            </li>

            <li className="menu-item menu-item-static">
              <Link to="Usuarios" className="menu-link">
                <img src="/agregaru.png" alt="Usuarios" width="43px" />
                <span>Usuarios</span>
              </Link>
            </li>

            <li className="menu-item menu-item-static">
              <Link to="/reportes" className="menu-link">
                <img src="/reporte.png" alt="Reportes" width="43px" />
                <span>Reportes</span>
              </Link>
            </li>

            <li className="menu-item menu-item-static">
              <Link to="/graficas" className="menu-link">
                <img src="/grafica.png" alt="Gráficas" width="43px" />
                <span>Gráficas</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className="footer">
          <ul className="menu">
            <li className="footer-item menu-item-static">
              <Link to="/notificaciones" className="menu-link">
                <img src="/notificacion.png" alt="Notificaciones" width="43px" />
                <span>Notificaciones</span>
              </Link>
            </li>
          </ul>
          <div className="user">
            <div className="user-img">
              <img src="/perfilusuario.png" alt="Usuario" width="43px" />
            </div>
            <div className="user-data">
              <span className="name">{userEmail || "Usuario"}</span>
              <span className="email">{userEmail || "user@example.com"}</span>
            </div>
            <div className="user-icon">
              <button onClick={handleLogout} className="logout-button" type="button">
                <img src="/cerrarsesion.png" alt="Cerrar sesión" width="30px" />
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
