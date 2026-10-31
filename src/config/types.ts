// Source-of-truth types for the runtime tenant configuration.
//
// Phase 0: every value here was previously hardcoded in components. The
// admin app (Phase 3+) will produce JSON matching this shape, store it in
// the Data Service entity AuraConfig, and Aura will hydrate from it after
// SSO. Until then the bundled defaultConfig in ./default.ts is the only
// source.
//
// Schema version is bumped any time this shape changes incompatibly.
// Older cached configs run through ./migrate.ts before being applied.

import type { CountryCode } from './countries';

export const SCHEMA_VERSION = 1;

// ── Branding ─────────────────────────────────────────────────────────────
// Orb videos ship with the app from src/brandAssets.ts. Strings, colors, and
// an optional customer logo live here.
export interface Branding {
  appName: string;
  tagline: string;
  greeting: string;
  /** ISO country code driving all market-specific demo content — currency,
   *  people names, phone/ID formats, KYC authority labels. See config/countries.ts.
   *  Undefined → Nigeria (the bundled baseline). Backfilled by migrate.ts. */
  country?: CountryCode;
  primaryColor: string;
  /** A subtle, less-prominent brand color used alongside primary (e.g. the
   *  alternating Home showcase accents). Distinct from `accentColor`. */
  secondaryColor: string;
  accentColor: string;
  deepBlue: string;
  /** Optional customer logo shown on the welcome/guest screen. A data URI
   *  (uploaded in the admin) or an image URL. Empty/undefined → no logo (the
   *  app name text shows on its own, as before). */
  logo?: string;
  /** Optional logo variant for dark surfaces (navy nav rails): the artwork with
   *  a transparent background, so it blends onto the rail instead of showing its
   *  own plate as a box. Falls back to `logo` when unset. */
  logoLight?: string;
  /** How large the logo renders on the welcome/login screens. Chosen in the
   *  admin (Branding) so wide vs. compact logos can be sized without re-cropping
   *  the image. Undefined → 'large' (the original size). */
  logoSize?: LogoSize;
  /** Browser-tab icon (favicon). A data URI (uploaded in the admin) or an image
   *  URL; a square PNG/SVG works best. Empty → the bundled default. Applied to
   *  every surface's <link rel="icon"> by the brand bridges. */
  favicon?: string;
  /** Formal bank name for document headers ("First Bank of Nigeria Limited").
   *  Empty → derived from `appName` (see config/bank.ts). */
  legalName?: string;
  /** Host used in the customer's KYC link ("kyc.firstbanknigeria.com").
   *  Empty → derived from `appName`. */
  kycDomain?: string;
}

export type LogoSize = 'small' | 'medium' | 'large';

/** Pixel caps per logo size — applied to the welcome/login logo <img>. */
export const LOGO_SIZES: Record<LogoSize, { maxHeight: number; maxWidth: string }> = {
  small: { maxHeight: 42, maxWidth: '40%' },
  medium: { maxHeight: 64, maxWidth: '58%' },
  large: { maxHeight: 96, maxWidth: '84%' },
};

// ── Agent curation ───────────────────────────────────────────────────────
export interface AgentsConfig {
  allowedChatAgentNames: string[];
  blockedProcessKeys: string[];
  displayNameOverrides: Record<string, string>;
}

// ── Demo content ─────────────────────────────────────────────────────────
export interface AgentActionItem {
  id: string;
  ref?: string;
  amount?: string;
  type: 'auto' | 'review';
  text: string;
  reviewActions?: string[];
}

export interface AgentRunResult {
  id: string;
  agentName: string;
  tag: string;
  tagColor: string;
  summary: string;
  actions: AgentActionItem[];
  timeAgo: string;
  accentColor: string;
}

export interface MockActionCenterTask {
  Id: number;
  Title: string;
  Status: string;
  AssignedToUser?: string;
  // Bold category label shown above the task title on Home (e.g. "Invoice
  // Task"). Defaults to "Claim App Task" if missing.
  category?: string;
  // CreationTime is generated at render time (relative to "now") so demo
  // alerts stay fresh — see HomeTab task initializer.
  minutesAgo?: number;
}

export interface MockAlertField {
  label: string;
  value: string;
}

export interface MockAlertReviewAction {
  label: string;
  style: 'primary' | 'secondary' | 'danger' | 'warning';
}

export interface MockAlertReviewDetail {
  ref?: string;
  amount?: string;
  fields: MockAlertField[];
}

