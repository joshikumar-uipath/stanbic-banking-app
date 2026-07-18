// ─────────────────────────────────────────────────────────────────────────────
// Mock Kafka console (/kafka) — the event backbone, visualised.
//
// Every surface publishes to the shared store's event log across eight topics.
// This reads that log live: a topic sidebar with counts, and a stream that
// updates on its own as events arrive. Capture on the desk or resolve in Ops in
// another tab and watch new events land here — the `storage` sync drives it.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, KAFKA_TOPICS, type CaseEvent, type KafkaTopic } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

// A stable colour per topic — read once, since the palette is fixed.
const TOPIC_COLOR: Record<KafkaTopic, string> = {
  'account-opening-requested': '#0091DA',
  'nin-validation': '#7C6CF0',
  'bvn-validation': '#2EA8C0',
  'account-creation-requested': '#D97706',
  'account-created': '#16A34A',
  'bulk-upload': '#C8A24A',
  'exception-queue': '#DC2626',
  'customer-notification': '#0033A1',
};

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function KafkaInner() {
  useBrandVars('Event Stream');
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [topic, setTopic] = useState<KafkaTopic | 'all'>('all');

  // Live: read the log, and re-read whenever the store emits (same tab) or the
  // `storage` event fires (another tab writing) — the store bridges both.
  useEffect(() => {
    let alive = true;
    const refresh = () => { void store.events().then((e) => { if (alive) setEvents(e); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    events.forEach((e) => { c[e.topic] = (c[e.topic] || 0) + 1; });
    return c;
  }, [events]);

  const shown = topic === 'all' ? events : events.filter((e) => e.topic === topic);
  // New rows animate in via a CSS mount animation (keyed by id) — no JS needed.

  return (
    <div className="inst">
      <TopBar system="Kafka · Event Stream" sub="Event backbone" />
      <div className="kf">
        <nav className="kf-side">
          <h2>Topics</h2>
          <button className={`kf-topic allrow${topic === 'all' ? ' cur' : ''}`} aria-current={topic === 'all'} onClick={() => setTopic('all')}>
            <span className="dot" style={{ background: 'var(--i-ink-3)' }} />
            <span className="nm">all topics</span>
            <span className="ct">{events.length}</span>
          </button>
          {KAFKA_TOPICS.map((t) => (
            <button key={t} className="kf-topic" aria-current={topic === t} onClick={() => setTopic(t)}>
              <span className="dot" style={{ background: TOPIC_COLOR[t] }} />
              <span className="nm">{t}</span>
              <span className="ct">{counts[t] || 0}</span>
            </button>
          ))}
        </nav>

        <div className="kf-main">
          <div className="kf-strip">
            <div className="kf-stat"><div className="k">Events</div><div className="v num">{events.length}</div></div>
            <div className="kf-stat"><div className="k">Topics active</div><div className="v num">{Object.keys(counts).length} <span style={{ fontSize: 13, color: 'var(--i-ink-3)', fontWeight: 500 }}>of {KAFKA_TOPICS.length}</span></div></div>
            <div className="kf-stat"><div className="k">Showing</div><div className="v num">{shown.length}</div></div>
          </div>

          <div className="kf-feed">
            {shown.length === 0 ? (
              <div className="kf-empty">No events on this topic yet. Capture an application or resolve a case and they'll stream in here.</div>
            ) : shown.map((e) => (
              <div className="kf-ev" key={e.id}>
                <span className="tp" style={{ color: TOPIC_COLOR[e.topic] }}><i style={{ background: TOPIC_COLOR[e.topic] }} />{e.topic}</span>
                <span className="cid">{e.caseId}</span>
                <span className="msg" title={e.message}>{e.message}</span>
                <span className="at">{ago(e.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KafkaConsole() {
  return <InstrumentProvider><KafkaInner /></InstrumentProvider>;
}
