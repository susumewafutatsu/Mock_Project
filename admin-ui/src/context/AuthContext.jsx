// src/context/AuthContext.jsx
// State đăng nhập toàn cục: giữ currentUser + token, phục hồi session khi F5.

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { tokenStore } from '../services/api';
import { STORAGE_KEYS } from '../utils/constants';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Phục hồi session từ localStorage khi mount, rồi xác thực lại với backend
  useEffect(() => {
    const token = tokenStore.getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    const cached = localStorage.getItem(STORAGE_KEYS.USER);
    if (cached) {
      try {
        setCurrentUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    }

    authService
      .getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      })
      .catch(() => {
        tokenStore.clear();
        setCurrentUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const auth = await authService.login(email, password);
    setCurrentUser(auth.user);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(auth.user));
    return auth.user;
  }, []);

  /** Dùng bởi CallbackPage sau khi nhận token từ Google SSO */
  const loginWithTokens = useCallback(async ({ accessToken, refreshToken }) => {
    tokenStore.save({ accessToken, refreshToken });
    const user = await authService.getCurrentUser();
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isLoading,
      isAuthenticated: !!currentUser,
      login,
      loginWithTokens,
      loginWithGoogle: authService.loginWithGoogle,
      logout,
      setCurrentUser,
    }),
    [currentUser, isLoading, login, loginWithTokens, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
