# Handover — Bulk account opening

Written 2026-09-25 for whoever picks this up next. Everything below is
**uncommitted working-tree state** on branch `account-opening-workspace`
(head `1c2c276`). Nothing has been pushed.

---

## 1. What this is

Bulk account opening, built against **`Bulk Account Opening BRD.docx`**
(Version 1.0, July 2026 — in the user's OneDrive `Mac-Downloads`). The BRD
covers two intake channels for retail (Employee Value Banking) and business
(Business Name / Sole Trader) customers, with a target of 1,000 accounts a
working day and at least 90% auto-completion.

**Prototype first, then build.** The screens were agreed on a Design canvas
before any code was written:

> https://claude.ai/artifact/SSodsTjG1cLYrm52wgNieg

That canvas has three planning boards (A: where the screens live in the rail,
B: every screen by owner, C: the manifest channel outline) above eight
clickable AOP-bundle screens. **Read board A before changing the navigation** —
it is the argument for why bulk left the right pane.

---

## 2. Where it lives, and why

A new rail item **Bulk opening**, between *Open an account* and *Approvals*,
rendering **full width**.

It is NOT a new route. `DeskShell.tsx` gained `dest === 'bulk'`. The shell
already spans the window — it is `Opening.tsx` that imposes the two-pane
`.dk-split` grid, and the new destination simply does not use it.

**Why it could not stay in the right pane** (this is board A's argument):

- the pane is roughly half the window, which capped the intake preview at 8 rows
- `BatchProgress` rendered every row unvirtualised and re-sorted on every store
  event — 200 rows × ~5 transitions each ≈ 1000 full re-renders per batch
- the review checkpoint is a side-by-side document view and does not fit at all,
  the same reason the capture wizard became a centred overlay

The **Bulk upload** button stayed exactly where it was in *Open an account* —
that is where an RM reaches for it — and now navigates instead of opening a pane.

`src/employee/screens/BulkUpload.tsx` is **deleted**, fully replaced.

---

## 3. Files

**New — `src/employee/bulk/` (11 files, ~2,200 lines)**

| File | What it is |
|---|---|
| `BulkOpening.tsx` | Container: batch picker, screen tabs, persona switch, queue counts |
| `Intake.tsx` | Screens 1, 2, 9 — channel choice, upload, intake validation + rejections |
| `Monitor.tsx` | Screens 3, 8 — windowed batch table, service health, completion banner |
| `Worklist.tsx` | Screen 4 — the maker's queue, lowest confidence first |
| `Review.tsx` | Screen 5 — **the checkpoint BR-DOC-10 makes mandatory** |
| `Authorise.tsx` | Screen 6 — verifier, PND by rule, deferral override |
| `ExceptionCase.tsx` | Screen 7 — trigger, evidence pack, disposition |
| `Invites.tsx` | Screens 10, 12 — manifest funnel and bulk chase |
| `engine.ts` | The process: intake checks, verifications, reconciliation, §9.1 table, PND |
| `zip.ts` | Real archive reading — central directory, local headers, raw inflate, byte-sniffed media types |
| `CustomerSheet.tsx` | One customer in full: Case (the existing CaseDetail, whole) · Documents · Extraction |
| `docs.ts` | caseId → its documents, in memory for the session (see §4) |
| `DocViewer.tsx` | The document reader: modal, a tab per document, honest placeholder for the sample bundle |
| `batches.ts` | Batch metadata + intake rejections, localStorage-backed |
| `bulk.css` | Styles — inherits every token from `desk.css`, redefines nothing |

**Modified**

- `onboarding/types.ts` — bulk domain model (see §4)
- `onboarding/store.ts` — passes the new fields through `create()`
- `employee/DeskShell.tsx` — rail item, `persona` state, `onBulk`
- `employee/roles.ts` — `PERSONAS` beside the tool `ROLES`
- `employee/RoleSwitch.tsx` — optional `persona` prop so the rail tells the truth
- `employee/screens/Opening.tsx` — `BULK` pane mode removed, button navigates
- `customer/Apply.tsx` — unrelated: individual submit now starts its Maestro case

---

## 4. Design decisions you should not undo without reading this

**`ValidationKind` was deliberately NOT widened.** The BRD needs six more
checks (TIN, CAC, ID doc, sanctions, watchlist, adverse media). That union is
keyed exhaustively by the tower, the Ops workbench and the customer app, so
widening it would reshape all three for a gap none of them has. They live in a
separate `VerificationKind` / `Verification[]` on the case instead.

**Batch metadata is not in the store.** A row rejected at intake never became
a case, so there is nowhere on the store to hang it. `batches.ts` keeps it in
localStorage rather than adding a second entity to the store abstraction (and a
second table to every backend it might later front).

**Maker/checker is personas, not tools.** §9.1 keeps them apart; both jobs are
on this desk and reuse React screens, so `roles.ts` gained `PERSONAS`
(`rm | maker | verifier`). `Role.href` stays **required** — personas got their
own `PersonaRole` type rather than making it optional, which had broken the
launcher (`skeleton/index.tsx` reads `RM.href`).

**`MAESTRO_CAP = 8`.** Only the front of each batch gets a real orchestration.
200 live instances against a shared demo tenant would take minutes and leave a
mess. The monitor says which rows are live rather than implying all of them are.

**The sample bundle's documents are a marked placeholder, never a drawing of a
document.** The sample is synthesised from file names and has no bytes behind
it. `DocViewer` says so on the page. Painting a plausible-looking scan there
would make the demo appear to have read a document it has never seen — the one
claim this screen must not make.

**Blob URLs are created AND revoked inside the same effect** in `DocViewer`.
Minting one in a `useMemo` and revoking it in an effect cleanup looks
equivalent and is not: StrictMode double-invokes effects in dev, so the first
cleanup revoked a URL the memo would not recreate and every image failed with
`ERR_FILE_NOT_FOUND`.

**The customer sheet embeds `CaseDetail` whole rather than reimplementing it.**
A bulk row is an ordinary `OnboardingCase`, so that component already renders
its Maestro stage, next best action, checks and timeline. Three tabs, not four:
`CaseDetail` carries its own Activity tab, which is why there is no separate
Timeline. Writing a second customer view would mean two that drift apart.

**Documents live in memory for the session** (`docs.ts`), keyed by case id. They
cannot ride on the case: the store serialises one to a 4KB JSON column and a
scan is three orders of magnitude past that. A reload loses them and the sheet
says so, rather than showing an empty pane and letting you assume nothing was
attached. The real fix is the evidence store (BR-DOC-09), not built.

**The decision column shows the LIVE position, not `c.decision`.** That field
records the routing the rule engine chose and never moves, so a row a maker had
already confirmed still read "Awaiting review" — telling an RM someone has to
look at something nobody does. `decisionLabel()` in `Monitor.tsx` prefers the
current state wherever they differ.

**Persona gating is enforced in TWO places, on purpose.** `BulkOpening`'s guard
effect depends on `[persona, screen]` — depending on `persona` alone let a
screen set from elsewhere stick, and an RM clicking "Awaiting review" in the
batch table landed in the maker's tool with the rail still reading Relationship
Manager. The second place is `Monitor`, which only offers that link to a maker
at all: bouncing someone out of a screen they should never have seen is a worse
answer than not showing them the door. §9.1 is the reason both exist.

**`Review` is keyed by application id** in `BulkOpening.tsx`. Without the
remount, one customer's in-progress corrections and the `busy` flag carry onto
the next. The capture wizard already learned this — see `captureSeq`.

---

## 5. Verified working

Walked in a browser, not just compiled:

- **AOP bundle:** 9 documents → 3 rejected at intake with specific reasons → 6
  processed → 5 reviewed by the maker → authorised by the verifier → **5 accounts
  opened, 1 exception held back**
- **Manifest:** 12 invited, 5 straight through with no human touch (correct —
  the customer typed their own details, so there is nothing to confirm)
- **Exception screen:** trigger stated as *"AOP reads 14/03/1984, NIMC response
  reads 14/03/1979"*, 14 evidence rows, disposition refusing to enable without a
  reason code and a note
- **Edit logging** checked against the store directly: the one field changed
  recorded `{field, before, after, at, by}`; untouched applications recorded nothing

`npm run build` is clean.

### Bugs found and fixed while testing

1. **Signed shift on an unsigned hash** — `hash()` returns unsigned 32-bit but
   `>>` is the signed shift, so above 2³¹ the modulo went negative and
   confidences rendered as 18% from a formula whose floor is 58%. Now `>>>`.
2. **`Review` not keyed** — approving once left `busy` true and stalled the queue.
3. **Missing grid tracks** collapsed the bundle preview into one column.
4. **Funnel and stat strip disagreed** — "Opened the link 0" beside a bar saying 5.

---

## 6. The naming overlap — DONE 2026-09-25

The user asked: *"what is this page for open account and bulk account. are they
same? what is the purpose?"* — and they are right that it is confusing.

**Intended split:** *My desk* = what needs you, ranked. *Open an account* = a
directory of every application however it arrived. *Bulk opening* = a workbench
for one batch, holding the four things that have no meaning for a single capture
(intake rejections, maker review, verifier authorisation, invitations).

**Why it reads as duplication:** *Open an account* still has a Bulk/Single
source filter; batch groups appear in both; and both names contain "open".

**Agreed and shipped:**

1. Rail item renamed *Bulk opening* → **Batches** — named for the unit of work,
   not the act, so it no longer shares a verb with *Open an account*.
2. The Bulk/Single source filter is **gone** from *Open an account*. Slicing that
   list to "Bulk" produced a worse version of the workbench — same rows, none of
   the queues — which was most of the duplication. `source` is pinned to `'all'`
   there; `caseFilters.ts` still exports `SOURCES` because **My desk still uses
   it**, and that screen is a personal to-do list rather than a directory.
3. In its place, a cross-link row above the list: *"11 batches in flight · 9 need
   a person — Open in Batches →"*. It only appears when there is a batch in
   flight, and the second number counts rows parked on a maker or verifier.
4. Not needed — batch groups **already** default to collapsed
   (`storedOpen` in `Opening.tsx` returns `g.kind === 'direct'`).

The split now reads: *Open an account* is the **directory** (every application,
however it arrived — finding a person should not require knowing how they came
in); *Batches* is the **workbench** (one batch, with the queues that have no
meaning for a single capture).

New CSS: `.dk-across` in `desk.css`.

---

## 7. Still outstanding against the BRD

| Gap | State |
|---|---|
| **Documents are now READ, but not EXTRACTED** | `bulk/zip.ts` decompresses a real archive (stored + deflate, via `DecompressionStream`) and `bulk/DocViewer.tsx` renders it — images, PDFs and text, tabbed per document, opened from an intake row. What still does NOT happen is reading DATA off those documents: `fieldsFor` in `bulk.ts` continues to fabricate BVN/NIN from a name hash. Wiring real IXP is the remaining half (BR-DOC-01/02/03). |
| **Submission limits not enforced** | 200-per-submission and 50-per-session are *displayed* on the intake screen; nothing caps them (BR-SUB-02, §9.3). |
| **RBAC** | No RM-sees-own / TeamLead-sees-team scoping. `capturedBy` exists on the case but nothing filters by it (BR-SUB-07). |
| **DSX / evidence store** | No document or evidence push (BR-DOC-09, BR-SUB-11). Evidence rows in the exception screen are presentational. |
| **Ops workbench is batch-blind** | `batchId` appears nowhere in `src/ops/`. Note `/ops` is a **static iframe** of `public/ops-console.html`, not React — anything built there is vanilla JS (BR-RPT-01). |
| **Reporting views** | Executive, compliance and alerting views not built (BR-RPT-02/04/05/06/07). |
| **Idempotency** | `openAccount()` guards on `accountNumber` — correct, but never tested under a real retry. |

### Deviation from the plan, on purpose

Board B said screen 5 would **reuse `customer/ExtractionReview.tsx`**. It was
not reused: that component requires a live Maestro `instanceId` and knows
nothing about reconciliation or the business verifications, which are the two
panels the checkpoint exists for. `bulk/Review.tsx` was built instead, and where
a row *is* live in Maestro it offers "Open the live extraction task ↗". This was
flagged to the user at the time.

---

## 8. Environment gotchas

- **Dev server: `npm run dev` → http://localhost:5180/#employee-web** → Bulk opening.
  Port 5180 is this project's; do not change it.
- **`VITE_UIPATH_DEMO_TOKEN` in `.env` is EXPIRED.** Data Fabric writes return
  401/400 and the store silently falls back to local, which is why everything
  still runs. Refresh with
  `uip login refresh --output json | jq -r '.Data.AccessToken'` and paste into
  `.env`. **These console errors are not from the bulk work** — verified by
  probing the endpoint unauthenticated.
- **`npm run build` is stricter than the editor** (`tsc -b`, `noUnusedLocals`).
  Always run it before claiming done.
- **Orchestrator identity must not change:** `FOLDER_KEY`, `FOLDER_ID`,
  `RELEASE_KEY` in `maestro.ts`, the `CORP_*` trio in `maestro-corporate.ts`.
- **To reset a demo:** `localStorage.removeItem('aof_bulk_batches')` then reload.
- `DESIGN_LANGUAGE.md` is the user's own file, deliberately left untracked.

---

## 9. Suggested next steps, in order

1. ~~Ask about §6~~ — done, see §6.
2. **Commit this work.** It is large, verified and building; leaving it in the
   working tree is the main risk right now.
3. Wire **real IXP** into the bundle path (§7, top row) — the largest remaining
   gap between the demo and the BRD.
4. Enforce the submission limits — trivial, and it makes the intake screen honest.
5. Give the Ops workbench a batch dimension, or decide it stays out of scope.
