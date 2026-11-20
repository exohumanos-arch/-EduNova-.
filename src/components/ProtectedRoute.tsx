import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { AuthUser } from '../types';

interface ProtectedRouteProps {
  user: AuthUser | null | undefined;
  requireAdmin?: boolean;
  children: React.ReactNode;
}

/**
 * Guards routes that require an authenticated session.
 * - Unauthenticated visitors are redirected to /login (the attempted path is kept in state).
 * - When `requireAdmin` is set, non-admin users are redirected to /dashboard.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  requireAdmin = false,
  children,
}) => {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
