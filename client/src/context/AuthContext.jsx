import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

/**
 * Session auth context.
 *
 * The API issues its own session JWT (password login today; optional OIDC
 * providers mint the same token). The token lives in sessionStorage and is
 * attached to API calls by the axios interceptor.
 *
 * Dev bypass: when the API runs locally with ALLOW_DEV_AUTH=true, the login
 * page offers a one-click dev session using the well-known dev token.
 */

const AuthContext = createContext(null);

const TOKEN_KEY = 'postline.session';
const DEV_TOKEN = 'dev-token';

function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // sessionStorage unavailable — session just won't persist across reloads
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Which sign-in methods the API supports: { password, devBypass, oidc: [] }
  const [providers, setProviders] = useState(null);

  // On mount: discover providers and validate any stored session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await authApi.providers();
        if (!cancelled) setProviders(p);
      } catch {
        // API unreachable — in dev, still allow the bypass button.
        if (!cancelled && import.meta.env.DEV) {
          setProviders({ password: false, devBypass: true, oidc: [] });
        }
      }

      const token = getStoredToken();
      if (token) {
        try {
          const { user: me } = await authApi.me();
          if (!cancelled) setUser(me);
        } catch {
          setStoredToken(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (password) => {
    const { token, user: me } = await authApi.login(password);
    setStoredToken(token);
    setUser(me);
  }, []);

  const loginDev = useCallback(async () => {
    setStoredToken(DEV_TOKEN);
    const { user: me } = await authApi.me();
    setUser(me);
  }, []);

  // Completes an OIDC sign-in: the provider callback redirects to
  // /login?grant=<id>; redeeming the one-time grant yields the session token.
  const loginWithGrant = useCallback(async (grantId) => {
    const { token, user: me } = await authApi.redeem(grantId);
    setStoredToken(token);
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async () => getStoredToken(), []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    providers,
    login,
    loginDev,
    loginWithGrant,
    logout,
    getAccessToken,
    devMode: !!providers?.devBypass && !providers?.password,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
