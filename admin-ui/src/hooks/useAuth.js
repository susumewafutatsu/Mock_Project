// src/hooks/useAuth.js
// TODO: Return { currentUser, login, logout, isLoading } from AuthContext

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
