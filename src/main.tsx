import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/print.css'
import { registerPWA } from './pwa/register'

// Apply saved theme + dark mode before render so it persists on refresh
try {
  const saved = localStorage.getItem("mnr_settings");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.theme && parsed.theme !== "sky") {
      document.documentElement.setAttribute("data-theme", parsed.theme);
    }
    if (parsed.darkMode) {
      document.documentElement.classList.add("dark");
      if (parsed.darkVariant && parsed.darkVariant !== "default") {
        document.documentElement.setAttribute("data-dark-variant", parsed.darkVariant);
      }
    }
  }
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
registerPWA();

// Fade out the initial splash once React has mounted
requestAnimationFrame(() => {
  const el = document.getElementById("app-splash");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 400);
});
