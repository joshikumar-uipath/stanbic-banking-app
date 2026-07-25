import type { OperationsConfig, RoutingRule } from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Row, Field } from './BrandingTab';

// The account-opening factory's operating parameters. The control tower reads the
// STP target; the SLA, retry backoff and routing rules describe how exceptions age
// and where they go — the same knobs the walkthrough lists under the admin console.
export default function OperationsTab({ operations, onChange }: { operations: OperationsConfig; onChange: (next: OperationsConfig) => void }) {
  const set = <K extends keyof OperationsConfig>(key: K, value: OperationsConfig[K]) =>
    onChange({ ...operations, [key]: value });

  const setRule = (i: number, patch: Partial<RoutingRule>) =>
    set('routing', operations.routing.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRule = () => set('routing', [...operations.routing, { cause: '', queue: 'Exceptions', assignTo: '' }]);
  const removeRule = (i: number) => set('routing', operations.routing.filter((_, j) => j !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Targets"
        subtitle="The goals the control tower measures the line against."
      />
      <Row>
        <Field label="Straight-through target (%)">
          <input
            className="admin-input" style={fieldInput} type="number" min={0} max={100}
            value={operations.stpTarget}
            onChange={(e) => set('stpTarget', clampInt(e.target.value, 0, 100))}
          />
        </Field>
        <Field label="Exception SLA (minutes)">
          <input
            className="admin-input" style={fieldInput} type="number" min={0}
            value={operations.slaMinutes}
            onChange={(e) => set('slaMinutes', clampInt(e.target.value, 0, 100000))}
          />
        </Field>
      </Row>

      <SectionHeader
        title="Retry schedule"
        subtitle="Backoff between validation attempts before a check gives up to the Exception Queue. Comma-separated minutes."
      />
      <Field label="Backoff (minutes)">
        <input
          className="admin-input" style={fieldInput}
          value={operations.retryBackoffMins.join(', ')}
          onChange={(e) => set('retryBackoffMins', parseMinutes(e.target.value))}
          placeholder="5, 15, 30, 60"
        />
      </Field>
      <p style={{ fontSize: 11.5, color: 'rgba(24,33,38,0.5)', margin: '-6px 0 0' }}>
        {operations.retryBackoffMins.length
          ? `${operations.retryBackoffMins.length} attempts — ${operations.retryBackoffMins.map(fmtMins).join(' → ')}, then Exception Queue.`
          : 'No retries — a failed check goes straight to the Exception Queue.'}
      </p>

      <SectionHeader
        title="Queue routing"
        subtitle="Where each kind of exception goes, and who owns it. Leave the owner blank to drop it into the queue unassigned for triage."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 34px', gap: 8, fontSize: 11, fontWeight: 600, color: 'rgba(24,33,38,0.5)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '0 2px' }}>
          <span>Cause</span><span>Queue</span><span>Assign to</span><span />
        </div>
        {operations.routing.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 34px', gap: 8, alignItems: 'center' }}>
            <input className="admin-input" style={fieldInput} value={r.cause} onChange={(e) => setRule(i, { cause: e.target.value })} placeholder="Identity check failed" />
            <input className="admin-input" style={fieldInput} value={r.queue} onChange={(e) => setRule(i, { queue: e.target.value })} placeholder="Exceptions" />
            <input className="admin-input" style={fieldInput} value={r.assignTo ?? ''} onChange={(e) => setRule(i, { assignTo: e.target.value })} placeholder="Unassigned" />
            <button
              type="button" onClick={() => removeRule(i)} aria-label="Remove rule"
              style={{ height: 34, borderRadius: 8, border: '1.5px solid rgba(24,33,38,0.12)', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            >×</button>
          </div>
        ))}
        <button
          type="button" onClick={addRule}
          style={{ alignSelf: 'flex-start', marginTop: 4, padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(24,33,38,0.12)', background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#182126' }}
        >+ Add rule</button>
      </div>
    </div>
  );
}

function clampInt(s: string, lo: number, hi: number): number {
  const n = Math.round(Number(s));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function parseMinutes(s: string): number[] {
  return s.split(',').map((x) => Math.round(Number(x.trim()))).filter((n) => Number.isFinite(n) && n > 0);
}
function fmtMins(m: number): string {
  return m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
