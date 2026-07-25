// ─────────────────────────────────────────────────────────────────────────────
// FaceID console data layer — ported from the standalone app's api.ts, but wired
// to Stanbic's shared OnboardingStore instead of UiPath Data Fabric + AWS.
//
// The console IS "the system of record behind the Liveness row": every onboarding
// case carries a LIVENESS check, so each case maps to a verification record here,
// and the enrolled identities are the people who have reached an account. Names,
// cities and ID labels follow the active market (config/countries.ts). No backend,
// no OAuth, no camera — the console runs entirely on the same mock store as Ops,
// the desk and the tower.
//
// The exported `api` object keeps the SAME shape the ported Console/Enroll code
// expects, so those files are re-skinned, not rewritten.
// ─────────────────────────────────────────────────────────────────────────────
import { store, type OnboardingCase } from '../onboarding';
import { getActiveCountry } from '../config/countries';

// The deployed FaceID backend (AWS API Gateway) — used only by the walk-up kiosk
// for the real liveness session + 1:N match. From the reference app's api.ts.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data as T;
}
/** Prefix a relative backend path with the API base. */
function abs(pathOrNull: string | null): string | null {
  if (!pathOrNull) return null;
  return pathOrNull.startsWith('http') ? pathOrNull : `${API_BASE}${pathOrNull}`;
}

export interface User {
  id: string;
  externalId: string;
  displayName: string;
  designation?: string | null;
  createdAt: string;
}

export interface VerificationSummary {
  verificationId: string;
  userId: string;
  status: 'created' | 'in_progress' | 'completed' | 'expired' | 'failed' | 'partial';
  displayName?: string;
  employeeId?: string | null;
  designation?: string | null;
  createdAt: string;
  expiresAt: string;
  hasCapture: boolean;
  hasReference: boolean;
  referenceStale?: boolean;
  channel?: 'embedded' | 'kiosk' | null;
  flagged?: boolean;
  location?: string | null;
  result: {
    verified: boolean;
    isLive: boolean;
    livenessConfidence: number;
    similarity: number | null;
    isMatch: boolean;
    completedAt: string;
    reason?: string;
  } | null;
}

export interface KioskResult {
  recognized: boolean;
  reason?: string;
  partial?: boolean;
  verificationId?: string;
  subject?: { displayName: string; employeeId: string; designation: string | null };
  event?: 'enter' | 'exit';
  time?: string;
  isLive?: boolean;
  similarity?: number;
  livenessConfidence?: number;
  captureImageUrl?: string | null;
  referenceImageUrl?: string | null;
}

// ── Deterministic pseudo-values (stable per case id) ─────────────────────────
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
/** A stable float in [lo, hi) derived from a seed. */
function seeded(seed: string, lo: number, hi: number): number {
  return lo + ((hash(seed) % 1000) / 1000) * (hi - lo);
}

