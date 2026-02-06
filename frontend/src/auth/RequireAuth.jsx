import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, hasRole } from './authUtils';

export default function RequireAuth({ children, roles }) {
  const location = useLocation();
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (Array.isArray(roles) && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }
  return children;
}