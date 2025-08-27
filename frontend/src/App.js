// src/App.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import PrivateRoute from './auth/PrivateRoute.js';
import DashboardLayout from './components/nav-bar/DashboardLayout.js';
import Finanzas from './components/finanzas/Finanzas.js';
import RegistrarCierre from './components/registrar-cierre/RegistrarCierre.js';
import HistorialCuadres from './components/historial/HistorialCuadres.js';
import Sucursales from './components/sucursales/Sucursales.js';
import Usuarios from './components/usuarios/Usuarios.js';
import Login from './auth/Login';
import { RequireAdmin } from './router/guards';
import RegistrarPagos from './components/registrar-pagos/RegistrarPagos.jsx';
import HistorialPagos from './components/historial/HistorialPagos.jsx';

export default function App() { 
  return (
    <Routes>
      {/* públicas */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />

      {/* protegidas */}
      <Route
        path="/Finanzas"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Finanzas />} />
        <Route path="RegistrarCierre" element={<RegistrarCierre />} />
        <Route path="HistorialCuadres" element={<HistorialCuadres  />} />

        {/* solo ADMIN */}
        <Route
          path="HistorialPagos"
          element={
            <RequireAdmin>
              <HistorialPagos />
            </RequireAdmin>
          }
        />
        <Route
          path="RegistrarPagos"
          element={
            <RequireAdmin>
              <RegistrarPagos />
            </RequireAdmin>
          }
        />
        <Route
          path="Sucursales"
          element={
            <RequireAdmin>
              <Sucursales />
            </RequireAdmin>
          }
        />
        <Route
          path="Usuarios"
          element={
            <RequireAdmin>
              <Usuarios />
            </RequireAdmin>
          }
        />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
