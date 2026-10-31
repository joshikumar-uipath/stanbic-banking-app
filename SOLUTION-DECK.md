# Stanbic IBTC — Intelligent account opening

*Slide content, organised around what the bank gets out of it*

---

## Slide 1 — Title

**From application to funded account in minutes, not days**

One orchestrated case for every customer, every channel, every check.

*Agentic account opening on UiPath: Maestro · IXP · Agents · Voice · Robots*

---

## Slide 2 — Why this, why now

**Account opening today costs time, staff and customers**

- **15–30 minutes of manual keying** per account form, with errors and rework
- **5–10 minutes of verification calls** per application, run one after another (NIN, BVN, AML, PEP…)
- **Checks compared by eye** across the form, NIBSS and NIMC
- **No live view of the pipeline.** RMs can't give a customer a believable time-to-account
- **Operations tops out at about 300 accounts a day** without hiring more staff

*Source: the bank's Bulk Account Opening BRD, §6.2*

---

## Slide 3 — What we built

**One case runs the whole journey, start to finish**

- **Every channel feeds the same case:** the customer app, a branch walk-in, a corporate application, a bulk payroll drive
- **UiPath Maestro runs each case** from intake to closure, and each case is a live Maestro instance
- **AI does the reading, checking and chasing.** People make the decisions
- **It works with the bank's own systems:** Finacle, NIBSS, NIMC, CAC, FIRS, Actimize, Kafka, Twilio, Outlook

*Visual: the architecture relay diagram (individual journey)*

---

## Slide 4 — The journey

**Five stages. Exceptions branch off and come back.**

| Main path | What happens |
|---|---|
| 1 · Intake | Capture or upload the form, IXP reads it, duplicate and risk pre-screen |
| 2 · Verification | NIN, BVN, liveness and face match, sanctions and PEP, document authenticity, all **at the same time** |
| 3 · Decision | Routing rules, risk-based EDD trigger, officer decision |
| 4 · Activation | CIF and account in Finacle, channels and card, customer and RM notified |
| 5 · Closure | Case packet filed, periodic KYC review scheduled |

**Exception lanes:** Compliance escalation · EDD review · Pending customer · Voice agent. Each one **returns to the stage it came from**. Declined is the only path that ends there.

**Outcome:** the clean cases go straight through. Only real exceptions reach a person.

---

## Slide 5 — Streamline: document extraction

**Stop typing forms. Check only what the model wasn't sure of.**

- **UiPath IXP reads the account-opening form inside the case** and gives every field a confidence score
- **Upload the whole package at once:** the form, ID, utility bill and signature are each classified and read
- **Corporate:** reads the CAC pack (certificate, MEMART, CO2/CO7), then verifies the RC number and TIN against the registries
- **The reviewer corrects flagged fields only.** In bulk, the form and the extracted data sit side by side, lowest confidence first
- **Every document is checked against rules:** expiry, utility bill age, issuing authority. The rule is a DMN table that operations can edit, so no code change is needed

**Outcome:** 15–30 minutes of keying per account becomes a review of a few minutes. The BRD target is under 5 minutes, and the POC times every review against it.

*Visual: Extraction review screen; Documents tab with rule outcomes*

---

## Slide 6 — Orchestration: Maestro case management

**Every application is a governed case, not an email thread**

- **One OnboardingCase per customer**, with stages, tasks, SLAs and human sign-offs
- **Checks run in parallel**, so verification time is the slowest check, not the sum of all of them
- **Exceptions are part of the case design.** Compliance, EDD and pending-customer lanes are built in, with automatic return
- **Robots handle systems that have no usable API**, such as Finacle CIF and account creation or registry lookups
- **Approvals happen in Action Center** with maker-checker, a reason on every decision and a full audit trail
- **Bulk:** one batch process starts an OnboardingCase per record, then a single batch sign-off

**Outcome:** cycle time drops because work waits on decisions, not on handoffs. Each case can show where it stands at any moment.

*Visual: case management canvas with the stages and the four secondary lanes*

---

## Slide 7 — Voice agents and customer engagement

**The case reaches out to the customer, not the other way round**

- **The voice agent calls the applicant** when the case needs something: missing documents, a failed check, information still outstanding
- It **confirms who they are, explains what's missing and sends the secure upload link.** The case then carries on from what was agreed
- **The RM sees the call live beside the case**, with the transcript, recording and outcome
- **SMS, WhatsApp and email at every step**, through Integration Service (Twilio, Outlook)
- **The account opens first.** The customer finishes KYC (documents, selfie, signature) from a link when it suits them
- **The customer has their own status screen** showing every check and the account number when it's issued

**Outcome:** fewer stalled applications, no RM time spent chasing, and a customer who always knows where things stand.

*Visual: voice agent panel on the case; customer status screen*

---

## Slide 8 — AI agents doing case work

**Agents handle the judgement-heavy steps a person used to grind through**

- **Next best action:** every case tells the RM what to do now, and why
- **Document and address authenticity** checked by an agent
- **Web research and adverse media** on the applicant, from the case view
- **Reconciliation names the one field that disagrees**, e.g. "AOP reads 14/03/1984, NIMC reads 14/03/1979"
- **Rules learned from patterns:** when people keep making the same manual decision, operations can promote it to a rule, so it stops reaching a person

