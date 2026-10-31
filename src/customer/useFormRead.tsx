// ─────────────────────────────────────────────────────────────────────────────
// "Have a completed form? Upload it" — read in the browser.
//
// The single form is read the way a package is (src/integrations/packageDocs):
// classified, and its fields taken from its text layer or this POC's checked
// transcription. The person watches it being scanned in the package review and
// confirms; the wizard is filled from what they confirmed. The Orchestrator case
// starts at Submit as for any application — nothing here waits on IXP or the
// network, so a dropped connection can no longer cost them the read.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import PackageReview from './PackageReview';
import { readPackage, type PackageResult } from '../integrations/packageDocs';

export function useFormRead(kind: 'individual' | 'business', onApply: (r: PackageResult, fileName: string) => void) {
  const [res, setRes] = useState<PackageResult | null>(null);
  const [name, setName] = useState('');
  const [reading, setReading] = useState(false);
  const [wrongKind, setWrongKind] = useState(false);

  const read = async (f: File) => {
    setReading(true); setName(f.name); setWrongKind(false);
    const r = await readPackage([f]);
    setReading(false);
    if (r.kind !== 'unknown' && r.kind !== kind) { setWrongKind(true); setRes(null); return; }
    setRes(r);
  };

  const review = res && (
    <PackageReview res={res}
      onClose={() => setRes(null)}
      onApply={() => { onApply(res, name); setRes(null); }} />
  );
  return { read, reading, review, wrongKind, name, reset: () => { setRes(null); setWrongKind(false); } };
}

/** Start a case at Submit, a few times over a flaky connection. */
export async function startWithRetry<T>(start: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await start(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw last;
}
