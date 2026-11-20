import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setStoredSessionToken, setUnauthorizedHandler } from '../services/api';

/**
 * @typedef {import('../types').AuthUser} AuthUser
 * @typedef {{
 *   user: AuthUser | null,
 *   role: 'ADMIN' | 'TEACHER' | null,
 *   isAuthenticated: boolean,
 *   isAdmin: boolean,
 *   isTeacher: boolean,
 *   authChecking: boolean,
 *   sessionExpiredMessage: string | null,
 *   loginWithCode: (role: 'admin' | 'teacher', accessCode: string) => Promise<AuthUser>,
 *   logout: () => Promise<void>,
 *   refreshSession: () => Promise<any>,
 *   clearExpiredMessage: () => void,
 *   setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>,
 * }} AuthContextValue
 */

/** @type {import('react').Context<AuthContextValue | null>} */
const AuthContext = createContext(null);

/** @param {{ children: React.ReactNode }} props */
export const AuthProvider = ({ children }) => {
  /** @type {[AuthUser | null, React.Dispatch<React.SetStateAction<AuthUser | null>>]} */
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setStoredSessionToken(null);
      setUser(null);
      setSessionExpiredMessage('Your session has expired. Please enter your access code to continue.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((res) => {
        if (active) {
          setUser(res.user);
          setSessionExpiredMessage(null);
        }
      })
      .catch(() => {
        if (active) {
          setStoredSessionToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setAuthChecking(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  /**
   * @param {'admin' | 'teacher'} role
   * @param {string} accessCode
   * @returns {Promise<AuthUser>}
   */
  const loginWithCode = useCallback(async (role, accessCode) => {
    const res = await api.codeLogin(role, accessCode);
    setUser(res.user);
    setSessionExpiredMessage(null);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local session state even if network fails
    } finally {
      setStoredSessionToken(null);
      setUser(null);
      setSessionExpiredMessage(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const res = await api.refresh();
    setUser(res.user);
    return res;
  }, []);

  const clearExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  /** @type {AuthContextValue} */
  const value = {
    user,
    role: user?.role ?? null,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    isTeacher: user?.role === 'TEACHER',
    authChecking,
    sessionExpiredMessage,
    loginWithCode,
    logout,
    refreshSession,
    clearExpiredMessage,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** @returns {AuthContextValue} */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
