import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { supabaseDB, _setUser, _clearUser } from '@/api/supabaseDB';
import { hydrateStorage, clearStorage } from '@/api/supabaseStorage';
import { queryClientInstance } from '@/lib/query-client';
import { setCurrentUser, clearCurrentUser } from '@/lib/userStore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session from Supabase (it persists the token in localStorage automatically)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const u = session.user;
        _setUser(u.id, u.email);
        setCurrentUser(u.email);
        await hydrateStorage(u.id);
        setUser({
          id:        u.id,
          email:     u.email,
          full_name: u.user_metadata?.name || u.email.split('@')[0],
          picture:   u.user_metadata?.picture,
        });
      } else {
        _clearUser();
        clearCurrentUser();
        clearStorage();
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await supabaseDB.auth.login(email, password);
    queryClientInstance.clear();
    return session;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const session = await supabaseDB.auth.register(email, password, name);
    queryClientInstance.clear();
    return session;
  }, []);

  const logout = useCallback(async () => {
    _clearUser();
    clearCurrentUser();
    clearStorage();
    await supabaseDB.auth.logout();
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
