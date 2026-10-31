# Stanbic IBTC proposal — slide content

Built on the 8-slide structure of the Abu Dhabi Police proposal deck: title, platform, solution, two use-case slides, business case, licensing, next steps. Every text box on each slide has a replacement below, in the same order as on the slide.

Figures marked **(BRD)** come from the bank's Bulk Account Opening BRD. Figures in **[brackets]** are placeholders for the bank to confirm. Don't present them as measured.

---

## Slide 1 — Title

| Box | Content |
|---|---|
| Title | **Every account, one case** |
| Subtitle | Agentic account opening and orchestration for Stanbic IBTC. Budgetary proposal. |
| Date | October 2026 |

Other title options: *Open accounts at the customer's speed* · *Agents read. Robots open. Bankers decide.*

**Notes:** Budgetary proposal for Stanbic IBTC: UiPath agentic automation and orchestration for account opening across individual, corporate and bulk channels.

---

## Slide 2 — Platform overview

Keep the generic platform slide. Change only the **Systems and data** box:

> **Finacle · NIBSS · NIMC · CAC · FIRS · SCUML · NICE Actimize · Kafka · Documents**

**Notes:** The UiPath Business Orchestration Platform. Maestro sits at the centre and orchestrates AI agents, robots, document processing and people through case management and BPMN. Underneath sit integration, enterprise context, the bank's core and registry systems, and governance.

---

## Slide 3 — The solution for Stanbic IBTC

| Box | Content |
|---|---|
| Kicker | STANBIC IBTC · BUDGETARY PROPOSAL |
| Headline | **Agents read. Robots open accounts. Bankers decide.** |
| Lede | One UiPath platform that runs every account opening as one case, from the customer app, the branch, corporate onboarding and bulk payroll drives through to a funded account in Finacle. |

**Four value pillars:**

| Pillar | Line |
|---|---|
| One case, one audit trail | Maestro records every hand-off between agent, robot and banker, from intake to closure. |
| Compliant by design | Maker-checker, sanctions, PEP and EDD lanes, and the evidence pack are built into the case. |
| Bankers freed to sell | Forms are read, checks run and customers are chased automatically. Bankers approve and decide. |
| Agent-native experience | Customer app · RM desk · Ops workbench · Control tower |

**Stack (right-hand side):**

| Layer | Line |
|---|---|
| Maestro | Case management · BPMN · SLAs and exception stages |
| AI agents | Read documents, recommend next action, call the customer |
| Robots | Finacle, registry lookups, API workflows, IXP |
| Bankers | Review, approve, authorise |
| Integration | Twilio/WhatsApp · Outlook · Google Drive · Kafka |
| Enterprise context | Data Fabric · Context grounding |
| Bank systems | Finacle · NIBSS · NIMC · CAC · FIRS · Actimize |
| Governance | Maker-checker · AI Trust Layer · audit |

**Notes:** Open with what the bank gets. Maestro runs each application as one case: IXP reads the form, agents check and recommend, robots work Finacle and the registries, and bankers keep every decision. It connects to NIBSS, NIMC, CAC, FIRS, Actimize and Finacle through the bank's existing interfaces.

---

## Slide 4 — Top 5 use cases · Customer channels

**Kicker:** TOP 5 USE CASES · CUSTOMER CHANNELS
**Title:** Individual, corporate and bulk account opening
**Role legend:** Agent · Robot · Banker (in place of Officer)

### 01 Individual account opening

- **Pain point:** 15–30 minutes of keying per form and 5–10 minutes of verification calls run one after another **(BRD)**. Customers get no credible time-to-account.
- **Process flow:**

| Step | Line | Owner |
|---|---|---|
| Capture | App, branch or form photo, read by IXP | Agent |
| Verify | NIN, BVN, liveness and sanctions in parallel | Robot |
| Decide | Banker approves exceptions only | Banker |
| Open | CIF and account in Finacle, customer notified | Robot |

