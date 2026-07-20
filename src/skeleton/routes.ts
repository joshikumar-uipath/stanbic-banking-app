// ─────────────────────────────────────────────────────────────────────────────
// Memorable URL routing for the Account Opening Factory surfaces.
//
// One responsive codebase per product — the URL picks the shell:
//   /                  launcher (links to everything)
//   /employee-mobile   Employee Field app, phone-framed   (RM · Branch · Contact-Centre)
//   /employee-web      Employee Field app, desktop
//   /ops               Operations Workbench               (Operations team)
//   /customer-mobile   Customer app, phone-framed         (Customer)
//   /customer-web      Customer app, desktop
//   /kyc/:token        Customer KYC completion link
//   /admin             Admin console                      (Platform Admin)
//   /kafka             Mock Kafka console                 (demo)
//   /finacle           Mock Finacle UI                    (demo)
//   /aura-consumer     legacy consumer scaffold (kept)
//
// UiPath Coded App hosting serves index.html for every path, so detection is
// client-side and also accepts a `#hash` fallback for that environment.
// ─────────────────────────────────────────────────────────────────────────────

export type RouteKey =
  | 'launcher'
  | 'employee-mobile' | 'employee-web'
  | 'ops'
  | 'customer-mobile' | 'customer-web'
  | 'kyc'
  | 'admin' | 'consumer'
  | 'kafka' | 'finacle' | 'comms' | 'tower';

// Routes that render full-width (no phone bezel). The rest render phone-framed.
export const WEB_SHELLS: RouteKey[] = ['launcher', 'employee-web', 'ops', 'customer-web', 'admin', 'kafka', 'finacle', 'comms', 'tower', 'consumer'];

export function detectRoute(): RouteKey {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase();
  const at = (name: string) => new RegExp(`/${name}$`, 'i').test(path) || hash.includes(name);

  if (at('employee-mobile')) return 'employee-mobile';
  if (at('employee-web')) return 'employee-web';
  if (at('customer-mobile')) return 'customer-mobile';
  if (at('customer-web')) return 'customer-web';
  if (/\/kyc(\/|$)/i.test(path) || hash.includes('kyc')) return 'kyc';
  if (at('ops') || at('operations')) return 'ops';
  if (at('admin')) return 'admin';
  if (at('kafka')) return 'kafka';
  if (at('finacle')) return 'finacle';
  if (at('comms') || at('notifications')) return 'comms';
  if (at('tower') || at('control-tower')) return 'tower';
  if (/\/aura-consumer(\/|$)/i.test(path) || hash.includes('aura-consumer')) return 'consumer';
  return 'launcher';
}
