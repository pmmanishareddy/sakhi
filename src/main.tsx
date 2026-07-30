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

// The updated worker activates immediately (skipWaiting + clientsClaim) but
// nothing reloads the page into it — without this, the new build only shows
// up after a lucky quit-and-relaunch, and deploys appear to never arrive.
//
// BUT only reload on a genuine UPDATE (a new worker replacing the one that was
// already controlling this page). On a fresh install the page loads with no
// controller; the SW's first clientsClaim fires controllerchange too, and
// reloading then blanks the just-loaded (often just-authenticated) standalone
// app. Skip that initial claim by checking whether a controller existed at load.
const hadControllerAtLoad = !!navigator.serviceWorker?.controller
let reloadingForUpdate = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!hadControllerAtLoad) return // initial claim on first load, not an update
  if (reloadingForUpdate) return
  reloadingForUpdate = true
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
