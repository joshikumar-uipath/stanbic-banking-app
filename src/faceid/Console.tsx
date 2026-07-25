/* Ported from the standalone FaceID Verify console (uipath-faceid). Re-skinned
   for Stanbic and wired to the shared store; kept close to the original, so its
   own lint patterns (function hoisting, animation setState-in-effect) are allowed
   here while tsc still type-checks it fully. */
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type User, type VerificationSummary } from "./data";
import { Enroll } from "./Enroll";
import { EnrollWizard } from "./EnrollWizard";
import { useConfig } from "../config";
import { getActiveCountry } from "../config/countries";

type NavId = "dashboard" | "activity" | "enroll" | "identities" | "settings";
type Cat = "ok" | "partial" | "no" | "spoof" | "inc" | "pending";

const MATCH_THRESHOLD = 80;
const LIVENESS_THRESHOLD = 70;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MESH_PTS = [
  [38, 28], [62, 28], [50, 40], [34, 46], [66, 46],
  [42, 58], [58, 58], [50, 64], [30, 38], [70, 38],
];
const CAT_LABEL: Record<Cat, string> = {
  ok: "Verified",
  partial: "Partial · Review",
  no: "No match",
  spoof: "Spoof blocked",
  inc: "Inconclusive",
  pending: "In progress",
};

