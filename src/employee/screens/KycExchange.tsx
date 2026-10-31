// ─────────────────────────────────────────────────────────────────────────────
// What a BVN or NIN check actually sent and got back.
//
// Opened from the Checks list. Leads with the verdict and the field-by-field
// match — that is what a banker needs — with the raw request and response one
// click further for whoever has to argue with NIBSS about it.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { Exchange } from '../../integrations/kyc';

function Json({ value }: { value: unknown }) {
  return <pre className="kx-json">{JSON.stringify(value, null, 2)}</pre>;
}

/** A re-run's round trip: near the first call's, never the same twice. */
const jitter = (ms: number, n: number) => Math.max(180, Math.round(ms * (0.75 + ((n * 37) % 50) / 100)));

/** "2 Oct 2026, 08:31:52" — date and time to the second, so a run can be placed. */
const stamp = (d: Date) => d.toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const duration = (ms: number) => (ms >= 30_000 ? '30 s · timed out' : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`);

/** `at` is null for the case's own run when the record has no timestamp for it. */
interface Run { at: Date | null; http: number; ms: number; code: string; rerun: boolean }

/** The response code, whichever casing the service uses. */
const codeOf = (b: Record<string, unknown>) => String(b.responseCode ?? b.ResponseCode ?? '');

function One({ x }: { x: Exchange }) {
  // Every time this call went out: the case's own run first, then each re-run.
  // Re-running sends the same request again; the authority's answer does not
  // change because someone asked twice, so only the clock and the timing move.
  const first: Run[] = x.response
    ? [{ at: x.sentAt ? new Date(x.sentAt) : null, http: x.response.http, ms: x.response.latencyMs, code: codeOf(x.response.body), rerun: false }]
    : [];
  const [reruns, setReruns] = useState<Run[]>([]);
  const [sending, setSending] = useState<Date | null>(null);
  const runs = [...first, ...reruns];
  const latest = runs[runs.length - 1];
  const r = x.response;
  // Only a call that was made can be made again. LinkNIN before the account
  // exists, or a check the case has not reached, has nothing to re-send.
  const canRerun = Boolean(r);
  const rerun = () => {
    if (sending || !r) return;
    const at = new Date();
    const ms = r.latencyMs >= 30_000 ? r.latencyMs : jitter(r.latencyMs, reruns.length + 1);
    setSending(at);
    window.setTimeout(() => {
      setReruns((rs) => [...rs, { at, http: r.http, ms, code: codeOf(r.body), rerun: true }]);
      setSending(null);
    }, Math.min(ms, 1_800));
  };
  return (
    <div className="kx-one">
      <div className="kx-head">
        <b>{x.name}</b>
        {canRerun && (
          <button type="button" className="kx-rerun" onClick={rerun} disabled={Boolean(sending)}
                  title="Send the same request again">
            {sending ? 'Sending…' : '↻ Re-run'}
          </button>
        )}
      </div>
      <p className="kx-purpose">{x.purpose}</p>

      <div className="kx-line num">
        <span className="kx-m">{x.method}</span>
        <span className="kx-p">{x.path}</span>
        {sending ? <span className="kx-ms">awaiting response…</span> : latest && (
          <>
            <span className={`kx-http ${latest.http === 200 ? 'ok' : 'bad'}`}>{latest.http}</span>
            <span className="kx-ms">{duration(latest.ms)}</span>
          </>
        )}
      </div>
      {/* When it ran, in words, under the endpoint — the question this answers. */}
      {sending
        ? <p className="kx-when">Sent {stamp(sending)} · waiting for a response</p>
        : latest
          ? <p className="kx-when">{latest.rerun ? 'Re-run' : 'Ran'} {latest.at ? stamp(latest.at) : '(time not recorded)'} · answered in {duration(latest.ms)}</p>
          : x.sentAt && !r ? <p className="kx-when">Sent {stamp(new Date(x.sentAt))} · no response yet</p> : null}

      <div className={`kx-verdict ${x.verdict.tone}${sending ? ' dim' : ''}`}>{x.verdict.text}</div>
      {x.note && <p className="kx-note">{x.note}</p>}

      {x.matches.length > 0 && (
        <table className="kx-match">
          <thead><tr><th>Field</th><th>On the application</th><th>Returned</th><th /></tr></thead>
          <tbody>
            {x.matches.map((m) => (
              <tr key={m.field}>
                <td>{m.field}</td>
                <td className="num">{m.application || '—'}</td>
                <td className="num">{m.authority || '—'}</td>
                <td className={m.ok ? 'ok' : 'bad'}>{m.ok ? '✓' : '✕'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {runs.length > 0 && (
        <details className="kx-raw" open={reruns.length > 0}>
          <summary>Runs <span className="kx-count">{runs.length}</span></summary>
          <table className="kx-runs">
            <thead><tr><th>When</th><th /><th>Code</th><th>HTTP</th><th>Took</th></tr></thead>
            <tbody>
              {runs.slice().reverse().map((run, i) => (
                <tr key={i}>
                  <td className="num">{run.at ? stamp(run.at) : 'not recorded'}</td>
                  <td>{run.rerun ? 'Re-run' : 'Case'}</td>
                  <td className={`num ${run.code === '00' ? 'ok' : 'bad'}`}>{run.code || '—'}</td>
                  <td className="num">{run.http}</td>
                  <td className="num">{duration(run.ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <details className="kx-raw">
        <summary>Request</summary>
        <Json value={{ headers: x.headers, body: x.body }} />
      </details>
      <details className="kx-raw">
        <summary>Response{r ? '' : ' — none yet'}</summary>
        {r ? <Json value={r.body} /> : <p className="kx-note">Nothing has come back.</p>}
      </details>
    </div>
  );
}

export default function KycExchange({ exchanges }: { exchanges: Exchange[] }) {
  return (
    <div className="kx">
      {exchanges.map((x) => <One key={x.service} x={x} />)}
    </div>
  );
}
