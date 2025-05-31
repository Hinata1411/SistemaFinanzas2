// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginSelect from './LoginSelect';
import PrivateRoute from './PrivateRoute';
import DashboardLayout from './DashboardLayout'; // Nuevo layout envolvente
import Home from './Home';
import RegistrarCierre from './RegistrarCierre';
import HistorialCuadres from './HistorialCuadres';
import Sucursales from './Sucursales';
import Usuarios from './Usuarios';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<LoginSelect />} />
        <Route path="/LoginSelect" element={<LoginSelect />} />

        {/* Rutas protegidas con layout */}
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          {/* Subrutas dentro del layout con sidebar */}
          <Route index element={<Home />} />
          <Route path="RegistrarCierre" element={<RegistrarCierre />} />
          <Route path="HistorialCuadres" element={<HistorialCuadres />} />
          <Route path="Sucursales" element={<Sucursales />} />
          <Route path="Usuarios" element={<Usuarios />} />
        </Route>

        {/* Fallback para rutas desconocidas */}
        <Route path="*" element={<LoginSelect />} />
      </Routes>
    </Router>
  );
}

export default App;
