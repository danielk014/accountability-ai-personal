import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { supabaseDB, _setUser, _clearUser } from '@/api/supabaseDB';
import { hydrateStorage, clearStorage } from '@/api/supabaseStorage';
import { queryClientInstance } from '@/lib/query-client';
import { setCurrentUser, clearCurrentUser } from '@/lib/userStore';

const AuthContext = createContext();

function buildUserObj(u) {
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
    let active = true;

    // Step 1: restore session and WAIT for storage hydration so pages render with data
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && active) {
          const u = session.user;
          _setUser(u.id, u.email);
          setCurrentUser(u.email);
          // Await hydration so supabaseStorage cache is ready before pages render
          await hydrateStorage(u.id).catch(() => {});
          if (active) setUser(buildUserObj(u));
        }
      } catch {}
      if (active) setLoading(false);
    };

    initAuth();

    // Step 2: listen for subsequent auth changes (sign in, sign out, token refresh, recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return; // already handled by initAuth() above

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }

      if (session?.user) {
        const u = session.user;
        _setUser(u.id, u.email);
        setCurrentUser(u.email);
        // Hydrate storage on actual sign-in so new user data is available immediately
        if (event === 'SIGNED_IN') {
          await hydrateStorage(u.id).catch(() => {});
        }
        setUser(buildUserObj(u));
      } else {
        _clearUser();
        clearCurrentUser();
        clearStorage();
        setUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
