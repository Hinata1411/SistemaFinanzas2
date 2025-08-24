// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import DashboardLayout from './DashboardLayout';
import Finanzas from './Finanzas.js';
import RegistrarCierre from './RegistrarCierre';
import Ventas from './Ventas';
import Sucursales from './Sucursales';
import Usuarios from './utils/Usuarios.js';
import Login from './auth/Login';
import { RequireAdmin } from './router/guards';

function App() {
  return (
    <Router>
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
          <Route path="Sucursales" element={<Sucursales />} />

          {/* solo ADMIN puede entrar */}
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
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
