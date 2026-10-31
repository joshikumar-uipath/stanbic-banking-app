# Feature guide content: one entry per persona, one flow per thing that persona does,
# one step per screen. build.py renders it; shots/<id>.jpg are real screenshots
# (1440×900) taken from the local app on port 5180 with route.js installed, so no
# write reached the tenant (see capture/README.md).
#
# Voice (DESIGN_LANGUAGE.md): sentence case, second person, say why not just what, "·" between metadata.
# Every step is (title, what to do, shot id, what you should see). An empty shot id renders a text-only step.

APP = 'http://localhost:5180/'
LAUNCHER = APP
CUSTOMER = APP + '#customer-web'
CUSTOMER_MOBILE = APP + '#customer-mobile'
KYC = APP + '#kyc/DEMO01'
DESK = APP + '#employee-web'
DESK_MOBILE = APP + '#employee-mobile'
OPS = APP + '#ops'
TOWER = APP + '#tower'
CASES = APP + '#cases'
KAFKA = APP + '#kafka'
FINACLE = APP + '#finacle'
COMMS = APP + '#comms'
FACEID = APP + '#faceid'
KIOSK = APP + '#faceid-kiosk'
ADMIN = APP + '#admin'

SITE = {
    # The bank's name, logo and favicon come from build.py's BANKS; write {BANK} / {ROOT} in the copy.
    'subtitle': 'Account opening POC',
    'short': 'Account opening',
    'launcher_href': '{ROOT}', 'launcher_label': 'Launcher',
    'description': 'Every feature of the {BANK} account opening POC, by persona, step by step with screenshots.',
    'hero_title': 'Every feature, step by step',
    'hero_intro': 'One account opening, seen from every seat — the customer on their phone, the relationship manager at the branch, the maker and verifier on a bulk batch, the operations analyst clearing exceptions, management and the presenter. Pick a persona to get their flows as numbered steps, each with a screenshot of the real screen and what you should see.',
    'how_to_use_html': [
        'Start the app with <code>npm run dev</code> (port 5180) and open the <a href="{ROOT}">launcher</a>. Every “Open it” button in this guide opens the right surface; none of the apps can open a single case from a URL, so the first step of each flow says how to reach the case.',
        'Use the sample cases below: each sits at a different stage of the Maestro case, so every flow has something to try it on. The store reseeds itself every 12 hours, and “Reset demo data” on the launcher reseeds it now.',
        '<b>What is live:</b> the app talks to the real UiPath staging tenant. Submitting an application, uploading a form, “Run in Maestro”, “Approve … &amp; advance”, “Confirm and continue” and Batches’ “Process N applications” start or move real Maestro cases. The steps say where. <b>What is simulated:</b> Finacle, Kafka, the notification service, NIMC/NIBSS verification, transfers, approvals and the Customer 360 actions. No SMS, email or WhatsApp is ever sent.',
        'The screenshots were taken with every write to the tenant intercepted, so where a screen depends on a live case the step says what you see instead (for example the extraction review’s “sample read”).',
    ],
    'brd_name': 'Bulk Account Opening BRD v1.0 (July 2026)',
    'pains_lead': 'The BRD’s own statement of the problem (§3.1) and the pain points it measures (§6.2), and where the POC answers each. No call notes were available, so these are the bank’s words as written in the BRD.',
    'journey_title': 'The account, stage by stage',
    'journey_lead': 'The five primary stages of the OnboardingCase in Maestro, the four secondary stages a case can divert into, who acts in each, and where the guide covers it.',
    'samples_title': 'Sample cases',
    'samples_cols': ('Case', 'Stage', 'Use it for'),
    'fine_print': 'Screenshots were taken from the local app at 1440 × 900 on 26 September 2026, with the shared tenant records loaded. Counts, names in the queues and batch numbers on your screen will differ: the desk shows every record on the tenant, and the store reseeds.',
    'rebuild_cmd': 'python3 public/guide/build.py',
}

# (reference, customer, stage, what to use it for)
SAMPLES = [
    ('AO-2026-000146', 'Hauwa Garba · Pre-registered', 'Intake', 'A case that has not started'),
    ('AO-2026-000106', 'Fatima Musa · Validating', 'Intake (live in Maestro)', 'Live case parked at Intake'),
    ('AO-2026-000107', 'Blessing Eze · Exception, NIN timeout', 'Verification (live)', 'Next best action, live Maestro card, voice agent, ops retry'),
    ('AO-2026-000103', 'Emeka Chukwu · Validated', 'Decision (live)', 'Live case waiting on the officer decision'),
    ('AO-2026-000104', 'Aisha Effiong · Pending liveness', 'Activation (live)', 'Account open, KYC outstanding'),
    ('AO-2026-000105', 'Tunde Abubakar · Pending documents · NYSC batch', 'Activation', 'Re-send the KYC link; “Run this case in Maestro”'),
    ('AO-2026-000101', 'Chidi Yusuf · Fully activated', 'Closure', 'A completed case; Finacle account'),
    ('AO-2026-000137', 'Amina Obi · Compliance hold (PEP)', 'Compliance escalations', 'Secondary stage on the case canvas'),
    ('AO-2026-000138', 'Yakubu Nwankwo · EDD review', 'EDD review', 'Secondary stage'),
    ('AO-2026-000139', 'Funke Lawal · Pending customer', 'Pending customer', 'Secondary stage'),
    ('AO-2026-000140', 'Sadiq Idris · Declined (fraud)', 'Declined / withdrawn', 'Terminal stage'),
    ('AO-2026-000007', 'Aisha Yusuf · NIN name mismatch', 'Ops console', 'Resolve one exception'),
    ('AO-2026-BULK-004', 'Ashaka Cement payroll · 12 of 180 rows failed', 'Ops console', 'Bulk failure'),
    ('Sample bundle / manifest', 'Created in Batches → New submission', 'Bulk intake', 'Maker, verifier, exceptions, invitations'),
]

# (no, stage, who, persona slug, flow id)
JOURNEY = [
    ('01', 'Intake — capture and enrich', 'Customer or RM captures · IXP reads the form · duplicate & risk pre-screen', 'customer', 'apply'),
    ('02', 'Verification — KYC and identity', 'NIN, BVN, liveness, sanctions & PEP, document checks · analyst review of exceptions', 'ops', 'resolve'),
    ('03', 'Decision — approve or refer', 'Onboarding officer decision · routing rules · risk-based EDD trigger', 'rm', 'case'),
    ('04', 'Activation — open the account', 'CIF and account in Finacle · channels & card · customer and RM comms', 'rm', 'kyclink'),
    ('05', 'Closure — wrap and assure', 'Case packet · audit report · periodic KYC review scheduled', 'presenter', 'cases'),
    ('S1', 'Compliance escalations', 'From Verification on a sanctions / PEP hit · loops back', 'presenter', 'cases'),
    ('S2', 'EDD review', 'From Decision on a high-risk profile · loops back', 'presenter', 'cases'),
    ('S3', 'Pending customer', 'From Decision when information is missing · loops back', 'rm', 'voice'),
    ('S4', 'Declined / withdrawn', 'From Decision · terminal', 'presenter', 'cases'),
    ('B', 'Bulk: intake → maker review → verifier authorises', 'RM submits a bundle or manifest · Ops maker · Ops verifier', 'bulkops', 'review'),
]

