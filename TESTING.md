# Aura — End-to-End Testing Checklist

**How to use:** Walk through the items below. For each, replace the `[ ]` with:
- `[x]` if it works
- `[!]` if it's broken (add a one-line note about what you saw)
- `[~]` to skip / not applicable right now

When you're done, paste the marked-up list (or just the `[!]` items) back to me and I'll fix the failures, then we iterate. Each round I'll re-emit a fresh copy of this list with the fixes applied.

URLs in play:
- Aura: http://localhost:5180/
- Admin: http://localhost:5180/admin/

---

## A. Admin panel — first-time setup

- [x] **A1.** `http://localhost:5180/admin/` loads without errors
- [x] **A2.** Login screen shows — username + password fields, Aura logo + ADMIN badge
- [!] **A3.** Wrong creds (e.g. `foo`/`foo`) → "Invalid credentials" message
- [!] **A4.** Right creds (`admin`/`admin`) → advances to tenant setup
- [x] **A5.** Tenant setup screen shows — Org / Tenant / Base URL / PAT fields
- [x] **A6.** Submitting with empty fields → "all required" error
- [!] **A7.** Submitting with bad PAT → "Could not verify tenant" error
- [!] **A8.** Submitting with valid org+tenant+PAT → advances to Dashboard
- [! ] **A9.** Header shows org/tenant name, my user name, schema version
- [!] **A10.** 9 tab buttons visible: Branding, Connection, Agents, Capabilities, Home Showcase, Demo Content, Notifications, Features, Strings

## B. Admin Dashboard — Data Service round-trip

- [ ] **B1.** Without `AuraConfig` entity created in Data Service, the dashboard shows "AuraConfig entity not found" warning
- [ ] **B2.** After creating the entity (see schema below), reload — warning gone, "No saved config yet" notice shows
- [ ] **B3.** Hitting Save on any tab creates the singleton record (Key='current', Version=1)
- [ ] **B4.** Notice flips to "Saved — version N" and the Save button updates to "Save (vN → vN+1)"
- [ ] **B5.** Reloading the admin page re-fetches the saved record (Version persists)
- [ ] **B6.** Editing across multiple tabs without saving → all edits stay in place when switching tabs (form state is shared)
- [ ] **B7.** Hitting Save commits all current edits across all tabs in one shot
- [ ] **B8.** Export JSON button downloads `aura-config-{org}-{tenant}-vN-{timestamp}.json`
- [ ] **B9.** Import JSON button accepts a previously exported file → loads into the form, shows "Imported …" notice
- [ ] **B10.** "Switch tenant" button → confirms, clears tenant creds, returns to Tenant Setup
- [ ] **B11.** "Logout" button → returns to Admin Login
- [ ] **B12.** Closing the tab and reopening → still logged in (8h session) and still connected to tenant

## C. Admin tabs — UI works

For each, just verify the form renders and edits stick when you switch tabs:

- [ ] **C1. Branding** — text fields, color pickers (with hex input), logo + orb URL fields
- [ ] **C2. Connection** — folder ID field
- [ ] **C3. Agents** — allowed-list textarea, blocked-list textarea, display-name override key/value rows with Add/Remove
- [ ] **C4. Capabilities** — 6 cards by default with id, label, subtitle, video, colors, visibility toggle, ↑↓ reorder, Remove, "+ Add capability"
- [ ] **C5. Home Showcase** — 9 items by default, same row pattern as Capabilities
- [ ] **C6. Demo Content** — master on/off toggle; 3 sub-tabs (Agent Insights, Mock Tasks, Alerts)
- [ ] **C6a.** Agent Insights cards expand with nested Actions editor (auto/review type, ref, amount, text, reviewActions list)
- [ ] **C6b.** Mock Tasks cards (Id, Title, Status, AssignedToUser, minutesAgo)
- [ ] **C6c.** Alerts cards (id, type select, agent, title, desc, daysAgo/hour/minute, read flag, reviewActions, reviewDetail)
- [ ] **C7. Notifications** — 4 number/text fields
- [ ] **C8. Features** — every flag has a checkbox; tabs sub-section toggles each tab on/off
- [ ] **C9. Strings** — start empty; "+ Add language" creates a tab; key/value rows; "Remove language" wipes it

## D. Aura mobile/web — first launch

