// ─────────────────────────────────────────────────────────────────────────────
// Application ID generator — AO-YYYY-NNNNNN (e.g. AO-2026-000001).
// The running counter is persisted in localStorage so IDs stay unique and
// monotonic across a demo session. Swapped for an Orchestrator/Data Fabric
// sequence in the real implementation.
// ─────────────────────────────────────────────────────────────────────────────

const COUNTER_KEY = 'aof_app_seq';

/** Force the running counter to `n`, so the NEXT id is AO-YYYY-{n+1 padded}.
 *  Used by the seed to park demo cases in a high, deterministic band (000101+)
 *  that never collides with the Ops console's curated 000001–000035 narratives. */
export function setApplicationSeq(n: number): void {
  try { localStorage.setItem(COUNTER_KEY, String(n)); } catch { /* ignore */ }
}

export function nextApplicationId(): string {
  const year = new Date().getFullYear();
  let seq = 0;
  try {
    seq = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) || 0;
  } catch { /* localStorage unavailable — fall back to 0 */ }
  seq += 1;
  try { localStorage.setItem(COUNTER_KEY, String(seq)); } catch { /* ignore */ }
  return `AO-${year}-${String(seq).padStart(6, '0')}`;
}

// Short, URL-safe token for the customer KYC completion link (e.g. /kyc/ABC123).
export function kycToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Mock Finacle identifiers.
export const mockCif = () => `CIF${Math.floor(100000000 + Math.random() * 899999999)}`;
export const mockAccountNumber = () => String(Math.floor(1000000000 + Math.random() * 8999999999));

// Simple unique id for events/rows (not user-facing).
let _seq = 0;
export const uid = (prefix = 'e') => `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