function fmtTimestamp(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${h}:${m} ${ampm}`;
}
function ymd(d: Date | null): string {
  const x = d ?? new Date();
  return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
}
function shortCode(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return String(h).padStart(5, "0");
}
function relTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
/** Absolute scan date-time, e.g. "23 Jun 2026 4:56 PM". */
function fmtWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : fmtTimestamp(d);
}
function friendlyReason(reason?: string): string {
  switch (reason) {
    case "not-live": return "Liveness failed";
    case "no-match": return "No match";
    case "no-frame": return "No capture frame";
    case "liveness-incomplete": return "Liveness incomplete";
    default: return reason ?? "—";
  }
}
function categorize(v: VerificationSummary): Cat {
  if (v.status === "partial") return "partial";
  if (v.status === "in_progress" || v.status === "created") return "pending";
  if (v.result?.verified) return "ok";
  const reason = v.result?.reason;
  if (reason === "no-match") return "no";
  if (reason === "not-live") return "spoof";
  return "inc";
}

function Icon({ name, className }: { name: string; className?: string }) {
  const p = {
    className: className ?? "pc-ic",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "dashboard":
      return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>);
    case "checks":
      return (<svg {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
    case "userplus":
      return (<svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>);
    case "users":
      return (<svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case "gear":
      return (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
    case "search":
      return (<svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>);
    case "plus":
      return (<svg {...p}><path d="M12 5v14M5 12h14" /></svg>);
    case "shield":
      return (<svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
    case "shieldcheck":
      return (<svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>);
    case "checkcircle":
      return (<svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg>);
    case "clock":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
    case "video":
      return (<svg {...p}><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>);
    case "camera":
      return (<svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>);
    case "trash":
      return (<svg {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
    case "warning":
      return (<svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>);
    case "infocircle":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>);
    case "check":
      return (<svg {...p}><path d="M20 6 9 17l-5-5" /></svg>);
    default:
      return null;
  }
}

export function Console({ onLogout }: { onLogout: () => void }) {
  const { branding } = useConfig();
  const country = getActiveCountry();
  const logout = onLogout;
  const [users, setUsers] = useState<User[]>([]);
  const [verifications, setVerifications] = useState<VerificationSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nav, setNav] = useState<NavId>("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Cat>("all");

  const [detail, setDetail] = useState<VerificationSummary | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [verifyUser, setVerifyUser] = useState<User | null>(null);
  const [active, setActive] = useState<{ token: string; widgetUrl: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load identities.");
    }
  }, []);
  const refreshVerifications = useCallback(async () => {
    try {
      setVerifications(await api.listVerifications());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
    void refreshVerifications();
  }, [refreshUsers, refreshVerifications]);

  // Receive results from the embedded widget iframe (verify modal).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || d.source !== "faceid-widget") return;
      if (d.type === "result") {
        toast(d.verified ? "Verification complete · Verified" : "Verification complete · Not verified");
        void refreshVerifications();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshVerifications]);

  // Close modals on Escape.
  useEffect(() => {
    const open = detail || editUserId || verifyUser;
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDetail(null);
        setEditUserId(null);
        setVerifyUser(null);
        setActive(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, editUserId, verifyUser]);

  function toast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2600);
  }

  const editUser = users.find((u) => u.id === editUserId) ?? null;

  // ---- derived data ----
  const metrics = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();
    const yStr = new Date(today.getTime() - 86400000).toDateString();
    const todayCount = verifications.filter((v) => new Date(v.createdAt).toDateString() === todayStr).length;
    const yCount = verifications.filter((v) => new Date(v.createdAt).toDateString() === yStr).length;
    const enrolledToday = users.filter((u) => new Date(u.createdAt).toDateString() === todayStr).length;
    const withResult = verifications.filter((v) => v.result);
    const passed = withResult.filter((v) => v.result?.verified).length;
    const passRate = withResult.length ? (passed / withResult.length) * 100 : null;
    const spoofs = verifications.filter((v) => categorize(v) === "spoof").length;
    return {
      enrolled: users.length,
      enrolledToday,
      today: todayCount,
      todayDelta: todayCount - yCount,
      passRate,
      spoofs,
    };
  }, [verifications, users]);

  const needs = useMemo(() => {
    const spoof = verifications.filter((v) => categorize(v) === "spoof").length;
    const noMatch = verifications.filter((v) => categorize(v) === "no").length;
    const flagged = verifications.filter((v) => v.flagged).length;
    return { spoof, noMatch, flagged };
  }, [verifications]);

  const lastVerifiedByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of verifications) {
      if (!v.userId) continue;
      if (!map.has(v.userId)) map.set(v.userId, v.createdAt); // list is newest-first
    }
    return map;
  }, [verifications]);

  const activityFiltered = verifications.filter((v) => filter === "all" || categorize(v) === filter);
  const idFilter = search.trim().toLowerCase();
  const identitiesFiltered = users.filter(
    (u) => !idFilter || `${u.displayName} ${u.externalId} ${u.designation ?? ""}`.toLowerCase().includes(idFilter)
  );

  async function startVerify(user: User) {
    setVerifyUser(user);
    setActive(null);
    try {
      const v = await api.createVerification(user.id);
      setActive({ token: v.token, widgetUrl: v.widgetUrl });
    } catch {
      toast("Could not start verification.");
      setVerifyUser(null);
    }
  }

  async function removeUser(user: User) {
    if (!window.confirm(`Remove ${user.displayName}? This deletes their face vector (DeleteFaces) and reference photo.`)) {
      return;
    }
    try {
      await api.deleteUser(user.id);
      toast(`${user.displayName} removed · DeleteFaces called`);
      void refreshUsers();
    } catch {
      toast("Could not remove identity.");
    }
  }

  const NAV: { id: NavId; label: string; group: string; count?: number; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", group: "Operate", icon: "dashboard" },
    { id: "activity", label: "Verifications", group: "Operate", count: verifications.length, icon: "checks" },
    { id: "enroll", label: "Enroll identity", group: "Manage", icon: "userplus" },
    { id: "identities", label: "Identities", group: "Manage", count: users.length, icon: "users" },
    { id: "settings", label: "Settings", group: "Configure", icon: "gear" },
  ];
  const TITLES: Record<NavId, [string, string]> = {
    dashboard: ["Dashboard", "Live verification operations overview"],
    activity: ["Verifications", "Every check, with result and reason"],
    enroll: ["Enroll identity", "Add a reference photo to the collection"],
    identities: ["Identities", "Manage enrolled references"],
    settings: ["Settings", "Thresholds, liveness, residency and security"],
  };

  let lastGroup = "";

  return (
    <div className="pc-app admin">
      <div className="pc-shell">
      {/* Sidebar */}
      <aside className="pc-sidebar">
        <div className="pc-lockup">
          <span className="pc-mark" aria-hidden>
            {branding.favicon && <img src={branding.favicon} alt="" />}
          </span>
          <div className="pc-wm">
            <b style={{ display: "block", color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>{branding.appName}</b>
            <small>VERIFY CONSOLE</small>
          </div>
        </div>

        <nav className="pc-nav">
          {NAV.map((item) => {
            const showLabel = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {showLabel && <span className="pc-lbl">{item.group}</span>}
                <button className={nav === item.id ? "active" : ""} onClick={() => setNav(item.id)}>
                  <Icon name={item.icon} className="pc-nav-ic" />
                  {item.label}
                  {item.count != null && <span className="pc-count">{item.count}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="pc-side-foot">
          <div className="pc-residency">
            <Icon name="shield" className="pc-ic" />
            <div>
              <b>{country.name} region</b>
              Liveness on · every check logged
            </div>
          </div>
          <div className="pc-user">
            <div className="pc-av">AD</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pc-un">Admin</div>
              <div className="pc-ur">Verification admin</div>
            </div>
            <button
              className="pc-signout"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,.18)",
                color: "#cbd5e1",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="pc-main">
        <header className="pc-topbar">
          <h1>
            {TITLES[nav][0]}
            <span>{TITLES[nav][1]}</span>
          </h1>
          <div className="pc-tb-right">
            <div className="pc-search">
              <Icon name="search" className="pc-ic" />
              <input
                placeholder="Search identities…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setNav("identities");
                }}
              />
            </div>
            <button className="pc-btn pc-btn-primary" onClick={() => setNav("enroll")}>
              <Icon name="plus" className="pc-ic" />
              New identity
            </button>
          </div>
        </header>

        <div className="pc-content">
          {loadError && <div className="pc-error">{loadError}</div>}

          {/* DASHBOARD */}
          {nav === "dashboard" && (
            <>
              <div className="pc-metrics">
                <Metric
                  tone="teal"
                  icon="users"
                  value={String(metrics.enrolled)}
                  label="Enrolled identities"
                  delta={metrics.enrolledToday > 0 ? `+${metrics.enrolledToday}` : undefined}
                  deltaTone="up"
                />
                <Metric
                  tone="orange"
                  icon="checks"
                  value={String(metrics.today)}
                  label="Verifications today"
                  delta={metrics.todayDelta !== 0 ? `${metrics.todayDelta > 0 ? "+" : ""}${metrics.todayDelta}` : undefined}
                  deltaTone={metrics.todayDelta >= 0 ? "up" : "down"}
                />
                <Metric
                  tone="teal"
                  icon="checkcircle"
                  value={metrics.passRate != null ? `${metrics.passRate.toFixed(1)}%` : "—"}
                  label="Pass rate"
                />
                <Metric tone="magenta" icon="shieldcheck" value={String(metrics.spoofs)} label="Spoofs blocked" />
                <Metric tone="amber" icon="clock" value="—" label="Avg latency" />
              </div>

              <div className="pc-grid2">
                <div className="pc-panel">
                  <div className="pc-panel-h">
                    <div>
                      <div className="pc-pt">Recent verifications</div>
                      <div className="pc-ps">Latest activity across all channels</div>
                    </div>
                    <button className="pc-link" onClick={() => setNav("activity")}>
                      View all →
                    </button>
                  </div>
                  <div>
                    {verifications.slice(0, 6).map((v) => (
                      <ActivityRow key={v.verificationId} v={v} onOpen={() => setDetail(v)} />
                    ))}
                    {verifications.length === 0 && <Empty>No verifications yet.</Empty>}
                  </div>
                </div>

                <div className="pc-panel">
                  <div className="pc-panel-h">
                    <div>
                      <div className="pc-pt">Needs attention</div>
                      <div className="pc-ps">Flags and queue</div>
                    </div>
                  </div>
                  <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <NoteCard tone="magenta" icon="warning">
                      <b>{needs.spoof} spoof {needs.spoof === 1 ? "attempt" : "attempts"}</b> blocked — review the flagged captures.
                    </NoteCard>
                    <NoteCard tone="amber" icon="infocircle">
                      <b>{needs.noMatch} no-match {needs.noMatch === 1 ? "result" : "results"}</b> awaiting adjudication.
                    </NoteCard>
                    <NoteCard tone="teal" icon="check">
                      <b>{needs.flagged} {needs.flagged === 1 ? "record" : "records"} flagged</b> for review by an admin.
                    </NoteCard>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ACTIVITY */}
          {nav === "activity" && (
            <>
              <div className="pc-filters">
                {(["all", "ok", "partial", "no", "spoof", "inc"] as const).map((f) => (
                  <button
                    key={f}
                    className={`pc-fchip ${filter === f ? "on" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === "all" ? "All results" : CAT_LABEL[f]}
                  </button>
                ))}
              </div>
              <div className="pc-panel">
                {activityFiltered.length === 0 ? (
                  <Empty>No results in this view.</Empty>
                ) : (
                  activityFiltered.map((v) => (
                    <ActivityRow key={v.verificationId} v={v} onOpen={() => setDetail(v)} />
                  ))
                )}
              </div>
            </>
          )}

          {/* ENROLL */}
          {nav === "enroll" && (
            <EnrollWizard
              toast={toast}
              onEnrolled={(u) => {
                void refreshUsers();
                toast(`${u.displayName} enrolled · reference indexed`);
                setNav("identities");
              }}
            />
          )}

          {/* IDENTITIES */}
          {nav === "identities" && (
            <div className="pc-panel">
              <div className="pc-panel-h">
                <div>
                  <div className="pc-pt">Enrolled identities</div>
                  <div className="pc-ps">{users.length} references</div>
                </div>
                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setNav("enroll")}>
                  + Add
                </button>
              </div>
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th>Last verified</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {identitiesFiltered.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="pc-idn">
                          <img className="pc-ava-img" src={api.referenceImageUrl(u.id)} alt="" />
                          <div>
                            <div className="pc-nn">{u.displayName}</div>
                            <div className="pc-ii">{u.externalId}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{u.designation || "—"}</td>
                      <td>
                        <span className="pc-chip ok">Active</span>
                      </td>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--muted)" }}>
                        {relTime(lastVerifiedByUser.get(u.id))}
                      </td>
                      <td>
                        <div className="pc-rowact">
                          <button className="pc-iconbtn" title="Verify now" onClick={() => startVerify(u)}>
                            <Icon name="video" className="pc-ic" />
                          </button>
                          <button className="pc-iconbtn" title="Update photo" onClick={() => setEditUserId(u.id)}>
                            <Icon name="camera" className="pc-ic" />
                          </button>
                          <button className="pc-iconbtn danger" title="Remove" onClick={() => removeUser(u)}>
                            <Icon name="trash" className="pc-ic" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {identitiesFiltered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--faint)" }}>
                        No identities found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SETTINGS */}
          {nav === "settings" && <SettingsSection />}
        </div>
      </div>
      </div>

      {/* Modals */}
      {detail && (
        <VerificationDetail
          summary={detail}
          referencesCount={users.length}
          onClose={() => setDetail(null)}
          onDeleted={() => void refreshVerifications()}
        />
      )}

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUserId(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <Enroll
              editUser={editUser}
              onCancelEdit={() => setEditUserId(null)}
              onEnrolled={(u) => {
                void refreshUsers();
                setEditUserId(null);
                toast(`${u.displayName} updated · new face indexed`);
              }}
            />
          </div>
        </div>
      )}

      {verifyUser && (
        <div
          className="modal-overlay"
          onClick={() => {
            setVerifyUser(null);
            setActive(null);
          }}
        >
          <div className="modal-panel pc-verify" onClick={(e) => e.stopPropagation()}>
            <div className="pc-verify-head">
              <span>Verify {verifyUser.displayName}</span>
              <button
                className="pc-iconbtn"
                onClick={() => {
                  setVerifyUser(null);
                  setActive(null);
                }}
              >
                ✕
              </button>
            </div>
            {active ? (
              <iframe title="FaceID widget" src={active.widgetUrl} allow="camera" className="pc-verify-frame" />
            ) : (
              <div className="pc-verify-load">
                <div className="spinner" />
                <p className="muted">Minting token…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="pc-toast show">
          <Icon name="check" className="pc-ic" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}

function Metric({
  tone,
  icon,
  value,
  label,
  delta,
  deltaTone,
}: {
  tone: string;
  icon: string;
  value: string;
  label: string;
  delta?: string;
  deltaTone?: "up" | "down";
}) {
  return (
    <div className="pc-metric">
      <div className="pc-mh">
        <span className={`pc-mi ${tone}`}>
          <Icon name={icon} className="pc-mi-ic" />
        </span>
        {delta && <span className={`pc-delta ${deltaTone ?? ""}`}>{delta}</span>}
      </div>
      <div className="pc-val">{value}</div>
      <div className="pc-lab">{label}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="pc-empty">{children}</div>;
}

function NoteCard({
  tone,
  icon,
  children,
}: {
  tone: "teal" | "amber" | "magenta";
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`pc-note ${tone}`}>
      <Icon name={icon} className="pc-ic" />
      <div>{children}</div>
    </div>
  );
}

function ActivityRow({ v, onOpen }: { v: VerificationSummary; onOpen: () => void }) {
  const cat = categorize(v);
  const name = v.displayName ?? "Unknown subject";
  const score =
    v.result?.similarity != null
      ? `${v.result.similarity.toFixed(1)}%`
      : v.result?.livenessConfidence != null
        ? `${v.result.livenessConfidence.toFixed(1)}%`
        : "—";
  const thumb = v.hasCapture ? api.captureImageUrl(v.verificationId) : null;
  return (
    <div className="pc-act" onClick={onOpen}>
      {thumb ? <img className="pc-act-ava" src={thumb} alt="" /> : <div className="pc-act-ava empty">?</div>}
      <div className="pc-who">
        <div className="pc-n">
          {name}
          {v.flagged && <span className="pc-flag" title="Flagged for review"> ⚑</span>}
        </div>
        <div className="pc-m">
          {(v.employeeId ?? "—")} · {v.result?.reason ? friendlyReason(v.result.reason) : v.result?.verified ? "Match confirmed" : v.status}
        </div>
      </div>
      <span className={`pc-chip ${cat} w`}>{CAT_LABEL[cat]}</span>
      <span className="pc-sc">{score}</span>
      <span className="pc-dt">{fmtWhen(v.createdAt)}</span>
      <span className="pc-tm">{relTime(v.createdAt)}</span>
    </div>
  );
}

// ---- Settings (visual; thresholds shown from defaults, not yet persisted) ----
function SettingsSection() {
  const [match, setMatch] = useState(MATCH_THRESHOLD);
  const [live, setLive] = useState(LIVENESS_THRESHOLD);
  const [retention, setRetention] = useState(30);
  const [attempts, setAttempts] = useState(3);
  return (
    <div className="pc-settings">
      <div className="pc-scard">
        <h3>Matching thresholds</h3>
        <p className="pc-sd">Minimum scores required to pass.</p>
        <div className="pc-srow">
          <div className="pc-sl">
            Face match similarity<span className="pc-sv">{match}%</span>
          </div>
          <input type="range" min={70} max={99} value={match} onChange={(e) => setMatch(+e.target.value)} />
          <div className="pc-sh">Below this, results are marked No match and routed to review.</div>
        </div>
        <div className="pc-srow">
          <div className="pc-sl">
            Liveness confidence<span className="pc-sv">{live}%</span>
          </div>
          <input type="range" min={60} max={99} value={live} onChange={(e) => setLive(+e.target.value)} />
          <div className="pc-sh">Below this, the capture is rejected as a potential spoof.</div>
        </div>
      </div>

      <div className="pc-scard">
        <h3>Liveness</h3>
        <p className="pc-sd">How presence is proven.</p>
        <div className="pc-srow">
          <div className="pc-sl">Detection mode</div>
          <div className="pc-seg">
            <button className="on">Active</button>
            <button>Passive</button>
          </div>
          <div className="pc-sh">Active = movement + light challenge (strongest). Passive = single frame.</div>
        </div>
        <div className="pc-srow">
          <div className="pc-sl">Audit frames kept</div>
          <div className="pc-seg">
            <button>1</button>
            <button className="on">4</button>
          </div>
        </div>
      </div>

      <div className="pc-scard">
        <h3>Data &amp; residency</h3>
        <p className="pc-sd">Where biometric data is processed and how long it's kept.</p>
        <div className="pc-srow">
          <div className="pc-sl">Processing region</div>
          <select className="pc-select">
            <option>us-east-1 · N. Virginia (current)</option>
            <option>eu-west-1 · Ireland</option>
            <option>ap-south-1 · Mumbai</option>
          </select>
        </div>
        <div className="pc-srow">
          <div className="pc-sl">
            Capture retention<span className="pc-sv">{retention} days</span>
          </div>
          <input type="range" min={0} max={365} value={retention} onChange={(e) => setRetention(+e.target.value)} />
        </div>
        <div className="pc-srow">
          <div className="pc-sl">
            Opt out of model improvement
            <label className="pc-toggle">
              <input type="checkbox" defaultChecked />
              <span className="pc-tk" />
            </label>
          </div>
          <div className="pc-sh">Stops AWS retaining selfie video to improve the service. Recommended for banking.</div>
        </div>
      </div>

      <div className="pc-scard">
        <h3>Security</h3>
        <p className="pc-sd">Abuse and lockout controls.</p>
        <div className="pc-srow">
          <div className="pc-sl">
            Max attempts before lockout<span className="pc-sv">{attempts}</span>
          </div>
          <input type="range" min={1} max={10} value={attempts} onChange={(e) => setAttempts(+e.target.value)} />
        </div>
        <div className="pc-srow">
          <div className="pc-sl">
            Require consent capture
            <label className="pc-toggle">
              <input type="checkbox" defaultChecked />
              <span className="pc-tk" />
            </label>
          </div>
          <div className="pc-sh">Record explicit biometric consent before each verification.</div>
        </div>
        <div className="pc-srow">
          <div className="pc-sl">
            Step-up only (never sole factor)
            <label className="pc-toggle">
              <input type="checkbox" defaultChecked />
              <span className="pc-tk" />
            </label>
          </div>
          <div className="pc-sh">Face verification supplements a password, never replaces it.</div>
        </div>
        <div className="pc-sh" style={{ marginTop: 4 }}>
          Settings are display-only in this demo — matching thresholds are configured server-side via environment
          variables.
        </div>
      </div>
    </div>
  );
}

// ---- Reason copy for the failure modal ----
function reasonShort(reason?: string): string {
  switch (reason) {
    case "no-match": return "No match";
    case "not-live": return "Spoof blocked";
    case "liveness-incomplete": return "Incomplete";
    case "no-frame": return "No capture";
    default: return "Failed";
  }
}
function reasonInfo(reason: string | undefined, bestScore: number | null) {
  switch (reason) {
    case "no-match":
      return {
        title: "No matching identity found",
        body: `Liveness passed — a live person was present, so this is not a spoof attempt. The capture did not match any enrolled reference${bestScore != null ? ` (best candidate ${bestScore.toFixed(1)}%)` : ""}.`,
        rec: "Route to manual review, or re-enroll if this is a known employee.",
      };
    case "not-live":
      return {
        title: "Liveness could not be confirmed",
        body: "The capture could not be confirmed as coming from a live person — a possible spoof (photo, screen, or mask).",
        rec: "Ask the subject to retry in good lighting, facing the camera.",
      };
    case "no-frame":
      return {
        title: "No usable capture",
        body: "The liveness session completed but returned no usable frame.",
        rec: "Retry the verification.",
      };
    default:
      return {
        title: "Verification incomplete",
        body: "The liveness check did not complete — it may have timed out or been interrupted.",
        rec: "Retry the verification.",
      };
  }
}

/** Count a number up to `target` (ease-out cubic), like the mockup's countUp. */
function useCountUp(target: number | null): number | null {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(target);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const dur = 1100;
    const startTimer = window.setTimeout(() => {
      const step = (now: number) => {
        if (!t0) t0 = now;
        const t = Math.min((now - t0) / dur, 1);
        setV(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 250);
    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [target]);
  return target == null ? null : v;
}

function VerificationDetail({
  summary,
  referencesCount,
  onClose,
  onDeleted,
}: {
  summary: VerificationSummary;
  referencesCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { branding } = useConfig();
  const [deleting, setDeleting] = useState(false);
  const [approved, setApproved] = useState(!!summary.result?.verified);
  const [approving, setApproving] = useState(false);
  const [grow, setGrow] = useState(false);
  const [scanning, setScanning] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setGrow(true), 80);
    const s = setTimeout(() => setScanning(false), 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(s);
    };
  }, []);

  const r = summary.result;
  const verified = !!r?.verified;
  const partial = summary.status === "partial";
  const isLive = !!r?.isLive;
  const isMatch = !!r?.isMatch;
  const hasUser = !!summary.userId;
  const captureUrl = summary.hasCapture ? api.captureImageUrl(summary.verificationId) : null;
  const refUrl = summary.hasReference
    ? api.verificationReferenceUrl(summary.verificationId)
    : hasUser
      ? api.referenceImageUrl(summary.userId)
      : null;

  const when = r?.completedAt || summary.createdAt;
  const dt = when ? new Date(when) : null;
  const referenceId = `VER-${ymd(dt)}-${shortCode(summary.verificationId)}`;
  const simVal = r?.similarity ?? null;
  const lvVal = r?.livenessConfidence ?? null;
  const confVal = simVal != null ? simVal : lvVal;
  const confAnim = useCountUp(confVal);
  const simAnim = useCountUp(simVal);
  const lvAnim = useCountUp(lvVal);
  const channelLabel =
    summary.channel === "kiosk" ? "Kiosk · walk-up" : summary.channel === "embedded" ? "Web · embedded" : "—";
  const info = verified ? null : reasonInfo(r?.reason, simVal);
  const matchGap = simVal != null && !isMatch ? MATCH_THRESHOLD - simVal : null;

  const checks = [
    { t: "Identity match", s: isMatch ? "Reference matched" : "No reference matched", ok: isMatch },
    { t: "Liveness", s: isLive ? "Live person confirmed" : "Not confirmed live", ok: isLive },
    { t: "Presentation attack", s: "No spoof · print/screen/mask", ok: isLive },
    { t: "Image quality", s: "Sharpness · pose · lighting", ok: isLive || summary.hasCapture },
  ];

  async function handleApprove() {
    setApproving(true);
    try {
      await api.approveVerification(summary.verificationId);
      setApproved(true);
      onDeleted();
    } catch {
      window.alert("Could not approve this verification.");
    } finally {
      setApproving(false);
    }
  }
  async function handleDelete() {
    if (!window.confirm("Delete this verification record permanently? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.deleteVerification(summary.verificationId);
      onDeleted();
      onClose();
    } catch {
      setDeleting(false);
      window.alert("Could not delete the record.");
    }
  }
  function handleExport() {
    const record = {
      referenceId,
      decision: verified ? "Verified" : "Not verified",
      status: summary.status,
      name: summary.displayName ?? null,
      employeeId: summary.employeeId ?? null,
      faceMatchSimilarity: simVal,
      livenessConfidence: lvVal,
      isMatch,
      isLive,
      reason: r?.reason ?? null,
      channel: summary.channel ?? null,
      timestamp: when ?? null,
      verificationId: summary.verificationId,
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${referenceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Tick = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path className="vr-draw" d="M20 6 9 17l-5-5" />
    </svg>
  );
  const Cross = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel vr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vr-console">
          <div className="vr-head">
            <div className="vr-brand">
              <span className="vr-mark" aria-hidden>
                {branding.favicon && <img src={branding.favicon} alt="" />}
              </span>
              <div className="vr-wm">{branding.appName}</div>
              <span className="vr-div" aria-hidden />
              <div className="vr-tool">
                Identity Verification
                <span className={`vr-live ${verified ? "" : "bad"}`}>
                  <span className={`vr-pulse ${verified ? "" : "bad"}`} />
                  {verified ? "SESSION COMPLETE" : `VERIFICATION FAILED · ${reasonShort(r?.reason)}`}
                </span>
              </div>
            </div>
            <div className="vr-head-right">
              <span className="vr-ref-pill">{referenceId}</span>
              <button className="vr-close" aria-label="Close" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>

          <div className="vr-body">
            {summary.referenceStale && (
              <div className="vr-stale">
                ⚠ The reference photo for this user was updated after this check. This record is kept as-is for
                audit, but is no longer current.
              </div>
            )}

            <div className="vr-grid">
              <div className="vr-photos">
                <div className="vr-portrait">
                  <span className="vr-frame-tag">Captured selfie</span>
                  {captureUrl ? <img src={captureUrl} alt="captured selfie" /> : (
                    <div className="vr-noimg">{
                      r?.reason === "not-live" || r?.reason === "liveness-incomplete" ? "Capture withheld · liveness failed"
                        : r?.reason === "no-frame" ? "No capture frame"
                        : "No capture"
                    }</div>
                  )}
                  {captureUrl && (
                    <>
                      <div className="vr-mesh" aria-hidden>
                        {MESH_PTS.map((p, i) => (
                          <span
                            key={i}
                            style={{
                              left: `${p[0]}%`,
                              top: `${p[1]}%`,
                              // pop-in delay, then a staggered start for the infinite pulse
                              animationDelay: `${0.3 + i * 0.04}s, ${0.9 + i * 0.16}s`,
                            }}
                          />
                        ))}
                      </div>
                      {scanning && <div className="vr-scanline" aria-hidden />}
                    </>
                  )}
                </div>
                <div className="vr-vlink" aria-hidden>
                  <div className={`vr-match-badge ${verified ? "on" : "fail"}`}>{verified ? Tick : Cross}</div>
                </div>
                {refUrl ? (
                  <div className="vr-portrait">
                    <span className="vr-frame-tag">Reference on file</span>
                    <img src={refUrl} alt="reference on file" />
                  </div>
                ) : (
                  <div className="vr-portrait empty">
                    <span className="vr-frame-tag">Reference on file</span>
                    <div className="vr-empty-body">
                      <div className="vr-empty-t">No matching reference</div>
                      <div className="vr-empty-s">Searched {referencesCount.toLocaleString()} enrolled {referencesCount === 1 ? "identity" : "identities"}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="vr-detail">
                <div className="vr-subject">
                  <div className={`vr-name ${verified ? "" : "fail"}`}>{summary.displayName ?? "Unknown subject"}</div>
                  <div className="vr-role">
                    {verified
                      ? summary.employeeId
                        ? `Employee · ${summary.employeeId}`
                        : "Identity confirmed"
                      : "No enrolled identity matched this capture"}
                  </div>
                </div>

                {(
                <>
                <div className="vr-confidence">
                  <div className="vr-conf-top">
                    <span className="vr-conf-label">{verified ? "Verification confidence" : "Best match score"}</span>
                    <span className={`vr-conf-num ${verified ? "" : "fail"}`}>
                      {confAnim != null ? (
                        <>
                          {confAnim.toFixed(1)}
                          <small>%</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>

                  <div className="vr-signal">
                    <div className="vr-signal-row">
                      <span className="k">Face match similarity</span>
                      <span className="v">
                        {simAnim != null ? `${simAnim.toFixed(1)}%` : "—"}&nbsp;
                        <span className={isMatch ? "pass" : "fail"}>{isMatch ? "PASS" : "FAIL"}</span>
                      </span>
                    </div>
                    <div className="vr-track">
                      <div className={`vr-fill ${isMatch ? "" : "fail"}`} style={{ width: grow ? `${simVal ?? 0}%` : "0%" }} />
                      <div className="vr-thresh" style={{ left: `${MATCH_THRESHOLD}%` }} />
                    </div>
                    {matchGap != null && matchGap > 0 && (
                      <div className="vr-gap-note">{matchGap.toFixed(1)} pts below the {MATCH_THRESHOLD}% match threshold</div>
                    )}
                  </div>

                  <div className="vr-signal">
                    <div className="vr-signal-row">
                      <span className="k">Liveness confidence</span>
                      <span className="v">
                        {lvAnim != null ? `${lvAnim.toFixed(1)}%` : "—"}&nbsp;
                        <span className={isLive ? "pass" : "fail"}>{isLive ? "PASS" : "FAIL"}</span>
                      </span>
                    </div>
                    <div className="vr-track">
                      <div className={`vr-fill ${isLive ? "" : "fail"}`} style={{ width: grow ? `${lvVal ?? 0}%` : "0%" }} />
                      <div className="vr-thresh" style={{ left: `${LIVENESS_THRESHOLD}%` }} />
                    </div>
                  </div>
                </div>

                {info && (
                  <div className="vr-reason">
                    <div className="vr-reason-t">{info.title}</div>
                    <div className="vr-reason-b">{info.body}</div>
                    <div className="vr-reason-rec">Recommended: {info.rec}</div>
                  </div>
                )}

                <div className="vr-section-label">{verified ? "Anti-spoof & quality" : "Signal breakdown"}</div>
                <div className="vr-checks">
                  {checks.map((c) => (
                    <div className={`vr-check ${c.ok ? "" : "off"}`} key={c.t}>
                      <span className="vr-tickwrap">{c.ok ? Tick : Cross}</span>
                      <div className="vr-ctext">
                        <div className="vr-ct">{c.t}</div>
                        <div className="vr-cs">{c.s}</div>
                      </div>
                    </div>
                  ))}
                </div>
                </>
                )}

                <div className="vr-section-label">Audit record</div>
                <div className="vr-meta">
                  <div className="vr-cell">
                    <div className="k">Decision</div>
                    <div className={`v ${verified ? "teal" : "bad"}`}>{verified ? "Verified" : "Not verified"}</div>
                  </div>
                  <div className="vr-cell">
                    <div className="k">{verified ? "Reference ID" : "Reason"}</div>
                    <div className={`v ${verified ? "" : "bad"}`}>{verified ? referenceId : friendlyReason(r?.reason)}</div>
                  </div>
                  <div className="vr-cell">
                    <div className="k">{verified ? "Employee ID" : "References searched"}</div>
                    <div className="v">{verified ? summary.employeeId ?? "—" : referencesCount.toLocaleString()}</div>
                  </div>
                  <div className="vr-cell">
                    <div className="k">Channel</div>
                    <div className="v">{channelLabel}</div>
                  </div>
                  <div className="vr-cell">
                    <div className="k">Location</div>
                    <div className="v">{summary.location || "—"}</div>
                  </div>
                  <div className="vr-cell">
                    <div className="k">Timestamp</div>
                    <div className="v">{dt ? fmtTimestamp(dt) : "—"}</div>
                  </div>
                </div>

                <div className="vr-foot">
                  <div className={`vr-banner ${partial ? "review" : verified ? "" : "fail"}`}>
                    <svg className="vr-bcheck" viewBox="0 0 26 26" aria-hidden>
                      <circle cx="13" cy="13" r="12" />
                      {partial ? <path d="M13 7v7M13 18h.01" /> : verified ? <path d="M7.5 13.5 11 17l7-8" /> : <path d="M9 9l8 8M17 9l-8 8" />}
                    </svg>
                    <span className="vr-btext">
                      {partial ? "Partially verified · pending manual review" : verified ? "Identity successfully verified" : "Verification not successful"}
                    </span>
                  </div>

                  <div className="vr-actions">
                    <button
                      className={`vr-btn vr-btn-approve ${approved ? "approved" : ""}`}
                      onClick={handleApprove}
                      disabled={approving || approved}
                    >
                      {approving ? "Approving…" : approved ? "✓ Approved" : "Overwrite & Approve"}
                    </button>
                    <button className="vr-btn vr-btn-ghost" onClick={handleExport}>
                      Export report
                    </button>
                    <button className="vr-btn vr-btn-danger" onClick={handleDelete} disabled={deleting}>
                      {deleting ? "Deleting…" : "Delete record"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
