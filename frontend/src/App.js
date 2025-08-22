// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import DashboardLayout from './DashboardLayout';
import Home from './Home';
import RegistrarCierre from './RegistrarCierre';
import Ventas from './Ventas';
import Sucursales from './Sucursales';
import Usuarios from './Usuarios';
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
          path="/home"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Home />} />
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
