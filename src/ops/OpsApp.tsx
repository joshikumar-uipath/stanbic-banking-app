// ─────────────────────────────────────────────────────────────────────────────
// Operations Workbench (/ops) — Stanbic Account Opening console.
// The console is a self-contained page (public/ops-console.html): triage bar,
// health strip, root-cause cards, rule-promotion, review cockpit, the 47-decision
// evidence explorer, rules view, bulk failures and keyboard shortcuts. We mount
// it full-screen here so the /ops route serves it exactly as authored.
// ─────────────────────────────────────────────────────────────────────────────
import './ops.css';

export default function OpsApp() {
  return (
    <iframe
      className="ops-frame"
      src="/ops-console.html"
      title="Operations Workbench — Account Opening"
    />
  );
}
