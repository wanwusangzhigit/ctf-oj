import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Drop tokens written by builds that authenticated with localStorage.
try {
  localStorage.removeItem('ctf-oj.tokens');
} catch {
  // Storage can be unavailable in private browsing modes.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
