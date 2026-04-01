import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Theme initialiser – runs BEFORE first paint to avoid FOUC ──
(function initTheme() {
  const stored = localStorage.getItem('ispy-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Apply dark class when explicitly set or OS prefers dark and no override
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW unavailable in dev – no action needed
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