# (quote, how the POC solves it, [(link label, 'page.html#flow')])
PAINS = [
    ('Manual data keying from the AOP takes 15–30 minutes per account, with a high error rate and rework. (§6.2)',
     'An uploaded form is read by IXP inside the case and every field comes back with a confidence; the person only corrects what the model was unsure of. In bulk, the maker reviews the extraction side by side with the form instead of typing it.',
     [('Upload a form', 'customer.html#upload'), ('Review an extraction', 'bulkops.html#review')]),
    ('Sequential verification calls add 5–10 minutes of cycle time to each application. (§6.2)',
     'NIN, BVN, AML, PEP, fraud, TIN, CAC, sanctions, watchlist and adverse media run in parallel as case tasks; the maker sees them as already done when the application reaches them.',
     [('Batch monitor', 'rm.html#batch'), ('Case detail', 'rm.html#case')]),
    ('Visual cross-checking is time-consuming and error-prone. (§6.2)',
     'Reconciliation compares the form, NIBSS and NIMC before a person looks, and names the one field that disagrees — “AOP reads 14/03/1984, NIMC reads 14/03/1979”.',
     [('Reconciliation', 'bulkops.html#review'), ('Exception case', 'bulkops.html#exception')]),
    ('No real-time pipeline visibility for RMs — they cannot give customers a credible time-to-account. (§6.2)',
     'My desk ranks what needs the RM with the live Maestro stage on every row; the customer has their own status screen; management has the control tower.',
     [('My desk', 'rm.html#desk'), ('Track (customer)', 'customer.html#track'), ('Control tower', 'management.html#overview')]),
    ('Operations cannot scale beyond ~300 accounts a day without more staff. (§6.2)',
     'Exceptions are cleared by cause, in bulk, and a pattern of identical human decisions can be promoted to a rule so it stops reaching a person at all.',
     [('Triage by cause', 'ops.html#triage'), ('Promote a rule', 'ops.html#rules')]),
]

# (feature, used by, persona slug, flow id, one-line why)
FEATURES = [
    ('Customer banking app', 'Customer', 'customer', 'tour', 'Account opening lives inside the app the customer already uses.'),
    ('Guided six-step application', 'Customer · RM', 'customer', 'apply', 'Plain questions, BVN and NIN first, demo autofill so a presenter never stalls.'),
    ('Upload a completed form (IXP)', 'Customer · RM', 'customer', 'upload', 'The case reads the form; the person checks only the unsure fields.'),
    ('Application status', 'Customer', 'customer', 'track', 'Where the application is, every check, and the account number when it lands.'),
    ('KYC link: documents, selfie, signature', 'Customer', 'customer', 'kyc', 'The account opens first; the customer finishes KYC from a link when they can.'),
    ('Assistant and notifications', 'Customer', 'customer', 'assistant', 'A scripted assistant for everyday questions, and the notification inbox.'),
    ('My desk', 'Relationship manager', 'rm', 'desk', 'The RM’s next move, ranked, with the live Maestro stage on every row.'),
    ('Open an account directory', 'Relationship manager', 'rm', 'directory', 'Every application however it arrived, grouped by walk-in and batch.'),
    ('Next best action and live Maestro card', 'Relationship manager', 'rm', 'case', 'What to do now on this case, and where it really sits in Maestro.'),
    ('Application details and web research', 'Relationship manager', 'rm', 'details', 'The captured data, the form, and an adverse-media search on the applicant.'),
    ('Voice agent calls', 'Relationship manager', 'rm', 'voice', 'The calls the voice agent placed on the case, with recording and outcome.'),
    ('Assisted capture (individual and corporate)', 'Relationship manager', 'rm', 'capture', 'The same wizard as the customer’s, plus business and directors for a company.'),
    ('Approvals (maker–checker)', 'Relationship manager', 'rm', 'approvals', 'Approve or reject within authority, always with a reason.'),
    ('Clients and Customer 360', 'Relationship manager', 'rm', 'clients', 'The branch book and next best actions per relationship.'),
    ('Bulk intake: AOP bundle or Excel manifest', 'Relationship manager', 'rm', 'batch', 'Up to 200 customers per submission, checked before anything is created.'),
    ('Invitations for a manifest', 'Relationship manager', 'rm', 'invites', 'Everyone on the manifest gets a link; the funnel shows who finished.'),
    ('Assistant rail: Chat, Explore agents, Alerts, Profile', 'Relationship manager', 'rm', 'assistant', 'The UiPath agents and tasks behind the desk.'),
    ('Maker review queue and side-by-side review', 'Operations maker', 'bulkops', 'review', 'The BRD’s mandatory checkpoint for OCR-read applications.'),
    ('Verifier authorisation and PND', 'Operations verifier', 'bulkops', 'authorise', 'A different person creates the accounts; PND by rule, with a deferral override.'),
    ('Managed exception case', 'RM (requester)', 'bulkops', 'exception', 'The trigger, the full evidence pack and a disposition that needs a reason.'),
    ('Triage by root cause, bulk actions', 'Operations analyst', 'ops', 'triage', 'Clear the cause, not the cases.'),
    ('Case view with keyboard actions', 'Operations analyst', 'ops', 'resolve', 'The problem, the checks and the applicant on one screen.'),
    ('Rules from patterns (DMN)', 'Operations analyst', 'ops', 'rules', 'Promote a decision people keep making by hand into a rule.'),
    ('Control tower (Power BI look)', 'Management', 'management', 'overview', 'Six report pages with click-to-filter and period ranges.'),
    ('Case management canvas', 'Presenter', 'presenter', 'cases', 'The OnboardingCase stages and tasks, and the secondary stages.'),
    ('Kafka, Finacle and notification service', 'Presenter', 'presenter', 'systems', 'The bank’s own systems, stood in for and reading the same store.'),
    ('FaceID console and kiosk', 'Presenter · Admin', 'presenter', 'faceid', 'Liveness and 1:1 match — the check behind the selfie.'),
    ('Admin console', 'Admin', 'presenter', 'admin', 'Branding, market, SLAs, queue routing and feature flags as configuration.'),
]

