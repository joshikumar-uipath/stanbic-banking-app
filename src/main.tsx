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

// The walkthrough capture's hook for the case's automated steps (dev server only).
if (import.meta.env.DEV) void import('./demo/walkthroughEngine').then((m) => m.expose())

// Memorable URLs pick the surface (see ./skeleton/routes). UiPath Coded App
// hosting serves the root index.html for every path, so detection is
// client-side and also accepts a #hash fallback for that environment.
const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)
const route = detectRoute()
// The surface is chosen once, at load. A link that changes only the hash (the role
// switch, "./#ops" ↔ "./#employee-web") keeps this page, so reload when it now
// names a different surface. Hash changes inside a surface leave the route as is.
window.addEventListener('hashchange', () => { if (detectRoute() !== route) window.location.reload() })

// Full-width surfaces drop the phone bezel (see skeleton.css).
if (WEB_SHELLS.includes(route)) document.documentElement.setAttribute('data-shell', 'web')

// Every surface except the launcher gets a way back to it — but not KYC, which
// is the customer-facing link. A customer finishing their own onboarding should
// not be offered a route into the bank's internal workspace.
const render = (node: ReactNode) => root.render(
  <StrictMode>
    {node}
    {route !== 'launcher' && route !== 'kyc' && <HomeButton route={route} />}
  </StrictMode>,
)

// One loader per surface, in a table rather than an if/else chain. Vite gives every
// import() its own list of chunks to preload, its stylesheets among them. In a build
// the minifier folded the chain's branches into ONE preload call, which kept only
// the last branch's list — so /ops, the instruments and the rest loaded without
// their CSS on the coded-app host (fine in dev, where CSS comes with the module).
// Separate functions cannot be folded together.
const SURFACES: Record<string, () => Promise<ReactNode>> = {
  admin: () => Promise.all([import('./admin/admin.css'), import('./admin/App')]).then(([, mod]) => <mod.default />),
  consumer: () => import('./consumer/ConsumerApp').then((mod) => <mod.default />),
  // The customer surface IS the banking app — account opening lives inside it.
  // Two shells, same screens: the phone (bottom nav) and internet banking on a
  // laptop (top nav, wide). Not the phone in a bezel — that made /customer-web
  // identical to /customer-mobile and earned the route nothing.
  'customer-mobile': () => import('./consumer/ConsumerApp').then((mod) => <mod.default shell="mobile" />),
  'customer-web': () => import('./consumer/ConsumerApp').then((mod) => <mod.default shell="web" />),
  ops: () => import('./ops/OpsApp').then((mod) => <mod.default />),
  kyc: () => import('./customer/CustomerApp').then((mod) => <mod.default />),
  // Demo instruments — the bank's own systems, reading the shared store live.
  kafka: () => import('./instruments/Kafka').then((mod) => <mod.default />),
  finacle: () => import('./instruments/Finacle').then((mod) => <mod.default />),
  comms: () => import('./instruments/Comms').then((mod) => <mod.default />),
  // The control tower as a Fabric / Power BI report — src/instruments/tower/.
  // Brought over from the Microsoft sibling whole; the chrome is the point.
  tower: () => import('./instruments/tower/Report').then((mod) => <mod.default />),
  cases: () => import('./instruments/Cases').then((mod) => <mod.default />),
  // FaceID kiosk — the walk-up liveness/identity capture (public, no login).
  'faceid-kiosk': () => import('./faceid/FaceIdKiosk').then((mod) => <mod.default />),
  // FaceID Verify Console — the ported liveness/identity admin console, native.
  faceid: () => import('./faceid/FaceIdConsole').then((mod) => <mod.default />),
  // The architecture relays — one animated walk through the stack per journey.
  // Lazy, so their ~100KB of component and content never loads anywhere else.
  'relay-individual': () => import('./architecture-relay/RelayPage').then((mod) => <mod.default journey="individual" />),
  'relay-corporate': () => import('./architecture-relay/RelayPage').then((mod) => <mod.default journey="corporate" />),
  'relay-bulk': () => import('./architecture-relay/RelayPage').then((mod) => <mod.default journey="bulk" />),
}

if (route === 'employee-mobile' || route === 'employee-web') {
  // One employee app, two shells: the banker's phone (bottom nav, overlays) and
  // the desk (nav rail, wide content). App picks its chrome off this prop —
  // every feature we add shows up on both without a second build.
  render(<App shell={route === 'employee-web' ? 'web' : 'mobile'} />)
} else {
  // Anything else is the launcher.
  const load = SURFACES[route] ?? (() => import('./skeleton').then((mod) => <mod.SkeletonRouter route={route} />))
  void load().then(render)
}
