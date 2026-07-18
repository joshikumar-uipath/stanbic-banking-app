// ─────────────────────────────────────────────────────────────────────────────
// The workspace's roles.
//
// The desk and the Operations Workbench deliberately share a design language —
// they are one platform, not two products. That only reads as intentional if the
// app says whose eyes you're looking through and lets you change them, so this
// is the single list both tools render. Keep it in step with the copy in
// public/ops-console.html, which shows the same switcher.
// ─────────────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  /** Who you are. Leads the rail — it's the thing that differs between tools. */
  name: string;
  /** The tool that role uses. */
  sub: string;
  /** What this role actually does all day — shown in the switcher. */
  blurb: string;
  href: string;
}

export const ROLES: Role[] = [
  {
    id: 'rm',
    name: 'Relationship Manager',
    sub: 'Branch desk',
    blurb: 'Open accounts, chase your own pipeline, approve, and look after your clients.',
    href: '/employee-web',
  },
  {
    id: 'ops',
    name: 'Operations analyst',
    sub: 'Exception triage',
    blurb: 'Clear stuck cases across the whole bank by cause, in bulk, and write rules so they stop.',
    href: '/ops',
  },
];

export const roleById = (id: string): Role => ROLES.find((r) => r.id === id) ?? ROLES[0];