PAGES = [
    # ------------------------------------------------------------------ customer
    {
        'slug': 'customer', 'name': 'Customer', 'icon': 'user',
        'who': 'Adaeze Okafor, the signed-in customer in the banking app',
        'app': 'Customer banking app', 'url': CUSTOMER,
        'intro': 'The customer opens an account from inside the {BANK} app they already bank with: six plain steps with their BVN and NIN, or a photo of a filled form that the case reads for them. The account opens while the checks run; they finish KYC — documents, a selfie and a signature — from a link whenever suits them, and follow every step on their status screen.',
        'before': [
            'Open the launcher and click “On web” on the Customer card (or go to localhost:5180/#customer-web). “Customer” itself opens the phone view.',
            'There is no sign-in: the app opens as Adaeze Okafor.',
            'Demo autofill is on: leave any field empty and press Continue, and it fills with sample values.',
            '“Submit application” and uploading a form start a real Maestro case on the staging tenant. Do it when you mean to.',
        ],
        'flows': [
            {
                'id': 'tour', 'title': 'Look around the banking app', 'time': '2 min',
                'open': CUSTOMER, 'sample': 'Adaeze Okafor',
                'why': 'Account opening is not a separate portal. It sits inside the everyday app, next to balances, payments and investments, which is where a customer would look for it.',
                'steps': [
                    ('Start on Home', 'The top bar holds Home, Pay & transfer, Open an account, Wealth and More, with the bell and the assistant on the right.', 'c-home', '“Good afternoon, Adaeze”, a total balance of NGN 915,900.50, quick actions (Send, Pay, Top up, Scan) and her accounts and card.'),
                    ('Open Pay & transfer', 'Click “Pay & transfer”.', 'c-pay', 'Nine payment types (Send Money, NIP Transfer, Scan & Pay, Pay Bill…) and recent recipients.'),
                    ('Send money', 'Click “Send Money”, enter a phone number and an amount, and click Continue.', 'c-transfer-review', 'A review with the fee and total, and the line “This is a demo — no real money moves.”'),
                    ('Confirm', 'Click “Confirm & Send”.', 'c-transfer-done', '“NGN 25,000.00 sent” with a reference, and Share, Copy ref and Receipt.'),
                    ('Wealth and More', 'Click Wealth for funds, protection and pension; click More for settings and the Apply section.', 'c-wealth', 'Invest / Protect / Retire / Money in/out tabs and the {BANK} funds with their returns.'),
                    ('Settings and services', 'On More, Quick Access and App & Security hold the everyday settings.', 'c-more', 'Under Apply, “Open Account” is a placeholder; the real journey is the “Open an account” tab.'),
                ],
            },
            {
                'id': 'apply', 'title': 'Open an account in six steps', 'time': '3 min',
                'open': CUSTOMER, 'sample': 'New application',
                'why': 'An account in about five minutes, starting from the two numbers every Nigerian customer has — BVN and NIN. Verification runs in the background, so the customer never waits on a queue.',
                'steps': [
                    ('Open the tab', 'Click “Open an account” in the top bar.', 'c-open', '“A bank account in about five minutes.” and three promises: open in about five minutes, verified with NIMC & NIBSS, finish KYC whenever.'),
                    ('Step 1 · About you', 'Click “Open an account”. Enter your name exactly as on your NIN, date of birth, gender, marital status, mother’s maiden name, nationality, phone and email — or leave them for autofill.', 'c-wiz-1', '“Let’s start with you”, Step 1 of 6, and the upload box “Have a completed form? Upload it” at the top.'),
                    ('Step 2 · Your identity', 'Click Continue. BVN, NIN, means of identification, ID number and expiry, and TIN (optional for a personal account).', 'c-wiz-2', '“We verify these with NIBSS and NIMC in the background. You won’t wait for it.” If the details match an existing customer, a note says so.'),
                    ('Step 3 · Where do you live?', 'Click Continue. Address, city, state, LGA, years at the address, alternate phone.', 'c-wiz-3', '“You can send proof of address later — it won’t hold up your account.”'),
                    ('Step 4 · What do you do?', 'Click Continue. Employment status, occupation, employer, annual income and source of funds.', 'c-wiz-4', '“This sets the limits on your account, and we are required to ask.”'),
                    ('Step 5 · Your new account', 'Click Continue. Account type (Savings, Current or Domiciliary), purpose, preferred branch and next of kin.', 'c-wiz-5', 'Savings · Everyday banking · Lagos main branch, and the next-of-kin block.'),
                    ('Step 6 · Check your details', 'Click Continue. Read the summary and tick the consent.', 'c-wiz-6', 'Name, phone, email, BVN, NIN, address, date of birth, identification, employment, account and next of kin in one list.'),
                    ('Submit', 'Click “Submit application”. In live use this starts the OnboardingCase in Maestro.', 'c-received', '“Application received”, your reference (AO-2026-…) and “We’ll text you the moment your account number is ready”. Buttons: “Track my application” and “Finish KYC now”.'),
                ],
            },
            {
                'id': 'upload', 'title': 'Upload a completed form instead of typing', 'time': '2 min',
                'open': CUSTOMER, 'sample': 'fixtures/documents/adaeze-okafor/account-opening-form.pdf',
                'why': 'Many customers already have a filled paper form. The case reads it with IXP while they are still on the screen, and they only check the fields the model was unsure of.',
                'steps': [
                    ('Choose the form', 'On step 1, click “Have a completed form? Upload it” and choose a PDF or photo of the account opening form. Sample forms are in the repo under fixtures/documents/.', 'c-upload', 'The upload starts the case straight away, so extraction runs while you wait.'),
                    ('Watch it read', 'The review takes over the screen: “Extraction review · Reading the form”, the document on the right.', 'c-review-reading', '“The case is running the extraction. You can close this and come back — it keeps going.” “Confirm and continue” stays disabled until the case has parked the review task.'),
                    ('Check what was read', 'On a live case the fields arrive in about 30 seconds. In these screenshots the upload was sandboxed, so after three minutes the screen shows its own labelled sample.', 'c-review', '“Showing a sample read — the live extraction was not available. Values below are illustrative.” Unsure fields sit at the top under “2 fields need checking”, each with its confidence.'),
                    ('Correct and confirm', 'Scroll the field groups, correct anything wrong, then click “Confirm and continue”. In live use this completes the Action Center task and the case moves on; the wizard fills in from what you confirmed.', 'c-review-fields', 'Every field shows its confidence (96%, 87%…); blank boxes on the form are listed separately.'),
                ],
            },
            {
                'id': 'track', 'title': 'Track the application', 'time': '1 min',
                'open': CUSTOMER, 'sample': 'The application you just submitted',
                'why': 'The customer can see where the application is and which checks have passed, without phoning the branch.',
                'steps': [
                    ('Open the status', 'Click “Track my application” on the received screen.', 'c-status', '“Your application”, the reference, a stage chip and the five progress steps: Application received → Verifying your identity → Identity verified → Account created → Fully activated.'),
                    ('Read the checks', 'Scroll to Checks and Activity.', 'c-status-checks', 'NIN – NIMC, BVN – NIBSS, AML, PEP and fraud screening and the selfie check, each Pending, Running or Passed. A live case reads its state from Maestro every 4 seconds; an unrun one plays the demo story.'),
                    ('Come back later', 'Next time, open “Open an account”: “Applications in progress” lists the applications made on this device. Tap one to reopen its status.', 'c-inprogress', 'Adaeze Okafor · AO-2026-… with its current state.'),
                ],
            },
            {
                'id': 'kyc', 'title': 'Finish KYC from the link', 'time': '2 min',
                'open': KYC, 'sample': 'The newest case waiting on KYC (e.g. AO-2026-000104)',
                'why': 'The account opens first and works with limits; KYC is three quick things the customer does from an SMS link when it suits them — no branch visit.',
                'steps': [
                    ('Open the link', 'Open localhost:5180/#kyc/DEMO01 (the launcher’s “KYC link”). The link opens the newest application waiting on documents or a selfie.', 'c-kyc-intro', '“Hello Adaeze 👋 Your account … is already open.” Three things: your documents, a quick selfie, your signature. “Takes about two minutes.”'),
                    ('Your documents', 'Click “Get started”. Tap “Means of identification” and “Proof of address”.', 'c-kyc-docs-done', 'Each tile turns green: “Uploaded · tap to replace”. (The tiles are a stand-in; no file picker opens.)'),
                    ('A quick selfie', 'Click Continue. The FaceID check opens in the page and asks for the camera.', 'c-kyc-selfie', '“Let’s verify it’s you” and “Stay in Position”. This is the real FaceID liveness service on the staging host; finish the check, then click “I’ve finished the check”.'),
                    ('Your signature', 'Sign in the box with a finger or the mouse.', 'c-kyc-sign', '“Sign here … This is the signature we’ll hold on file.” “Clear” starts again.'),
                    ('Done', 'Click Finish.', 'c-kyc-done', '“You’re all set. Your account is fully activated.” with the account number. On a live case, “fully activated” waits for Maestro’s Closure stage.'),
                ],
            },
            {
                'id': 'assistant', 'title': 'Ask the assistant, read notifications', 'time': '1 min',
                'open': CUSTOMER, 'sample': 'Adaeze Okafor',
                'why': 'Everyday questions answered in the app rather than by the contact centre.',
                'steps': [
                    ('Open the assistant', 'Click the chat icon in the top bar (“Ask Digibot”).', 'c-assistant', '“Hi Adaeze 👋 I’m your {BANK} assistant” and chips: Check my balance, Send money, Pay a bill, Replace my card, Reset card PIN, Talk to support.'),
                    ('Ask something', 'Click “Check my balance”.', 'c-assistant-answer', 'The balances of every account. The assistant is scripted in the POC; it does not call a model.'),
                    ('Notifications', 'Click the bell.', 'c-notifications', 'Banking and Tips & Deals tabs with unread counts: statement ready, salary received, card payment due.'),
                ],
            },
            {
                'id': 'phone', 'title': 'The same app on a phone', 'time': '1 min',
                'open': CUSTOMER_MOBILE, 'sample': 'Adaeze Okafor',
                'why': 'The customer app is phone-first; the web shell is the same screens on a laptop.',
                'steps': [
                    ('Open the phone view', 'From the launcher click the Customer card itself (localhost:5180/#customer-mobile).', 'c-mobile', 'A phone frame with the header, balance and a bottom bar: Home, Pay, the raised “+” Open, Wealth, More.'),
                    ('Open an account', 'Tap the raised “+”.', 'c-mobile-open', 'The same “A bank account in about five minutes” screen, with “Applications in progress” underneath.'),
                    ('A call from the voice agent', 'When the voice agent service calls the customer about their application, a “UiBank is calling you” card appears on the phone with “This is me” and “Not me”. It only appears when the voice service sends a call, so it is not in these screenshots.', '', 'The card only shows on the phone view.'),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------ relationship manager
    {
        'slug': 'rm', 'name': 'Relationship manager', 'icon': 'briefcase',
        'who': 'A relationship manager on the branch desk',
        'app': 'Employee desk', 'url': DESK,
        'intro': 'The RM’s workspace: a desk that ranks what needs them, a directory of every application however it arrived, a case view that says the next best action and where the case really is in Maestro, assisted capture for walk-ins and companies, bulk submissions for payroll drives, approvals within their authority and their book of clients — with the UiPath agents one click away.',
        'before': [
            'Open the launcher and click “On web” on the Relationship Manager card (localhost:5180/#employee-web).',
            'You are signed in automatically with the demo token. If you sign out, sign back in with the demo login demo / demo.',
            'The desk shows every record on the shared tenant, so you will see other people’s test applications too.',
            'Buttons that act on the real tenant: “Submit application”, uploading a form, “▶ Run this case in Maestro”, “Approve … & advance”, “Confirm and continue” and Batches’ “Process N applications”. Voice agent panels are the real voice service — do not press its call controls.',
        ],
        'flows': [
            {
                'id': 'desk', 'title': 'Start the day on My desk', 'time': '1 min',
                'open': DESK, 'sample': 'Blessing Eze (AO-2026-000107) at the top',
                'why': 'An RM should not have to hunt for work. The desk ranks everything that needs them and shows each case’s live Maestro stage, so they can tell a customer where it is.',
                'steps': [
                    ('Your next move', 'The card at the top is the single most urgent item, with “Open AO-2026-…” and “Skip for now →”.', 'r-desk', '“Your next move · 1 of 62”, why it needs you, and the stat tiles: Needs you, Breaching SLA, In flight, Straight through.'),
                    ('Work the lanes', 'Scroll to “My desk”. Filter by All / Needs attention / In flight / Done, by source (Bulk / Single) and by type (Corporate / Individual).', 'r-desk-lanes', '“01 Needs you now” with Who · What · Maestro stage · Status · When. Rows marked LIVE are real Maestro instances. Click a row to open the case.'),
                ],
            },
            {
                'id': 'directory', 'title': 'Find any application', 'time': '1 min',
                'open': DESK, 'sample': 'Any',
                'why': 'Finding a customer should not require knowing how they came in. “Open an account” is the directory of every application; batches are one group each.',
                'steps': [
                    ('Open the directory', 'Click “Open an account” in the rail.', 'r-opening', 'Stats (In progress, Awaiting KYC, Exceptions, Straight through), “Walk-in / direct” and one collapsible group per batch, and “N batches in flight · N need a person — Open in Batches →”.'),
                    ('Search', 'Type a name or reference in “Search name or reference”, or use the top search “Search customers, applications, references”.', '', 'The list narrows as you type.'),
                ],
            },
            {
                'id': 'case', 'title': 'Work a case: next best action and the live Maestro card', 'time': '2 min',
                'open': DESK, 'sample': 'Blessing Eze · AO-2026-000107 (live, exception)',
                'why': 'The case says what to do next and shows where it really sits in Maestro, so the RM acts on the truth rather than on a status someone typed.',
                'steps': [
                    ('Open the case', 'In “Open an account”, search “Blessing” and click Blessing Eze.', 'r-case', 'The right pane: “Next best action · Approve Activation & advance” with “Open in Action Center ↗”, and under it “If that doesn’t work”.'),
                    ('Read the live card', 'Scroll to “Live in Maestro”.', 'r-case-live', 'The stage strip (Intake → Verification → Decision → Activation → Closure), “In Activation” with each task and which one “needs a person”, and “Open in Maestro ↗”. Pressing “Approve Activation & advance” completes the real Action Center task — only do it on purpose.'),
                    ('Messages', 'Click the Messages tab.', 'r-case-messages', 'Every SMS and WhatsApp the customer received for this case, with delivery status.'),
                    ('Activity', 'Click the Activity tab.', 'r-case-activity', 'The timeline: received, BVN verified, NIN timed out, routed to Operations.'),
                ],
            },
            {
                'id': 'details', 'title': 'See everything captured, and a web search', 'time': '1 min',
                'open': DESK, 'sample': 'Blessing Eze · AO-2026-000107',
                'why': 'All the application data in one place, plus an adverse-media search done before anyone approves.',
                'steps': [
                    ('Open the details', 'On the case, click Details.', 'r-details', 'Tabs Applicant · Employment & account · Document · Web research. Applicant shows personal data, identification and contact.'),
                    ('The document', 'Click Document.', 'r-details-doc', 'The uploaded form, fetched from Orchestrator (“Fetching the uploaded pages…” while it loads).'),
                    ('Web research', 'Click Web research.', 'r-details-web', '“No adverse media that can be tied to this applicant”, the findings it ruled out and the searches it ran.'),
                ],
            },
            {
                'id': 'voice', 'title': 'Listen to the voice agent’s calls', 'time': '1 min',
                'open': DESK, 'sample': 'Blessing Eze · AO-2026-000107',
                'why': 'When the case needs the customer — name-collision screening, a delay, missing documents — the voice agent calls them and the RM can hear exactly what was said.',
                'steps': [
                    ('Open the voice agent', 'On the case, under “Voice agent”, click “Open call history” (or “Listen in” while a call is live).', 'r-voice', 'Previous calls on the left (name-collision screening, fraud check callback, missing documents) and the selected call’s purpose, duration, recording and session.'),
                    ('Close it', 'Click Close. Do not press the call controls inside the panel: it is the real voice service.', '', 'You are back on the case.'),
                ],
            },
            {
                'id': 'kyclink', 'title': 'Re-send the KYC link, and run an unrun case', 'time': '1 min',
                'open': DESK, 'sample': 'Tunde Abubakar · AO-2026-000105 (pending documents)',
                'why': 'An account that is open but missing documents only needs the customer to finish KYC; the RM nudges them on the channel they use.',
                'steps': [
                    ('Open the case', 'Search “Tunde Abubakar” and open him.', 'r-case-105', '“Re-send the KYC link” as the next best action, the account number with the LIVE tag, and every check verified. This case has never run in Maestro, so it also offers “▶ Run this case in Maestro” — that starts a real case.'),
                    ('Pick the channels', 'Click “Re-send the KYC link”.', 'r-kyc-link', '“Send the KYC link” with SMS, WhatsApp and Email. Click “Send link · 2 channels” to record it on the case. Nothing is actually sent in the POC.'),
                    ('A case at Activation', 'Open Aisha Effiong (AO-2026-000104).', 'r-case-activation', 'A live case parked at Activation: the next best action is the Activation approval, and the card lists the activation tasks.'),
                ],
            },
            {
                'id': 'capture', 'title': 'Capture an application with a customer', 'time': '3 min',
                'open': DESK, 'sample': 'New application',
                'why': 'Walk-ins and phone customers get the same guided capture as self-service, and the RM can open a company account too.',
                'steps': [
                    ('Start', 'Click “New application” (My desk or Open an account).', 'r-capture', 'The capture overlay with “Individual | Corporate”, “Customer details” and the upload box. The six individual steps are the customer’s (see the customer guide).'),
                    ('A company instead', 'Click Corporate.', 'r-corp-1', '“Business details”: company name, RC number, TIN, category, sector, turnover, address, email and phone. Continue stays disabled until there is a company name.'),
                    ('Directors & signatories', 'Enter a company name and click Continue.', 'r-corp-2', '“Everyone who signs on the account. Each is verified with NIBSS in the background.” and “Add another director”.'),
                    ('Check the details', 'Click Continue.', 'r-corp-3', 'The company and director summary and the signatories’ consent. “Submit application” starts the corporate case in Maestro; press Esc to leave without submitting.'),
                ],
            },
            {
                'id': 'batch', 'title': 'Submit a bulk batch (AOP bundle)', 'time': '4 min',
                'open': DESK, 'sample': '“Load a sample bundle”',
                'why': 'Business Name and Sole Trader drives arrive as piles of filled forms. One submission checks them all, rejects what is incomplete with a reason, and processes the rest in parallel.',
                'steps': [
                    ('New submission', 'Click Batches in the rail (or “Bulk upload” in Open an account).', 'r-batch-new', 'Two channels: “Excel manifest” (structured at intake, no review needed) and “AOP bundle” (OCR extraction, ops review before creation).'),
                    ('Load the bundle', 'Choose “AOP bundle”, click “Load a sample bundle” (or “Choose .zip”), set the batch name, segment and branch.', 'r-batch-bundle', 'One row per customer with the documents found and Complete or “Missing …”.'),
                    ('Look at a document', 'Click View on a row.', 'r-batch-doc', 'The document reader with a tab per document. For the sample bundle it says so: “Sample bundle — no file behind this entry.” A real .zip shows the real pages.'),
                    ('Validate', 'Click “Validate customers →”.', 'r-batch-intake', '“Intake validation”: 9 submitted, 9 identified, 6 accepted, 3 rejected at intake — each with the reason (utility bill too old, no proof of address, no ID).'),
                    ('Process', 'Click “Process 6 applications →”. In live use the first 8 rows each start a real OnboardingCase.', 'r-batch-monitor', 'The batch monitor: Verifying, Awaiting review, With authoriser, Exceptions, Auto-rejected, Accounts open, and the verification services (TIN, CAC, ID document, sanctions, watchlist, adverse media). These screenshots ran without live orchestration, which the monitor says.'),
                    ('One customer', 'Click a customer’s name.', 'r-batch-sheet', 'The customer sheet: Case (the same case view as the desk), Documents and Extraction, with Prev / Next.'),
                    ('What was read', 'Click Extraction.', 'r-batch-sheet-extract', '“Every source agrees”, each field with its confidence, and the verifications.'),
                    ('The batch completes', 'After the maker and verifier have done their part (see the bulk operations guide), open Batch again.', 'r-batch-complete', '5 accounts open with their numbers, 1 parked as an exception.'),
                ],
            },
            {
                'id': 'invites', 'title': 'Invite a payroll list (Excel manifest)', 'time': '2 min',
                'open': DESK, 'sample': '“Load a sample manifest”',
                'why': 'For an employer drive the manifest is the control list: only the people the organisation named are onboarded, and each fills the form themselves.',
                'steps': [
                    ('Load the manifest', 'In New submission choose “Excel manifest” and click “Load a sample manifest” (or “Upload .csv”).', 'r-manifest', 'Reference, first and last name, BVN, NIN, phone and email for 12 people.'),
                    ('Validate', 'Click “Validate 12 rows →”.', 'r-manifest-intake', '12 submitted, 12 accepted, “Every row passed intake. Nothing to send back.”'),
                    ('Watch who finishes', 'Click “Process 12 applications →”, then Invitations.', 'r-invites', 'Invited 12 · Opened the link · Completed · No response, the funnel, and each person with where they got to. “Re-send the link to all” and “Send by WhatsApp” nudge the rest (nothing is sent in the POC).'),
                ],
            },
            {
                'id': 'approvals', 'title': 'Approve within your authority', 'time': '1 min',
                'open': DESK, 'sample': 'Meridian Trading Ltd. · International payment release',
                'why': 'Maker–checker for requests beyond account opening, with the authority limit and a mandatory reason on every decision.',
                'steps': [
                    ('Open Approvals', 'Click Approvals in the rail.', 'r-approvals', 'Pending you, value awaiting, breaching SLA and dual approval, and the requests with their amounts.'),
                    ('Open a request', 'Click Meridian Trading Ltd. — International payment release.', 'r-approval-open', '“Within your approval authority”, the maker’s justification, the checks and the recommendation.'),
                    ('Approve with a reason', 'Click Approve, pick a reason and click “Confirm approval”.', 'r-approval-reason', 'Reason chips: Within policy & limits, Relationship value / retention, Affordability / collateral adequate, Service recovery, Documented exception. Approvals are mock data in the POC.'),
                ],
            },
            {
                'id': 'clients', 'title': 'Look after your clients', 'time': '1 min',
                'open': DESK, 'sample': 'Adaeze Balogun',
                'why': 'The branch book with the next best action per relationship, so the RM talks to the right client about the right thing.',
                'steps': [
                    ('Open Clients', 'Click Clients in the rail.', 'r-clients', 'Relationships, at-risk, next best actions and KYC due, and the book with segment and KYC state.'),
                    ('Customer 360', 'Click Adaeze Balogun.', 'r-client-360', 'Relationship value, products and suggested actions (“Move idle cash to Money Market Fund”) with Propose, Assign to RM and Dismiss. The actions show a confirmation only.'),
                ],
            },
            {
                'id': 'assistant', 'title': 'Chat, agents, alerts and profile', 'time': '2 min',
                'open': DESK, 'sample': 'Signed-in user',
                'why': 'The UiPath agents and tasks behind the desk, in the same rail.',
                'steps': [
                    ('Chat', 'Click Chat under Assistant.', 'r-chat', '“Your conversation” with past conversations with the UiPath agents. A new message calls a live conversational agent.'),
                    ('Explore agents', 'Click “Explore agents”.', 'r-explore', 'Agents, RPA Workflow, Maestro, Case Management, Delegate and Tasks. “Run Now”, “Assign to me” and Approve / Reject inside act on the real tenant.'),
                    ('Alerts', 'Click Alerts.', 'r-alerts', 'Agent alerts with “Review Now” and Dismiss.'),
                    ('Profile', 'Click Profile.', 'r-profile', 'Notifications, appearance, language, the app version, “Sign out” and “Delete account” (which only clears this browser).'),
                ],
            },
            {
                'id': 'mobile', 'title': 'The desk on the RM’s phone', 'time': '1 min',
                'open': DESK_MOBILE, 'sample': 'Signed-in user',
                'why': 'An RM in the field has the same app on their phone.',
                'steps': [
                    ('Open the phone view', 'From the launcher click “On mobile” on the Relationship Manager card.', 'r-mobile', 'A phone frame with the assistant home (“Hello, how can I help you today?”), recently active agents and the bottom bar Home · Chat · Explore · Alerts · Profile. Open an account, Approvals and Customers are cards on Home; Batches, My desk and the case view are desk-only.'),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------ bulk operations
    {
        'slug': 'bulkops', 'name': 'Bulk operations', 'icon': 'layers',
        'who': 'Operations maker and verifier on a bulk batch',
        'app': 'Employee desk → Batches', 'url': DESK,
        'intro': 'For a bundle of scanned forms the BRD makes a person look before an account is created. The maker compares what was read with the form and approves, corrects or flags it; a different person, the verifier, then authorises the accounts, with PND by rule. Anything that cannot be reconciled becomes a managed exception with the full evidence pack.',
        'before': [
            'Submit a bundle first (Relationship manager → “Submit a bulk batch”), so there is something to review.',
            'Open Batches and use “Acting as” at the top right: Relationship Manager · Maker · Verifier. Each persona only sees its own screens — §9.1 keeps maker and checker apart.',
            'Everything on these screens is local to the browser, apart from the Maestro cases the first 8 rows start when processed.',
        ],
        'flows': [
            {
                'id': 'review', 'title': 'Maker: review what was read off the form', 'time': '3 min',
                'open': DESK, 'sample': 'The AOP batch you submitted',
                'why': 'OCR is not 100% accurate, so each OCR-read application passes a brief human checkpoint (BR-DOC-10). The maker sees the form, the read, the reconciliation and the verifications together.',
                'steps': [
                    ('Switch to Maker', 'In Batches click Maker under “Acting as”.', 'b-queue', '“Extraction review · 5 waiting”, lowest confidence first, with lenses All / Low confidence / Reconciliation / Aged over 24h and “Review next →”.'),
                    ('Open one', 'Click Review on the first row.', 'b-review', 'The AOP on the left with unsure boxes highlighted, and on the right “What was read off the form” with a confidence per field.'),
                    ('Reconciliation', 'Look at the green banner.', 'b-review-recon', '“Every source agrees — name and date of birth match across the form, NIBSS and NIMC.” A disagreement is named here.'),
                    ('Verification outcomes', 'Scroll down.', 'b-review-verif', 'TIN – FIRS, CAC registry, ID document, sanctions, internal watchlist, adverse media, NIN and BVN — already run in parallel. Every field you change is logged with your name, the time and the value before.'),
                    ('Or flag it', 'Click “Flag as exception”.', 'b-flag', 'A bar at the bottom: “What is the concern? It travels with the case.” with “Raise the exception” (enabled once you type) and Cancel.'),
                    ('Approve', 'Click “Approve and take the next →” until the queue is empty.', 'b-approve', '“Queue is clear. Everything on this batch has been confirmed and is with the verifier.”'),
                ],
            },
            {
                'id': 'authorise', 'title': 'Verifier: authorise the accounts', 'time': '1 min',
                'open': DESK, 'sample': 'The same batch',
                'why': 'A different person creates the accounts. Business accounts open on PND by rule (§9.2), and the verifier can lift it only against a recorded deferral.',
                'steps': [
                    ('Switch to Verifier', 'Click Verifier under “Acting as”.', 'b-authorise', '“Authorise account opening · 5 ready”, each with product and “PND on”, and on the right “Business accounts open on PND”, “Open operative instead — overrides the PND rule” with a deferral reference, and the maker trail.'),
                    ('Create the accounts', 'Click “Create 5 accounts →”.', 'b-created', '“Nothing is waiting on you.” The accounts are created in the mock Finacle and the RM sees the numbers on the batch.'),
                ],
            },
            {
                'id': 'exception', 'title': 'Requester: dispose of an exception', 'time': '1 min',
                'open': DESK, 'sample': 'The parked row on the batch',
                'why': 'An exception carries its full evidence pack, so whoever receives it does not repeat any verification — and cannot close it without a reason.',
                'steps': [
                    ('Open the exception', 'As Relationship Manager, open Batch and click “Parked →” on the red row (or the Exceptions tab).', 'b-exception', '“What triggered this” (here a verification service persistently unavailable), who it is routed to, and every check with its result, time and evidence.'),
                    ('Decide', 'Pick a “Reason code” and write a “Supporting note”, then “Resolve and resume the case”, “Send to Compliance” or “Return to the customer”.', '', 'The buttons stay disabled until both are filled: “A disposition without a reason and a note is not accepted — every decision has to be reconstructable.”'),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------ operations analyst
    {
        'slug': 'ops', 'name': 'Operations analyst', 'icon': 'dashboard',
        'who': 'An operations analyst on exception triage',
        'app': 'Operations Workbench', 'url': OPS,
        'intro': 'Operations sees every stuck case across the bank, grouped by why it stopped. They clear a cause in one action — retry every NIN check that hit the same gateway timeout — work single cases from the keyboard, and turn a decision they keep making by hand into a rule.',
        'before': [
            'Open the launcher and click the Operations analyst card (localhost:5180/#ops).',
            'Actions on the seeded cases stay in the browser. In a case view, “▶ Run in Maestro” and “Approve … & advance” act on the real tenant.',
            'Keyboard in a case: J / K next and previous, A accept, E escalate, X reject, Esc close.',
        ],
        'flows': [
            {
                'id': 'triage', 'title': 'Triage by cause, not by case', 'time': '2 min',
                'open': OPS, 'sample': 'Needs attention',
                'why': 'Most stuck cases share a handful of causes. Clearing the cause clears every case behind it at once.',
                'steps': [
                    ('Needs attention', 'The workbench opens on Needs attention.', 'o-attention', 'The banner (“27 cases are past SLA… Clear the cause, not the cases”), straight-through, past SLA, unassigned and hours returned, and the “Pattern found” card.'),
                    ('Root causes', 'Scroll to Root causes.', 'o-causes', 'NIMC gateway timeout, BVN did not verify, liveness below threshold, NIN name mismatch, proof of address out of policy, bulk upload partly failed — each with a bulk action and “Review one by one”.'),
                    ('Clear a cause', 'Click “Retry NIN check on all (8)”.', 'o-bulk-retry', 'A confirmation: “Retry NIN check → 8 cases back in the flow”, and the counts drop.'),
                    ('Or open a queue', 'Click a pipeline step in the rail, e.g. Liveness.', 'o-queue', '“Pending liveness” with every case at that step.'),
                    ('The case list', 'On Needs attention, scroll to “Individual cases”; sort by Urgency, Risk, Age or Name.', 'o-list', 'Customer with reason and channel, the Maestro stage bar, outcome, SLA and assignee.'),
                ],
            },
            {
                'id': 'resolve', 'title': 'Resolve one case', 'time': '2 min',
                'open': OPS, 'sample': 'Aisha Yusuf · AO-2026-000007 (name mismatch)',
                'why': 'When a case does need a person, everything they need is on one screen and the decision is one key.',
                'steps': [
                    ('Open a name mismatch', 'Click Aisha Yusuf.', 'o-case-mismatch', 'The problem (“NIMC holds a different spelling”), “Aisha Yusuff” on the form against “Aisha Yusuf” at NIMC, the agent trail, the checks with the risk score, and the applicant.'),
                    ('A liveness failure', 'Open Blessing Okoro.', 'o-case-liveness', 'The liveness gauge at 0.41 against 0.60, and “Request a new selfie” / “Approve manually”.'),
                    ('A live case', 'Open Blessing Eze.', 'o-case-live', '“Live in Maestro · Running” with the stage chips and the case’s real stage. “Approve … & advance” here completes the real task.'),
                    ('Accept', 'On Aisha Yusuf click “Accept NIMC name and continue” (or press A).', 'o-resolve', 'A confirmation for AO-2026-000007 and the next case opens.'),
                    ('A bulk failure', 'Click “Bulk failures”, then Ashaka Cement payroll.', 'o-bulk', '“12 of 180 rows failed at the same step”, with “Retry the 12 failed rows” and “Download the failures”.'),
                ],
            },
            {
                'id': 'rules', 'title': 'Turn a pattern into a rule', 'time': '2 min',
                'open': OPS, 'sample': 'Pattern found: 47 name-mismatch decisions',
                'why': 'If people accept the same thing 47 times out of 47, it is a policy nobody wrote down. Promoting it returns hours every week.',
                'steps': [
                    ('Open Rules', 'Click Rules in the rail.', 'o-rules', 'The candidate at the top and the live rules, each with how many cases it has handled and a Pause button.'),
                    ('Review the evidence', 'Click “Review the 47 decisions”.', 'o-evidence', '“Every name mismatch decision, 12 May to 14 July”: the histogram, a threshold slider and every decision.'),
                    ('Promote', 'Click “Promote at 0.91”.', 'o-promote', '“Rule live at 0.91. 2 open cases cleared.” It joins the live rules.'),
                    ('The decision table', 'Click Edit.', 'o-dmn', 'The OnboardingAutomation DMN table — check, condition, automated action — with “Download .dmn”.'),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------ management
    {
        'slug': 'management', 'name': 'Management', 'icon': 'dashboard',
        'who': 'Head of retail onboarding, operations leads',
        'app': 'Control tower', 'url': TOWER,
        'intro': 'The control tower is a six-page report in the Power BI look over the same case store: how many applications arrived, how many went straight through, where every application sits, why work stops, which channels perform and how long an account takes to open.',
        'before': [
            'Open the launcher and click “Control tower” under Behind the scenes (localhost:5180/#tower).',
            'It reads the local store plus a synthetic 60-day history; the Power BI chrome (File, Export, Share…) is for the look and is disabled.',
            '“Simulate an application” creates a new record that is mirrored to Data Fabric. Leave it alone unless you want a moving number.',
        ],
        'flows': [
            {
                'id': 'overview', 'title': 'Read the report', 'time': '3 min',
                'open': TOWER, 'sample': 'Last 48 hours',
                'why': 'One place to answer “how are we doing” with the same numbers operations works from.',
                'steps': [
                    ('Overview', 'The report opens on Overview.', 'm-overview', 'Applications, straight-through, accounts opened and exceptions against the prior period, applications received, the straight-through gauge against 80%, where every application sits and how work arrives.'),
                    ('Exceptions & SLA', 'Click “Exceptions & SLA” at the bottom.', 'm-exceptions', 'Open work, breached SLA, at risk, oldest item, “Why work stops”, queue load by routing rule and aging.'),
                    ('Flow', 'Click Flow.', 'm-flow', 'The account opening Sankey from channel through verification to outcome.'),
                    ('Channels', 'Click Channels.', 'm-channels', 'Bulk payroll, branch and digital, intake and straight-through by channel, and top employers.'),
                    ('Verification', 'Click Verification.', 'm-verification', 'First-time right, failures, timeouts and retries, and result by check.'),
                    ('Timing', 'Click Timing.', 'm-timing', 'Median and 90th percentile time to open, and when applications arrive by hour and weekday.'),
                ],
            },
            {
                'id': 'filter', 'title': 'Filter and change the range', 'time': '1 min',
                'open': TOWER, 'sample': 'Bulk payroll',
                'why': 'Every visual answers the same question for a slice: one channel, one outcome, one failing check.',
                'steps': [
                    ('Open Filters', 'Click Filters.', 'm-filters', 'Channel, verification, outcome and failing check, each with counts.'),
                    ('Filter a channel', 'Tick “Bulk payroll”.', 'm-filtered', '“Filtered by: Channel: Bulk payroll” and every visual recalculated. “Clear all” removes it. Clicking a bar or a Sankey node filters the same way.'),
                    ('Change the range', 'Click “7 days”.', 'm-range', 'The same report over 7 days; 24 hours, 48 hours and 30 days are there too.'),
                ],
            },
        ],
    },
    # ------------------------------------------------------------------ presenter
    {
        'slug': 'presenter', 'name': 'Presenter and admin', 'icon': 'play',
        'who': 'Whoever runs the demo',
        'app': 'Launcher and the tools behind the scenes', 'url': LAUNCHER,
        'intro': 'The launcher opens every surface; the tools behind it are the bank’s systems stood in for — the case in Maestro, the Kafka stream, Finacle, the notification service and FaceID — plus the admin console that sets the brand, the market and the operating rules.',
        'before': [
            'Open localhost:5180. Every card opens in a new tab.',
            'Case management’s “▶ Run in Maestro” and “Approve {Stage}” act on the real tenant; the admin console’s Connect, Provision and “Publish to Data Fabric” write to the tenant you connect.',
        ],
        'flows': [
            {
                'id': 'launcher', 'title': 'Open the demo and reset it', 'time': '1 min',
                'open': LAUNCHER, 'sample': '—',
                'why': 'Role first: you pick who you are, and it opens the tool that role uses.',
                'steps': [
                    ('The launcher', 'Open localhost:5180.', 'p-launcher', 'The feature guide banner, then Who are you? — Relationship Manager, Operations analyst, Customer — each with its other surfaces and a “Step-by-step guide” link.'),
                    ('Behind the scenes', 'Scroll down.', 'p-launcher-tools', 'The feature guide, Mock Kafka console, Mock Finacle UI, Notification service, Control tower, Case management and FaceID.'),
                    ('Reset before a run', 'Click “↺ Reset demo data”, then “Yes, reset”.', '', 'The pipeline reseeds: exceptions come back and ages are current. Branding is kept. Records on the shared tenant are not touched.'),
                ],
            },
            {
                'id': 'cases', 'title': 'Show the case in Maestro terms', 'time': '2 min',
                'open': CASES, 'sample': 'Blessing Eze; Amina Obi for a secondary stage',
                'why': 'The OnboardingCase as a case plan: five stages, the tasks in each — agent, robot, human, app, gateway — and the four stages a case can divert into.',
                'steps': [
                    ('The canvas', 'Open Case management from the launcher.', 'p-cases', 'OnboardingCase with Start onboarding, then Intake, Verification, Decision, Activation and Closure, each with its SLA, duration and tasks, and where it may route to.'),
                    ('Secondary stages', 'Scroll down.', 'p-cases-secondary', 'Compliance escalations, EDD review, Pending customer and Declined / withdrawn, with where each comes from and whether it loops back.'),
                    ('Pick a case', 'Choose AO-2026-000137 · Amina Obi in the case list.', 'p-cases-pick', '“Compliance hold”: the case lit in Compliance escalations. The canvas is drawn from the local record; “▶ Run in Maestro” starts a new real instance.'),
                ],
            },
            {
                'id': 'systems', 'title': 'The bank’s systems: Kafka, Finacle, notifications', 'time': '2 min',
                'open': KAFKA, 'sample': 'Any',
                'why': 'Every step on the case lands somewhere the bank already runs. These stand-ins read the same store, so they move as the demo moves.',
                'steps': [
                    ('Kafka event stream', 'Open Mock Kafka console.', 'p-kafka', 'Events across the eight topics — account-opening-requested, nin-validation, bvn-validation, account-created, bulk-upload, exception-queue, customer-notification…'),
                    ('One topic', 'Click account-created.', 'p-kafka-topic', 'Only the “Finacle account … created for …” events.'),
                    ('Finacle', 'Open Mock Finacle UI.', 'p-finacle', 'CIFs, active accounts, “Limited (KYC pending)” and opened today, and every account with its status.'),
                    ('An account', 'Click Blessing Eze.', 'p-finacle-account', 'The account card, customer and account details.'),
                    ('Notification service', 'Open Notification service, then click Blessing Eze.', 'p-comms-thread', 'Every SMS and WhatsApp the customer received, with delivery status. Nothing is actually sent.'),
                ],
            },
            {
                'id': 'faceid', 'title': 'FaceID: the console and the kiosk', 'time': '2 min',
                'open': FACEID, 'sample': '—',
                'why': 'The selfie check is a liveness and 1:1 match service. The console is where the bank reviews every check; the kiosk is the walk-up version.',
                'steps': [
                    ('Sign in', 'Open FaceID Verify console and click “Sign in with {BANK}”.', 'p-faceid-login', '“Verify a real, live person. In seconds.” No credentials are asked for.'),
                    ('Dashboard', 'You land on the dashboard.', 'p-faceid', 'Enrolled identities, verifications today, pass rate, spoofs blocked, recent verifications and what needs attention.'),
                    ('Identities', 'Click Identities.', 'p-faceid-identities', 'Every enrolled identity (the opened accounts) with “Verify now”, “Update photo” and remove.'),
                    ('Settings', 'Click Settings.', 'p-faceid-settings', 'Face match similarity 80%, liveness confidence 70%, detection mode, region and security.'),
                    ('The kiosk', 'Open FaceID kiosk. For a result without a camera add ?demo=success or ?demo=mismatch before the #.', 'p-kiosk-success', '“Customer Verification Complete” with face match and liveness passed. A real scan uses the camera and AWS.'),
                    ('A failed match', 'Use ?demo=mismatch.', 'p-kiosk-mismatch', '“Verification Failed — the submitted selfie does not sufficiently match the identity document on file.”'),
                ],
            },
            {
                'id': 'admin', 'title': 'Configure the demo', 'time': '2 min',
                'open': ADMIN, 'sample': 'admin / admin',
                'why': 'Brand, market, SLAs and routing are configuration, not code — the same app can be shown to another bank or country.',
                'steps': [
                    ('Sign in', 'Open localhost:5180/#admin (it is deliberately not on the launcher) and sign in with admin / admin.', 'p-admin-login', '“Demo admin gate — sign in with admin / admin.”'),
                    ('Choose a configuration', 'Pick a saved configuration or create one.', 'p-admin-picker', '“Choose a configuration” with Load preset, Rename, Delete and Create. “Connect a UiPath tenant instead” uses a PAT.'),
                    ('Branding and market', 'Load one. The Branding tab holds the app name, colours, logo and Country.', 'p-admin-branding', 'Changing Country relocalises names, currency, phone and ID formats and the KYC authorities — and reseeds the store.'),
                    ('Operations', 'Click Operations.', 'p-admin-ops', 'Straight-through target, exception SLA, retry backoff and queue routing (cause → queue → owner) — what the control tower measures against.'),
                    ('Features', 'Click Features.', 'p-admin-features', 'Feature flags and the bottom-navigation tabs. “Save configuration” keeps it in this browser; “Publish to Data Fabric” writes it to the tenant.'),
                ],
            },
        ],
    },
]