- [ ] **D1.** `http://localhost:5180/` loads
- [ ] **D2.** First time (cleared localStorage) → ConnectTenant screen shows with Aura branding orb + "Connect to your UiPath tenant"
- [ ] **D3.** Three required fields (org/tenant/clientId) + collapsible "Advanced"
- [ ] **D4.** Empty submit → error message
- [ ] **D5.** Filled submit → drops into the regular login screen
- [ ] **D6.** "Sign in with UiPath" → real SSO works (assuming OAuth client + redirect URI are configured)
- [ ] **D7.** Demo `demo`/`demo` login still works (assuming `VITE_UIPATH_DEMO_TOKEN` set)

## E. Aura mobile/web — config visibly drives the UI

After saving an admin change, hard-refresh Aura and confirm the change is visible:

- [ ] **E1.** Change `branding.appName` → "Aura" → "Atlas" in admin → Aura's login screen shows "Atlas"
- [ ] **E2.** Change `branding.tagline` → reflected on login screen
- [ ] **E3.** Change `branding.greeting` (e.g. "Hello" → "Hola") → reflected on Home tab after login
- [ ] **E4.** Change `branding.primaryColor` → CTA buttons (Sign in with UiPath, etc.) re-color
- [ ] **E5.** Change `branding.accentColor` → bottom-nav active pill, accents re-color
- [ ] **E6.** Toggle a Feature flag off (e.g. `enableSearch`) → search button hides in Chat
- [ ] **E7.** Hide a tab (e.g. Alerts) → bottom nav drops that tab
- [ ] **E8.** Toggle `demoContent.enabled` off → Agent Insights section + mock tasks empty on Home; Alerts tab empty
- [ ] **E9.** Change `notifications.taskPopupFilter` to a string in your real tasks → banner pops up for matching task
- [ ] **E10.** Edit `agents.allowedChatAgentNames` → only those agents show in Chat tab
- [ ] **E11.** Add an entry to `agents.displayNameOverrides` → the agent name in Chat header changes
- [ ] **E12.** Edit a Capability label/subtitle/video → the Explore tile updates
- [ ] **E13.** Toggle a Capability `visible: false` → tile disappears from the Explore grid
- [ ] **E14.** Reorder Capabilities → grid order matches admin order
- [ ] **E15.** Edit a Home Showcase item name/color → carousel updates
- [ ] **E16.** Edit a Demo Content > Alert title → Alerts tab shows the new title

## F. Aura — tenant switching

- [ ] **F1.** Profile tab → "Switch tenant" button visible
- [ ] **F2.** Tap → confirmation sheet appears
- [ ] **F3.** Confirm → returns to ConnectTenant (already-typed values cleared)
- [ ] **F4.** Re-entering a different org/tenant → fresh login flow + fresh AuraConfig fetch

## G. Caching / offline behavior

- [ ] **G1.** Hard refresh after first SSO → second load uses cached config (no network blink)
- [ ] **G2.** Devtools → Application → Local Storage shows `aura_tenant_config_v1:{org}/{tenant}` after sign-in
- [ ] **G3.** Disabling network and reloading → app still renders with cached config; no white screen
- [ ] **G4.** Re-enabling network → next launch refreshes config from Data Service

## H. iOS simulator

(Optional — only relevant if you re-run `npx cap sync ios && npx cap run ios`.)

- [ ] **H1.** First-launch ConnectTenant screen renders correctly
- [ ] **H2.** All five tabs reachable
- [ ] **H3.** "Switch tenant" from Profile works on device

---

## Required Data Service entity (one-time setup per tenant)

Before any admin Save can succeed, create this in Data Service → Entities → New:

```
Entity name: AuraConfig

Fields:
  Key         Text (length 64), unique, indexed
  ConfigJson  Long Text (max length 8000+)
  Version     Number
  UpdatedAt   DateTime
  UpdatedBy   Text (length 256)
```

The admin will create the singleton record (Key='current') on first save.

---

## How to flag failures

After running through the items above:

**Option 1 (quickest)** — paste this back to me with `[!]` next to broken items, e.g.:
```
[x] A1. Admin URL loads
[!] A8. Right creds → "Connect" button doesn't do anything, no error
[!] B3. Save POSTs but Data Service returns 400, response: {…}
[x] C1. Branding edits stick
…
```

**Option 2** — just say something like *"E5, E13 are broken"* and I'll dig into those.

I'll fix every flagged item, re-run the build, and emit a fresh copy of this list. We iterate until everything is `[x]`.
