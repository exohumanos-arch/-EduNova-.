import React from 'react';
import { Navigate } from 'react-router-dom';
import type { AuthUser } from '../types';

interface ProtectedRouteProps {
  user: AuthUser | null;
  requireAdmin?: boolean;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  requireAdmin = false,
  children,
}) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};