- **Outcome stats:** **5 min** review per account, down from 15–30 **(BRD target)** · **10 min** to account number, measured from submission **(BRD target)**

### 02 Corporate account opening

- **Pain point:** CAC certificate, MEMART and CO2/CO7 read by hand. Every director is verified separately, and UBO is worked out on paper.
- **Process flow:**

| Step | Line | Owner |
|---|---|---|
| Extract | Read the CAC pack | Agent |
| Verify | RC, TIN, directors' NIN/BVN, UBO >5%, SCUML | Robot |
| Decide | Risk rating, EDD trigger | Banker |
| Activate | Corporate CIF, mandates, signing limits | Robot |

- **Outcome stats:** **[__] days** to open, down from **[__]** · **Every director** screened, on the same case

### 03 Bulk account opening

- **Pain point:** Payroll and NYSC drives keyed by hand. Operations tops out at about 300 accounts a day without adding staff **(BRD)**.
- **Process flow:**

| Step | Line | Owner |
|---|---|---|
| Intake | Zip bundle or Excel manifest, up to 200 per batch | Robot |
| Review | Maker checks low-confidence fields side by side | Agent |
| Authorise | A different person signs off, PND by rule | Banker |
| Open | One case per customer, accounts in Finacle | Robot |

- **Outcome stats:** **1,000 a day**, up from ~300 **(BRD target)** · **90%+** auto-completion **(BRD target)**

**Notes:** Three customer-facing channels on the same case. Individual is the flow we demonstrated end to end. Corporate adds the CAC pack, directors and UBO. Bulk reuses the individual case once per record, with maker and verifier kept apart. In every channel the agent reads and recommends, the robot works Finacle and the registries, and the banker keeps the decision.

---

## Slide 5 — Top 5 use cases · Operations and compliance

**Kicker:** TOP 5 USE CASES · OPERATIONS & COMPLIANCE
**Title:** Customer outreach, exceptions and compliance

### 04 Customer outreach (voice agent)

- **Pain point:** Applications stall waiting on a document or an answer. RMs chase by phone, and customers call in to ask where things stand.
- **Process flow:**

| Step | Line | Owner |
|---|---|---|
| Detect | Case flags what is missing | Agent |
| Call | Voice agent verifies the customer and explains what is missing | Agent |
| Upload | Customer finishes KYC from a secure link | Robot |
| Resume | Case returns to the stage it left | Robot |

- **Outcome stats:** **[__]%** of stalled cases resumed without an RM · **Same day** follow-up, previously **[__] days**

### 05 Exceptions and compliance

- **Pain point:** Exceptions are worked one case at a time. Sanctions, PEP and EDD reviews happen outside the case, and the evidence is scattered.
- **Process flow:**

| Step | Line | Owner |
|---|---|---|
| Group | Exceptions grouped by root cause | Agent |
| Fix | Retry a whole cause in one action | Robot |
| Escalate | Compliance and EDD lanes, return to origin | Banker |
| Learn | Promote repeated decisions to a rule | Agent |

- **Outcome stats:** **One action** clears a cause, not a case · **5 min** to retrieve full evidence **(BRD target)**

**Notes:** Two use cases behind the front line. The voice agent stops applications stalling. It calls the customer, sends the upload link, and the case carries on from what was agreed. Exceptions are cleared by cause, and decisions people keep making by hand become rules, so straight-through rates keep rising.

---

## Slide 6 — Business case · Indicative

Only the bulk row can be worked out from the BRD. Fill in the other rows from discovery.

**Formula per row:** hours released = volume × (minutes now − minutes with UiPath) ÷ 60. Value = hours × loaded hourly cost.

| Use case | Volume / yr | Minutes, now → with UiPath | Hours released | Value / yr |
|---|---|---|---|---|
| 01 Individual account opening | [__] | 30 → 5 | [__] | [__] |
| 02 Corporate account opening | [__] | [__] → [__] | [__] | [__] |
| 03 Bulk account opening | 250,000 | 30 → 5 | ~104,000 | [__] |
| 04 Customer outreach | [__] | [__] → [__] | [__] | [__] |
| 05 Exceptions and compliance | [__] | [__] → [__] | [__] | [__] |
| **Total** | | | **[__]** | **[__]** |

