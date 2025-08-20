// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import DashboardLayout from './DashboardLayout';
import Home from './Home';
import RegistrarCierre from './RegistrarCierre';
import HistorialCuadres from './HistorialCuadres';
import Sucursales from './Sucursales';
import Usuarios from './Usuarios';
import Login from './auth/Login'; 

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
          <Route path="HistorialCuadres" element={<HistorialCuadres />} />
          <Route path="Sucursales" element={<Sucursales />} />
          <Route path="Usuarios" element={<Usuarios />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
