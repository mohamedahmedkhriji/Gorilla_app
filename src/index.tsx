import '@fontsource/bebas-neue/400.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import './index.css';
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initializeTheme } from './services/theme';
import { initializeLanguage } from './services/language';
import { registerServiceWorker } from './services/pwa';

initializeTheme();
initializeLanguage();
registerServiceWorker();

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root container not found');
}
const root = createRoot(container);
root.render(<App />);
