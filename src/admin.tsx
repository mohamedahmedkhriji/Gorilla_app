import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminLogin } from './pages/admin';
import { initializeTheme } from './services/theme';
import { applyLanguage } from './services/language';
import { initializeRuntimeTranslator } from './services/runtimeTranslator';
import './index.css';

initializeTheme();
applyLanguage('en', false);
initializeRuntimeTranslator();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <AdminLogin />
  </React.StrictMode>,
);