**How the bulk row is worked out:**
- **Volume:** 1,000 accounts a day **(BRD target)** × 250 working days
- **30 minutes today:** 15–30 minutes of keying (22.5 midpoint) plus 5–10 minutes of verification (7.5 midpoint), from the BRD
- **5 minutes with UiPath:** the BRD's target review time. Verification runs automatically
- **Result:** ~104,000 hours, which is ~58 FTE at 1,800 hours each

**Headline once the rows are filled:** **[__] hours a year back to the branches.** · **$[__]** annual value · **[__]** FTE capacity released

**Assumptions box:** Volumes and handling times are working estimates to validate with Stanbic IBTC. Bulk volume is the BRD's 1,000-a-day target, not today's volume. Loaded hourly cost is [__]. 1,800 working hours per FTE. Value is released capacity, not headcount reduction.

**Notes:** Indicative run-rate value once all five use cases are live. Value is released capacity: RMs and operations staff move from keying and chasing to selling and serving.

---

## Slide 7 — Proposed licensing · Budgetary

Same table. Change the descriptions and what drives each quantity:

| Item | Description | Qty drives from |
|---|---|---|
| Unified Platform · Enterprise | Orchestration, governance, Maestro case management, IXP, API workflows | 1 |
| Platform Units | Agents, voice agent, Maestro orchestration, IXP document extraction | Accounts a year × pages read per account, plus calls |
| Unattended Robots | Finacle CIF and account creation, registry lookups, 24 hours a day | Peak accounts an hour |
| Pro Users | Building cases, agents and robots | Delivery team size |
| Basic Users | RMs, makers, verifiers and analysts taking approval tasks | Staff who approve or review |

**Why Enterprise for Stanbic** (replace the ADP list): high availability · customer-managed keys and external credential vault · bring your own LLM · long Insights retention for audit · CI/CD

**Notes:** Budgetary licensing at list price, annual subscription. Services and infrastructure are not included.

---

## Slide 8 — Next steps

**Title:** From demo to live service in 16 weeks

| Phase | Weeks | Content |
|---|---|---|
| Validate | 1–2 | Confirm volumes and baselines. Agree success measures with Retail, Business Banking and Operations. |
| Pilot | 3–10 | Connect Finacle and the registries. Go live with individual account opening and one bulk segment (Employee Value Banking payroll). |
| Scale | 11–16 | Add corporate, voice outreach and exception handling. Report measured straight-through rate and time to account to leadership. |

**Decisions needed:**
- Approve the budgetary envelope of **$[__]**
- Name business owners for the two pilots
- Choose the deployment model: Automation Cloud or Automation Suite on-prem

**Notes:** Close with a phased plan: validate the baselines, pilot the two flows already demonstrated, then scale. Ask for the budget, named owners and a deployment decision.

---

## Things to fix in the source deck before reusing it

- **Typos:** "Process Appps" (slide 3), a stray "]" before "Platform units" (slide 7), and "·Any Other System of Records" is missing a space (slide 2).
- **The ~20× value to cost on slide 7 doesn't add up.** With the $500K envelope on slide 8 and $5.2M on slide 6, the ratio is about 10×. Recalculate it, or drop it until the price is set.
- **Platform Units don't match.** The slide 7 notes say 50,000 Platform Units, but the slide itself says "100 bundles". Check they're the same quantity.
- **Slides 2 and 3 both draw the platform stack.** That's why the Stanbic slide 3 above maps the stack to the bank's own systems instead of repeating it.
- **ADP's slide 3 is built around "Sovereign by design / on-premises".** Don't carry that over. The Stanbic POC runs on Automation Cloud, so deployment is left as a decision on slide 8.
