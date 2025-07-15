// src/lib/auth-config.ts
import { Configuration, PopupRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID!,
    authority: 'https://login.microsoftonline.com/common', // Use 'common' for multi-tenant
    redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  },
  cache: {
    cacheLocation: 'sessionStorage', // Use sessionStorage, not localStorage
    storeAuthStateInCookie: false,   // Set to false, not true
  },
};

export const loginRequest: PopupRequest = {
  scopes: ['User.Read'],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
};