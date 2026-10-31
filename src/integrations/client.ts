// ─────────────────────────────────────────────────────────────────────────────
// The integration seam.
//
// Every external call in the process goes through `call()`. Today every service
// is in `fixture` mode and answers from src/fixtures. When Stanbic sends an
// endpoint and credentials for one service, you set that ONE service to `live`
// and nothing else in the app changes.
//
// The mode is per service, not global, on purpose: BVN will almost certainly go
// live before Actimize does, and a half-connected environment has to keep
// working rather than becoming an all-or-nothing switch.
//
//   Configure via env, e.g.  VITE_SERVICE_BVN=https://uat.example/bvn
//   Anything without an endpoint stays on fixtures.
// ─────────────────────────────────────────────────────────────────────────────
import { SERVICE_BY_ID, type PayloadSample, type ServiceId } from '../fixtures';

export type Mode = 'fixture' | 'live';

export interface ServiceConfig {
  mode: Mode;
  endpoint?: string;
  /** Wall-clock budget before the caller should treat it as a timeout. */
  timeoutMs: number;
}

/** Endpoints come from the environment so nothing secret lands in the repo. */
const ENDPOINT: Partial<Record<ServiceId, string | undefined>> = {
  bvn: import.meta.env?.VITE_SERVICE_BVN,
  nin: import.meta.env?.VITE_SERVICE_NIN,
  cac: import.meta.env?.VITE_SERVICE_CAC,
  tin: import.meta.env?.VITE_SERVICE_TIN,
  idDoc: import.meta.env?.VITE_SERVICE_IDDOC,
  liveness: import.meta.env?.VITE_SERVICE_LIVENESS,
  screening: import.meta.env?.VITE_SERVICE_SCREENING,
  coreBanking: import.meta.env?.VITE_SERVICE_CORE,
  omniflow: import.meta.env?.VITE_SERVICE_OMNIFLOW,
  dsx: import.meta.env?.VITE_SERVICE_DSX,
  ixp: import.meta.env?.VITE_SERVICE_IXP,
};

export function configFor(id: ServiceId): ServiceConfig {
  const endpoint = ENDPOINT[id];
  return { mode: endpoint ? 'live' : 'fixture', endpoint, timeoutMs: 30_000 };
}

/** Which services are wired to something real. Shown in the readiness banner. */
export function liveServices(): ServiceId[] {
  return (Object.keys(ENDPOINT) as ServiceId[]).filter((id) => ENDPOINT[id]);
}

export interface CallResult<T = Record<string, unknown>> {
  ok: boolean;
  /** Which branch answered, so the caller can act on it without parsing prose. */
  variant: PayloadSample['variant'] | 'error';
  status: number;
  body: T;
  /** True when this came from a fixture rather than a real service — the UI
   *  says so rather than passing demo data off as live. */
  simulated: boolean;
  service: ServiceId;
  latencyMs: number;
}

/**
 * Pick the fixture sample that matches what the caller is asking for.
 *
 * `want` is the branch the caller expects — normally derived from the persona's
 * script. When no sample matches, the first one wins rather than throwing: a
 * fixture miss must degrade to something usable, never break the flow.
 */
function pickSample(id: ServiceId, want?: PayloadSample['variant']): PayloadSample | undefined {
  const svc = SERVICE_BY_ID.get(id);
  if (!svc || !svc.samples.length) return undefined;
  return svc.samples.find((s) => s.variant === want) ?? svc.samples[0];
}

/**
 * Call a service.
 *
 * In fixture mode this resolves from src/fixtures, honouring the sample's
 * declared latency so retry and SLA behaviour can actually be observed. In live
 * mode it POSTs the request to the configured endpoint.
 */
export async function call<T = Record<string, unknown>>(
  service: ServiceId,
  request: Record<string, unknown>,
  opts: { want?: PayloadSample['variant']; signal?: AbortSignal } = {},
): Promise<CallResult<T>> {
  const cfg = configFor(service);
  const started = Date.now();

  if (cfg.mode === 'live' && cfg.endpoint) {
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: opts.signal,
      });
      const body = (await res.json().catch(() => ({}))) as T;
      return {
        ok: res.ok, variant: res.ok ? 'ok' : 'noMatch', status: res.status,
        body, simulated: false, service, latencyMs: Date.now() - started,
      };
    } catch (e) {
      // A live service that is unreachable is a real outcome the process has to
      // handle — it is the `parked` branch — so it is reported, not thrown.
      return {
        ok: false, variant: 'error', status: 0,
        body: { error: String(e) } as T, simulated: false,
        service, latencyMs: Date.now() - started,
      };
    }
  }

  const sample = pickSample(service, opts.want);
  if (!sample) {
    return {
      ok: false, variant: 'error', status: 0,
      body: { error: `No fixture for service "${service}"` } as T,
      simulated: true, service, latencyMs: 0,
    };
  }

  // Honour the declared latency, but cap it so a demo never sits for 30s on a
  // timeout sample. The variant, not the wall clock, is what the caller acts on.
  const wait = Math.min(sample.latencyMs ?? 0, 1_200);
  if (wait) await new Promise((r) => setTimeout(r, wait));

  const status = sample.status ?? 200;
  return {
    ok: sample.variant === 'ok' || sample.variant === 'possible' || sample.variant === 'confirmed',
    variant: sample.variant,
    status,
    body: sample.response as T,
    simulated: true,
    service,
    latencyMs: Date.now() - started,
  };
}