export interface MockAlert {
  id: string;
  type: 'action' | 'success' | 'warning' | 'info';
  agent: string;
  title: string;
  desc: string;
  // When the alert "happened," in days/hours/minutes ago — translated to
  // an absolute timestamp by AlertsTab at render time so the list always
  // reads as "TODAY" / "YESTERDAY" relative to the current device clock.
  daysAgo: number;
  hour: number;
  minute: number;
  read: boolean;
  reviewActions?: MockAlertReviewAction[];
  reviewDetail?: MockAlertReviewDetail;
}

export interface DemoContent {
  enabled: boolean;
  agentInsights: AgentRunResult[];
  tasks: MockActionCenterTask[];
  alerts: MockAlert[];
}

// ── Notifications ────────────────────────────────────────────────────────
export interface NotificationsConfig {
  taskPollIntervalMs: number;
  taskPopupFilter: string;
  taskPopupRecencyMs: number;
  autoDismissMs: number;
}

// ── Feature flags ────────────────────────────────────────────────────────
export interface FeatureFlags {
  enableVoiceInput: boolean;
  enableCamera: boolean;
  enableSearch: boolean;
  enableNotifications: boolean;
  enableThemeToggle: boolean;
  enableLanguageSelector: boolean;
  enableDemoLogin: boolean;
  tabs: {
    home: boolean;
    chat: boolean;
    explore: boolean;
    alerts: boolean;
    profile: boolean;
  };
}

// ── Home showcase carousel ───────────────────────────────────────────────
export interface ShowcaseItem {
  name: string;
  category: string;
  color: string;
  video: string;
  videoScale?: number;
  chatAgentName?: string;
  exploreCategory?: string;
}

// ── Strings (i18n overrides) ─────────────────────────────────────────────
// Each language is a flat key→value override. Aura merges these on top of
// the bundled TRANSLATIONS in ThemeContext at runtime, so admins can change
// individual strings without supplying every key.
export type StringsConfig = Record<string, Record<string, string>>;

// ── Connection ───────────────────────────────────────────────────────────
// Phase 0: only the Orchestrator folder ID currently lives here. Other
// connection settings (baseUrl, orgName, tenantName, clientId, redirectUri,
// scope) remain env-driven until Phase 1 ships the first-launch tenant
// selection screen, after which the full set will populate this section.
export interface ConnectionConfig {
  defaultFolderId: string;
}

// ── Operations ─────────────────────────────────────────────────────────────
// The account-opening factory's operating parameters: the straight-through goal
// the control tower measures against, how long an exception may age before it
// breaches SLA, the retry backoff the validation robots follow, and the rules
// that route each kind of exception to a queue (and optionally an owner).
export interface RoutingRule {
  /** The exception cause this rule matches, e.g. "Identity check failed". */
  cause: string;
  /** The queue it routes into, e.g. "Exceptions", "Retry queue". */
  queue: string;
  /** Optional default assignee; empty = leave unassigned for triage. */
  assignTo?: string;
}
export interface OperationsConfig {
  /** Straight-through-processing target, percent (control tower compares to it). */
  stpTarget: number;
  /** Minutes an exception may age before it breaches SLA. */
  slaMinutes: number;
  /** Retry backoff in minutes between validation attempts, e.g. [5,15,30,60]. */
  retryBackoffMins: number[];
  /** Cause → queue (+ optional owner) routing rules. */
  routing: RoutingRule[];
}

// ── Employee app roles ───────────────────────────────────────────────────
// Who the banker's phone opens as. One app serves the branch and the back
// office: a Relationship Manager in the field, the two bulk-opening operators
// (maker and verifier, kept apart by §9.1), and the operations analyst who
// triages the whole bank's exceptions. The admin picks the role a fresh install
// starts in and which roles a user may switch between.
export type EmployeeRole = 'rm' | 'maker' | 'verifier' | 'ops';
export interface EmployeeAppConfig {
  /** The role the employee app opens in when the user hasn't picked one. */
  defaultRole: EmployeeRole;
  /** Roles offered in the in-app switcher. The default is always included. */
  roles: EmployeeRole[];
  /** When false the switcher is hidden and everyone works as the default role. */
  allowSwitch: boolean;
}

// ── Top-level ────────────────────────────────────────────────────────────
export interface TenantConfig {
  schemaVersion: number;
  branding: Branding;
  connection: ConnectionConfig;
  agents: AgentsConfig;
  homeShowcase: ShowcaseItem[];
  demoContent: DemoContent;
  notifications: NotificationsConfig;
  features: FeatureFlags;
  strings: StringsConfig;
  /** Optional so older saved configs stay valid; migrate.ts backfills the default. */
  operations?: OperationsConfig;
  /** Optional for the same reason; migrate.ts backfills the default. */
  employeeApp?: EmployeeAppConfig;
}
