# Handover — Stanbic IBTC account opening POC

The bulk account opening work has its own handover: [HANDOVER-BULK.md](HANDOVER-BULK.md).

## Feature guide

- **Feature guide** (2026-09-26): `public/guide/` — every persona and flow as numbered steps with a real
  screenshot, plus coverage of all 77 requirements in the Bulk Account Opening BRD v1.0 with an honest status.
  Served at `/guide/index.html` (dev: http://localhost:5180/guide/index.html) and linked from the launcher's
  banner, its "Behind the scenes" list and each persona card. Rebuild with `python3 public/guide/build.py`;
  retake screenshots with `public/guide/capture/` (read its README first — this app writes to the tenant on page load).

## Demo walkthrough

`public/walkthrough/` (built 2026-10-07 from `walkthrough-kit`): a player that plays three journeys
through the real apps, screen by screen, with an animated cursor and a caption per step. The frames
are real screenshots, captured once from the running app. Served at `/walkthrough/index.html`
(dev: http://localhost:5180/walkthrough/index.html — the bare `/walkthrough/` falls through to the
app, which shows the launcher) and linked from the launcher's tools as "Demo walkthrough".
FirstBank theme throughout.

- **Individual** — Olumuyiwa Dada brings his completed paper form to the Alapere branch; the RM
  uploads it and submits, then completes KYC with him at the desk (documents, the face check — a
  recorded clip from the live Azure service — and his signature). The case then runs Intake →
  Closure on the desk: the voice agent calls him about a watchlist name match, the NIMC/NIBSS calls
  and document rules, the approvals, then Finacle, Kafka and comms — and finally the case in UiPath
  Maestro itself: a live OnboardingCase instance on staging (its case plan, the stage it is parked
  at, the execution trail), opened read-only.
- **Corporate** — ABA Integrated Solutions Ltd from its corporate form: business details,
  directors, the corporate stages, account in Finacle.
- **Bulk** — a Lagos State Government staff batch from `fixtures-firstbank/bulk/document-package.zip`:
  intake with its five rejections, maker review, verifier authorisation.
- **Relationship manager** — My desk (next move, the numbers, the queue), Approvals (maker-checker,
  dual approval above their limit), Clients (Customer 360 with next best actions).
- **Operations analyst** (7 scenes) — the workbench (health strip, triage banner, views, pipeline
  queues, upstream health); root causes with one fix for all; working a name-mismatch case side by
  side; the 47-decision pattern, its threshold slider and Promote (run after the case: promoting
  auto-settles open name mismatches); a bulk payroll failure retried for its 12 rows only; the
  onboarding automation rules and their DMN; and the Document rules DMN edited live (utility-bill
  window 90 → 60 days, saved, shown in View, then Reset to default so later runs start clean).

Chat, Explore agents, Alerts and Profile on the RM rail are generic platform panels (Alerts shows
insurance-claim samples), so the tour leaves them out.

Both journeys start on the branch desk, not the customer app: the desk lists only branch-captured
records (`source` rm/branch), and a customer's own application never appears there.

**Nothing is written while capturing.** `capture/overlay.cjs` answers every non-read request in the
test browser (on every host) and lists it in `writes`; every `AOF*` Data Fabric read comes back empty,
so no colleague's live case can appear. Maestro is simulated: Submit gets a walkthrough instance, the
desk's Approve completes its parked task and moves the stage. The record's automated outcomes
(validations passed, the Finacle account, activation) run through a dev-only hook,
`src/demo/walkthroughEngine.ts` (loaded from `main.tsx` only when `import.meta.env.DEV`), with the same
store writes as `src/demo/story.ts`.

**Voice agent and face check, without the live services.** The voice agent's call is simulated in
the overlay (`ov.call(instance, 'start'|'end')`): a secondary "Voice Agent" stage with "Speaking to
Customer", which is what the desk reads as "on a call". The call popup itself is never opened — it
frames the live voice service, which places real calls over WebSocket/WebRTC; the overlay refuses that
host outright, and AWS (FaceID backend, Cognito, Rekognition) too. The KYC selfie step still runs in
the capture (no frames are taken of it): an init script points its FaceID frame at this app's own port
of the kiosk (`#faceid-kiosk`), with `capture/fake-camera.y4m` as the camera (`python3 make-camera.py`;
37 MB, gitignored).

**The face check is a recorded clip, not the capture.** In "KYC with him at the desk", after
*Complete KYC with them now*, the player plays `public/walkthrough/recorded/face/face-check.mp4`:
0:41–0:55 of the Hackathon submission video *Intelligent Banking Onboarding with Power Apps, UiPath
Maestro, and AI-Driven Test Automation* (OneDrive, Hackweek 2026 / Microsoft Hackathon) — documents,
Azure liveness, identify, verification complete, the Verify result card. It is a real run on the live
service in another demo tenant (UiBank), so it shows a real person; the passport used as the reference
on file is blurred except its photo, on every frame from 0:51.9. Cropped to 16:10 at 1440x900, no
audio, 0.85 MB. `lib.cjs` `R.video()` makes it a frame (poster `face-check-poster.jpg`); `player.js`
plays any frame with `video` over the screen until it ends. The KYC steps still run in the capture
browser (without frames) so the record carries liveness and signature.

**The voice agent scene ends with two recorded clips** from the same video, in
`public/walkthrough/recorded/voice/`: `screening-call.mp4` (0:57.8–1:05.8 — the desk's red "on a call"
card and Maestro's Voice Agent stage running) and `rm-call.mp4` (0:29.1–0:34.4 — the RM's next best
action "Call Olumuyiwa about the missing documents" and the call panel's live transcript). Same crop and
encoding as the face clip; no identity documents on screen, so nothing is blurred.

**The Maestro scene needs a staging session.** It opens a real instance
(`capture/config.cjs` → `apps.maestro`) in the capture profile, so that profile must be signed in to
staging once: run a visible Chrome on `$TMPDIR/wt-aof-profile`, sign in, close it. The overlay lets
only the staging token exchange (`identity_/connect/token`) through, recorded as AUTH; Maestro's other
background POSTs (telemetry, notifications, licence check, chat hub) are answered locally, and Pause /
Cancel are never clicked. If the session expires the scene fails and the old walkthrough is kept.

**The scanned forms are redacted copies.** The frames show the page images, and the two FirstBank
sample forms carry handwritten BVN/NIN/account numbers. `fixtures-firstbank/redacted/` holds copies
with identifiers and signatures blacked out (rebuild: `python3 scripts/redact-forms.py "<folder with
the originals>"`); `src/fixtures/redactedCopies.ts` maps each copy's SHA-256 to its original's masked
transcription. Rebuilding the copies changes their SHA — update that map.

**Two brands, one player.** `walkthrough/index.html` plays the FirstBank capture (`frames/`,
`walkthrough.json`); `walkthrough/index.html?brand=stanbic` plays the Stanbic IBTC one (`stanbic/frames/`,
`stanbic/walkthrough.json`, Stanbic logo and colours) — `config.js` picks by `?brand=`. The launcher's
"Demo walkthrough" link follows the active admin branding (`walkthroughFor` in `src/skeleton/index.tsx`).
Capture per brand with `BRAND=stanbic node run.cjs` (default FirstBank); `capture/config.cjs` → `story`
holds what differs: bank name, branch, forms, company, bulk package. Stanbic: theme from the AuraConfig
profile "Stanbic IBTC" v5 (exported to `public/guide/capture/stanbic-theme.json`), Alausa branch, the
corporate journey on Stanbic's own entity form (George Emore Technical Enterprises Ltd, redacted copy in
`fixtures/redacted/`, read with its existing masked transcription), bulk from `fixtures/bulk/`. **There is
no Stanbic individual form** — `Stanbic IBTC/Forms/AOF Individual.PDF` and `AOF Corporate.PDF` are
byte-identical to the FirstBank ones — so the Stanbic individual journey is captured on the desk (typed)
instead of uploaded. Give `story.individual.form` a redacted Stanbic form to switch it to upload.

**Four application flows, each end to end** (2026-10-22). The applications are split by who and by
how the form arrives — *Individual · upload*, *Individual · fill in*, *Corporate · upload*,
*Corporate · fill in* — each its own act, then Bulk, Customer, RM, Operations and Behind the scenes.
The player shows **one flow at a time**: the Flow dropdown left of the screen picks it (account-opening
flows first, then "More"), and the header, the scene list and the counter show only that flow's scenes.
Play runs the flow to its end. A link to a scene (`#corpf-apply`) opens its flow. The header labels
each scene with a word or two (`TAGS` in `scenes.cjs`, saved on the scene as `tag`; the full title is
the tooltip), and shows the short title "Walkthrough" beside the logo (`shortTitle` in `config.js`). In `scenes.cjs`, `individualFlow()` / `corporateFlow()`
are the shared journey: only the way in differs (`upload`), and each flow runs the shared scenes for
its own record, so the reference, case and account on screen are always that flow's. A scene that
shows nothing of the record sets `same: '<scene id>'` and reuses that scene's frames (the Maestro
scene in the second individual flow). Individual captions take the person and pronouns from `who`
(Olumuyiwa by default; `story.individual.who` for the person on an uploaded form). *Corporate · fill
in* types a generated demo business, Nwosu Logistics Enterprises (`CORPORATE_TYPED` in `config.cjs`).
**Stanbic has no *Individual · upload* yet**: it appears once `story.individual.form` is set. Without a
staging session, take the Maestro scene from the live capture: `KEEP=indf-maestro=ind-maestro` (new
scene id = scene in the current `walkthrough.json`). `ONLY_SCENES=launch,corpf-apply,…` runs a trial of
just those scenes into `frames.next/` and never swaps it in.

