// src/context/AuthContext.jsx
// TODO: Implement global authentication state using React Context
// - State: currentUser, accessToken, isLoading
// - Actions: login(), logout(), setCurrentUser()
// - Persist token in localStorage
// - Expose via useAuth hook (see hooks/useAuth.js)

import { createContext } from 'react';

export const AuthContext = createContext(null);

// TODO: Implement AuthProvider component
export const AuthProvider = ({ children }) => {
  // TODO: useState for user, token, loading
  // TODO: useEffect to restore session from localStorage on mount

  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
};
