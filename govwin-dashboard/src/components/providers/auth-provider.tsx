// src/components/providers/auth-provider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '@/lib/auth-config';

interface AuthContextType {
  user: AccountInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  msalInstance: PublicClientApplication;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [msalInstance] = useState(() => new PublicClientApplication(msalConfig));
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeMsal = async () => {
      try {
        await msalInstance.initialize();
        
        const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];

        if (account) {
          setUser(account);
        }
      } catch (error) {
        console.error('MSAL initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeMsal();
  }, [msalInstance]);

  const login = async () => {
    try {
      setIsLoading(true);
      const response: AuthenticationResult = await msalInstance.loginPopup(loginRequest);
      msalInstance.setActiveAccount(response.account); 
      setUser(response.account);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await msalInstance.logoutPopup();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    msalInstance,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}