// The "ships-with-the-app" tenant config. Identical to the previous
// hardcoded values across components, except PII has been replaced with
// generic placeholders (e.g. "Joshi Kumar" → "John Doe") so the bundled
// demo experience is safe to hand to anyone.
//
// Tenants who configure their own AuraConfig in Data Service will see this
// merged with their overrides; until then this is what gets rendered.

import type { TenantConfig } from './types';
import { SCHEMA_VERSION } from './types';

// Brand colors. The bundled default is the "Aura AI" identity (UiPath spec:
// Robotic Orange + Agentic Teal + Deep Blue). Kept here so swapping a tenant's
// primary / accent doesn't require a rebuild.
const TEAL = '#0BA2B3';
const ORANGE = '#FA4616';
const DEEP_BLUE = '#182126';
const DARK_BLUE = '#1E6482';

export const defaultConfig: TenantConfig = {
  schemaVersion: SCHEMA_VERSION,

  // ── Branding ─────────────────────────────────────────────────────────
  branding: {
    appName: 'Aura AI',
    tagline: 'Your AI assistant, at your fingertips',
    greeting: 'Hello',
    country: 'NG',
    primaryColor: ORANGE,
    secondaryColor: TEAL,
    accentColor: TEAL,
    deepBlue: DEEP_BLUE,
    logoSize: 'large',
  },

  // ── Connection ───────────────────────────────────────────────────────
  connection: {
    // Insurance / CX-Insurance-in-WhatsApp folder. Replace per tenant.
    defaultFolderId: '2683975',
  },

  // ── Home "Recently Active" showcase carousel ─────────────────────────
  homeShowcase: [
    { name: 'Compliance',         category: 'Case',       color: ORANGE, video: './case-card.mp4',     videoScale: 1.4, exploreCategory: 'case' },
    { name: 'FinSight Agent',     category: 'Chat Agent', color: TEAL,   video: './agent-card.mp4',                       chatAgentName: 'FinSight Agent' },
    { name: 'Coverage Check',     category: 'Maestro',    color: TEAL,   video: './maestro-card.mp4',  videoScale: 2.5, exploreCategory: 'maestro' },
    { name: 'Appraisal Booking',  category: 'RPA',        color: ORANGE, video: './rpa-card.mp4',      videoScale: 3.4, exploreCategory: 'rpa' },
    { name: 'KYC',                category: 'Agent',      color: TEAL,   video: './agent-card.mp4',                       exploreCategory: 'agents' },
    { name: 'Fulfilment',         category: 'Maestro',    color: TEAL,   video: './maestro-card.mp4',  videoScale: 2.5, exploreCategory: 'maestro' },
    { name: 'Daily To-do',        category: 'Delegate',   color: TEAL,   video: './delegate-card.mp4', videoScale: 1.4, exploreCategory: 'delegate' },
    { name: 'Lending',            category: 'Case',       color: ORANGE, video: './case-card.mp4',     videoScale: 1.4, exploreCategory: 'case' },
    { name: 'HR Agent',           category: 'Chat Agent', color: TEAL,   video: './agent-card.mp4',                       chatAgentName: 'HR Assistant' },
  ],

  // ── Agents ───────────────────────────────────────────────────────────
  agents: {
    // Only these agent display names appear in the Chat Agents section.
    // Others are excluded. Order here is the display order.
    allowedChatAgentNames: [
      'HR Assistant',
      'FinSight Agent',
      'Cheque Processing Agent',
      'Claims Adjuster Agent',
    ],
    // Agents permanently hidden from all UI (matched by processKey).
    blockedProcessKeys: [
      'KCB.Conversational.Agent.agent.Agent',
      'ConversationalAgent_Prj.Agent.HR_ConvAgent',
      'Solution.53.agent.Agent',
      'Claims.Adjuster.Agent.agent.Agent',
    ],
    // Override the display name of specific agents in headers/menus.
    displayNameOverrides: {
      'Ask UiPath': 'Ask UiPath',
    },
  },

  // ── Demo content ─────────────────────────────────────────────────────
  demoContent: {
    enabled: true,
    agentInsights: [
      {
        id: '1',
        agentName: 'Claims Adjuster Agent',
        tag: 'Claims',
        tagColor: TEAL,
        summary: '3 claims reviewed — 2 auto-approved, 1 needs you',
        actions: [
          { id: 'c1', ref: 'CLM-4821', amount: '$4,200', type: 'auto', text: 'Auto collision — all documents verified. Approved & processed.' },
          { id: 'c2', ref: 'CLM-4822', amount: '$11,500', type: 'auto', text: 'Property damage — assessor report matched policy. Approved & processed.' },
          { id: 'c3', ref: 'CLM-4823', amount: '$32,000', type: 'review', text: 'Medical claim — missing hospital discharge summary. Cannot auto-approve.', reviewActions: ['Approve Anyway', 'Request Docs', 'Reject'] },
        ],
        timeAgo: '2 min ago',
        accentColor: '#1A1A1A',
      },
      {
        id: '2',
        agentName: 'Invoice Insight Agent',
        tag: 'Finance',
        tagColor: ORANGE,
        summary: '5 overdue invoices — 3 actioned, 2 need your approval',
        actions: [
          { id: 'i1', ref: 'INV-0091', amount: '$3,200', type: 'auto', text: 'Acme Corp — 14 days overdue. Follow-up email drafted & sent automatically.' },
          { id: 'i2', ref: 'INV-0097', amount: '$1,800', type: 'auto', text: 'Gamma Ltd — 9 days overdue. Reminder scheduled for next business day.' },
          { id: 'i3', ref: 'INV-0103', amount: '$1,800', type: 'auto', text: 'Epsilon Co — 7 days overdue. Added to overdue watchlist.' },
          { id: 'i4', ref: 'INV-0094', amount: '$2,750', type: 'review', text: 'Beta Solutions — 21 days overdue. Agent recommends formal escalation to collections.', reviewActions: ['Approve Escalation', 'Extend Grace', 'Discuss'] },
          { id: 'i5', ref: 'INV-0099', amount: '$2,900', type: 'review', text: 'Delta Inc — 30 days overdue. Agent recommends issuing a legal notice.', reviewActions: ['Issue Notice', 'Negotiate', 'Discuss'] },
        ],
        timeAgo: '15 min ago',
        accentColor: ORANGE,
      },
      {
        id: '3',
        agentName: 'Cheque Processing Agent',
        tag: 'Clearing',
        tagColor: DARK_BLUE,
        summary: '74 cheques processed — 2 require manual review',
        actions: [
          { id: 'k1', type: 'auto', text: '74 cheques cleared across 3 branches — total value $1.2M, avg processing time 4.2s.' },
          { id: 'k2', type: 'auto', text: 'Signature verification passed on 71 cheques — 3 flagged for mismatch, 2 auto-resolved via secondary check.' },
          { id: 'k3', type: 'auto', text: 'MICR code validation completed — 0 encoding errors detected, all routing numbers verified.' },
          { id: 'k4', type: 'review', text: 'Cheque #8842 ($45,000) — signature confidence 62%, below threshold. Payee name partially obscured. Requires manual verification.', reviewActions: ['Approve Cheque', 'Reject & Return', 'Request Re-scan'] },
          { id: 'k5', type: 'review', text: 'Cheque #8856 ($28,500) — post-dated by 14 days. Bank policy requires approval for early clearing.', reviewActions: ['Clear Now', 'Hold Until Date', 'Return to Depositor'] },
        ],
        timeAgo: '25 min ago',
        accentColor: DARK_BLUE,
      },
    ],

    // Demo Action Center tasks shown on Home before any real ones load.
    // CreationTime is computed at render time using minutesAgo.
    tasks: [
      { Id: 1001, Title: 'Property Water Damage Claim — CLM-8821', Status: 'Assigned', AssignedToUser: 'John Doe', category: 'Claim App Task', minutesAgo: 0 },
      { Id: 1002, Title: 'Vendor Invoice Approval — INV-0342', Status: 'Pending', category: 'Invoice Task', minutesAgo: 30 },
      { Id: 1003, Title: 'IT Access Request — EMP-2291', Status: 'Assigned', AssignedToUser: 'John Doe', category: 'IT Request', minutesAgo: 65 },
    ],

    // Alerts feed — daysAgo/hour/minute become absolute timestamps at render.
    alerts: [
      // ── TODAY ──────────────────────────────────────────────────────
      {
        id: 't0',
        type: 'action',
        agent: 'Action Center',
        title: 'Claim Data Verification',
        desc: 'New property claim requires verification — water damage to kitchen cabinets, flooring, and dishwasher. Total claimed: $9,600 (less $1,000 deductible). OCR extracted from handwritten form.',
        daysAgo: 0,
        hour: -1, // -1 means "use current hour" — alert appears in real time
        minute: -1,
        read: false,
        reviewActions: [
          { label: 'Review Now', style: 'primary' },
          { label: 'Dismiss', style: 'secondary' },
        ],
        reviewDetail: {
          ref: 'HO5-2021-RC-4872',
          amount: '$9,600',
          fields: [
            { label: 'Policyholder', value: 'John Doe' },
            { label: 'Policy No', value: 'HO5-2021-RC-4872' },
            { label: 'Incident', value: 'Burst pipe — kitchen water damage' },
            { label: 'Location', value: 'Kitchen, Al Furjan, Dubai' },
            { label: 'Date', value: '06 Feb 2026 · 7:15 AM' },
            { label: 'Items', value: 'Cabinets $4,800 · Flooring $3,300 · Dishwasher $1,500' },
            { label: 'Deductible', value: '$1,000' },
            { label: 'Source', value: 'Handwritten form — OCR extracted' },
          ],
        },
      },
      {
        id: 't1',
        type: 'action',
        agent: 'Claims Adjuster Agent',
        title: 'Action Required',
        desc: 'Claim #TXA-9104 needs manual review — damage estimate of $45,200 exceeds auto-approval threshold.',
        daysAgo: 0,
        hour: 14,
        minute: 32,
        read: false,
        reviewActions: [
          { label: 'Approve Claim', style: 'primary' },
          { label: 'Request More Info', style: 'secondary' },
          { label: 'Reject', style: 'danger' },
        ],
        reviewDetail: {
          ref: 'CLM-TXA-9104',
          amount: '$45,200',
          fields: [
            { label: 'Claimant', value: 'Jane Smith' },
            { label: 'Policy', value: 'AUTO-2024-887' },
            { label: 'Incident', value: 'Rear-end collision, Nairobi CBD' },
            { label: 'Filed', value: 'Apr 8, 2026' },
            { label: 'Status', value: 'Pending adjuster sign-off' },
            { label: 'Flag reason', value: 'Exceeds $40K auto-approval limit' },
          ],
        },
      },
      {
        id: 't2',
        type: 'action',
        agent: 'FinSight Agent',
        title: 'Budget Variance Alert',
        desc: 'Q1 budget exceeded in 3 departments. Marketing +27%, IT +18%, Operations +9%. Approve variance?',
        daysAgo: 0,
        hour: 11,
        minute: 15,
        read: false,
        reviewActions: [
          { label: 'Approve Variance', style: 'primary' },
          { label: 'Escalate to CFO', style: 'warning' },
          { label: 'Reject', style: 'danger' },
        ],
        reviewDetail: {
          ref: 'Q1-2026-VAR',
          fields: [
            { label: 'Period', value: 'Q1 2026 (Jan–Mar)' },
            { label: 'Marketing overspend', value: '$142,000 (+27%)' },
            { label: 'IT overspend', value: '$89,500 (+18%)' },
            { label: 'Operations overspend', value: '$34,200 (+9%)' },
            { label: 'Total variance', value: '$265,700' },
            { label: 'Recommendation', value: 'Request department heads to justify overspend before approval' },
          ],
        },
      },
      {
        id: 't3',
        type: 'success',
        agent: 'Invoice Insight Agent',
        title: 'Reconciliation Complete',
        desc: 'April vendor invoices reconciled. 2 mismatches flagged for your review. 98 invoices auto-cleared.',
        daysAgo: 0,
        hour: 9,
        minute: 45,
        read: false,
      },
      // ── YESTERDAY ──────────────────────────────────────────────────
      {
        id: 'y1',
        type: 'action',
        agent: 'Cheque Processing Agent',
        title: 'Signature Verification Required',
        desc: 'Cheque #CHQ-2291 flagged — signature mismatch detected. Drawer: Apex Supplies Ltd. Amount: $12,800.',
        daysAgo: 1,
        hour: 16,
        minute: 22,
        read: false,
        reviewActions: [
          { label: 'Verify & Clear', style: 'primary' },
          { label: 'Place on Hold', style: 'warning' },
          { label: 'Return Cheque', style: 'danger' },
        ],
        reviewDetail: {
          ref: 'CHQ-2291',
          amount: '$12,800',
          fields: [
            { label: 'Drawer', value: 'Apex Supplies Ltd' },
            { label: 'Payee', value: 'KCB Bank Kenya Ltd' },
            { label: 'Account', value: '****4821' },
            { label: 'Issue date', value: 'Apr 7, 2026' },
            { label: 'Flag', value: 'Signature does not match account specimen' },
            { label: 'Risk score', value: 'High (83/100)' },
          ],
        },
      },
      {
        id: 'y2',
        type: 'success',
        agent: 'Claims Adjuster Agent',
        title: 'Batch Processing Done',
        desc: 'Storm event FL-07 — 63 claims processed, 8 escalated for human review. $2.1M settled.',
        daysAgo: 1,
        hour: 13,
        minute: 10,
        read: true,
      },
      {
        id: 'y3',
        type: 'info',
        agent: 'FinSight Agent',
        title: 'Monthly Report Ready',
        desc: 'Monthly cash flow report is ready. Net cash position improved 12% MoM. Download or review in dashboard.',
        daysAgo: 1,
        hour: 10,
        minute: 5,
        read: true,
      },
      // ── 2 DAYS AGO ────────────────────────────────────────────────
      {
        id: 'd2a',
        type: 'warning',
        agent: 'Invoice Insight Agent',
        title: 'Overdue Escalation',
        desc: 'Supplier #67 (TechVault Ltd) payment overdue by 28 days. $8,400 outstanding. Escalation recommended.',
        daysAgo: 2,
        hour: 15,
        minute: 30,
        read: true,
      },
      {
        id: 'd2b',
        type: 'action',
        agent: 'Claims Adjuster Agent',
        title: 'Pending Adjuster Sign-off',
        desc: '3 medical claims awaiting your sign-off. Oldest claim is 6 days overdue. Combined value: $78,500.',
        daysAgo: 2,
        hour: 11,
        minute: 44,
        read: true,
        reviewActions: [
          { label: 'Review Claims', style: 'primary' },
          { label: 'Snooze 24h', style: 'secondary' },
          { label: 'Delegate', style: 'warning' },
        ],
        reviewDetail: {
          fields: [
            { label: 'Claim 1', value: 'CLM-9081 — Medical, $32,000 (6 days)' },
            { label: 'Claim 2', value: 'CLM-9094 — Medical, $28,500 (4 days)' },
            { label: 'Claim 3', value: 'CLM-9098 — Medical, $18,000 (2 days)' },
            { label: 'Policy limit', value: '$50,000 per incident' },
            { label: 'SLA breach risk', value: 'HIGH — review within 24h' },
          ],
        },
      },
      {
        id: 'd2c',
        type: 'success',
        agent: 'Cheque Processing Agent',
        title: 'End-of-Day Run Complete',
        desc: 'End-of-day cheque clearing complete. 142 cheques cleared ($4.2M), 3 returned (NSF).',
        daysAgo: 2,
        hour: 18,
        minute: 0,
        read: true,
      },
      // ── 3 DAYS AGO ────────────────────────────────────────────────
      {
        id: 'd3a',
        type: 'warning',
        agent: 'FinSight Agent',
        title: 'Spending Pattern Anomaly',
        desc: 'Unusual late-night transactions detected on corporate card #4829. 4 transactions between 01:00–03:00.',
        daysAgo: 3,
        hour: 14,
        minute: 20,
        read: true,
      },
      {
        id: 'd3b',
        type: 'success',
        agent: 'Invoice Insight Agent',
        title: 'Automated Follow-ups Sent',
        desc: 'Follow-up emails sent to 5 overdue accounts. $18,400 in outstanding invoices. Expected recovery: 3–5 days.',
        daysAgo: 3,
        hour: 10,
        minute: 55,
        read: true,
      },
      {
        id: 'd3c',
        type: 'info',
        agent: 'Claims Adjuster Agent',
        title: 'Weekly Summary',
        desc: 'Week of Apr 1–7: 217 claims processed, 94% auto-resolved, $1.2M settled. 13 escalated for review.',
        daysAgo: 3,
        hour: 9,
        minute: 0,
        read: true,
      },
      // ── 4 DAYS AGO ────────────────────────────────────────────────
      {
        id: 'd4a',
        type: 'action',
        agent: 'Invoice Insight Agent',
        title: 'Duplicate Invoice Detected',
        desc: 'Invoice INV-0241 from TechCorp appears to be a duplicate of INV-0198. Amount: $3,750. Confirm or cancel payment?',
        daysAgo: 4,
        hour: 16,
        minute: 40,
        read: true,
        reviewActions: [
          { label: 'Cancel Duplicate', style: 'danger' },
          { label: 'Confirm Both', style: 'secondary' },
          { label: 'Request Clarification', style: 'warning' },
        ],
        reviewDetail: {
          ref: 'INV-0241',
          amount: '$3,750',
          fields: [
            { label: 'Vendor', value: 'TechCorp Kenya Ltd' },
            { label: 'Original invoice', value: 'INV-0198 — Paid Mar 28, $3,750' },
            { label: 'Duplicate invoice', value: 'INV-0241 — Submitted Apr 5, $3,750' },
            { label: 'Match score', value: '97% (same amount, vendor, description)' },
            { label: 'Recommendation', value: 'Cancel INV-0241 and request confirmation from vendor' },
          ],
        },
      },
      {
        id: 'd4b',
        type: 'success',
        agent: 'FinSight Agent',
        title: 'Tax Reconciliation Complete',
        desc: 'Q1 2026 tax reconciliation complete. No discrepancies found. VAT refund of $24,100 submitted.',
        daysAgo: 4,
        hour: 11,
        minute: 30,
        read: true,
      },
      {
        id: 'd4c',
        type: 'warning',
        agent: 'Cheque Processing Agent',
        title: 'Insufficient Funds Hold',
        desc: 'Cheque #CHQ-2188 — Drawer account shows insufficient funds. Auto-hold applied. Contact drawer required.',
        daysAgo: 4,
        hour: 9,
        minute: 15,
        read: true,
      },
    ],
  },

  // ── Notifications ────────────────────────────────────────────────────
  notifications: {
    taskPollIntervalMs: 30000,
    taskPopupFilter: 'Claim Data Verification',
    taskPopupRecencyMs: 60000,
    autoDismissMs: 6000,
  },

  // ── Features ─────────────────────────────────────────────────────────
  features: {
    enableVoiceInput: true,
    enableCamera: true,
    enableSearch: true,
    enableNotifications: true,
    enableThemeToggle: true,
    enableLanguageSelector: true,
    enableDemoLogin: true,
    tabs: {
      home: true,
      chat: true,
      explore: true,
      alerts: true,
      profile: true,
    },
  },

  // ── String overrides ─────────────────────────────────────────────────
  // Empty by default — Aura uses its bundled TRANSLATIONS until an admin
  // adds language-specific overrides here. Shape: `{ [lang]: { [key]: value } }`.
  strings: {},

  // ── Operations ───────────────────────────────────────────────────────
  // The account-opening factory's operating parameters. The control tower reads
  // stpTarget; the rest describe how exceptions age, retry and route.
  operations: {
    stpTarget: 80,
    slaMinutes: 240,
    retryBackoffMins: [5, 15, 30, 60],
    routing: [
      { cause: 'Identity check failed', queue: 'Exceptions', assignTo: '' },
      { cause: 'Gateway timeout', queue: 'Retry queue', assignTo: '' },
      { cause: 'Liveness below threshold', queue: 'Manual review', assignTo: '' },
      { cause: 'Documents outstanding', queue: 'Customer chaser', assignTo: '' },
    ],
  },
};
