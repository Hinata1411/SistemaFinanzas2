
import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from './firebase';

export default function PrivateRoute({ children }) {
  const isAuthenticated = !!auth.currentUser || !!localStorage.getItem('token');

  return isAuthenticated ? children : <Navigate to="/LoginSelect" />;
}