**Outcome:** analysts spend their time on real risk, and the share of cases that go straight through keeps rising.

---

## Slide 9 — Bulk account opening

**Payroll drives and youth-corps batches without the back-office backlog**

- **Two ways in:** a .zip bundle of scanned forms, or an Excel manifest. Up to 200 customers per submission
- **Checked at intake before any account is created.** Rejected rows come back with the reason
- **Manifest customers get an invitation link** and fill in their own details. A funnel shows who has finished
- **Maker reviews the scanned forms.** A different person, the verifier, authorises account creation (BRD §9.1)
- **PND (post-no-debit) set by rule**, with a recorded deferral override
- **Records that can't be reconciled become managed exceptions** with the full evidence pack

**Outcome:** built against the BRD targets of **1,000 accounts a working day** and **at least 90% auto-completion**. Manifest rows need no human touch until the verifier.

*Visual: batch monitor; maker side-by-side review*

---

## Slide 10 — Operations: fix the cause, not each case

**One action clears a whole class of exceptions**

- **Exceptions grouped by root cause**, e.g. 40 NIN checks that hit the same gateway timeout, retried in one go
- **Each case view shows the problem, the checks and the applicant on one screen**, with keyboard shortcuts
- **Every BVN and NIN call can be opened** to see exactly what was sent and received, field by field
- **Managed exception cases** record the trigger, the evidence and a disposition that requires a reason

**Outcome:** operations capacity grows without adding staff, which removes the ~300-a-day ceiling.

---

## Slide 11 — Visibility and control

**Management sees the whole pipeline. Audit sees every decision.**

- **Control tower** (Power BI style, six pages): volumes, straight-through rate, where every application sits, why work stops, channel performance, time to open
- **RM's desk** ranks the day's work and shows the live Maestro stage on every row
- **Case canvas** shows each application as its real stages and tasks
- **Maker-checker, a reason on every approval, and the evidence one click away**
- **Admin console:** branding, market, SLAs, queue routing and feature flags are configuration. The same platform already runs a second bank's brand

**Outcome:** a believable time-to-account for every customer, and an audit trail regulators can follow.

---

## Slide 12 — What changes for each person

| Who | Before | After |
|---|---|---|
| Customer | Branch visit, paper, silence | Applies in the app, follows every step, account opens before KYC is finished |
| Relationship manager | Keys forms, chases customers | Reviews what was read, the voice agent does the chasing, the desk says what to do next |
| Ops maker / verifier | Types and compares by eye | Reviews flagged fields side by side, authorises in one place |
| Ops analyst | Works exceptions one at a time | Clears exceptions by cause and turns repeated decisions into rules |
| Management | Spreadsheets after the fact | Live control tower with the straight-through rate |
| Compliance | Evidence scattered | Sanctions, PEP and EDD lanes built into the case, with a full evidence pack |

---

## Slide 13 — Outcome scorecard

| Measure | Today (BRD) | Target (BRD) | How the solution delivers it |
|---|---|---|---|
| Data entry per account | 15–30 min | Review under 5 min | IXP extraction plus a review of low-confidence fields, timed per review |
| Verification time | 5–10 min, one after another | One parallel step | Checks run as parallel case tasks |
| Time to account number | Bank to confirm | Within 10 min of submission | Orchestrated case, account opens before KYC is complete |
| Daily capacity | ~300 accounts | 1,000 a day | Bulk intake, clearing exceptions by cause |
| Auto-completion | Bank to confirm | At least 90% | Straight-through by design, rules learned from patterns |
| Pipeline visibility | None | Real time | Desk, customer status screen, control tower |

---

## Slide 14 — The platform behind it

**UiPath agentic automation, plugged into the bank's existing systems**

- **Orchestration:** Maestro case management · Orchestrator · Action Center
- **AI:** IXP (document understanding) · Agents · Voice agent · Face matching
- **Automation:** Robots · API workflows · Integration Service · Data Fabric
- **Bank and third-party systems:** Finacle · Kafka · NIBSS · NIMC · CAC · FIRS · SCUML · NICE Actimize · Twilio/WhatsApp · Outlook · Google Drive

*Visual: the layered architecture relay (Experience → Engagement → Orchestration → AI → Systems)*

---

## Slide 15 — Next steps

1. Confirm the target KPIs and the baseline figures with Operations
2. Connect the real bank systems: Finacle, Kafka, the ID-document vendor
3. Load-test bulk at 1,000 accounts a day
4. Run a pilot on one segment (e.g. Employee Value Banking payroll) and measure straight-through rate and time-to-account
5. Expand to corporate and the remaining channels

---

## Presenter notes (not for the slides)

- **The figures in Slide 13 are the BRD's baselines and targets, not results we measured.** The POC hasn't been load-tested at 1,000 a day. Auto-completion depends on simulated verification. "10 minutes to an account number" has only been observed on the local engine, not on live Maestro.
- **Finacle, Kafka and the notification service are stand-ins.** Maestro, IXP, the approval app and the voice agent are real and run on the staging tenant.
- **Only the first 8 rows of a bulk batch start real Maestro cases.** The batch monitor shows which rows those are.
- Screenshots for every screen mentioned are in `public/guide/shots/`.
