import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @param {{
 *   user?: import('../types').AuthUser | null,
 *   requireAdmin?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
export const ProtectedRoute = ({ user: userProp, requireAdmin = false, children }) => {
  let ctxUser = null;
  try {
    ctxUser = useAuth()?.user ?? null;
  } catch {
    ctxUser = null;
  }

  const activeUser = userProp !== undefined ? userProp : ctxUser;

  if (!activeUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && activeUser.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
