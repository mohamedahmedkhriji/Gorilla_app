import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminLogin } from './pages/admin';
import { initializeTheme } from './services/theme';
import './index.css';

initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminLogin />
  </React.StrictMode>,
);
