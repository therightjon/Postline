import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './services/authConfig';
import { AuthProvider } from './context/AuthContext';
import App from './App';

/* Oat UI — must load before app CSS so overrides work */
import '@knadh/oat/oat.min.css';
import '@knadh/oat/oat.min.js';

import './index.css';

const msalInstance = new PublicClientApplication(msalConfig);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MsalProvider>
    </BrowserRouter>
  </React.StrictMode>
);
