import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { supabaseDB, _setUser, _clearUser } from '@/api/supabaseDB';
import { hydrateStorage, clearStorage } from '@/api/supabaseStorage';
import { queryClientInstance } from '@/lib/query-client';
import { setCurrentUser, clearCurrentUser } from '@/lib/userStore';

const AuthContext = createContext();

function applySession(u) {
  _setUser(u.id, u.email);
  setCurrentUser(u.email);
  hydrateStorage(u.id).catch(() => {});
  return {
    id:        u.id,
    email:     u.email,
    full_name: u.user_metadata?.name || u.email.split('@')[0],
    picture:   u.user_metadata?.picture,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]                             = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Step 1: restore session instantly from Supabase's local cache (no network needed)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) setUser(applySession(session.user));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Step 2: listen for subsequent auth changes (sign in, sign out, token refresh, recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // already handled by getSession() above

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }

      if (session?.user) {
        setUser(applySession(session.user));
      } else {
        _clearUser();
        clearCurrentUser();
        clearStorage();
        setUser(null);
      }
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
    queryClientInstance.clear();
    setUser(null);
    try { await supabaseDB.auth.logout(); } catch {}
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading: loading,
      isPasswordRecovery,
      clearPasswordRecovery,
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
