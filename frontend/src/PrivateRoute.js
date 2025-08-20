// src/PrivateRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function PrivateRoute({ children }) {
  // 👉 tu lógica real: lee token de localStorage o de un contexto
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
