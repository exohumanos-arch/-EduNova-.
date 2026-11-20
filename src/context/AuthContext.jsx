import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getErrorMessage, setStoredSessionToken, setUnauthorizedHandler } from '../services/api';

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
 *   loginWithCode: (role: 'admin' | 'teacher', accessCode: string, autoCommit?: boolean) => Promise<AuthUser>,
 *   commitUser: (nextUser: AuthUser) => void,
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
   * @param {AuthUser} nextUser
   */
  const commitUser = useCallback((nextUser) => {
    setUser(nextUser);
    setSessionExpiredMessage(null);
  }, []);

  /**
   * @param {'admin' | 'teacher'} role
   * @param {string} accessCode
   * @param {boolean} [autoCommit=true]
   * @returns {Promise<AuthUser>}
   */
  const loginWithCode = useCallback(async (role, accessCode, autoCommit = true) => {
    try {
      const res = await api.codeLogin(role, accessCode);
      if (!res || !res.user || (res.user.role !== 'ADMIN' && res.user.role !== 'TEACHER')) {
        throw new Error('Received an invalid authentication response from the server.');
      }
      if (autoCommit) {
        setUser(res.user);
        setSessionExpiredMessage(null);
      }
      return res.user;
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Invalid access code. Please try again.'));
    }
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
    commitUser,
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
