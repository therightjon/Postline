import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '../services/authConfig';

const AuthContext = createContext(null);

// Dev mode: bypass MSAL when B2C isn't configured
const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_B2C_CLIENT_ID === undefined;

const DEV_USER = {
  id: 'dev-user-001',
  name: 'Dev User',
  email: 'dev@postline.app',
};

export function AuthProvider({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const msalAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!DEV_MODE);
  const [devLoggedIn, setDevLoggedIn] = useState(false);

  useEffect(() => {
    if (DEV_MODE) return; // Skip MSAL handling in dev mode
    if (inProgress === InteractionStatus.None) {
      if (accounts.length > 0) {
        const account = accounts[0];
        setUser({
          id: account.localAccountId,
          name: account.name || account.username,
          email: account.username,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }
  }, [accounts, inProgress]);

  const login = useCallback(async () => {
    if (DEV_MODE) {
      setDevLoggedIn(true);
      setUser(DEV_USER);
      return;
    }
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [instance]);

  const logout = useCallback(async () => {
    if (DEV_MODE) {
      setDevLoggedIn(false);
      setUser(null);
      return;
    }
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [instance]);

  const getAccessToken = useCallback(async () => {
    if (DEV_MODE) return 'dev-token';
    if (accounts.length === 0) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      console.error('Token acquisition failed:', error);
      try {
        await instance.acquireTokenRedirect(loginRequest);
      } catch (redirectError) {
        console.error('Token redirect failed:', redirectError);
      }
      return null;
    }
  }, [instance, accounts]);

  const isAuthenticated = DEV_MODE ? devLoggedIn : msalAuthenticated;

  const value = {
    user,
    isAuthenticated,
    loading: DEV_MODE ? false : (loading || inProgress !== InteractionStatus.None),
    login,
    logout,
    getAccessToken,
    devMode: DEV_MODE,
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
