import React, { createContext, useContext } from 'react';

/**
 * @typedef {import('../types').AuthUser} AuthUser
 * @typedef {{
 *   user: AuthUser,
 *   role: 'ADMIN',
 *   isAuthenticated: boolean,
 *   isAdmin: boolean,
 *   isTeacher: boolean,
 *   authChecking: boolean,
 * }} AuthContextValue
 */

const DEFAULT_USER = /** @type {AuthUser} */ ({
  id: 1,
  username: 'Administrator',
  role: 'ADMIN',
});

/** @type {AuthContextValue} */
const DEFAULT_CONTEXT = {
  user: DEFAULT_USER,
  role: 'ADMIN',
  isAuthenticated: true,
  isAdmin: true,
  isTeacher: false,
  authChecking: false,
};

/** @type {import('react').Context<AuthContextValue>} */
const AuthContext = createContext(DEFAULT_CONTEXT);

/** @param {{ children: React.ReactNode }} props */
export const AuthProvider = ({ children }) => {
  return <AuthContext.Provider value={DEFAULT_CONTEXT}>{children}</AuthContext.Provider>;
};

/** @returns {AuthContextValue} */
export function useAuth() {
  return useContext(AuthContext);
}
