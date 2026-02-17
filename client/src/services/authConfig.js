/**
 * Azure AD B2C / MSAL Configuration
 * 
 * To configure your own B2C tenant, update these values:
 * - TENANT_NAME: Your B2C tenant name (e.g., "postlineb2c")
 * - CLIENT_ID: The Application (client) ID from your B2C app registration
 * - POLICY_NAME: Your sign-up/sign-in user flow name
 */

const TENANT_NAME = import.meta.env.VITE_B2C_TENANT_NAME || 'postlineb2c';
const CLIENT_ID = import.meta.env.VITE_B2C_CLIENT_ID || '00000000-0000-0000-0000-000000000000';
const POLICY_NAME = import.meta.env.VITE_B2C_POLICY_NAME || 'B2C_1_signupsignin';

const B2C_AUTHORITY = `https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/${POLICY_NAME}`;
const B2C_KNOWN_AUTHORITY = `https://${TENANT_NAME}.b2clogin.com`;

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: B2C_AUTHORITY,
    knownAuthorities: [B2C_KNOWN_AUTHORITY],
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'offline_access'],
};

export const apiTokenRequest = {
  scopes: [`https://${TENANT_NAME}.onmicrosoft.com/postline-api/access`],
};
