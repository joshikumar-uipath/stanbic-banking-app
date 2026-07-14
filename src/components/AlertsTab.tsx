import { useState, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig, defaultConfig } from '../config';
import type { MockAlert } from '../config';

type AlertType = 'success' | 'action' | 'warning' | 'info';

interface ReviewAction {
  label: string;
  style: 'primary' | 'danger' | 'secondary' | 'warning';
}

interface AlertItem {
  id: string;
  type: AlertType;
  agent: string;
  title: string;
  desc: string;
  timestamp: number;
  read: boolean;
  reviewActions?: ReviewAction[];
  reviewDetail?: {
    ref?: string;
    amount?: string;
    fields: { label: string; value: string }[];
  };
}

// Convert config-shaped MockAlert objects into the AlertItem shape the
// rendering code expects, computing absolute timestamps from the relative
// daysAgo / hour / minute fields. hour/minute of -1 means "use the current
// device clock value" so demo alerts can claim to have just happened.
function alertsFromConfig(items: MockAlert[]): AlertItem[] {
  const now = new Date();
  const ts = (daysAgo: number, h: number, m: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h < 0 ? now.getHours() : h, m < 0 ? now.getMinutes() : m, 0, 0);
    return d.getTime();
  };
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    agent: item.agent,
    title: item.title,
    desc: item.desc,
    timestamp: ts(item.daysAgo, item.hour, item.minute),
    read: item.read,
    reviewActions: item.reviewActions,
    reviewDetail: item.reviewDetail,
  }));
}

// ─── Generate alerts relative to today ───────────────────────────────────────
// Module-level — runs before useConfig() is available (used in App.tsx for
// the initial unread badge). Reads from the bundled defaultConfig; admin
// overrides take effect once the AlertsTab itself mounts.
export function getInitialUnreadCount(): number {
  if (!defaultConfig.demoContent.enabled) return 0;
  return alertsFromConfig(defaultConfig.demoContent.alerts).filter(a => !a.read).length;
}


// ─── UI config ────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<AlertType, { bg: string; border: string; dot: string; label: string; icon: React.ReactNode }> = {
  success: {
    bg: 'rgba(var(--brand-primary-rgb),0.08)', border: 'rgba(var(--brand-primary-rgb),0.2)', dot: 'var(--brand-primary)', label: 'Resolved',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  },
  action: {
    bg: 'rgba(var(--brand-primary-rgb),0.08)', border: 'rgba(var(--brand-primary-rgb),0.22)', dot: 'var(--brand-primary)', label: 'Action Required',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  },
  warning: {
    bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', dot: '#fbbf24', label: 'Warning',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
  },
  info: {
    bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', dot: '#a78bfa', label: 'Info',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
};

