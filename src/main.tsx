import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// iOS home-screen apps rarely run the service-worker update check on launch,
// so an installed app can stay on a stale build indefinitely. Check whenever
// the app comes to the foreground (and every 15 min while open); autoUpdate
// then activates and reloads into the new build on its own.
registerSW({
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) }
    document.addEventListener('visibilitychange', check)
    setInterval(check, 15 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
