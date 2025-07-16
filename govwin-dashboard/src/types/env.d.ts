// src/types/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    // Cosmos DB
    COSMOS_URL: string;
    COSMOS_KEY: string;
    COSMOS_DATABASE?: string;
    COSMOS_CONTAINER?: string;

    // Azure Web PubSub
    WEBPUBSUB_CONNECTION_STRING: string;
    WEBPUBSUB_HUB?: string;

    // Azure AD
    AZURE_AD_CLIENT_ID: string;
    AZURE_AD_TENANT_ID: string;
    NEXT_PUBLIC_AZURE_AD_CLIENT_ID: string;
    NEXT_PUBLIC_AZURE_AD_TENANT_ID: string;

    // App
    NODE_ENV: 'development' | 'production' | 'test';
    NEXT_PUBLIC_APP_URL?: string;
  }
}