// ── Generated avatars (no real face images in the demo) ──────────────────────
const AVA_COLORS = ['#012169', '#0033A1', '#0091DA', '#1a4b8c', '#2f5fa8', '#0d2a5e'];
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}
/** A brand-coloured initials avatar as an SVG data URI (stands in for a face photo). */
function avatar(name: string, tint = 0): string {
  const bg = AVA_COLORS[(hash(name) + tint) % AVA_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${bg}"/><text x="60" y="60" dy=".35em" font-family="Inter,system-ui,sans-serif" font-size="46" font-weight="600" fill="#fff" text-anchor="middle">${initials(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── Caches, mirroring the real api's record index ────────────────────────────
let userById: Record<string, User> = {};
let verById: Record<string, VerificationSummary> = {};

// Locally-enrolled identities (from the Enroll wizard) persist in this browser,
// separate from the store-derived ones.
const ENROLL_KEY = 'faceid_enrolled';
function readEnrolled(): User[] {
  try { return JSON.parse(localStorage.getItem(ENROLL_KEY) || '[]'); } catch { return []; }
}
function writeEnrolled(list: User[]) {
  try { localStorage.setItem(ENROLL_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
// Verifications the analyst dismissed this session (can't delete a real case).
const dismissed = new Set<string>();

// Real kiosk verifications — the backend has no admin list endpoint, so each
// walk-up result is captured here (localStorage) as it happens and surfaced in the
// console, exactly like the reference console shows kiosk scans. Cross-tab: the
// kiosk writes this key, the console listens for the `storage` event.
const KIOSK_VERS_KEY = 'faceid_kiosk_vers';
interface StoredKioskVer { v: VerificationSummary; cap: string | null; ref: string | null }
function readKioskVers(): StoredKioskVer[] {
  try { return JSON.parse(localStorage.getItem(KIOSK_VERS_KEY) || '[]'); } catch { return []; }
}
function writeKioskVers(list: StoredKioskVer[]) {
  try { localStorage.setItem(KIOSK_VERS_KEY, JSON.stringify(list.slice(0, 100))); } catch { /* ignore */ }
}
let kioskImgById: Record<string, { cap: string | null; ref: string | null }> = {};

function kioskResultToStored(r: KioskResult, location: string): StoredKioskVer {
  const name = r.subject?.displayName || 'Walk-up visitor';
  const id = r.verificationId || `kiosk-${hash(name + (r.time || Date.now()))}`;
  const when = r.time || new Date().toISOString();
  const status: VerificationSummary['status'] = r.recognized ? (r.partial ? 'partial' : 'completed') : 'failed';
  return {
    v: {
      verificationId: id, userId: r.subject?.employeeId || id, status,
      displayName: name, employeeId: r.subject?.employeeId ?? null, designation: r.subject?.designation ?? null,
      createdAt: when, expiresAt: new Date(Date.parse(when) + 15 * 60000).toISOString(),
      hasCapture: !!r.captureImageUrl, hasReference: !!r.referenceImageUrl,
      channel: 'kiosk', flagged: !r.recognized, location,
      result: {
        verified: !!r.recognized && !r.partial, isLive: r.isLive ?? true,
        livenessConfidence: r.livenessConfidence ?? 0, similarity: r.similarity ?? null,
        isMatch: !!r.recognized, completedAt: when,
        reason: r.recognized ? undefined : r.reason,
      },
    },
    cap: r.captureImageUrl ?? null, ref: r.referenceImageUrl ?? null,
  };
}

const livenessOf = (c: OnboardingCase) => c.validations.find((v) => v.kind === 'LIVENESS')?.status ?? 'pending';
const cityFor = (seed: string) => { const cs = getActiveCountry().cities; return cs[hash(seed) % cs.length]; };

function mapVerification(c: OnboardingCase): VerificationSummary {
  const lv = livenessOf(c);
  const decided = lv === 'passed' || lv === 'failed' || lv === 'timeout';
  const passed = lv === 'passed';
  const status: VerificationSummary['status'] =
    passed ? 'completed' : (lv === 'failed' || lv === 'timeout') ? 'failed' : (lv === 'running' ? 'in_progress' : 'created');
  const name = `${c.firstName} ${c.lastName}`.trim();
  const livenessConfidence = passed ? seeded(c.id + 'lc', 82, 99) : seeded(c.id + 'lc', 28, 58);
  const similarity = passed ? seeded(c.id + 'sm', 86, 99) : null;
  return {
    verificationId: c.id, userId: c.id, status,
    displayName: name, employeeId: c.id, designation: c.employer ?? null,
    createdAt: c.createdAt, expiresAt: new Date(Date.parse(c.createdAt) + 15 * 60000).toISOString(),
    hasCapture: decided, hasReference: true,
    channel: c.source === 'rm' || c.source === 'branch' ? 'embedded' : 'kiosk',
    flagged: lv === 'failed' || lv === 'timeout',
    location: cityFor(c.id),
    result: decided ? {
      verified: passed, isLive: passed,
      livenessConfidence, similarity,
      isMatch: passed, completedAt: c.updatedAt,
      reason: passed ? undefined : (lv === 'timeout' ? 'liveness-incomplete' : 'not-live'),
    } : null,
  };
}

function mapUser(c: OnboardingCase): User {
  return {
    id: c.id, externalId: c.id, displayName: `${c.firstName} ${c.lastName}`.trim(),
    designation: c.employer ?? null, createdAt: c.createdAt,
  };
}

export const api = {
  base: '',

  // ---- Identities ----
  async listUsers(): Promise<User[]> {
    const cases = await store.list();
    // Enrolled = people with an account on file (a verified reference).
    const derived = cases
      .filter((c) => c.state === 'FULLY_ACTIVATED' || c.state === 'ACCOUNT_CREATED')
      .map(mapUser);
    const all = [...readEnrolled(), ...derived];
    userById = Object.fromEntries(all.map((u) => [u.id, u]));
    return all.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  },

  async enroll(input: { externalId: string; displayName: string; designation?: string; referenceImage: File }): Promise<User> {
    const list = readEnrolled();
    const existing = list.find((u) => u.externalId === input.externalId);
    const user: User = {
      id: existing?.id ?? `enr-${hash(input.externalId + input.displayName)}`,
      externalId: input.externalId, displayName: input.displayName,
      designation: input.designation ?? null, createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    writeEnrolled([user, ...list.filter((u) => u.externalId !== input.externalId)]);
    userById[user.id] = user;
    return user;
  },

  async deleteUser(id: string): Promise<void> {
    writeEnrolled(readEnrolled().filter((u) => u.id !== id));
    delete userById[id];
  },

  referenceImageUrl(userId: string): string {
    return avatar(userById[userId]?.displayName || userId);
  },

  // ---- Verifications / audit ----
  async listVerifications(): Promise<VerificationSummary[]> {
    const cases = await store.list();
    // Real walk-up kiosk scans (captured from the AWS backend) shown alongside the
    // Stanbic onboarding-derived records — kiosk first (they're the live ones).
    const kiosk = readKioskVers();
    kioskImgById = Object.fromEntries(kiosk.map((k) => [k.v.verificationId, { cap: k.cap, ref: k.ref }]));
    const all = [...kiosk.map((k) => k.v), ...cases.map(mapVerification)].filter((v) => !dismissed.has(v.verificationId));
    verById = Object.fromEntries(all.map((v) => [v.verificationId, v]));
    return all.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  },

  captureImageUrl(verificationId: string): string {
    return kioskImgById[verificationId]?.cap || avatar(verById[verificationId]?.displayName || verificationId, 1);
  },
  verificationReferenceUrl(verificationId: string): string {
    return kioskImgById[verificationId]?.ref || avatar(verById[verificationId]?.displayName || verificationId);
  },

  /** Approve a flagged/failed check — clears liveness on the case and rolls it
   *  forward, exactly like the Operations resolve, so the desk & tower update. */
  async approveVerification(verificationId: string): Promise<void> {
    const c = await store.get(verificationId);
    if (!c) return;
    const now = new Date().toISOString();
    const validations = c.validations.map((v) => (v.kind === 'LIVENESS' ? { ...v, status: 'passed' as const, attempts: v.attempts + 1, updatedAt: now } : v));
    const patch: Partial<OnboardingCase> = { validations };
    if (c.state === 'PENDING_LIVENESS' || c.state === 'EXCEPTION') patch.state = 'FULLY_ACTIVATED';
    await store.update(verificationId, patch);
    await store.publish(verificationId, 'customer-notification', `Liveness approved in FaceID Verify for ${c.firstName} ${c.lastName}`);
  },

  async deleteVerification(verificationId: string): Promise<void> {
    dismissed.add(verificationId);
    delete verById[verificationId];
  },

  /** Start a 1:1 verification — returns a tokenised link to the native kiosk. */
  async createVerification(userId: string): Promise<{ token: string; widgetUrl: string }> {
    const token = `${userId}-${hash(userId + Date.now().toString()).toString(36)}`;
    return { token, widgetUrl: `/faceid-kiosk?token=${encodeURIComponent(token)}` };
  },

  // ---- Walk-up kiosk — the REAL AWS liveness path (reference behaviour) ----
  // These hit the deployed FaceID backend: createKioskSession starts an AWS
  // Rekognition liveness session; kioskIdentify runs the 1:N match after the
  // FaceLivenessDetector challenge completes. (The console above still reads the
  // Stanbic onboarding store — only the kiosk uses this backend.)
  async createKioskSession(): Promise<{ sessionId: string; region: string }> {
    return asJson(await fetch(`${API_BASE}/api/kiosk/session`, { method: 'POST' }));
  },

  async kioskIdentify(sessionId: string, location?: string | null, force?: string | null): Promise<KioskResult> {
    const raw = await asJson<KioskResult>(
      await fetch(`${API_BASE}/api/kiosk/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, location: location || undefined, force: force || undefined }),
      }),
    );
    const result = { ...raw, captureImageUrl: abs(raw.captureImageUrl ?? null), referenceImageUrl: abs(raw.referenceImageUrl ?? null) };
    // Capture the scan so it shows in the console (the backend has no list endpoint).
    const stored = kioskResultToStored(result, location || '');
    writeKioskVers([stored, ...readKioskVers().filter((k) => k.v.verificationId !== stored.v.verificationId)]);
    return result;
  },
};
