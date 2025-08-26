// src/App.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import PrivateRoute from './PrivateRoute';
import DashboardLayout from './DashboardLayout';
import Finanzas from './Finanzas.js';
import RegistrarCierre from './RegistrarCierre';
import Ventas from './Ventas';
import Sucursales from './Sucursales';
import Usuarios from './utils/Usuarios.js';
import Login from './auth/Login';
import { RequireAdmin } from './router/guards';
import RegistrarPagos from './RegistrarPagos.jsx';
import HistorialPagos from './HistorialPagos.jsx';

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
        <Route path="Ventas" element={<Ventas />} />

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
