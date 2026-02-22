import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { localDB } from '@/api/localDB';
import { queryClientInstance } from '@/lib/query-client';
import { setCurrentUser, clearCurrentUser } from '@/lib/userStore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from localStorage
  useEffect(() => {
    localDB.auth.me()
      .then(u => {
        setCurrentUser(u.email); // must be set before app renders
        setUser(u);
      })
      .catch(() => {
        clearCurrentUser();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await localDB.auth.login(email, password);
    setCurrentUser(session.email);
    queryClientInstance.clear();
    setUser({ id: session.id, email: session.email, full_name: session.name, picture: session.picture });
    return session;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const session = await localDB.auth.register(email, password, name);
    setCurrentUser(session.email);
    queryClientInstance.clear();
    setUser({ id: session.id, email: session.email, full_name: session.name, picture: session.picture });
    return session;
  }, []);

  const logout = useCallback(() => {
    clearCurrentUser();
    localDB.auth.logout();
    queryClientInstance.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading: loading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
