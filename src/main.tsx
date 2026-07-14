import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// The main app renders exactly as it always has: static index.css + static App,
// rendered synchronously. ONLY when the URL is /admin (or #admin) do we instead
// load the admin dashboard tree + its CSS — needed because UiPath Coded App
// hosting serves the root index.html for every path, so the separate
// admin/index.html entry never loads once deployed.

const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)

const path = window.location.pathname.replace(/\/+$/, '')
const isAdmin = /\/admin$/i.test(path) || window.location.hash.toLowerCase().includes('admin')
// Consumer-facing banking app — fully isolated under /Aura-consumer. Does not
// touch the enterprise app or admin. No login.
const isConsumer = /\/aura-consumer(\/|$)/i.test(window.location.pathname) || window.location.hash.toLowerCase().includes('aura-consumer')

if (isAdmin) {
  Promise.all([import('./admin/admin.css'), import('./admin/App')]).then(([, mod]) => {
    const AdminApp = mod.default
    root.render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    )
  })
} else if (isConsumer) {
  import('./consumer/ConsumerApp').then((mod) => {
    const ConsumerApp = mod.default
    root.render(
      <StrictMode>
        <ConsumerApp />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
