import React, { createContext, useContext, useEffect, useState } from 'react';
import { restoreSession, signIn as apiSignIn, signOut as apiSignOut, signUp as apiSignUp, updateProfileDetails as apiUpdateProfile } from './auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function signUp(details) {
    const u = await apiSignUp(details);
    setUser(u);
    return u;
  }

  async function signIn(details) {
    const u = await apiSignIn(details);
    setUser(u);
    return u;
  }

  async function signOut() {
    await apiSignOut();
    setUser(null);
  }

  async function updateProfile(details) {
    const u = await apiUpdateProfile(details);
    setUser(u);
    return u;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, updateProfile, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
