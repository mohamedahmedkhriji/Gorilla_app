import './index.css';
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initializeTheme } from './services/theme';
import { initializeLanguage } from './services/language';
import { initializeRuntimeTranslator } from './services/runtimeTranslator';

initializeTheme();
initializeLanguage();
initializeRuntimeTranslator();

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root container not found');
}
const root = createRoot(container);
root.render(<App />);