**Re-capture** (≈10 min; the dev server on :5180 must be running; run `python3 make-camera.py` once first):

```
cd public/walkthrough/capture
PW=/Users/joshikumar/.uipath-skills/playwright/node_modules/playwright-core node run.cjs              # FirstBank
BRAND=stanbic PW=/Users/joshikumar/.uipath-skills/playwright/node_modules/playwright-core node run.cjs  # Stanbic IBTC
```

It clears the browser profile's storage (`$TMPDIR/wt-aof-profile`, no sign-in needed — the app has
its own token), runs every scene, and replaces `frames/` and `walkthrough.json` only if all succeed.
To work on scenes: `node explore.cjs` (same `PW`) and drive it with `dev.cjs` (`run(page, state, from, to)`).

## Found while shooting the guide (not fixed)

- **New records can inherit someone else's live case.** Application ids come from a per-browser counter
  (`aof_app_seq`), and links to Maestro instances are shared through Data Fabric `AOFMaestroLink`. In a fresh
  browser the next id (e.g. AO-2026-000389) can already be linked by another session, and the new record then
  shows that session's case on its status screen and the desk.
- **Opening any route writes to the tenant**: `maestro.ts` inserts missing hero rows into `AOFMaestroLink` on load.
- `VITE_UIPATH_DEMO_TOKEN` in `.env` was valid on 2026-09-26 (HANDOVER-BULK.md §8 says it had expired).
- On an AOP-bundle row, the customer sheet's Documents pane says "A manifest customer fills the form
  themselves" — the manifest wording shown for the wrong channel.
