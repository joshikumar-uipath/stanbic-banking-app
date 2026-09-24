import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './skeleton/skeleton.css'
import App from './App'
import { detectRoute, WEB_SHELLS } from './skeleton/routes'
import { setLiveCaseGuard } from './onboarding/store'
import { getLinkedInstance, getCachedState } from './onboarding/maestro'
import HomeButton from './skeleton/HomeButton'

// The record's outcome must not run ahead of its Maestro case: "Fully activated"
// is what the last task of Closure produces, not what a liveness approval
// produces. Registered here rather than imported inside store.ts, which must not
// depend on maestro.ts. Unknown case state does not block: the desk polls every
// linked instance, so the gap is one tick.
setLiveCaseGuard((recordId) => {
  const inst = getLinkedInstance(recordId)
  if (!inst) return false
  const live = getCachedState(inst)
  return live ? !live.done : false
})

// Memorable URLs pick the surface (see ./skeleton/routes). UiPath Coded App
// hosting serves the root index.html for every path, so detection is
// client-side and also accepts a #hash fallback for that environment.
const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)
const route = detectRoute()

// Full-width surfaces drop the phone bezel (see skeleton.css).
if (WEB_SHELLS.includes(route)) document.documentElement.setAttribute('data-shell', 'web')

// Every surface except the launcher gets a way back to it — but not KYC, which
// is the customer-facing link. A customer finishing their own onboarding should
// not be offered a route into the bank's internal workspace.
const render = (node: ReactNode) => root.render(
  <StrictMode>
    {node}
    {route !== 'launcher' && route !== 'kyc' && <HomeButton />}
  </StrictMode>,
)

if (route === 'admin') {
  Promise.all([import('./admin/admin.css'), import('./admin/App')]).then(([, mod]) => {
    const AdminApp = mod.default
    render(<AdminApp />)
  })
} else if (route === 'consumer') {
  import('./consumer/ConsumerApp').then((mod) => {
    const ConsumerApp = mod.default
    render(<ConsumerApp />)
  })
} else if (route === 'employee-mobile' || route === 'employee-web') {
  // One employee app, two shells: the banker's phone (bottom nav, overlays) and
  // the desk (nav rail, wide content). App picks its chrome off this prop —
  // every feature we add shows up on both without a second build.
  render(<App shell={route === 'employee-web' ? 'web' : 'mobile'} />)
} else if (route === 'ops') {
  import('./ops/OpsApp').then((mod) => render(<mod.default />))
} else if (route === 'customer-mobile' || route === 'customer-web') {
  // The customer surface IS the banking app — account opening lives inside it.
  // Two shells, same screens: the phone (bottom nav) and internet banking on a
  // laptop (top nav, wide). Not the phone in a bezel — that made /customer-web
  // identical to /customer-mobile and earned the route nothing.
  import('./consumer/ConsumerApp').then((mod) => {
    const App2 = mod.default
    render(<App2 shell={route === 'customer-web' ? 'web' : 'mobile'} />)
  })
} else if (route === 'kyc') {
  import('./customer/CustomerApp').then((mod) => render(<mod.default />))
} else if (route === 'kafka') {
  // Demo instruments — the bank's own systems, reading the shared store live.
  import('./instruments/Kafka').then((mod) => render(<mod.default />))
} else if (route === 'finacle') {
  import('./instruments/Finacle').then((mod) => render(<mod.default />))
} else if (route === 'comms') {
  import('./instruments/Comms').then((mod) => render(<mod.default />))
} else if (route === 'tower') {
  // The control tower as a Fabric / Power BI report — src/instruments/tower/.
  // Brought over from the Microsoft sibling whole; the chrome is the point.
  import('./instruments/tower/Report').then((mod) => render(<mod.default />))
} else if (route === 'cases') {
  import('./instruments/Cases').then((mod) => render(<mod.default />))
} else if (route === 'faceid-kiosk') {
  // FaceID kiosk — the walk-up liveness/identity capture (public, no login).
  import('./faceid/FaceIdKiosk').then((mod) => render(<mod.default />))
} else if (route === 'faceid') {
  // FaceID Verify Console — the ported liveness/identity admin console, native.
  import('./faceid/FaceIdConsole').then((mod) => render(<mod.default />))
} else {
  // launcher
  import('./skeleton').then((mod) => render(<mod.SkeletonRouter route={route} />))
}
