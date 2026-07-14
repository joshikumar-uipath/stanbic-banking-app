# Aura — Cleanup & Pre-Submission TODOs

A prioritized punch list compiled from the App Store rejection audit and the hardcoded-values / runtime-state audit (2026-04-23).

Group order: **Critical → High → Must → Code quality → Optional**.
Within each group, items are roughly ordered "least effort, most impact first."

---

## CRITICAL — Will block App Store submission

- [ ] **Decide UiPath branding authorization (#5 in audit).** App is `com.uipath.aura`, uses UiPath logo + name + APIs. Must submit from official UiPath Apple Developer team OR rebrand entirely (`com.<you>.personalagent`, drop UiPath visuals).
- [ ] **Strip secrets from the production bundle.**
  - Remove `VITE_UIPATH_SERPER_API_KEY` (`.env:11`, `vite.config.ts:29`). Move Serper proxy to a backend.
  - Remove `VITE_UIPATH_DEMO_TOKEN` (`.env:17`) from `.env.production`. Rotate the PAT — assume compromised.
  - Remove the raw JWT pasted in `.env:20` if it's still valid.
- [ ] **Disable or gate the `demo/demo` backdoor before public release.** `useAuth.tsx:216-256`. For App Review, give reviewers a real test account in App Review Notes instead.
- [ ] **Strip developer PII from mock data.** Replace "Joshi Kumar" / "joshi.kumar@uipath.com" with `John Doe` / generic emails:
  - `src/components/AlertsTab.tsx:55`
  - `src/components/HomeTab.tsx:134, 137, 636, 664`
  - `src/components/ExploreTab.tsx:1189`
  - Also "Robert Mwangi" at `AlertsTab.tsx:79`
- [ ] **Point production at production UiPath, not staging.** `.env.production:1` currently `https://staging.uipath.com`. Either flip to prod URLs or label App Store listing "Aura (Beta)".
- [ ] **Add a working privacy policy + terms of service.** `ProfileTab.tsx:135-154` — both menu items have empty `value` and no `onClick`. Host the policy somewhere public (Notion / GitHub Pages), open via `Browser.open()`.

---

## HIGH — Likely rejection or visibly broken

- [ ] **Hide / replace the mic feature on iOS.** `webkitSpeechRecognition` doesn't exist in WKWebView. Either hide the mic UI on iOS via `Capacitor.isNativePlatform()` or install `@capacitor-community/speech-recognition`.
  - Affected: `HomeTab.tsx`, `ExploreTab.tsx`, `ChatView.tsx`
- [ ] **Gate or remove mock data in production builds.** `AGENT_RUN_RESULTS` (`HomeTab.tsx:43-90`), the alerts builder (`AlertsTab.tsx:28-276`), the 3 mock Action Center tasks (`HomeTab.tsx:133-137`). Add a `VITE_DEMO_MODE` flag, or replace with empty-state UI.
- [ ] **Wire up native OAuth callback.** Currently the redirect URI is an HTTPS staging host (`mea.staging.uipath.host/aura`); WKWebView can't round-trip cross-origin. Steps:
  1. Register `aura://callback` as a valid redirect URI on the UiPath External App.
  2. Set `VITE_UIPATH_REDIRECT_URI=aura://callback` in `.env.production`.
  3. Verify `appUrlOpen` listener fires on device — scaffolded at `useAuth.tsx:106-150`.
- [ ] **Generate the full app-icon set + customize launch screen.** Currently only the 1024×1024 marketing icon is in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`. Use `appicon.co` or `cordova-res`. Update `LaunchScreen.storyboard`.

---

## MUST — Needs fixing before store

- [ ] **Add Support URL + contact email in App Store Connect.** Required by Apple 5.1.5.
- [ ] **Decide iPad support.** `ios/App/App/Info.plist:41-47` declares iPad orientations but UI is iPhone-only. Either remove the `UISupportedInterfaceOrientations~ipad` block or actually test + fix the iPad layout.
- [ ] **Set version + build numbers in Xcode.** `Info.plist:22` uses `$(MARKETING_VERSION)` placeholder. Set `MARKETING_VERSION=1.0.0` and `CURRENT_PROJECT_VERSION=1` in target build settings. Bump build number on every TestFlight upload.
- [ ] **Make the displayed app version dynamic.** `ProfileTab.tsx:137` shows hardcoded `'1.0.0'`. Read it from `App.getInfo()` (Capacitor App plugin) so it stays in sync.
- [ ] **Add offline-state handling.** API calls silently fail on network loss. Add a `navigator.onLine` check / Capacitor Network plugin and a "You're offline" banner.
- [ ] **Document the Sign-in-with-Apple exemption in App Review Notes.** Apple 4.8: "Enterprise B2B app, requires UiPath account." Pre-empts the rejection question.
- [ ] **Pull the externally-overridable parameters out of the bundle.**
  - `INSURANCE_FOLDER_ID = '2683975'` at `ExploreTab.tsx:15` — should come from env or user setting.
  - All hardcoded `staging.api.uipath.com` references (App.tsx, useAuth.tsx, ExploreTab.tsx, HomeTab.tsx) — already partially derived from env, but a few remain.

---

## Code quality — Consistency & dedup

- [ ] **De-duplicate the agent-filter lists.** `BLOCKED_PROCESS_KEYS` is defined twice with the same 4 keys:
  - `src/components/ChatHistoryTab.tsx:6-11`
  - `src/components/ChatView.tsx:174-179`
  - Move to `src/constants/agentFilters.ts` (or similar) and import from both. Same for the allowed-chat-agents whitelist (`ExploreTab.tsx:117-123`, `ChatView.tsx:193`).
- [ ] **De-duplicate the brand-color constants.** `TEAL = '#0BA2B3'` and `ORANGE = '#FA4616'` are local consts in multiple files (`App.tsx:144`, `ExploreTab.tsx:127-128`) AND defined in `ThemeContext.tsx`. Use the theme tokens everywhere.
- [ ] **Reconcile `taskNotes` vs `claimNotes` persistence inconsistency.** `HomeTab.tsx`'s `taskNotes` is in-memory only; `ExploreTab.tsx`'s `claimNotes` mirrors to localStorage (`ExploreTab.tsx:319`). Both UIs look identical — pick one behavior and apply consistently.
- [ ] **Centralize the timer / animation magic numbers.** `App.tsx:100, 141, 167, 286`, `ExploreTab.tsx:357`, `ChatView.tsx:292`, `capacitor.config.ts:21`. Move to `src/constants/timing.ts` so adjustments don't require grepping.
- [ ] **Consider removing the `homeNavPressCount` scroll-to-top hack** if there's a more idiomatic way (ref + `scrollTo`).

---

## Storage hygiene

- [ ] **Cap localStorage size for `claimNotes`.** Voice notes are stored as base64 data URLs — ~300 KB per 30-second recording. localStorage typically has a 5–10 MB quota. Add a max-entries / max-bytes cap, or move to IndexedDB.
- [ ] **Add try/catch around all localStorage `setItem` calls.** Currently `ChatView.tsx:292` and `ExploreTab.tsx:319` will throw if quota is hit, taking down the surrounding code path.
- [ ] **Encrypt or scrub sensitive fields stored in localStorage.** `pa_chat_history` and `claimNotes` may include PII / financial data. At minimum, document this in the privacy policy.

---

## Optional polish

- [ ] **Accessibility pass — `aria-label` on icon-only buttons.** Bottom nav, mic button, camera button, send button. Run axe-core in dev.
- [ ] **Bundle size.** `dist/` is ~129 MB (mostly video assets). Lazy-load videos per tab instead of preloading all 10+ in `index.html` at boot.
- [ ] **Error message granularity.** Most failure paths surface "Agent is not responding" — distinguish network / auth / agent-side errors.
- [ ] **Document the demo flow.** Add a `DEMO.md` or section in `README.md` explaining what `demo/demo` does and how to rotate the PAT.
- [ ] **Delete the merged `fix/include-attachment-name` branch** on GitHub (already merged into main).

---

## Already done in recent sessions (for the record)

- [x] Removed the green debug overlay from `index.html`
- [x] Bundled Poppins + Inter fonts locally instead of Google Fonts CDN
- [x] Locked the viewport meta to prevent input-focus auto-zoom on iOS
- [x] Unified body/screen background to `#f6f6f6` to fix Dynamic Island seam
- [x] Removed `padding-bottom` from `#root` so BottomNav extends to device edge
- [x] Reduced `pt-14` → `pt-3` in every screen header (Apple safe-area double-padding)
- [x] Tightened BottomNav padding + pill size
- [x] Increased Explore card row height to `minmax(195px, 1fr)`, then to `0` to fit all 6 in viewport
- [x] Fixed `useVideoBlob` to resolve once at mount (no tear-down reload)
- [x] Removed black-flash background under Explore card videos
- [x] Fixed `MediaRecorder` MIME mismatch causing voice-note "Error" on iOS
- [x] Added lazy `GetCurrentUser` retry in `assignTaskToMe` so the button isn't gated on initial fetch failure
- [x] Merged `fix/include-attachment-name` into `main`

---

*Last updated: 2026-04-23. When you knock items off, prefer fixing the CRITICAL block before TestFlight, the HIGH/MUST blocks before App Store submission.*