const getActionStyles = (theme: 'dark' | 'light'): Record<ReviewAction['style'], React.CSSProperties> => ({
  primary:   { background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)', color: '#fff' },
  danger:    { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' },
  secondary: theme === 'light'
    ? { background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(24,33,38,0.7)' }
    : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' },
  warning:   { background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' },
});

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'TODAY';
  if (same(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ alert, onAction, onClose }: {
  alert: AlertItem;
  onAction: (alertId: string, actionLabel: string) => void;
  onClose: () => void;
}) {
  const { theme, t } = useTheme();
  const cfg = TYPE_CONFIG[alert.type];
  const [done, setDone] = useState<string | null>(null);
  const actionStyles = getActionStyles(theme);

  const handleAction = (label: string) => {
    setDone(label);
    setTimeout(() => {
      onAction(alert.id, label);
      onClose();
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl px-5 pt-5 pb-8 flex flex-col gap-4"
        style={{ background: theme === 'light' ? '#ffffff' : '#0f172a', border: `1px solid ${t.border}`, maxHeight: '82vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-1" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 36, height: 36, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.icon}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold mb-0.5" style={{ color: cfg.dot }}>{alert.title}</p>
            <p className="text-sm font-medium leading-snug" style={{ color: theme === 'light' ? t.textPrimary : '#e2e8f0' }}>{alert.desc}</p>
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>{alert.agent} · {formatTime(alert.timestamp)}</p>
          </div>
        </div>

        {/* Detail fields */}
        {alert.reviewDetail && (
          <div className="rounded-2xl overflow-hidden" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}` }}>
            {alert.reviewDetail.ref && (
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.divider}` }}>
                <span className="text-xs" style={{ color: t.textMuted }}>Reference</span>
                <span className="text-xs font-semibold" style={{ color: theme === 'light' ? t.textPrimary : '#e2e8f0' }}>{alert.reviewDetail.ref}</span>
              </div>
            )}
            {alert.reviewDetail.amount && (
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.divider}` }}>
                <span className="text-xs" style={{ color: t.textMuted }}>Amount</span>
                <span className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>{alert.reviewDetail.amount}</span>
              </div>
            )}
            {alert.reviewDetail.fields.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5"
                style={{ borderBottom: i < alert.reviewDetail!.fields.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
                <span className="text-xs flex-shrink-0" style={{ color: t.textMuted }}>{f.label}</span>
                <span className="text-xs text-right" style={{ color: t.textBody }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {done ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-2xl"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.1)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>"{done}" submitted</span>
          </div>
        ) : alert.reviewActions ? (
          <div className="flex flex-col gap-2">
            {alert.reviewActions.map((a) => (
              <button key={a.label} onClick={() => handleAction(a.label)}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity active:opacity-70"
                style={actionStyles[a.style]}>
                {a.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Cancel */}
        {!done && (
          <button onClick={onClose} className="text-xs text-center py-1" style={{ color: t.textMuted }}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AlertsTab() {
  const { theme, t, tr } = useTheme();
  const { demoContent } = useConfig();
  const [alerts, setAlerts] = useState<AlertItem[]>(() =>
    demoContent.enabled ? alertsFromConfig(demoContent.alerts) : []
  );
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [reviewing, setReviewing] = useState<AlertItem | null>(null);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const markAllRead = () => setAlerts((p) => p.map((a) => ({ ...a, read: true })));
  const markRead   = (id: string) => setAlerts((p) => p.map((a) => a.id === id ? { ...a, read: true } : a));
  const dismiss    = (id: string) => setAlerts((p) => p.filter((a) => a.id !== id));

  const handleReviewAction = (alertId: string, _actionLabel: string) => {
    dismiss(alertId);
  };

  const visible = filter === 'unread' ? alerts.filter((a) => !a.read) : alerts;

  const groups: { label: string; items: AlertItem[] }[] = [];
  visible.forEach((alert) => {
    const label = formatDateLabel(alert.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(alert);
    else groups.push({ label, items: [alert] });
  });

  return (
    <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 35% at 50% 30%, rgba(79,100,200,0.14) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <div className="px-5 pt-3 pb-4 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-bold" style={{ fontSize: 22, color: t.textPrimary }}>{tr.alerts}</h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-medium" style={{ color: t.textSecondary }}>
              {tr.markAllRead}
            </button>
          )}
        </div>
        <p className="text-xs mb-4" style={{ color: t.textMuted }}>
          {unreadCount > 0 ? tr.unreadCount(unreadCount) : tr.allCaughtUp}
        </p>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(['all', 'unread'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all"
              style={filter === f
                ? { background: 'var(--brand-primary)', color: '#fff' }
                : { background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted }
              }>
              {f === 'unread' ? (unreadCount > 0 ? `${tr.filterUnread} (${unreadCount})` : tr.filterUnread) : tr.filterAll}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 relative z-10">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={t.textMuted} strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm font-medium" style={{ color: t.textMuted }}>{tr.noNotifications}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold tracking-widest mb-2.5" style={{ color: t.textLabel }}>
                  {group.label === 'TODAY' ? tr.today : group.label === 'YESTERDAY' ? tr.yesterday : group.label}
                </p>
                <div className="flex flex-col gap-2">
                  {group.items.map((alert) => {
                    const cfg = TYPE_CONFIG[alert.type];
                    return (
                      <div key={alert.id}
                        className="rounded-2xl p-4 relative cursor-pointer active:opacity-80 transition-opacity"
                        style={{
                          background: alert.read ? t.bgCard : cfg.bg,
                          border: `1px solid ${alert.read ? t.border : cfg.border}`,
                        }}
                        onClick={() => { markRead(alert.id); if (alert.reviewActions) setReviewing(alert); }}
                      >
                        {/* Unread dot */}
                        {!alert.read && (
                          <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                        )}

                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                            style={{ width: 32, height: 32, background: alert.read ? (theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)') : cfg.bg, border: `1px solid ${cfg.border}` }}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-xs font-semibold mb-0.5" style={{ color: alert.read ? t.textMuted : cfg.dot }}>
                              {alert.title}
                            </p>
                            <p className="text-sm font-medium leading-snug mb-1" style={{ color: alert.read ? t.textBody : t.textPrimary }}>
                              {alert.desc}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs" style={{ color: t.textSecondary }}>{alert.agent}</p>
                              <p className="text-xs" style={{ color: t.textMuted }}>{formatTime(alert.timestamp)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons (unread action alerts only) */}
                        {alert.type === 'action' && !alert.read && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); markRead(alert.id); setReviewing(alert); }}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)', color: '#fff' }}>
                              Review Now
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold"
                              style={{ background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}`, color: t.textMuted }}>
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewing && (
        <ReviewModal
          alert={reviewing}
          onAction={handleReviewAction}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
