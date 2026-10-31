# Account Opening Workspace: Design Language

This is the look and feel of the Stanbic IBTC Account Opening workspace, taken from the source code and organised page by page. It is written for reproducing that look in another project.

All values are the actual values in the code. Line references are relative to `src/` unless marked `public/` or `/`. Where a value is a `color-mix()` of the brand colour, the approximate hex for the Stanbic brand is shown next to it.

---

## Contents

0. Surface map: the three visual families
1. Foundations (shared across every page)
2. Launcher `/`
3. Relationship Manager: desk `/employee-web`
4. Relationship Manager: phone `/employee-mobile`
5. Operations analyst: Operations Workbench `/ops`
6. Customer: banking app `/customer-mobile` · `/customer-web`
7. Customer: account opening, status and the KYC link `/kyc/:token`
8. Behind the scenes: Kafka, Finacle, Comms, Control tower, Case management
9. FaceID Verify console `/faceid` and kiosk `/faceid-kiosk`
10. Admin / branding console `/admin`
11. Porting checklist and known inconsistencies

---

## 0. Surface map

The workspace is one product with **three visual families**. When you port a page, choose its family first.

| Family | Feel | Pages |
|---|---|---|
| **A. Institutional** | Swiss private bank and editorial. IBM Plex Sans and Mono, **square corners everywhere**, hairline rules rather than floating cards, a navy rail derived from the brand colour, dense 14px base text | Launcher, RM desk, Ops workbench, Kafka, Finacle, Comms, Case management, FaceID console |
| **B. Consumer** | Light and airy mobile banking. Poppins headings, Inter body text, 14–26px radii, soft shadows, brand-gradient hero cards, phone bezel on desktop | Customer app (mobile and web), account-opening wizard, KYC link, RM phone, FaceID kiosk (dark variant) |
| **C. Imitation** | Deliberately copies a third-party product's chrome | Control tower (Microsoft Power BI / Fabric), Case management canvas (UiPath Maestro), inside a family-A top bar |

Routes and shells (`skeleton/routes.ts`):

| Route | Surface | Shell |
|---|---|---|
| `/` | Launcher (role-first front door) | web |
| `/employee-web` | RM desk | web |
| `/employee-mobile` | RM phone | phone bezel |
| `/ops` | Operations Workbench (an iframe of `public/ops-console.html`) | web |
| `/customer-mobile` | Customer banking app | phone bezel |
| `/customer-web` | Customer internet banking | web |
| `/kyc/:token` | Customer KYC completion link | phone bezel, no Home button |
| `/kafka` `/finacle` `/comms` `/tower` `/cases` | Demo instruments | web |
| `/faceid` `/faceid-kiosk` | FaceID console / kiosk | web / phone frame |
| `/admin` | Branding and config (not linked from the launcher) | web |

`html[data-shell="web"]` (`skeleton/skeleton.css`) switches off the phone bezel, restores normal document scroll, and sets `background:#eef2f7`.

---

## 1. Foundations

### 1.1 The brand is data, not code

Every surface reads the tenant brand at runtime. **No page hardcodes the brand colour.** A page uses either the CSS variables or a `color-mix()` of them.

**Branding config fields** (`config/types.ts:19-49`):

| Field | Meaning |
|---|---|
| `appName` | Tab title ("Stanbic IBTC — Account Opening"), wordmark, login copy |
| `tagline` | Login and welcome tagline |
| `greeting` | Greeting word on the home screen (localised by `country`) |
| `country?` | Market localisation (default NG). Relabels BVN/NIBSS and NIN/NIMC |
| `primaryColor` | Main brand colour |
| `secondaryColor` | Companion colour (sky) |
| `accentColor` | Accent colour |
| `deepBlue` | Dark navy. Used for the favicon plate and FaceID surfaces |
| `logo` | Full wordmark, **for light surfaces** |
| `logoLight` | Variant for dark or navy rails |
| `logoSize` | `small 42px/40%`, `medium 64px/58%`, `large 96px/84%` |
| `favicon` | Square mark. Also used as the in-rail brand mark |

**Presets** (`config/presets.ts`, `config/default.ts`):

| | **Stanbic IBTC** (the effective default) | Aura AI (bundled default) | Zara AI |
|---|---|---|---|
| primary | `#0033A1` Stanbic blue | `#FA4616` Robotic orange | `#FF3333` |
| secondary | `#0091DA` sky | `#0BA2B3` Agentic teal | `#1E6482` |
| accent | `#0091DA` | `#0BA2B3` | `#1A1A1A` |
| deepBlue | `#012169` | `#182126` | `#182126` |
| tagline | "Banking that moves with you" | "Your AI assistant, at your fingertips" | same as Aura |
| assets | `stanbic-logo.png` (blue on transparent), `stanbic-logo-light.png`, `stanbic-favicon.png` (flat blue shield) | none | none |

**Runtime variables.** A brand bridge sets these on `:root` for each surface: `App.tsx:1005` for the desk and phone, `instruments/brand.ts` for the instruments, `skeleton/index.tsx` for the launcher, `ConsumerApp.tsx:43` for the consumer app, and `CustomerApp.tsx:30` for the KYC link.

```css
--brand-primary: #0033A1;      --brand-primary-rgb: 0,51,161;
--brand-secondary: #0091DA;    --brand-secondary-rgb: 0,145,218;
```

The defaults that apply before the config loads are Aura orange and teal (`index.css:7-13`). The bridge also sets `document.title = "<appName> — <surface>"` and the favicon. When no favicon has been uploaded, `config/favicon.ts` generates one: a 32×32 SVG, `rect rx=7` filled with deepBlue, and a white initial in Arial 700 at 19px.

**The derivation pattern.** Copy this pattern exactly. It is what lets one hex re-theme a whole surface:

```css
--brand:        var(--brand-primary);
--brand-rgb:    var(--brand-primary-rgb);                     /* only for rgba() tints/scrims */
--navy:         color-mix(in srgb, var(--brand) 62%, #000);   /* rail / dark surfaces  ≈ #002064 */
--navy-2:       color-mix(in srgb, var(--brand) 78%, #000);   /* rail hover/active/rules ≈ #00287E */
--brand-hover:  color-mix(in srgb, var(--brand) 82%, #000);   /* primary button hover ≈ #002A84 */
--on-navy:      color-mix(in srgb, var(--brand) 18%, #fff);   /* text on navy ≈ #D1DAEE */
--on-navy-dim:  color-mix(in srgb, var(--brand) 42%, #fff);   /* dim text on navy ≈ #94A9D8 */
/* consumer gradients: brand → color-mix(brand 55–60%, #000) at 140–150deg */
```

**The rule for data colours.** Chrome follows the brand. Semantic colours (good, warn, bad) are **fixed** and never re-branded: "a breached SLA has to look wrong no matter which palette a tenant picked" (`instruments/tower/metrics.ts`).

### 1.2 Fonts

| Face | Weights | Source | Used by |
|---|---|---|---|
| **IBM Plex Sans** | 400/500/600/700 | Google Fonts (`/index.html:83-89`) | Family A: all body text, headings and numerals |
| **IBM Plex Mono** | 400/500/600 | Google Fonts | Family A: IDs, references, table headers, eyebrows |
| Libre Franklin | 400–700 | Google Fonts | Fallback after Plex |
| **Poppins** | 400/500/600/700/900 | self-hosted `/fonts/Poppins-*.woff2`, `font-display:block` | Family B: headings and money |
| **Inter** | variable 100–900 | self-hosted `/fonts/Inter.woff2` | Family B: body text |
| Segoe UI | system font | — | Tower (Power BI) and the Launcher pill |

Family-A stack: `'IBM Plex Sans','Libre Franklin','Inter',system-ui,sans-serif`, base size **14px**, `-webkit-font-smoothing:antialiased`.
Mono stack: `'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace`.
Numerals: `.num { font-family: var(--num); font-variant-numeric: tabular-nums }`. Apply it to **every** count, amount, SLA, age, ID, account number, BVN/NIN and phone number.

### 1.3 Family-A neutral and semantic tokens (desk, ops and instruments are byte-identical)

```css
/* ink ramp */       --ink:#0b1220; --ink-2:#566072; --ink-3:#8a93a1; --ink-4:#9aa3b0;
/* paper */          --page:#ffffff; --surface:#ffffff; --wash:#f5f7fa;
/* lines */          --line:#e6e9ef; --line-2:#dfe3ea; --line-3:#eef1f5;
/* success */        --green:#12805c; --green-bg:#ecf6f1; --green-ink:#0f6f4f;  (line #cfe9d9)
/* critical */       --red:#d1443a;   --red-bg:#fbeceb;   --red-ink:#b42318;   --red-line:#f2ccc8;
/* warning */        --amber:#c99a3e; --amber-bg:#fbf4e6; --amber-ink:#9a6b1e; --amber-line:#ecdcc4;
/* idle dot */       --gray-dot:#c4c9d2;
/* content column */ --col:1520px;
```

There is also a brighter, Tailwind-like **status** palette, used inline for state tags, SLA and checks:

- red `#dc2626` / `#b91c1c` / `#fdf3f3`
- amber `#d97706` / `#b45309` / `#fdf6e8`
- green `#16a34a` / `#15803d` / `#f0f9f3`
- blue `#0033A1` / `#eef2fa`

### 1.4 Shape, elevation, focus

- **Family A: `border-radius: 0` on every surface.** Cards, buttons, inputs, modals, chips, tiles, dropdowns and toasts are all square. The only exceptions are circles (avatars, status dots), 2–4px on tiny bars and kbd keys, and the 999px Launcher pill.
- **Family A elevation:** almost none. Structure comes from 1px hairlines. Shadows appear only on floating things:
  - dropdown `0 18px 44px -10px rgba(0,0,0,.5)`
  - modal `0 24px 60px -14px rgba(0,0,0,.45)`
  - toast `0 12px 28px -8px rgba(0,0,0,.4)`
  - brand chip on navy `0 1px 2px rgba(0,0,0,.25)`
- **Family B:** radii 11/14/16/18/20/22/26 and 999, with soft layered shadows (see §6.1).
- **Focus ring:** `:focus-visible { outline:2px solid var(--brand-secondary); outline-offset:2px; border-radius:4px }` (Power BI uses its own `#0f6cbd`).
- **Scrollbars (family A):** 10px wide, square thumb `#d5d5cf`, `border:2px solid transparent; background-clip:content-box`. On phone surfaces scrollbars are hidden globally.

### 1.5 Iconography (every page)

- Inline SVG in the Lucide/Feather style: `viewBox 0 0 24 24`, `fill:none; stroke:currentColor`, round caps and joins, `aria-hidden`.
- Stroke width is **1.75–1.9**: 1.8 on the desk, customer and ops pages; 1.7 on consumer and Power BI; 1.75 on the launcher. Emphasis glyphs use 2.2–2.6, and checks inside discs use 3.
- Sizes:
  - 13–14px inline chips
  - 15–16px navigation
  - 17–18px close and search
  - 19–22px tiles
  - 23–24px quick actions
  - 38–44px success ticks
- Unicode glyphs are part of the language. `→` means move forward. `↗` means open an external surface. The other glyphs: `▶` run, `✓ ✓✓` done/delivered, `●` live, `▲` alert, `·` joins metadata, `—` joins a clause, `↻` re-run, `⚡` Maestro, `⚠` warning.
- In family B, icons always sit inside tinted rounded squares or circles, never bare. Chevrons are the exception.

### 1.6 Motion (every page)

- Short and functional: hover and segmented controls 0.12–0.2s, chevron rotation 0.15–0.18s, modal pop 0.16–0.2s.
- Live dot: `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }` at 2s, or 1.6s on an active step.
- New-row arrival flash (instruments): `from{opacity:0; transform:translateY(-4px); background:rgba(brand,.10)}`, 0.4s ease-out.
- Modal pop: `from{opacity:0; transform:translateY(8px) scale(.97)}`, 0.18s `cubic-bezier(.2,.9,.3,1.2)`.
- Button press: `translateY(1px)` on the desk, `scale(.985)` on ops, `scale(.99)` on customer pages.
- **Every surface honours `prefers-reduced-motion: reduce`** by switching off all animation.

### 1.7 Voice (every page)

- **Sentence case** in source strings. UPPERCASE appears only through CSS, on eyebrows, labels and tags.
- Plain, declarative, second person, no exclamation marks in staff tools. The copy says **why**, not only what.
- `·` joins metadata: "AO-2026-000107 · opened 3h ago". `—` joins a clause.
- Empty states have two parts: a bold one-liner, then a sentence saying where to act to make data appear.
- Destructive copy states the consequences, and the cancel button says "Keep it", not "Cancel".
- Staff tools translate system states into human terms: "BVN & NIN needs a person" rather than a raw state name.

### 1.8 Global "← Launcher" pill (`skeleton/HomeButton.tsx`)

This pill is on every route except `/` and `/kyc`. **Surfaces reserve the bottom-left corner for it**: desk rail `padding-bottom:46px`, ops rail `52px`, Power BI rail `margin-bottom:34px`.

```js
position:'fixed', bottom:12, left:14, zIndex:2147483000,
font:'600 12px/1 "Segoe UI", system-ui', letterSpacing:'.01em', color:'#0b1220',
background:'rgba(255,255,255,.92)', border:'1px solid #dfe3ea', borderRadius:999, padding:'7px 12px',
boxShadow:'0 1px 2px rgba(11,18,32,.06), 0 6px 18px -10px rgba(11,18,32,.35)', backdropFilter:'blur(6px)'
```

### 1.9 Phone bezel (family B on desktop, `index.css:118-190`, at `min-width:500px`)

```css
body { background:#fff; display:flex; align-items:center; justify-content:center; min-height:100dvh; }
body::before { position:fixed; inset:0; background:     /* four soft brand glows */
  radial-gradient(ellipse 50% 45% at 10% 15%, rgba(var(--brand-primary-rgb),.25) 0%, transparent 60%),
  radial-gradient(ellipse 45% 40% at 90% 85%, rgba(var(--brand-primary-rgb),.22) 0%, transparent 60%),
  radial-gradient(ellipse 40% 35% at 85% 10%, rgba(var(--brand-primary-rgb),.18) 0%, transparent 55%),
  radial-gradient(ellipse 35% 30% at 20% 80%, rgba(var(--brand-primary-rgb),.15) 0%, transparent 55%); }
#root { width:390px; height:min(844px, calc(100dvh - 24px)); border-radius:52px; overflow:hidden;
  box-shadow: 0 0 0 2px #2c2c2e, 0 0 0 3px #3a3a3c, 0 0 0 14px #38383a,
              0 0 0 15px #48484a, 0 0 0 16px #2c2c2e, 0 4px 20px rgba(0,0,0,.12); }
#root::before, #root::after { /* 4px side buttons, 68px / 80px tall, linear-gradient(#38383a,#48484a,#38383a) */ }
#root * { min-width: 0; }   /* load-bearing for horizontal carousels */
```

- There is no notch and no fake status bar. Headers pad the top by `max(env(safe-area-inset-top), 12px)`.
- On a real phone narrower than 500px there is no bezel, and the background is `#e8ebed` in light mode.

---

## 2. Launcher `/`

`skeleton/index.tsx`, `skeleton/launcher.css`. Family A, light.

**Concept:** the page is **role-first, not app-first**. You pick who you are, and the page opens the tool that role uses. Every link opens in a new tab (`target=_blank rel=noopener`) and navigates by hash (`#employee-web`), so it survives a coded-app base path.

### Tokens (scoped to `.ld`)
```css
--ld-brand: var(--brand-primary, #0033A1);  --ld-brand-rgb: var(--brand-primary-rgb, 0,51,161);
--ld-ink:#0b1220; --ld-text:#4a5261; --ld-soft:#566072; --ld-faint:#9aa3b0;
--ld-line:#e6e9ef; --ld-line-2:#eef1f5; --ld-panel:#fff; --ld-ground:#fff;
font-family:'IBM Plex Sans','Libre Franklin','Inter',-apple-system,system-ui,sans-serif;
```
Two demo tool accents are passed in as `--a`: violet `#7C5CF0` and slate `#64748B`.

### Layout
- `.ld` owns its own scroll (`height:100dvh; overflow-y:auto`).
- Inner column: `max-width:940px; margin:0 auto; padding:60px 28px 84px`, or `44px 18px 60px` below 560px.
- **Hero wash**, behind the top 400px only:
  ```css
  radial-gradient(760px 320px at 18% -30%, rgba(brand,.10), transparent 62%),
  radial-gradient(620px 280px at 92% -20%, rgba(brand,.05), transparent 60%);
  ```

### Hero
- Logo: `max-height:38px; max-width:190px`, left-aligned. The fallback is a 32px **square** brand mark with the app name at 600 15px.
- `h1` "Account Opening": `700 clamp(34px,4.6vw,48px)/1.04`, tracking `-.035em`, colour ink.
- Sub: 16px/1.55, soft, `max-width:580px`, with `<b>` in ink 600. The copy reads: "One workspace. **Pick who you are** and it opens the tool that role uses — the same system, doing a different job."

### Section heads
- `.ld-group-h`: label `700 15px`, `-.01em`, ink. A right-hand note `500 11.5px`, faint, `.04em`, e.g. "for the demo".
- The two sections are "Who are you?" and "Behind the scenes".

### Person cards ("Who are you?")
- Grid `repeat(2,minmax(0,1fr))` with a 12px gap, dropping to 1 column below 720px.
- Card: white, 1px `--ld-line`, **radius 0**.
  - Resting shadow: `0 1px 2px rgba(16,26,40,.04), 0 10px 28px -14px rgba(16,26,40,.14)`.
  - Hover: border `rgba(brand,.38)`, shadow `0 16px 36px -14px rgba(brand,.34)`, lifts `translateY(-1px)`, and the chevron slides 3px and turns brand. Transition 0.18s.
- Body: padding 16, gap 14.
  - Icon tile: 44px square, `rgba(brand,.09)` fill, `rgba(brand,.2)` border, brand icon.
  - Name `600 15px`, `-.01em`.
  - Role sub `600 10.5px`, `.09em`, UPPERCASE, faint.
  - Description 12.75px/1.5, soft.
- Alternate-surface links sit below, indented 74px: "On web", "On mobile", "KYC link".
  - Style: `500 12px`, brand text on `rgba(brand,.07)`, `rgba(brand,.16)` border, square, padding `6px 10px`.
- The three people:
  - **Relationship Manager** · BRANCH DESK · "Open accounts, chase your own pipeline, approve, and look after your clients."
  - **Operations analyst** · EXCEPTION TRIAGE · "Clear stuck cases across the whole bank by cause, in bulk, and write rules so they stop."
  - **Customer** · YOUR OWN BANKING APP · "Open an account yourself in minutes, then watch it happen — no branch, no waiting."

### Tool list ("Behind the scenes")
- One panel: white, 1px line, square, shadow `0 10px 28px -14px rgba(16,26,40,.10)`.
- Rows:
  - Padding `13px 16px`, `--ld-line-2` separators, hover `#f5f7fa`.
  - Icon tile: 36px, `color-mix(--a 10%, #fff)` with a 20% border.
  - Name and description.
  - Mono URL chip on the right: `500 12px ui-monospace`, `--a` text on `color-mix(--a 9%,#fff)`, hidden below 560px.
  - Chevron.
- Rows: Mock Kafka console · Mock Finacle UI · Notification service · Control tower · Case management · FaceID Verify console · FaceID kiosk.

### Footer
- 12.25px faint: "Mock data throughout — nothing here is connected to a production system."
- **Reset demo data** is a two-click confirm:
  - Trigger: an outlined ghost button, "↺ Reset demo data".
  - Confirm text: "Reset the pipeline to its starting state? … Branding is kept."
  - Buttons: solid brand "Yes, reset" and a text-only "Cancel".

### Monoline icons
Lucide-style at stroke 1.75: phone, monitor, dashboard, user, link, sliders, activity, landmark, briefcase, message. The chevron uses stroke 2.

---

## 3. Relationship Manager: desk `/employee-web`

Files: `employee/desk.css` (the source of truth, 1030 lines), `employee/DeskShell.tsx`, `ui.tsx`, `roles.ts`, `maestroStatus.tsx`, `nba.ts`, `CallPanel.tsx`, and `screens/*`. Family A.

The RM desk and the RM phone are **one React app with two shells** (`App.tsx:809-977`). They share features but look nothing alike.

### 3.1 Tokens (`.dk`, `desk.css:12-61`)
```css
.dk {
  --d-brand: var(--brand-primary, #0033A1);   --d-brand-rgb: var(--brand-primary-rgb, 0,51,161);
  --d-accent: var(--brand-secondary, #0091DA);
  --d-rail:      color-mix(in srgb, var(--d-brand) 62%, #000);   /* ≈ #002064 */
  --d-rail-2:    color-mix(in srgb, var(--d-brand) 78%, #000);   /* ≈ #00287E */
  --d-on-rail:   color-mix(in srgb, var(--d-brand) 18%, #fff);   /* ≈ #D1DAEE */
  --d-on-rail-dim: color-mix(in srgb, var(--d-brand) 42%, #fff); /* ≈ #94A9D8 */
  --d-brand-hover: color-mix(in srgb, var(--d-brand) 82%, #000);
  --d-ink:#0b1220; --d-ink-2:#566072; --d-ink-3:#8a93a1; --d-ink-4:#9aa3b0;
  --d-page:#fff; --d-surface:#fff; --d-line:#e6e9ef; --d-line-2:#dfe3ea; --d-line-3:#eef1f5; --d-wash:#f5f7fa;
  --d-green:#12805c; --d-green-bg:#ecf6f1; --d-green-ink:#0f6f4f;
  --d-red:#d1443a; --d-red-bg:#fbeceb; --d-red-ink:#b42318; --d-red-line:#f2ccc8;
  --d-amber:#c99a3e; --d-amber-bg:#fbf4e6; --d-amber-ink:#9a6b1e; --d-amber-line:#ecdcc4;
  /* RESERVED priority accent — only for "your next move", never chrome */
  --d-gold:#9a6b1e; --d-gold-bg:#faf4ea; --d-gold-ink:#855b16; --d-gold-line:#ecdcc4;
  --d-gray-dot:#c4c9d2;
  --d-num:'IBM Plex Sans','Libre Franklin',system-ui,sans-serif;
  --d-mono:'IBM Plex Mono',ui-monospace,'SFMono-Regular',menlo,monospace;
  --d-col:1520px;  --d-bar:66px;   /* logo band height == utility bar height so the rules align */
  height:100dvh; display:grid; grid-template-columns:228px minmax(0,1fr); overflow:hidden; font-size:14px;
}
```
The desk also uses some off-token literals:
- warm hover washes `#fafaf7` and `#fcfcfa`
- segmented-control track `#ecece7`
- step panel `#fbfbf9`
- delete zone `#fdfcfb`

### 3.2 Typography
| Role | Spec |
|---|---|
| Hero customer name | 22 / 700 / -.025em / lh 1.1 |
| Page title `h1` | 19 / 700 / -.02em; trailing count 13/400 tabular `#a0a09a` |
| Page subline | 12.5 ink-2 ("Assisted capture · branch pipeline") |
| Pane / modal title | 15–16 / 700 / -.01em |
| NBA card title / attention headline | 15 / 600 / -.01em |
| Row name | 13.5 / 600 / -.01em, ellipsis |
| Row body | 12.5 ink-2 |
| Prose ("why") | 13.5 / lh 1.6 ink-2, max 78ch |
| Reference / ID | **Mono** 11.5 tabular ink-3 |
| Eyebrow `.dk-eyebrow` | **Mono** 10.5 / 500 / .1em / UPPER ink-3; number `.no` in gold-ink 600; trailing hairline `.ln` |
| Table column header | **Mono** 10 / 500 / .08em / UPPER ink-4, 32px tall |
| Rail section head | 10.5 / 600 / .14em / UPPER on-rail-dim |
| Hero eyebrow | 10.5 / 700 / .14em / UPPER gold-ink |
| KPI label | 11 / 600 / .07em / UPPER ink-3 |
| **KPI numeral** | **32 / 700 / -.025em / lh 1, tabular**; suffix 12.5/500 ink-3 |
| Account-plate number | 19 / 700 / **+.03em** (spaced digits) |
| Tag / chip | 10.5 / 700 / .03–.04em / UPPER |
| Micro label | 8.5–9 / 700 / .04–.05em / UPPER |
| Button | 12.5 / 600 (`.lg` 13) |

### 3.3 Shell
**Nav rail** `.dk-side` (228px, or 64px in slim mode, persisted in `localStorage 'dk_rail_slim'`). Background `--d-rail`, text `--d-on-rail`, `padding-bottom:46px` (the Launcher corner). Top to bottom:
1. **Logo band**, 66px tall, padding `0 18px`, gap 10.
   - `.dk-mark` is a **30×30 white square chip** (`box-shadow:0 1px 2px rgba(0,0,0,.25)`) holding the favicon.
   - Wordmark: `b` is the app name at 15/600 white; `em` "Employee" is 10.5 dim, .04em.
2. **Role switcher**, the signature shared with ops. Border-bottom rail-2.
   - Button padding `11px 18px`. Name 13.5/600 white ("Relationship Manager"). Sub 10.5 UPPER .04em dim ("BRANCH DESK").
   - The chevron sits at 90° and turns to −90° when open (0.15s).
   - Dropdown: **white**, square, `top:calc(100% + 4px)`, 10px insets, `box-shadow:0 18px 44px -10px rgba(0,0,0,.5)`.
     - Header "Same workspace — different job" at 10/700 .1em UPPER ink-4.
     - Items: name 13/600 (brand colour and ✓ when current), 11.5 ink-2 blurb.
3. **Nav**, padding `8px 12px`. Sections "Your desk" (My desk, Open an account, Approvals, Clients) and "Assistant" (Chat, Explore agents, Alerts, Profile).
   - `.dk-nav` item: padding 8, gap 10, 13.5px, 15px icons at opacity .85.
   - Hover rail-2. **Active** (`aria-current`): rail-2 background, #fff, 600. There is **no accent bar**.
   - Badge: 11px tabular, padding `1px 6px`, `rgba(255,255,255,.1)`. `.hot` is solid red. `.new` is accent. Capped at "99+".
4. **Shrink toggle**: padding `10px 18px`, border-top rail-2, 13px dim, double chevron.
5. **Footer**: 30px **circle** avatar on rail-2 (the only round element in the rail), name 12.5/600, email 11 dim, and a sign-out icon.

In **slim mode** the labels are hidden, section heads become 1px rail-2 hairlines, and badges become 8px dots at `top:7px; right:12px`.

**Utility bar** `.dk-util`: height 66px, padding `0 24px`, 1px line bottom border, white.
- Search `.dk-find`: max 520px. Input padding `9px 12px 9px 34px`, 1px line-2, square, 13.5px. Placeholder "Search customers, applications, references". Icon `#a8a8a2`. The results dropdown has shadow `0 16px 40px -12px rgba(17,24,29,.28)`.
- Right side: "● Live", 12.5/600 green, with a 7px pulsing dot.

**Body:** `.dk-scroll` is the one scroll region. `.dk-body` padding is `8px 24px 28px`, and `.dk-col` is `max-width:1520px; margin:0 auto`. Full-bleed bands use `width:calc(100% - 48px); max-width:1520px; margin:0 auto`.

**Two-pane split** `.dk-split`: one column at rest. In `.busy` it becomes `minmax(0,1fr) minmax(400px,520px)` with `border-left:1px solid line` on the right pane. Below 1180px only one pane shows.

### 3.4 Components
**Buttons**
```css
.dk-btn { border:1px solid var(--d-line-2); border-radius:0; padding:8px 14px; font-size:12.5px; font-weight:600;
  background:#fff; color:var(--d-ink); display:inline-flex; align-items:center; gap:7px; }
.dk-btn:hover { background:var(--d-wash); }  .dk-btn:active { transform:translateY(1px); }
.dk-btn.pri { background:var(--d-brand); border-color:var(--d-brand); color:#fff; }  .dk-btn.pri:hover { background:var(--d-brand-hover); }
.dk-btn.lg { padding:10px 18px; font-size:13px; }   .dk-btn:disabled { opacity:.45; }
.dk-btn.danger { color:#b91c1c; border-color:#f0c9c9; background:#fff; }        /* outlined at rest… */
.dk-btn.danger:hover:not(:disabled) { background:#b91c1c; border-color:#b91c1c; color:#fff; }   /* …solid on hover */
```
Other button styles:
- **Text links**: 12/600 brand, underline on hover, with a trailing `↗` for external targets ("Open in Maestro ↗").
- **Skip**: 12.5/600 ink-3, hover brand, "Skip for now →".
- **Dashed CTA**: brand text, `rgba(brand,.06)` fill, `1px dashed rgba(brand,.4)`, "▶ Run this case in Maestro".
- **Details** button in the case header: the **one 8px-radius button on the desk**.

**Segmented filters** `.dk-segs`
- Track `#ecece7` with padding 3.
- Buttons: `5px 11px`, 12.5/500 ink-2.
- Pressed: white, ink, 600, `box-shadow:0 1px 2px rgba(0,0,0,.06)`.

**Case-pane tabs** `.dk-tabs`
- Wash track, padding 4, equal-width buttons at 12.5/600.
- Selected: white with `0 1px 2px rgba(0,0,0,.07)`.
- Count: a 17×16 square on line. When selected it becomes `rgba(brand,.12)` with brand text.
- Panels fade in with `dkTabIn .22s`: `translateY(3px)` → 0.

**Worklist rows**, the signature table:
```css
.dk-rows { border-top:1px solid var(--d-line-2); border-bottom:1px solid var(--d-line-2); }
.dk-cols, .dk-row { display:grid; align-items:center; gap:18px; padding:0 14px; }
.dk-cols { height:32px; border-bottom:1px solid var(--d-line-2); font:500 10px var(--d-mono); letter-spacing:.08em; color:var(--d-ink-4); text-transform:uppercase; }
.dk-row { position:relative; min-height:54px; border-bottom:1px solid var(--d-line-3); background:#fff; }
.dk-row:hover { background:var(--d-wash); }
.dk-row::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:transparent; }   /* severity spine */
.dk-row.sev-crit::before { background:var(--d-red); }  .dk-row.sev-warn::before { background:var(--d-amber); }
.dk-row[aria-current="true"] { background:rgba(var(--d-brand-rgb),.05); }
.dk-row[aria-current="true"]::before { background:var(--d-brand); }
```
- Row anatomy: status dot, name, mono ref and source chips, then "what", then the Maestro stage cell, then a tag, then mono "when", then a 15px chevron in ink-4. The whole row is a `<button>`.
- Source chips, 10px/700, padding `1px 6px`:
  - `.bulk`: `rgba(brand,.1)` with brand text and a layers icon.
  - `.single`: wash / ink-3, "Walk-in".
  - `.corp`: gold-bg / gold-ink with an inset gold-line ring, "Corporate".

**Grouped pipeline** (bulk batches)
- `.dk-group`: 1px line-2 border, white, 10px gap between groups.
- Header: padding `11px 14px`. A twist chevron rotates 90° over 0.18s. Icon: 32px square at `rgba(brand,.09)`. Title 13.5/650. Sub is mono "BATCH-ID · 3h ago".
- Summary chips `.dk-chip`, 10.5/700 UPPER:
  - neutral "N people"
  - green "N opened"
  - red "N exceptions"
  - amber "N in flight"
  - `.live` "N live in Maestro" with a pulsing 6px brand dot
- Body: `#fcfcfa` with `border-left:2px solid rgba(brand,.16)`. Rows are indented to 26px.

**Status dot and tag** (`ui.tsx`)
- Tones: `good→green`, `warn→amber`, `crit→red`, `info→brand`, `idle→#c4c9d2`.
- `.dk-dot`: an 8px circle. `.live` pulses at 2s.
- `.dk-tag`: 10.5/700/.04em UPPER, padding `3px 8px`, square. Colours:
  - default: wash / ink-2
  - red: red-bg / red-ink
  - amber: amber-bg / amber-ink
  - green: green-bg / green-ink
  - info: `rgba(brand,.08)` / brand

**KPI health strip**
- A single hairline-divided strip, not separate boxes: `display:flex; border-bottom:1px solid line`.
- Each stat has padding `16px 22px 18px` and `border-left:1px solid line`.
- Label row: an 8px tone dot, then the 11px UPPER label. The 32px numeral sits 10px below it, in the tone colour.

**"Your next move" hero** (My desk), gold-accented:
```css
.dk-hero { width:calc(100% - 48px); max-width:var(--d-col); margin:14px auto 0;
  border-top:2px solid var(--d-gold); border-bottom:1px solid var(--d-line); padding:18px 2px 20px; }
.dk-hero .av { width:44px; height:44px; border-radius:0; background:var(--d-brand); color:#fff; font:700 15px/1 var(--d-num); letter-spacing:.04em; }
```
Contents, in order:
- the eyebrow "▲ YOUR NEXT MOVE · 1 OF 7"
- a square initials avatar, the name, a mono sub and a tag
- the "why" paragraph
- a primary `.lg` button "Open Ada", then "Skip for now →", then a right-aligned counter "7 things need you"

**Triage / attention bar**
- Full width, padding `12px 24px`. Green variant: `#ecf6f1` with a `#cfe9d9` bottom rule. Red variant: `#fbeceb` with `#f2ccc8`.
- A 30px **square** solid pip holds a white glyph.
- Headline ink `#0f6f4f` (green) or red-ink. Sub `#166534` or `#7f1d1d`.
- Copy: "Your desk is clear" / "N applications are moving without you."

**Maestro stage cell** (5-segment tracker, shared with ops)
- `.dk-mbar .seg`: **13×4px, radius 2px**, 3px gap, off state line-2.
- Kinds:
  - `await` (parked on a human): amber segments, amber-ink label, "Awaiting approval".
  - `run`: accent segments, brand label, "Running".
  - `done`: all green, "Completed".
- The active segment pulses at 1.6s. While loading, all segments pulse at 1.2s with the label "Checking…".
- A "● LIVE" micro-badge (9/700 UPPER) sits beside it.
- Stage chips `.dk-mchip` (8.5/700 UPPER) run from cool to warm to green:
  ```css
  .s-intake{background:#eef1f6;color:#465569;border-color:#d3dbe6}   .s-verification{background:#eaf0fd;color:#2f4fa8;border-color:#cbd9f6}
  .s-decision{background:#fdf2dd;color:#8a5a11;border-color:#f0dcae} .s-activation{background:#e4f4f1;color:#12705f;border-color:#bfe4dc}
  .s-closure{background:#e9f4ea;color:#2c6b34;border-color:#c6e3c9}
  ```
- Voice-call indicator: an 18px green circle holding a 14px handset. It pulses at 1.1s while calling, and `.missed` is red.

**Next-best-action cards** `.dk-nba`. The base is `1px solid line-2; padding:14px; radius 0`, stacked with a 14px margin-top.
- **Action card** (the bank's recommendation, warm):
  - `border:1px solid #e2cba6; border-top:2px solid var(--d-gold); background:#f9f0df`.
  - Header "⚡ NEXT BEST ACTION" at 10.5/700 .1em UPPER.
  - A full-width primary button whose label *is* the action title.
  - A fallback ladder: "IF THAT DOESN'T WORK" rows, each with a 13/600 title, a 12 ink-2 "why" and a chevron.
  - The done variant is green-bg with a `#cfe9d9` border.
- **Live-in-Maestro card** (the system speaking, blue):
  - `border:1px solid rgba(brand,.3); border-top:2px solid brand; background:rgba(brand,.04)`.
  - A stage strip of `.dk-mstage` chips at 10.5/600:
    - done: green "✓ "
    - active: brand on `rgba(brand,.06)` with a `0 0 0 2px rgba(brand,.12)` halo, "● "
    - idle: ink-4
    - secondary detour stages: **violet** `#6b5aa8/#dcd4f2/#f6f3fd`, or `#4c2fa6/#b9a7e8/#efe9fb` when active
  - A steps panel (`#fbfbf9`) with a mono UPPER header and 6px step pips:
    - done `#16a34a`
    - now: brand with a 3px ring
    - bad `#b91c1c`
- **Voice agent card**:
  - Green-bg, `#cfe9d9` border, 2px green top rule.
  - `.live` (on a call) switches to red-bg with a red top rule and a breathing glow:
    ```css
    @keyframes dkCallGlow { 0%,100%{box-shadow:0 0 0 0 rgba(209,68,58,0)} 50%{box-shadow:0 0 0 5px rgba(209,68,58,.18),0 0 22px rgba(209,68,58,.35)} }
    ```

**Case-pane blocks**
- **Account plate** `.dk-acct`: navy **rail** background, padding `12px 14px`. Contents: "ACCOUNT NUMBER" label at 10.5 UPPER dim, the number at 19/700 +.03em, the CIF, and a green "Live" tag.
- **Checks list**: bordered, rows at `9px 12px`, each with a dot, a 13px label and a 12px status. Mappings:
  - passed → good "Verified"
  - running → info (live dot)
  - failed/timeout → crit "Failed · 3 attempts"
- **Key–value** `.dk-kv`: 12.5 ink-2 label on the left, value on the right.
- **Activity timeline**: a 2px line rail with 10px topic dots (`0 0 0 3px #fff` knockout). The topic tag uses `color-mix(topic 12%, #fff)`. Topic colours:
  - Application `#0091DA`
  - NIN `#7C6CF0`
  - BVN `#2EA8C0`
  - Account requested `#D97706`
  - Account created `#16A34A`
  - Bulk `#C8A24A`
  - Exception `#DC2626`
  - Customer notified `#0033A1`
- **Message rows**, with a channel chip:
  - sms `rgba(0,145,218,.12)/#0079b3`
  - whatsapp `rgba(37,211,102,.15)/#1da851`
  - email: brand tint
  - Delivery line: "✓✓ Delivered · to …" in green-ink.
- **Delete zone**: `#fdfcfb` bordered box with the heading "Delete this record" and "Removes it from the desk. Nothing it has already started is undone." Outlined danger button. The cancel button reads "Keep it".

**Overlays**
- **Small modal**:
  - Scrim `rgba(20,20,26,.38)`.
  - Modal: 384px, white, square, padding 20, `box-shadow:0 24px 60px -14px rgba(0,0,0,.45)`, `dkPop .18s cubic-bezier(.2,.9,.3,1.2)`.
  - Channel option cards: 1.5px border. Pressed: brand border with `rgba(brand,.04)` fill.
  - 34px square channel icons: SMS `#0091DA`, WhatsApp `#25D366`, Email brand.
- **Capture overlay** (it hosts the customer `.cx` wizard):
  - Scrim `rgba(17,24,29,.42)` with `blur(2px)`.
  - Dialog: max 1020px (1440px when showing the extraction review), `height:min(880px,92vh)`, 1px line-2, `box-shadow:0 40px 90px -30px rgba(17,24,29,.5)`.
- **Application Details popup** `.ad`: max 1380px, `height:min(1000px,94vh)`, **radius 18** (a deliberate exception that matches the customer shell). Its parts:
  - **Pill** `.ad-pill` (radius 999, 10.5/700):
    - progress `#eef3fb/#0033a1`
    - pending `#fdf5e6/#b7791f`
    - good `#e8f6ef/#12805c`
    - exception `#fdecea/#c0392b`
  - **Fact grid**: 4 columns (3 at 1240px, 2 at 1000px, 1 at 620px). `dt` is 12 at `rgba(17,24,29,.40)`, `dd` 13.5/500, and empty fields show italic "Not captured".
  - **Confidence pills**: hi `#12805c/#e8f6ef`, mid `#b7791f/#fdf5e6`, lo `#c0392b/#fdecea`.
  - **Person avatar**: 34px, radius 11, `linear-gradient(135deg,#0033a1,#0091da)`.
  - **Underline tabs**: 12.5/500. Selected: brand 700 with a 2.5px brand underline.
  - **Document tab**: fields on the left, PDF on the right on `#f4f6fb`, with a **scan sweep** while reading:
    ```css
    height:130px; background:linear-gradient(180deg, rgba(0,51,161,0) 0%, rgba(0,51,161,.08) 55%, rgba(0,145,218,.26) 92%, rgba(0,145,218,.85) 100%);
    border-bottom:1.5px solid #0091da; box-shadow:0 6px 22px rgba(0,145,218,.4); animation: sweep 2.4s cubic-bezier(.4,0,.5,1) infinite;
    ```
- **Call panel**: the same `.ad` shell narrowed to 1040px, holding the voice-agent iframe. While connecting it shows "Connecting the call…". The fallback button is "Open the call ↗" (radius 6).
- **Toast**:
  - Position: absolute, bottom 20, centred.
  - Style: **ink** `#0b1220` background, white 13/500, padding `9px 16px`, square, `0 12px 28px -8px rgba(0,0,0,.4)`.
  - Lifetime: 2600ms.
- **Empty states**:
  - Box: `1px dashed line-2`, padding `34px 20px`, centred, with a 14/600 title and a 12.5 ink-2 line.
  - Pane blank state: a 46px radius-13 brand-tint tile with "Nothing open".
- **Held phone surfaces** `.dk-hold` (Chat, Explore, Alerts, Profile, Customer360 inside the desk) are forced into desk style:
  - `border-radius:0 !important` (except `rounded-full`)
  - no shadows
  - gradient buttons become solid brand
  - `grid-cols-2` becomes 3 columns

### 3.5 Semantic mapping
| Meaning | Solid / bg / ink / line | Used for |
|---|---|---|
| Success | `#12805c / #ecf6f1 / #0f6f4f / #cfe9d9` | Verified, Completed, account Live, desk clear |
| Warning | `#c99a3e / #fbf4e6 / #9a6b1e / #ecdcc4` | Pending KYC, dual approval, awaiting approval, `sev-warn` |
| Critical | `#d1443a / #fbeceb / #b42318 / #f2ccc8` | Exception, SLA breach, failed, hot badge, live call |
| Info | brand / `rgba(brand,.08)` / brand | Running, Maestro live, selected row |
| **Priority (gold)** | `#9a6b1e / #faf4ea (#f9f0df) / #855b16 / #ecdcc4 (#e2cba6)` | **Only** "your next move": hero rule, NBA card, eyebrow numbers, Corporate chip |
| Detour (violet) | `#6b5aa8 / #f6f3fd / #4c2fa6 / #dcd4f2` | Secondary Maestro stages |

- **State to tone:** progress (Validating, EDD review) → info. Account created / Fully activated → good. Pending documents / liveness / customer → warn. Exception / Compliance hold / Declined → crit.
- **Urgency ranking:** exception, then SLA-breaching approval, then pending KYC, then approval, then KYC-due client, then in-flight.
- **Client segment colours:** Premier `#C8A24A`, Priority `#7C6CF0`, Business `#2EA8C0`, Retail `#7A8896`. Tags are drawn as `color-mix(seg 16%, transparent)` with the segment colour as text.

### 3.6 Screens
- **My desk**: all inside one scroll.
  1. The hero, or a green "Your desk is clear" bar.
  2. The health strip: Needs you · Breaching SLA · In flight "no action needed" · Straight through "% of your openings" (green at 80% or above).
  3. `h1` "My desk 12" with "+ New application".
  4. Three segmented filters: All / Needs attention / In flight / Done · All sources / Bulk / Single · All types / Corporate / Individual. Then "Clear filters" and a right-aligned "Collapse all".
  5. Foldable eyebrow lanes "01 NEEDS YOU NOW ─── 5" and "02 IN FLIGHT ─── nothing needed from you".
  6. Rows in the grid `minmax(0,1.1fr) minmax(0,1.3fr) 150px 118px 84px 20px`, columns Who / What / Maestro stage / Status / When.
- **Open an account**: a split view.
  - KPIs: In progress · Awaiting KYC · Exceptions · Straight through.
  - Title "Open an account" with the sub "Assisted capture · branch pipeline". Buttons "Bulk upload" and "New application".
  - A 280px search box and filters.
  - A grouped pipeline: "Walk-in / direct" plus one group per employer batch.
  - The right pane holds the case detail, bulk upload, or the blank state.
- **Case detail**, top to bottom:
  1. Header: a 28px square ✕, the name at 15/700, "AO-2026-000107 · opened 3h ago", a Details button and a tag.
  2. The NBA card.
  3. The Maestro card.
  4. The Voice agent card.
  5. Tabs Overview / Messages / Activity.
  6. Overview content: the account plate, "CHECKS", then "CONTACT".
  7. The delete zone.
- **Application details**: popup tabs Applicant|Business · Employment & account · Directors · Document · Web research.
- **Approvals**:
  - KPIs: Pending you · Value awaiting · Breaching SLA · Dual approval.
  - Title "Approvals" with the sub "Maker-checker · your authority".
  - Filters: All / Breaching SLA / Dual approval / High risk.
  - Columns: Customer ("Raised by …") / Request / Amount / Flags / SLA.
- **Clients**:
  - KPIs: Relationships · At-risk · Next best actions · KYC due.
  - Title "Clients" with the sub "Key relationships · branch book".
  - Columns: Client / Headline / Relationship / Segment / KYC.
- **Bulk upload**:
  - A mode toggle "Payroll · CSV" / "Documents · ZIP" (wash track; `.on` is white).
  - Employer field and a mono textarea.
  - A preview table of up to 8 rows, then "+ N more".
  - An 8px progress bar.
  - The line "Reading documents · classifying with IXP…".

### 3.7 Voice
- NBA titles are imperatives, and each "why" line argues for the action:
  - "Retry the BVN check": "…outages are the usual cause and clear on their own, which is why the retry schedule exists — try it before involving anyone."
  - "Hand to Operations": "Ops can override with documentary evidence — you cannot."
- Reassurance: "N applications are moving without you." · "You'll only hear about it if a check needs a person — you can start the next customer."
- Say who is acting: "Voice agent · no answer", "Your call · due", "needs a person".
- Honest empty states: "Nothing here matches" / "No work needing you fits the filters you have set." Use "Checking…", never a wrong "Not started".

---

## 4. Relationship Manager: phone `/employee-mobile`

Files: `App.tsx` (mobile shell), `contexts/ThemeContext.tsx`, `components/BottomNav.tsx`, `HomeTab.tsx`, `customerUi.tsx`, `OpenAccountTab.tsx`. This is family B, the "Aura" consumer-AI look, inside the phone bezel (§1.9). Fonts are Inter for body text and Poppins for headlines (`.font-headline` = Poppins 700, −.03em; `.font-headline-black` = 900).

### 4.1 Theme tokens (light is the default)
The theme is persisted in `localStorage['aura_theme']` and applied as `html[data-theme]`. The native status bar is `#e8ebed` in light mode and `#182126` in dark mode.

| Token | LIGHT | DARK |
|---|---|---|
| bgPrimary | `#e8ebed` | `#182126` |
| bgPage | `linear-gradient(160deg,#fff 0%,#f0f0f0 55%,#fff 100%)` | `linear-gradient(160deg,#0d1a20 0%,#182126 55%,#0d1a20 100%)` |
| bgCard / bgCardStrong | `rgba(255,255,255,.88)` / `#fff` | `rgba(255,255,255,.05)` / `.08` |
| bgInput | `rgba(0,0,0,.04)` | `rgba(255,255,255,.05)` |
| bgIconBox | `rgba(brand,.08)` | `rgba(brand,.12)` |
| border / borderStrong / divider | `rgba(0,0,0,.08)` / `.12` / `.06` | `rgba(255,255,255,.08)` / `.14` / `.07` |
| textPrimary / textBody | `#182126` / `rgba(24,33,38,.85)` | `#fff` / `rgba(255,255,255,.85)` |
| textSecondary / textMuted / textLabel | `rgba(brand,.8)` / `rgba(0,0,0,.35)` / `rgba(brand,.5)` | `rgba(brand,.75)` / `rgba(255,255,255,.35)` / `rgba(brand,.45)` |
| navBg / navBorder / navInactive | `rgba(246,246,246,.97)` / `rgba(0,0,0,.07)` / `rgba(0,0,0,.38)` | `rgba(18,30,35,.97)` / `rgba(255,255,255,.06)` / `rgba(255,255,255,.38)` |
| aiBubbleBg / Border / Text | `rgba(255,255,255,.95)` / `rgba(0,0,0,.08)` / `#182126` | `rgba(brand,.08)` / `rgba(brand,.18)` / `rgba(255,255,255,.92)` |
| dropdownBg | `rgba(255,255,255,.98)` | `rgba(13,26,32,.97)` |
| orbBlend | `multiply` | `screen` |

### 4.2 Bottom nav
- **Container:** background `navBg`, `borderTop 1px navBorder`, `backdrop-filter:blur(20px)`, padding-top 10.
- **Tabs:** five tabs, Home · Chat · Explore · Alerts · Profile.
- **Active tab:** a **50×28 brand pill** (`rounded-2xl`) with a white icon and `box-shadow:0 2px 16px rgba(brand,.45)`.
- **Inactive tab:** `navInactive`.
- **Label:** `text-xs font-medium`.
- **Alerts badge:** a 16px `#ef4444` circle with a 2px navBg ring, 8px/800 text, and a cap of "9+".
- **Overlays:** work surfaces (Customers, Approvals, Open account) open as `absolute inset-0 z-40` overlays and leave the nav visible.

### 4.3 Home tab anatomy
1. **Orb.** The tenant logo, if any, then an orb video (`orb-light.mp4` in light mode, `orb.mp4` in dark) in a 320px block.
   - Light mode applies the mask `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`.
   - Dark mode fades the orb in over .3s.
2. **Greeting.** "Hello, {name}" at 24px bold with tight tracking. Sub "How can I help you today?" in `rgba(brand,.7)`.
3. **Composer pill.**
   - Pill: 68px tall, `rounded-full`, `rgba(255,255,255,.85)` background (dark mode `rgba(8,18,38,.65)`), 1px `rgba(brand,.25)` border, 20px blur.
   - Three 32px round tool buttons (camera, globe, mic), then a 1×22 divider.
   - Input at 13.5px, placeholder "Ask me anything...".
   - A **36px send circle in `--brand-secondary`** with `0 0 16px rgba(secondary,.5)`.
4. **Section header.**
   - A 4×20 brand bar with `0 0 8px rgba(brand,.7)` glow.
   - A 16px bold title at −0.3 tracking.
   - "Tap to view" on the right, xs, in `rgba(brand,.6)`.
5. **Launcher cards** (Open an account, Approvals, Key Relationships).
   - Card: `bgCard`, 1px border, **radius 18**, padding 16, gap 14.
   - Icon tile: 46×46, radius 14, brand fill, `0 5px 14px rgba(brand,.4)`.
   - Text: title 14.5/700; meta 12 in textMuted; warning counts in `#E0904A`/600.
6. **Agent Insights and "On Your Desk" task cards.** `rounded-2xl`, padding `px-4 py-3.5`, with 10px pill chips at brand alpha .12–.18.

### 4.4 Components
- **Semantic colours:**
  - good `#16A968`
  - warn/pending `#E0904A`
  - exception/high `#E0533D`
  - progress `var(--brand-secondary)`
  - neutral `#7A8896`
- **Status pill:** `color-mix(tone 16%, transparent)`, 10.5/700, padding `4px 9px`, radius 7.
- **Pill:** radius 999, 11/600.
- **Avatar:** a radius-16 square with `linear-gradient(140deg, brand, color-mix(brand 55%, #000))`. Initials are 0.34×size at weight 700. Shadow `0 4px 14px rgba(brand,.35)`.
- **Open account tab:**
  - Title 24/700, with the sub "Assisted capture · Stanbic IBTC".
  - Stat tiles at radius 14 with 20/700 numbers.
  - List rows at radius 16, padding 14.
- **Icons:** `Icn` (stroke 1.8, 20px default). BottomNav uses Heroicons-style glyphs: Home filled, the others stroked.
- **Motion:**
  - `aura-entrance` .75s `cubic-bezier(.22,1,.36,1)`
  - `orb-breathe` scale 1.06
  - `glow-pulse`
  - `orange-pulse` (brand shadow 20 → 40px)
  - notification slide .6s `cubic-bezier(.16,1,.3,1)`
  - `active:scale-95` on press
- **Voice:** warmer than the desk. For example: "Hello, {name}", "Tap to view", "Capture their details — the account opens while they walk away".

---

## 5. Operations analyst: Operations Workbench `/ops`

**Architecture.** `ops/OpsApp.tsx` renders only a full-screen iframe (`.ops-frame { position:fixed; inset:0; border:0 }`). The whole UI lives in **`public/ops-console.html`**: CSS at lines 12–566, markup at 568–666, and vanilla JS at 668–2159, rendered through `innerHTML`. The files `ops/charts.tsx` and `ops/derive.ts` are dead code and not the reference.

This page is family A and deliberately **shares the desk's design language** ("one platform, not two products"). §5.10 lists the differences.

### 5.1 Tokens (`:root`, lines 13–62)
```css
--brand-primary:#012169; --brand-primary-rgb:1,33,105; --brand-secondary:#0091DA;   /* static fallback */
--navy:   color-mix(in srgb, var(--brand-primary) 62%, #000);   /* rail, promo card  ≈ #002064 */
--navy-2: color-mix(in srgb, var(--brand-primary) 78%, #000);   /* hover / separators */
--navy-3: color-mix(in srgb, var(--brand-primary) 88%, #000);   /* "me" avatar */
--blue:   var(--brand-primary);  --blue-hover: color-mix(in srgb, var(--brand-primary) 82%, #000);
--sky:    var(--brand-secondary);                                /* kicker, focus ring, "new" badge */
--on-navy: color-mix(in srgb, var(--brand-primary) 18%, #fff);  --on-navy-dim: color-mix(in srgb, var(--brand-primary) 42%, #fff);
--ink:#0b1220; --ink-2:#566072; --ink-3:#8a93a1; --ink-4:#9aa3b0;
--page:#fff; --line:#e6e9ef; --line-2:#dfe3ea; --line-3:#eef1f5;
--green:#12805c; --green-bg:#ecf6f1;
--red:#d1443a; --red-ink:#b42318; --red-deep:#8f1d16; --red-bg:#fbeceb; --red-line:#f2ccc8;
--amber:#c99a3e; --amber-ink:#9a6b1e; --amber-bg:#fbf4e6; --amber-line:#ecdcc4;
--num:'IBM Plex Sans','Libre Franklin',sans-serif;  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace;
--col:1520px;
```
**Theming the iframe.** The parent sends `postMessage({type:'aof-brand', logo, appName, primaryColor, secondaryColor, primaryRgb})` on mount and again on load. The console then calls `setProperty('--brand-primary'|'--brand-primary-rgb'|'--brand-secondary')`. Every navy token is a `color-mix`, so those three calls re-theme the whole console.

A second message, `aof-country`, relabels the KYC vocabulary: BVN/NIBSS and NIN/NIMC become the local equivalents.

**Leftover warm grays.** Some values are left over from an older beige palette: `#f3f3ee` on button hover, `#f1f1ec` on row hover, `#ecece7` on the segmented-control track and kbd keys, `#f2f2ec` on tags, and `#a0a09a` / `#7c7c76` / `#6f6f69` for muted text.
- For a *pixel-exact* copy, keep them.
- For the *intended* language, use the desk's cool `--wash #f5f7fa`.

### 5.2 Typography
| Role | Spec |
|---|---|
| View title `h1` | 19 / 700 / −.02em; count `.n` 13/400 `#a0a09a` |
| Cockpit title | 25 / 700 / −.02em |
| Modal title | 18 / 700 / −.02em |
| Promo headline (on navy) | 17 / 600 / −.02em, #fff, max 46ch |
| Triage headline | 15 / 600 / −.01em; sub 12.5 |
| Cause title | 14.5 / 600; detail 13 ink-2 lh 1.45 |
| Eyebrow `h2.eyebrow` | Plex Sans 10.5 / 600 / .12em ink-4, **uppercase written in the markup** ("ROOT CAUSES") |
| Rail section head | 10.5 / 600 / .14em on-navy-dim |
| Kicker on navy | 10.5 / 600 / .14em `--sky` ("PATTERN FOUND") |
| **Table header** | **IBM Plex Mono 10 / .08em ink-4** |
| Row name / reason | 13.5 / 600 · 12.5 ink-3 |
| Row ID / SLA / age | **Mono 11.5 tabular** ink-3 |
| Stat label / value | 11.5 / 500 UPPER .05em · **26 / 700 / −.02em tabular** |
| Status tag `.state` | 10.5 / 700 / .04em UPPER |

### 5.3 Shell
- **Grid.** `.shell { grid-template-columns:248px minmax(0,1fr); height:100vh }`. Slim mode is `64px`. Below 1180px the layout becomes one column.
- **Rail `.side`.** Background `--navy`, `padding-bottom:52px` (the Launcher corner). From top to bottom:
  - **Logo block.** The tenant wordmark sits on a **white plate** (padding `7px 10px`, `0 1px 3px rgba(0,0,0,.2)`, max 26px tall and 158px wide). Under it, 10.5px on-navy-dim: "Account Opening · Staging".
  - **Role switcher.** Identical to the desk's `.dk-role` (§3.3).
  - **Nav sections.**
    - VIEWS: Needs attention, All cases, Assigned to me, Unassigned
    - AUTOMATION: Rules
    - PIPELINE: shows "N in flight"
    - UPSTREAM
    - TOOLS: FaceID kiosk and console, with ↗
  - **Nav item.** Padding 8, 13.5px, 15px icons. Hover and current use navy-2; current is #fff 600 with **no accent bar**. Badges: `rgba(255,255,255,.1)` by default, **red** for hot items (work), **sky** for new items.
  - **Shrink control.** "Shrink to icons", persisted in `localStorage 'ops_rail_slim'`. In slim mode a 34px glyph tile (radius 8, white, navy letter) replaces the logo.
- **Top bar `.util`.** Padding `12px 24px`, 1px line bottom border.
  - Search "Search all applications…" (max 520px), styled like the desk's.
  - "● Live" in green.
  - A 34px navy-3 avatar circle reading "OA".
- **Content.** Column 1520px, body padding `8px 24px 24px`.
- **Footer `.keys`.** A keyboard legend, 11.5px ink-3. `kbd` elements are Plex, `#ecece7` on `#dcdcd5`, radius 4, padding `1px 6px`.
- **Radii.** Everything is 0 except circles, 2–5px on tiny bars and kbd keys, and 3px on provenance chips.

### 5.4 Components
**Buttons**
```css
.btn { border:1px solid var(--line-2); border-radius:0; padding:7px 13px; font-size:12.5px; font-weight:600; background:#fff; color:var(--ink); }
.btn:hover { background:#f3f3ee; }  .btn:active { transform:scale(.985); }
.btn.pri  { background:var(--blue); border-color:var(--blue); color:#fff; }   .btn.pri:hover { background:var(--blue-hover); }
.btn.warn { background:var(--red); border-color:var(--red); color:#fff; }     .btn.warn:hover { filter:brightness(1.06); }
.btn.ghost-red { border:none; color:var(--red); background:transparent; }
```
- **On navy:**
  - `.btn-sky`: sky fill, **always #fff text**, padding `9px 15px`, 13/700.
  - `.btn-line`: `1px rgba(255,255,255,.28)`, transparent, #fff 13/600.
- **Triage `.go`:** solid red or green, padding `9px 15px`, 13/600.
- **Icon square buttons:** 28×28 (30×30 in modals) with a 1px line-2 border and the glyphs ‹ › ✕.
- **Maestro:**
  - `.mz-run`: **dashed** 1px blue border, blue text, "▶ Run in Maestro".
  - `.mz-approve`: solid blue, `10px 18px`.

**Status tag `.state`** (the same shape as the desk's `.dk-tag`, with a 6px dot and square corners)

| state | dot | bg | fg |
|---|---|---|---|
| Exception | `#dc2626` | `#fdf3f3` | `#b91c1c` |
| Validating / Validated | `#0033A1` | `#eef2fa` | `#0033A1` |
| Pending documents / liveness | `#d97706` | `#fdf6e8` | `#b45309` |
| Account created / Fully activated | `#16a34a` | `#f0f9f3` | `#15803d` |

**Provenance chips `.pv`.** 10.5px, padding `0 6px`, **radius 3**, format "WhatsApp · Ruth". The tone signals triage risk, not the channel's brand:
- default (staff-owned: RM, Branch, Contact centre): `rgba(17,24,29,.05)` fill with ink-3 text
- `.amber` (self-served, nobody behind it: Mobile app, Internet banking, WhatsApp, Partner, Email): `#fdf5e6 / #b7791f / #f0dcb8`
- `.agent` (agent banking): `#eef7f3 / #12805c / #cfe6dc`
- `.batch` (payroll batch): `#eef3fb / #0033a1 / #d6e2f5`

**Other chips**
- `.tag`: 11.5/500 on `#f2f2ec`, red or amber variants, e.g. "3 past SLA".
- `.kindtag`: 10/600 .08em on navy with white text, radius 4, e.g. "BULK · 180 ROWS".
- `.pill`: SLA over `#fdf3f3/#b91c1c`; risk `#f2f2ec/#6f6f69`.

**Exception queue.** A div grid, not a `<table>`.
```css
.cols { grid-template-columns:100px minmax(0,1.3fr) 152px 130px 96px 88px 40px; gap:10px; padding:6px 8px;
  font:10px var(--mono); letter-spacing:.08em; color:var(--ink-4); border-bottom:1px solid var(--line); position:sticky; top:46px; }
.row { /* same grid */ padding:9px 8px; border-bottom:1px solid var(--line-3); }   .row:hover { background:#f1f1ec; }
.row[aria-selected="true"] { background:#eef2fa; box-shadow: inset 2px 0 0 var(--blue); }
```
- **Columns:** APPLICATION · CUSTOMER · CHECKS · OUTCOME · SLA · ASSIGNEE · AGE.
- **CUSTOMER cell:** a 28px avatar circle (colour hashed from the palette below), then the name, reason and provenance chips.
  `["#0033A1","#3B6FB6","#0A2240","#0060A9","#0091DA","#5A82C2","#334E7B"]`
- **SLA cell:** mono text with a 3px track underneath.
- **ASSIGNEE cell:** a 20px avatar and the name, or "Unassigned" in `#d97706`.
- **AGE cell:** mono, right-aligned: "62m", "2h" or "5d".
- **Container queries:** below 940px the APPLICATION column is dropped; below 780px ASSIGNEE is dropped too.

**Sorting and view toggle**
- **Sort `.segs`:** Urgency / Risk / Age / Name, styled like the desk's segmented control.
- **View/Edit tab toggle `.seg`:** a 1px line outline; the selected tab is **navy with #fff text**.

**Health strip.** Stats separated by vertical hairlines, each with an 8px coloured dot:

| Stat | Dot colour | Value colour | Caption |
|---|---|---|---|
| Straight-through | `#16a34a` | red below 80 | "target 80" |
| Past SLA | `#dc2626` | — | "of N open" |
| Unassigned | `#d97706` | — | "waiting" |
| Hours returned, week | `#0091DA` | — | "412 +38" |

**Triage bar.**
- Red variant: `--red-bg` with a `--red-line` rule.
- Green variant: `--green-bg` with `#cfe9d9`.
- A 30px **square** pip holds ▲ or ✓, with the call to action on the right.

**Root-cause cards.**
- Grid `repeat(auto-fit, minmax(min(100%,560px),1fr))`, gap 10.
- White bordered cards, each with a 28px square icon tile: red `--red-bg/--red`, amber, or gray `#f2f2ec`.
- The **bulk action lives on the cause**, for example "Retry NIN check on all (6)" beside "Review one by one". The button is `.btn.warn` for red causes and `.btn.pri` otherwise. There are **no per-row checkboxes**.
- The principle: "Clear the cause, not the cases."

| Cause | Icon | Tone | Subtitle |
|---|---|---|---|
| NIMC gateway timeout | ! | red | Infrastructure, not data |
| NIN name mismatch | ? | amber | Needs a human call |
| Liveness below threshold | ? | amber | Poor light, likely retryable |
| Proof of address out of policy | · | gray | Applicant action |
| Bulk upload partly failed | ▦ | red | Same gateway, same window |
| BVN did not verify | ! | red | Needs a customer call |

**Rule-promotion card `.promo`** (the signature element):
```css
.promo { background:var(--navy); padding:18px 20px; color:var(--on-navy); position:relative; overflow:hidden; }
.promo::after { content:""; position:absolute; right:-40px; top:-40px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.06); }
@media (min-width:1120px){ .promo-in { grid-template-columns:minmax(0,1fr) auto; gap:40px; align-items:center; } }
```
- Content order: kicker "PATTERN FOUND", headline, body (13px, max 62ch), a stats row (22/700 white, gap 26), then two buttons.
- Buttons: "Review the 47 decisions" (sky) and "Not yet" (line).

**Rule card.**
- White, 1px line-2, padding `14px 16px`.
- A 28px ✓ tile: `#f0f9f3 / #16a34a / #cfe9d9`.
- The condition sits in a code-like box: Plex 12.5 in a 1px line box, e.g. `nin.error.status >= 500 → retry up to 3 times, 60s apart`.
- Metrics at 17/700, e.g. "1,102 cases deflected · 18h reviewer time returned · 0 reversals", with a Pause button.

**Charts** (hand-drawn in HTML/CSS; no library)
- **Maestro stage lane `.mbar`:** identical to the desk's: five segments of 13×4px at radius 2.
  - `.await` amber
  - `.run` sky, with a blue label
  - `.done` green
  - the stages are Intake → Verification → Decision → Activation → Closure
- **Pipeline funnel (in the rail):**
  - A 2px navy-2 spine.
  - Each row is a grid `8px 1fr 70px 20px`: a dot, a 12.5px label, a 9px bar (radius 4, navy-2 track, on-navy-dim fill, minimum 6%), and the count.
  - The **hot** stage (the largest, and at least 40% of the total) is drawn red.
- **Upstream health dots:** healthy `#3fbf7f`, degraded `#f0b429`, down `#dc2626`, with captions such as "recovered 14:31".
- **Evidence histogram:**
  - 96px tall, blue bars with **only the top-right corner rounded** (`radius 0 5px 0 0`).
  - Bars below the threshold are `#c9d4ea`.
  - Empty bins are hatched: `repeating-linear-gradient(45deg,#f0f0eb 0 4px,#e4e4dd 4px 8px)`.
  - No gridlines and no y-axis.
- **Liveness gauge:** a 6px track with a red fill and a 2×14 ink threshold tick.
- **Name diff:** `.hi-bad #fde3e3 / --red-ink` and `.hi-good #dcf3e6 / #15803d`.
- **Mini stepper:** 9px dots (11px at the stop point) joined by 20×2 connectors. Done `#16a34a`, current `#0033A1`, stopped `#dc2626`.

**Review cockpit.** A **centred modal**, not a side drawer.
```css
.cock { position:fixed; top:50%; left:50%; width:min(1320px,96vw); max-height:min(820px,92vh); background:#fff; border-radius:0;
  box-shadow:0 32px 80px rgba(var(--brand-primary-rgb),.3); transform:translate(-50%,-50%) scale(.985); transition:opacity .16s, transform .16s; }
/* scrim: rgba(var(--brand-primary-rgb),.13) */
```
- **Header.**
  - A 40px avatar, the name at 25px, and the ID.
  - The mini stepper, then SLA and risk pills.
  - A "3 of 12" counter with ‹ › ✕.
- **Maestro live strip.** `#f4f7fd` with a **2px blue top border**; it turns green when done. Label "⚡ LIVE IN MAESTRO" at 11/700.
- **Body.** Three columns `1.5fr / 1.05fr / .85fr`, each padded `20px 24px` and separated by hairlines.
  - Column 1: **THE PROBLEM** card (red-bg / red-line, with a ▲ header in 12/700 UPPER red-ink) and an AGENT TRAIL (a 42px tabular time column with 14.5px entries).
  - Column 2: CHECKS (20px circular status icons with a blue "re-run" link) and the risk score.
  - Column 3: APPLICANT fields in a `90px 1fr` grid.
- **Footer.**
  - Left: an amber note, e.g. "⚠ Finacle create is blocked until the name is resolved."
  - Right: Reject (ghost-red), the alternative action (`.btn`), and the primary (`.btn.pri`).
- **Keyboard:** J/K next and previous, A accept, R re-run, E escalate, X reject, Esc close.

**Other surfaces**
- **Modal `.veil`:**
  - Veil `rgba(brand-rgb,.45)`.
  - Modal: white, square, `min(900px,100%)`, `0 24px 64px rgba(0,0,0,.3)`.
  - Footer: primary, then Close, then a 12px caveat on the right.
- **Toast:** **navy** background, #fff 13.5/500, square, `0 8px 24px rgba(0,0,0,.22)`, bottom 24. It animates `toastIn .2s` (an 8px rise) and lasts 2600ms. The leading glyph carries the colour: ✓ sky, ⚡ blue, ⚠ red.
- **DMN editor (Rules → Edit):**
  - Vendored dmn-js in a `.dmn-host` with a 1px line border, `height:calc(100vh - 232px)` and a 440px minimum.
  - Tables are forced to 100% width.
  - Note: "Decision table · `onboarding-automation.dmn` — the same rules, editable as DMN."
- **Focus:** `outline:2px solid var(--sky); outline-offset:2px; border-radius:4px`.

### 5.5 Semantic colour
There are **two palettes**:
- **Muted tokens** (green `#12805c`, red `#d1443a`, amber `#c99a3e`) drive the CSS components.
- **Bright inline values** (`#dc2626`, `#d97706`, `#16a34a`, `#0033A1`) drive state tags, SLA, checks and stats.

Meanings:
- **SLA:** overdue `#dc2626` "Xm over"; 60 minutes or less left `#d97706`; otherwise `#6f6f69` "Xh Ym left".
- **Risk:** below 30 is low (auto-approve), below 50 is medium, otherwise high.
- **Maestro:** amber = parked for a human, sky = running, green = done.
- **Badges:** red = work waiting, sky = new.

### 5.6 Views
- **Needs attention** (the default view), in order:
  1. triage bar
  2. health strip
  3. `h1`
  4. navy promo card
  5. ROOT CAUSES grid
  6. sticky row bar "Individual cases · N shown, sorted by urgency" with sort controls
  7. queue
- **All cases / Assigned to me / Unassigned:** the same layout without the promo and causes.
- **Pipeline stage views:** Pending NIN, BVN, liveness, documents, Finacle.
- **Exceptions and Bulk failures:** a bulk record opens the cockpit with a BULK kindtag and file fields.
- **Automation:** "Automation · 7 live, 1 candidate" with a View/Edit toggle.
  - View: the CANDIDATE promo, then LIVE RULES cards.
  - Edit: the full-width DMN table.
- **Evidence modal:** "Every name mismatch decision, 12 May to 14 July". Contains a finding card, the histogram, a threshold slider (`accent-color:var(--blue)`) and a decisions table.

### 5.7 Voice
- Short declarative sentences with causal framing: infrastructure vs data vs applicant.
- In narrative, numbers are spelled out: "Forty-seven times out of forty-seven."
- Reversibility is stated plainly.
- Examples:
  - Triage: "3 cases are past SLA, worst is 1h 36m over" / "6 of them share one cause: nimc gateway timeout. **Clear the cause, not the cases.**" / "Open Blessing →"
  - All clear: "Nothing is breaching" / "12 open, all inside SLA. Good time to look at the rule below."
  - Promo: "Ruth has accepted the NIMC spelling on every name mismatch that reached her… That is a policy nobody has written down yet."
  - Problem card: "The gateway failed, the applicant did not" / "The applicant has done nothing wrong here."
  - Toasts: "Parked. It will come back if the pattern holds." · "Rule live at 0.93. 5 open cases cleared, about 4 a day stop arriving."
  - Guardrail: "A single reversal pauses the rule and routes the cases back."
  - Empty state: "Nothing here. This queue is clear."

### 5.8 What is shared with the desk, and what differs
**Byte-identical:**
- neutral, line and semantic tokens
- the `color-mix` rail derivation
- Plex Sans and Mono, the 14px base, the 1520px column, radius 0
- the role switcher and its copy
- rail nav, badges, section heads, slim mode
- search, the "Live" pulse, the `h1` style
- the Maestro `.mbar`, uppercase status tags
- focus ring, scrollbars, reduced-motion handling
- the Launcher corner

**Different:**

| | Desk | Ops |
|---|---|---|
| Rail width | 228px | 248px |
| Rail bottom padding | 46 | 52 |
| Top bar | fixed 66px | padding-based |
| Logo | 30px square mark + wordmark | white plate + full wordmark |
| KPI value | 32px | 26px |
| Eyebrow | Mono 10.5/500, trailing hairline, gold number | Plex Sans 10.5/600, no rule |
| Reserved gold accent | yes ("your next move") | none |
| Press | `translateY(1px)` | `scale(.985)` |
| Detail surface | right-hand split pane | centred 3-column cockpit modal |
| Toast | ink `#0b1220` | navy |
| Unique elements | — | triage bar, root causes, promo card, pipeline funnel, upstream health, histogram, DMN, keyboard legend |

---

## 6. Customer: banking app

**Routes:** `/customer-mobile` (phone bezel) and `/customer-web` (internet banking, full width).
**Files:** `consumer/theme.ts`, `ConsumerApp.tsx`, `TopNav.tsx`, `components.tsx`, `icons.tsx`, `CallConfirm.tsx`, `screens/*`.
**Style:** family B. Styles are inline, driven by JS tokens.

### 6.1 Tokens (`consumer/theme.ts`, complete)
```ts
export const C = {
  page:'#F4F5F8', card:'#FFFFFF', cardAlt:'#FBFBFD',
  text:'#11181D', textSoft:'rgba(17,24,29,0.52)', textFaint:'rgba(17,24,29,0.34)',
  border:'rgba(17,24,29,0.07)', borderStrong:'rgba(17,24,29,0.12)', hairline:'rgba(17,24,29,0.05)',
  good:'#16A968', goodSoft:'rgba(22,169,104,0.12)', warn:'#E0533D', warnSoft:'rgba(224,83,61,0.12)',
  brand:'var(--brand-primary)', brandRgb:'var(--brand-primary-rgb)',
  secondary:'var(--brand-secondary)', secondaryRgb:'var(--brand-secondary-rgb)',
};
export const SHADOW = {
  sm:'0 1px 2px rgba(17,24,29,0.05)',
  md:'0 6px 20px -6px rgba(17,24,29,0.12), 0 2px 6px rgba(17,24,29,0.05)',
  lg:'0 18px 40px -12px rgba(17,24,29,0.18), 0 4px 12px rgba(17,24,29,0.06)',
  brand:'0 16px 34px -10px rgba(var(--brand-primary-rgb),0.45)',
  nav:'0 -2px 24px rgba(17,24,29,0.08)',
};
export const R = { card:22, tile:18, pill:999, sm:12 };
export const FONT_HEAD = "'Poppins', Arial, sans-serif";
export const FONT_BODY = "'Inter', Arial, sans-serif";
export const PAGE_BG = `radial-gradient(130% 55% at 50% -8%, rgba(var(--brand-primary-rgb),0.07) 0%, transparent 60%), #F4F5F8`;
```
**Recurring inline values:**
- **Brand tint fills:** `rgba(brand, .08–.14)`. The default for icon tiles is `.10`.
- **Tinted panel:** `rgba(brand,.06)` fill with a `rgba(brand,.18)` border.
- **Success tile:** `rgba(31,157,87,.12)`.
- **Disabled:** `rgba(24,33,38,.18)`.
- **Segment track:** `rgba(17,24,29,.05)`.
- **Toggle off:** `rgba(17,24,29,.16)`.

### 6.2 Typography (letter-spacing in px)
| Role | Spec |
|---|---|
| Screen title | Poppins 700, 26, −0.6 |
| Greeting | Inter 14 soft "Good morning," / Poppins 700, 24, −0.5 "Adaeze 👋" |
| **Hero balance** | **Poppins 700, 32, −0.8, tabular** |
| Section label | Poppins 700, 17, −0.3 (generic: 600, 16.5) |
| Sub-screen header | Poppins 700, 19, −0.3 |
| List row title / sub | Inter 600, 15 / 12.5 soft |
| Amount | Poppins 700, 18, −0.3 tabular; negative amounts in `C.warn` |
| Amount input / review amount | Poppins 700, 28 / 34 |
| Field label | Inter 700, 12, +0.3, UPPERCASE soft |
| Hero eyebrow | Inter 700, 10.5, .14em, opacity .85 ("NEW ACCOUNT") |
| Tag | Inter 700, 10.5, +0.4, UPPERCASE |
| Tab bar label | Inter 10; 700 active / 500 idle |

### 6.3 Mobile shell
1. **App header.** Padding `0 16px`, row height 58.
   - Left: a 40px avatar circle, `linear-gradient(135deg, brand, color-mix(brand 55%, #000))`, initials in Poppins 700 15.
   - Centre: the logo, 24px tall, absolutely centred.
   - Right: two 40px white circles with `SHADOW.sm`, holding the bell and chat icons.
   - Unread badge: 16px, `C.warn`, with a 2px white ring.
2. **Scroll area.** Padding `4px 16px 24px`, 16–18px gap between blocks.
3. **Floating bottom nav**, a pill:
   ```tsx
   <div style={{ padding:'8px 14px max(env(safe-area-inset-bottom),12px)' }}>
     <div style={{ background:'#fff', borderRadius:24, boxShadow:SHADOW.lg, display:'flex', padding:6 }}>
   ```
   - **Tabs** (radius 18, padding `9px 2px`):
     - Active: `rgba(brand,.10)` fill, brand colour, icon stroke 2.1.
     - Idle: textFaint, stroke 1.8.
     - Order: Home · Pay · **Open** · Wealth · More.
   - **Raised centre FAB**, "Open":
     - A 46px circle at `marginTop:-22` in brand, with `3px solid #fff` and `SHADOW.brand`.
     - Plus icon at 22px, stroke 2.6.
     - Active state: gradient fill and `scale(1.06)`.
4. **Pushed sub-screen.** A 56px row with a 40px back circle and a Poppins 700 19 title. This replaces both the header and the nav.
5. **Overlays.**
   - Digibot: `absolute inset:0; z 60`.
   - CallConfirm: `top:10; left/right:12`, radius 20, `SHADOW.lg`. Its height animates `.35s cubic-bezier(.2,.7,.2,1)`. The card itself is an iframe served by the voice service, and it appears on mobile only.

### 6.4 Web shell (`/customer-web`)
- **TopNav.** White, with a 1px border and `SHADOW.sm`. Inner width `max-width:1180px; padding:0 24px; height:68; gap:28`.
  - Logo: max 34px tall.
  - Links: Home · Pay & transfer · Open an account · Wealth · More. Each is 14px, radius 9, padding `9px 14px`. Active: `rgba(brand,.09)` with brand text at 700. Idle: soft.
  - Right side: 38px round icon buttons on `C.page`, a 17px `#ef4444` badge, and a 36px solid-brand initials circle.
- **Content.** `max-width:1180px`. There is no bottom nav.
- **Layout changes from mobile:**
  - Home is a two-column grid, `0.85fr / 1.15fr`.
  - Account cards become a grid instead of a carousel.
  - Open an account is centred at 760px.

### 6.5 Components
**Balance hero**
```tsx
{ borderRadius:26, padding:'20px 22px 22px', color:'#fff', overflow:'hidden', position:'relative',
  background:'linear-gradient(140deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 58%, #000) 100%)',
  boxShadow:SHADOW.brand }
// decor: 180px circle rgba(255,255,255,.10) at top:-50 right:-30; 150px circle rgba(0,0,0,.08) at bottom:-70 left:-20
```
- Label: "Total balance", 13/500, white at 78%.
- Eye toggle: 30px, `rgba(255,255,255,.16)`. When hidden, the amount reads `NGN ••••••`.
- Change chip: "+2.4% this month" on `rgba(255,255,255,.16)`, radius 999.
- White sparkline: 96×42, stroke 2.2, area gradient from .28 to 0, end dot r2.6.

**Account cards**
- Size and shape: 168px wide in the carousel, or `minmax(190px,1fr)` in the web grid. Radius 20, padding 16, `SHADOW.md`, white text.
- Decoration: a 90px `rgba(255,255,255,.12)` circle.
- Icon tile: 34px, radius 11, `rgba(255,255,255,.2)`.
- Gradients, all at 140deg:
  - current: brand → 55% black
  - savings: secondary → 50% black
  - loop: `#12B5A6→#0A7E73`
  - fixed: `#6C5CE0→#3E327F`
  - wallet: `#4BB543→#2C7D1F`
- The carousel bleeds to the screen edge (`margin:0 -16px`).

**Payment card**
- Radius 20, padding 20, min-height 176, `SHADOW.lg`.
- Gradients: Mastercard `#38302E→#5A4D49`; Visa Gold `#1C4E63→#39B3E5`.
- Gold EMV chip: 40×30, radius 7, `linear-gradient(135deg,#f3d27a,#caa24a)`.
- Card number: `•••• 7421` in Poppins 500 19, 2.5px tracking.

**Quick actions**
- Home, 4-up: 56px white tiles, radius 18, `SHADOW.md`, brand icons at 24px (stroke 1.9), labels 12/600. The four are Send · Pay · Top up · Scan.
- Pay grid: 50px tiles, radius 16, `rgba(brand,.10)` fill.
- More grid: 48px tiles, radius 15.

**Cards and lists**
- **Card:** white, radius 22, `SHADOW.md`.
- **ListRow:** padding `15px 18px`, a 42px tile (radius 13) and a trailing chevron. Dividers are hairlines inset 18px.
- **Transaction row:** a 40px tile, radius 11.
  - Credit: green tile and a down arrow.
  - Debit: brand tint.
  - Rows are grouped under date headers (12/700 soft), with one Card per date.
- **Recipient row:** a 42px initials avatar and a star for favourites. "Add a new recipient" uses a `1.5px dashed rgba(brand,.45)` circle.
- **Search pill:** white, `SHADOW.sm`, radius 999, padding `12px 16px`.

**Tabs, chips and toggles**
- **SegTabs:** track `rgba(17,24,29,.05)`, radius 999, padding 4. The active tab is white with `SHADOW.sm`. Text Poppins 600 14.
- **ChipTabs:** a horizontal scroller. Active is solid brand with white text; idle is white with `SHADOW.sm`. Padding `9px 18px`.
- **Pill:** active is solid brand; idle is white with a 1px border. Padding `9px 16px`, 13/600.
- **Tag:** radius 7, padding `3px 8px`, 10.5/700 UPPERCASE. Variants: brand, good, neutral.
- **Toggle:** a 42×24 track with a 20px knob. The knob slides `left 2→20` over .2s; the track is brand when on.
- **Risk meter:** five 7px dots.

**Buttons**
- **Primary (flows):**
  ```tsx
  { width:'100%', borderRadius:14, padding:15, font:"600 16px Poppins", background:'var(--brand-primary)', color:'#fff',
    boxShadow:'0 6px 18px rgba(var(--brand-primary-rgb),.35)' }   // disabled: rgba(24,33,38,.18), no shadow
  ```
- **Big CTA:** radius 18, padding `16px 18px`, Inter 700 15.5, `SHADOW.brand`. For example: "+ Open an account".
- **Pill CTA:** radius 999, padding `10px 20px`. For example: "Pay now".
- **Outline:** `1.5px solid C.borderStrong`, radius 999.
- **Soft brand pill:** `rgba(brand,.10)` fill. For example: "Profile".
- **Text link:** brand 600 13. For example: "See all".

**Digibot chat**
```tsx
user: { alignSelf:'flex-end', maxWidth:'82%', background:'#1c2630', color:'#fff', borderRadius:'16px 16px 4px 16px', padding:'10px 14px', fontSize:14.5 }
bot:  { background:'#fff', border:`1px solid ${C.border}`, borderRadius:'16px 16px 16px 4px', padding:'12px 14px' }
chip: { background:'rgba(brand,.08)', border:'1px solid rgba(brand,.35)', color:brand, borderRadius:999, padding:'8px 14px', fontSize:13, fontWeight:600 }
```
- Typing indicator: three 7px dots, `1s`, staggered .15s.
- Footnote: "✨ Response generated by AI".
- The topic picker is a bottom sheet: radius `20px 20px 0 0`, a 38×4 grabber, backdrop `rgba(0,0,0,.4)`.

### 6.6 Semantic colour
| Meaning | Colour |
|---|---|
| Success | `#16A968` (tiles `rgba(31,157,87,.12)`) |
| Pending | `#D97706` |
| Error / negative | `#E0533D`; web badge `#ef4444` |
| Info | brand tint |
| Cashflow in / out | good / brand |

### 6.7 Screens
- **Home.**
  - Top of screen, in order: greeting, balance hero, quick actions, then SegTabs (Accounts | Insights).
  - Accounts tab: "Your money" carousel with a "See all" link, then Cards with an "Outstanding balance · Pay now" row, then Extras ("Go Green" NEW, "Net worth").
  - Insights tab: cards with a 46px tone tile, a date, a 15.5/700 title and a 13.5 body.
- **Pay.**
  - "Pay & Transfer" title and a search box.
  - A 4-column action grid: Send Money, NIP Transfer, Scan & Pay, Pay Bill, Buy Goods, Own Accounts, Pay Card, Airtime, Forex.
  - SegTabs: Recent | All | Favourites. Then the recipients list.
- **Open (the FAB).**
  - Brand hero: "NEW ACCOUNT" / "A bank account in about five minutes."
  - A Perks card.
  - The big CTA, with the line "Takes about 5 minutes · You'll need your BVN and NIN" under it.
  - "Applications in progress" list.
- **Wealth.** ChipTabs: Invest · Protect · Retire · Money in/out.
  - Invest:
    - intent tiles; selected state is `rgba(brand,.08)` with a 1.5px `rgba(brand,.5)` border
    - product cards with "1Y RETURN" in green Poppins 18
    - risk dots
    - an RM card with a "Call" button
  - Protect / Retire / Cashflow:
    - 8px progress bars
    - paired 9px bars (radius `3px 3px 0 0`)
- **More.**
  - Profile card with a 56px gradient avatar.
  - "Security Checkup".
  - Grids: QUICK ACCESS and APPLY.
  - APP & SECURITY list with toggles.
  - Footer version line.
- **Notifications.** Underline tabs Banking | Tips & Deals with a 2px brand underline. Unread rows show an 8px brand dot.
- **Transfer flow.**
  - Chrome: a white 52px header, a `C.page` body and a white footer.
  - Steps: form (From / To / Amount / Note), then review ("You're sending", 34px amount, "This is a demo — no real money moves."), then success (76px green circle, receipt, and 46px Share / Copy ref / Receipt actions).
- **Scan & Pay.**
  - Background `#0c1b26`, with a 230px frame at radius 24.
  - Four corner brackets: `3px solid brand`, 12px radii.

### 6.8 Voice
- Warm, reassuring and focused on progress: you never wait, and checks run in the background. Contractions are fine, and greetings carry one 👋.
- Examples:
  - "Start with your BVN and NIN. We verify everything in the background — you never wait on a queue."
  - "Your account opens while checks run in the background."
  - "Finish KYC whenever — send documents and your selfie later, from a link."
  - Digibot: "Hi Adaeze 👋 I'm your Stanbic IBTC assistant. What can I help you with?"
- Currency is always written as `NGN 1,234.56`.

---

## 7. Customer: account opening, status & KYC link

Files: `customer/customer.css` (class-based, scoped under `.cx`), `ui.tsx`, `icons.tsx`, `flow.tsx`, `Apply.tsx`, `ApplyCorporate.tsx`, `ExtractionReview.tsx`, `Status.tsx`, `Kyc.tsx`, `CustomerApp.tsx`.

The wizard mounts full-screen from the consumer app's **Open** tab. `/kyc/:token` is the standalone link the customer receives by text: phone bezel, no tabs, no login, **no Home button**. The same `.cx` shell is reused inside the RM desk's capture and Application Details dialogs.

### 7.1 Tokens (`.cx`, css:6-25)
```css
--blue: var(--brand-primary, #0033A1);
--blue-2: color-mix(in srgb, var(--brand-primary, #0033A1) 78%, #000);   /* hover */
--sky: var(--brand-secondary, #0091DA);
--navy: color-mix(in srgb, var(--brand-primary, #012169) 62%, #000);
--page:#F4F6FA; --card:#FFFFFF; --wash:#F7F8FB;
--ink:#11181D; --soft:rgba(17,24,29,.58); --faint:rgba(17,24,29,.40);
--line:rgba(17,24,29,.10); --line-2:rgba(17,24,29,.06);
--good:#16A34A; --good-bg:#EAF7F0; --warn:#D97706; --warn-bg:#FDF6E8; --crit:#DC2626; --crit-bg:#FDF3F3;
--r-card:20px; --r-tile:16px; --r-sm:11px;
--f-head:'Poppins',system-ui,sans-serif; --f-body:'Inter',system-ui,-apple-system,sans-serif;
/* info tint (repeated literal): #EAF1FB bg / #0b2f6b text */
.cx :focus-visible { outline:2px solid var(--sky); outline-offset:2px; border-radius:6px; }
```
Resets use `:where()` so they carry zero specificity.

This shell differs from the consumer app (§6):

| Token | Consumer app | `.cx` shell |
|---|---|---|
| Page background | `#F4F5F8` | `#F4F6FA` |
| Good green | `#16A968` | `#16A34A` |
| Soft text | .52 | .58 |
| Faint text | .34 | .40 |
| Card radius | 22 | 20 |
| Tile radius | 18 | 16 |

### 7.2 Typography
```css
.cx-h1 { font:600 24px/1.2 var(--f-head); letter-spacing:-.025em; text-wrap:balance; }
.cx-h2 { font:600 17px/1.25 var(--f-head); letter-spacing:-.02em; }
.cx-p  { font-size:14px; line-height:1.55; color:var(--soft); }
.cx-label { font:600 10.5px/1 var(--f-body); letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
```
Other type roles:
- Hero h1: 600 26/1.18 at −.03em.
- Reference ID: 600 15 at .06em.
- Account number: Poppins 600 26 at .04em.

### 7.3 Scaffold
Every step uses the same three parts: a fixed white header, a body that scrolls, and a fixed white footer holding full-width buttons.
```css
.cx-head { padding:max(env(safe-area-inset-top),14px) 18px 10px; background:#fff; border-bottom:1px solid var(--line-2); }
.cx-back, .cx-x { width:34px; height:34px; border-radius:999px; color:var(--soft); }     /* hover bg --wash */
.cx-body { flex:1; overflow-y:auto; padding:18px; }   /* .mid centres a .cx-mid child vertically */
.cx-foot { padding:14px 18px max(env(safe-area-inset-bottom),28px); background:#fff; border-top:1px solid var(--line-2);
  display:flex; flex-direction:column; gap:8px; box-shadow:0 -10px 14px -10px rgba(17,24,29,.12); }  /* content slides under it */
```
- **Brand lockup in the header:**
  - The logo, 24px tall with a max width of 132px.
  - If there is no logo, a 28px **sky** square (radius 8) with a white Poppins 700 initial, plus the app name.
  - Underneath, an UPPERCASE 10px faint subtitle naming the step: "ABOUT YOU", "FINISH YOUR ACCOUNT", "APPLICATION RECEIVED".
- **Progress rail:**
  ```css
  .cx-rail { display:flex; gap:5px; margin-top:12px; }
  .cx-rail i { flex:1; height:3px; border-radius:2px; background:var(--line); transition:background .3s; }
  .cx-rail i.on { background:var(--sky); }
  .cx-step-n { font:500 11.5px/1 var(--f-body); color:var(--faint); margin-top:9px; }  /* "Step 2 of 6" */
  ```
  - Individual steps: About you · Identity · Address · Employment · Account · Review.
  - Corporate steps: Business · Directors · Review.

### 7.4 Components
**Buttons**
```css
.cx-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:14px 18px;
  border:1px solid transparent; border-radius:14px; font:600 15px/1 var(--f-body); letter-spacing:-.01em;
  background:var(--blue); color:#fff; transition:background .15s, transform .1s, opacity .15s; }
.cx-btn:hover { background:var(--blue-2); } .cx-btn:active { transform:scale(.99); } .cx-btn:disabled { opacity:.4; }
.cx-btn.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
.cx-btn.sky { background:var(--sky); }   .cx-btn.sm { padding:10px 14px; font-size:13.5px; border-radius:11px; width:auto; }
.cx-link { font:600 13.5px/1 var(--f-body); color:var(--blue); padding:6px; }
```
Buttons that move forward end with an `arrowRight` icon at 17px, e.g. "Continue →".

**Form fields**
```css
.cx-field > label { display:block; font:500 12.5px/1 var(--f-body); color:var(--soft); margin-bottom:6px; }
.cx-input { width:100%; padding:13px 14px; border:1px solid var(--line); border-radius:13px; background:#fff; font-size:15px; }
.cx-input::placeholder { color:rgba(17,24,29,.30); }
.cx-input:focus { border-color:var(--sky); box-shadow:0 0 0 3px rgba(0,145,218,.14); }
.cx-input.bad { border-color:var(--crit); }  .cx-input.bad:focus { box-shadow:0 0 0 3px rgba(220,38,38,.12); }
.cx-hint { font-size:11.5px; color:var(--faint); margin-top:5px; }
.cx-err  { font-size:11.5px; color:var(--crit); margin-top:5px; font-weight:500; }   /* replaces the hint */
.cx-row  { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
```
- `.cx-select` is the same box with `appearance:none` and an inline SVG chevron (12px, 50% ink) placed 12px from the right.
- Consent checkbox: 18px, `accent-color:var(--blue)`, with 12.5/1.5 soft copy.

**Chips and notes**
- `.cx-chip`: radius 999, padding `5px 10px`, 600 11.5px, with a 6px dot. Tones:
  - good `#EAF7F0/#16A34A`
  - warn `#FDF6E8/#D97706`
  - crit `#FDF3F3/#DC2626`
  - info `#EAF1FB`/blue
- `.cx-note`: radius 16, padding `12px 14px`, 12.5/1.5, with a 16px icon. Tones:
  - info `#0b2f6b` on `#EAF1FB`
  - warn `#7c4a06` on `#FDF6E8`
  - good `#0d5c30` on `#EAF7F0`
- Individual / Corporate segmented control: a wash track with radius 11; the active option is white with `0 1px 2px rgba(17,24,29,.08)`.

**Hero and value props**
```css
.cx-hero { border-radius:26px; padding:26px 22px 24px; color:#fff; position:relative; overflow:hidden;
  background:linear-gradient(150deg, var(--blue), var(--navy)); }
.cx-hero::after { /* 210px circle rgba(255,255,255,.12) at right -50 / top -60 */ }
```
Value-prop rows: padding `11px 0`, a hairline divider, and a 34px icon tile (radius 11, `#EAF1FB` background, blue icon).

**Document upload tile** `label.cx-drop`
- `1.5px dashed var(--line)`, radius 16, padding 18, `--wash` background.
- Hover: sky border on `rgba(0,145,218,.04)`.
- 34–40px icon tile in the brand colour at 10% strength.
- Title 13.5/600, sub 12 soft.
- `.reading` state: solid border plus a spinner.
- `.done` state: solid `--good` border on `--good-bg`, a green check, "Uploaded · tap to replace", and the trailing icon becomes `refresh`.

**Liveness (FaceID iframe)**
```css
.cx-faceid { width:100%; max-width:460px; margin:0 auto 8px; flex:1 1 auto; min-height:360px;
  border-radius:16px; overflow:hidden; border:1px solid var(--line-2); background:var(--wash); }
```
- Keep the frame narrower than 480px, or FaceID draws its own phone bezel inside it.
- Status line below the frame: "Finish the check above, then continue" in soft, or "Liveness confirmed · score 0.94" in good.
- The footer button is **sky** ("I've finished the check →") until the check is confirmed, then becomes primary ("Continue →").

**Signature pad**
- White, 1px line border, radius 16.
- The canvas is 180px tall with `touch-action:none`.
- A dashed baseline sits 40px from the bottom. Placeholder: "Sign above the line".
- Ink is `#11181D` at 2.2px with round caps. A "Clear" link sits beside it.

**Received moment**
- `.cx-tick`: a 76px `--good-bg` circle with a 38px check. It pops in with `cx-pop .4s cubic-bezier(.2,.8,.3,1.2)` (scale .5 to 1).
- Reference box: wash background, `1px dashed line`, radius 12, text centred.

**Status tracker**
```css
.cx-st { display:flex; gap:12px; position:relative; padding-bottom:16px; }
.cx-st::before { content:""; position:absolute; left:8px; top:20px; bottom:0; width:2px; background:var(--line); }
.cx-st.done::before { background:var(--good); }
.cx-st .dot { width:18px; height:18px; border-radius:999px; border:2px solid var(--line); background:#fff; }
.cx-st.done .dot { background:var(--good); border-color:var(--good); }     /* 10px check, stroke 3 */
.cx-st.cur  .dot { border-color:var(--sky); box-shadow:0 0 0 4px rgba(0,145,218,.16); }
.cx-st.exc  .dot { background:var(--crit); border-color:var(--crit); }
```
- The five steps: Application received → Verifying your identity → Identity verified → Account created → Fully activated.
- The current step is labelled "In progress…" with a sky spinner (13px, `2px rgba(0,145,218,.25)`, `.7s`).
- **Account-number card:** `linear-gradient(150deg, var(--blue), var(--navy))`, eyebrow "YOUR ACCOUNT NUMBER", number in Poppins 600 26, then "CIF … · Stanbic IBTC".
- **Check discs:** 20px. Passed `#16A34A` ✓, running `#0091DA`, pending `#C7CDD4`, failed `#DC2626` !, retrying `#D97706`.
- **Activity feed:** 7px sky dots, at most 6 rows.

**Extraction review** (`.xv`, css:261-417) replaces the wizard after a form is uploaded. It is shared with the desk.
- **Layout:**
  - Head: eyebrow "EXTRACTION REVIEW" (11/700, .1em, blue), a 21px heading, then "Open in Maestro ↗" and "Close".
  - Split: `minmax(0,.95fr) minmax(0,1.05fr)`, with fields on the left and the PDF on the right (`#f4f6fb`, `#view=FitH`). It stacks below 1000px.
- **Field row:**
  - An 11.5/600 label.
  - The input: 13.5px, padding `8px 10px`, radius 9, background `#fbfcfe`, blue focus ring.
  - Missing: a dashed border and "Not found on the form".
  - Edited: `#e8f6ef/#bfe6d3`.
- **Confidence pill** (10.5/700, radius 999; the high band is 90 or above, mid is 80 or above):
  - hi `#12805c` on `#e8f6ef`, border `#bfe6d3`
  - mid `#b7791f` on `#fdf5e6`, border `#f0dcaf`
  - lo `#c0392b` on `#fdecea`, border `#f4c9c3`
- **Cards:**
  - "Needs checking": `#fdf7ec` with border `#ddc08a`, heading `#7a5417`.
  - "Form exceptions": `#fdf1f1` with border `#e5b4b4`, heading `#8c2f2f`. Severity pills are 9.5/700 UPPER: critical `#fff/#a32020`, high `#8c2020/#f7dada`, medium `#8a5a12/#fbeed4`, low `#4b5563/#eceef1`.
- **Loading:**
  - A scan sweep plays over the document while it is read (the same gradient as §3.4, 2.4s).
  - Skeleton rows are 11px bars at radius 5 with a shimmer: `linear-gradient(90deg,#eef1f6,#f7f9fc,#eef1f6)`, 1.15s.
  - Fields reveal in a stagger: `opacity 0 / translateY(4px)` to settled, over .25s.
- **Confirm button:** it is gated, so its tooltip hangs on a wrapper. Tooltip: `#1f2733`, white 12/500, radius 8, max 34ch.

### 7.5 Screens
- **Apply (individual)** has six steps. Step 1 opens with the upload tile ("Have a completed form? Upload it"), followed by two-up fields. The Review step shows `.cx-kv` rows (13.5px, soft key, right-aligned value) and the consent checkbox. Footer buttons: "Continue →", then "Submit application" or "Submitting…".
- **Apply (corporate)** runs Business → Directors → Review. Each director is a card (radius 16) with a 22px number badge and a remove button. A ghost button reads "Add another director".
- **Received:** the tick, "Application received", "YOUR REFERENCE", a good note, and two buttons: "Track my application →" and the ghost "Finish KYC now".
- **Status:** the header ("APPLICATION", the ID, a status chip), the account card, a warn note when KYC is pending ("Finish setting up"), then the Progress, Checks and Activity cards.
- **KYC link** runs intro → docs → liveness → signature → done.
  - Intro: "Hello {name} 👋", value-prop rows, and an info note.
  - Docs: two upload tiles.
  - Liveness: the FaceID frame.
  - Signature: the pad.
  - Done: the tick, "You're all set", and the account number.

### 7.6 Voice
- Apply:
  - "Let's start with you" · "Use your name exactly as it appears on your NIN."
  - "We verify these with NIMC and NIBSS in the background. You won't wait for it."
  - "You can send proof of address later — it won't hold up your account."
  - "This sets the limits on your account, and we are required to ask."
- Upload:
  - "Scan or photo of the account opening form — we'll read it and fill this in."
  - "{n} fields read from {file}. Please check each one before you continue."
- Duplicates: "These details match an existing customer. In production this stops here — we never open a duplicate account."
- Received: "That's everything we need from you for now, {name}. We're verifying your identity in the background — you don't need to wait here."
- Status: "We need a moment. One of our checks needs a person to look at it. We'll be in touch — you don't need to do anything."
- KYC:
  - "Takes about two minutes. You can stop and come back — this link keeps your place."
  - "Photos are fine — just make sure all four corners are visible."
- Review:
  - "{n} fields need checking" / "Read poorly or missing. Compare each with the form and correct it, or leave it if it is right."
  - "Everything read cleanly."

---

## 8. Behind-the-scenes instruments

Files: `instruments/shell.tsx`, `instruments.css`, `brand.ts`, `Kafka.tsx`, `Finacle.tsx`, `Comms.tsx`, `tower/*`, `Cases.tsx`, `cases.css`.

The Kafka, Finacle and Comms instruments deliberately do **not** copy the third-party products they stand in for. They are drawn in the bank's own family-A chrome, so they read as part of one platform. Two instruments are exceptions:
- **Tower** copies Power BI.
- **Cases** copies UiPath Maestro.

Do not port `instruments.css:181-349`. That range holds the `.cl-*` styles, which use Space Grotesk and 22px radii and are dead code.

### 8.1 Shared instrument shell (Kafka, Finacle, Comms, Cases)
```css
.inst {
  --i-brand: var(--brand-primary, #0033A1); --i-brand-rgb: var(--brand-primary-rgb, 0,51,161); --i-accent: var(--brand-secondary, #0091DA);
  --i-navy: color-mix(in srgb, var(--i-brand) 62%, #000);  --i-navy-2: color-mix(in srgb, var(--i-brand) 78%, #000);
  --i-on-navy: color-mix(in srgb, var(--i-brand) 18%, #fff); --i-on-navy-dim: color-mix(in srgb, var(--i-brand) 42%, #fff);
  --i-ink:#0b1220; --i-ink-2:#566072; --i-ink-3:#8a93a1; --i-ink-4:#9aa3b0;
  --i-line:#e6e9ef; --i-line-2:#dfe3ea; --i-line-3:#eef1f5;
  --i-good:#12805c; --i-good-bg:#ecf6f1; --i-good-ink:#0f6f4f;
  --i-warn:#c99a3e; --i-warn-bg:#fbf4e6; --i-warn-ink:#9a6b1e;
  --i-red:#d1443a;  --i-red-bg:#fbeceb;  --i-red-ink:#b42318;
  height:100dvh; display:grid; grid-template-rows:auto 1fr; overflow:hidden; font-size:14px;
}
@keyframes instIn { from { opacity:0; transform:translateY(-4px); background:rgba(var(--i-brand-rgb),.10); } to { opacity:1; transform:none; background:transparent; } }
```
Rows are keyed by id. Every newly arrived row gets `animation: instIn .4s ease-out`, so no extra JavaScript is needed to flash it.

**Top bar** (62px, navy). Left to right: a white square mark, `appName` over an uppercase sub-label, a system pill, a spacer, "● Live", and "← Launcher".
```css
.inst-top { display:flex; align-items:center; gap:14px; padding:0 22px; height:62px; background:var(--i-navy); color:#fff; }
.inst-top .mark { width:30px; height:30px; border-radius:0; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); }
.inst-top .wm b { font:600 14.5px/1.15 var(--i-num); }  .inst-top .wm em { font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--i-on-navy-dim); }
.inst-top .sys { padding:4px 10px; background:rgba(255,255,255,.1); font:600 11px/1 var(--i-num); letter-spacing:.05em; text-transform:uppercase; color:var(--i-on-navy); }
.inst-top .live { margin-left:auto; font-size:12.5px; font-weight:600; color:#6ee7a8; }  .inst-top .live i { width:7px; height:7px; border-radius:50%; background:#34d399; }
```
System pill and sub-label for each instrument:

| Instrument | System pill | Sub-label |
|---|---|---|
| Kafka | "Kafka · Event Stream" | "Event backbone" |
| Finacle | "Finacle · Core Banking" | "Core banking" |
| Comms | "Notification Service" | "Customer comms" |
| Cases | "Case Management" | "Account opening" |

**Shared stat strip, list and drawer**
- **Stat strip:**
  - Labels are 11px UPPER, .05em, ink-3.
  - Values are 700 24px (22px on Kafka), −.02em, tabular.
  - Each stat is separated by a vertical 1px line.
- **List:**
  - A 1px line-2 box with line-3 hairlines between rows.
  - Header row: 34px tall on line-3, 600 10.5px .08em UPPER ink-4.
  - Hover: `#fafaf7`.
  - Selected row: `rgba(brand,.06)` plus `inset 3px 0 0 brand`.
- **Right drawer:**
  - The grid column animates from `0` to `380px` (`transition:grid-template-columns .2s`).
  - Header: name at 15/700 and a mono ID, with a 28px ✕ button.
  - Below 1180px the drawer replaces the list instead of sitting beside it.

### 8.2 `/kafka`: event stream
- **Layout:** `260px` topic sidebar next to a stat strip and feed (`minmax(0,1fr)`).
- **Topic hues:**
  - account-opening-requested `#0091DA`
  - nin-validation `#7C6CF0`
  - bvn-validation `#2EA8C0`
  - account-creation-requested `#D97706`
  - account-created `#16A34A`
  - bulk-upload `#C8A24A`
  - exception-queue `#DC2626`
  - customer-notification `#0033A1`
- **Topic row:**
  - An 8px rounded-square swatch (radius 2).
  - The name in **mono 12px kebab-case**.
  - A count chip on line-3.
  - Current row: `rgba(brand,.08)`.
- **Event row:**
  ```css
  .kf-ev { display:grid; grid-template-columns:150px 190px minmax(0,1fr) 64px; gap:14px; padding:10px 24px; border-bottom:1px solid var(--i-line-3); animation:instIn .4s ease-out; }
  /* topic: mono 11.5/500 in topic hue · case id: mono 12 ink-2 · message: 13 ellipsis · age: tabular 11.5 ink-3 right ("12s ago") */
  ```
- **Order:** newest first.
- **Empty state:** "No events on this topic yet. Capture an application or resolve a case and they'll stream in here."

### 8.3 `/finacle`: core banking
- **Stat strip:** CIFs · Active accounts (good-ink) · Limited (KYC pending) (warn-ink) · Opened today.
- **Heading:** `h1` "Accounts" at 18/700.
- **Table:**
  ```css
  .fn-cols, .fn-row { grid-template-columns:120px minmax(0,1.2fr) 140px 110px 96px 20px; gap:14px; padding:0 16px; }
  .fn-row { min-height:52px; border-bottom:1px solid var(--i-line-3); }
  .fn-row .cif  { font-family:var(--i-mono); font-size:12.5px; color:var(--i-brand); font-weight:500; }   /* CIF in brand-blue mono */
  .fn-row .acct { font-family:var(--i-mono); font-size:13px; }
  .fn-tag.active { background:var(--i-good-bg); color:var(--i-good-ink); }  .fn-tag.limited { background:var(--i-warn-bg); color:var(--i-warn-ink); }
  ```
- **Drawer account card:**
  - Navy background, padding 16.
  - "SAVINGS ACCOUNT" label at 10.5/.1em UPPER dim.
  - Account number at **700 22px, .04em**.
  - Sub line: "Opening balance ₦0.00 · Active, limited until KYC".
- **Field groups:**
  - Two groups under the eyebrows "CUSTOMER" and "ACCOUNT".
  - Each field is a `dl` row in a `96px 1fr` grid, with 12.5 ink-3 keys and 13px values.
  - BVN and NIN are shown in mono.
- **Empty state:** "No accounts yet" / "Open an account on the desk or in the customer app and the CIF appears here."

### 8.4 `/comms`: notification service
- **Channels:**

  | Channel | Avatar colour | Chip |
  |---|---|---|
  | SMS | `#0091DA` | `rgba(0,145,218,.12)` / `#0079b3` |
  | WhatsApp | `#25D366` | `rgba(37,211,102,.14)` / `#1da851` |
  | Email | brand | `rgba(brand,.1)` / brand |

  Icons are solid glyphs: Material "sms", the WhatsApp brand mark, and Material "email".
- **Toolbar:**
  - "Conversations" heading and its count.
  - Search box ("Search name, ref or number"), max 300px.
  - Segmented channel filter: a line-3 track; the pressed option is white with its channel colour.
- **Conversation row:**
  - Grid `40px 1fr auto`, padding `12px 16px`.
  - **34px square** channel avatar with a white 16px glyph.
  - Name 13.5/600, preview 12.5 ink-2 with ellipsis, and a count chip.
- **Message preview**, the one rounded shape on this page:
  ```css
  .cm-bubble { font-size:13px; line-height:1.5; background:#fff; border:1px solid var(--i-line-2); border-radius:4px 14px 14px 14px; padding:11px 13px; }
  ```
  - Header: channel chip, label ("Account opened"), then the time on the right.
  - Footer: "to +234…" on the left, and "✓✓ Delivered" (good-ink) or "✓ Sent" on the right.
- **Message copy:**
  - "Hi Ada, we've received your account opening request (ref …). We'll text you as each step completes."
  - "Good news Ada! Your Stanbic IBTC account 0123… is now open. Complete a quick KYC check to unlock full access."
  - "Ada, finish setting up your account with a 30-second selfie check: <link>"

### 8.5 `/tower`: Control tower as a **Power BI / Fabric report**
This page drops the bank top bar entirely.

**Tokens**
```css
.inst.pb {
  --pb-ink:#252423; --pb-ink-2:#605e5c; --pb-ink-3:#8a8886;        /* Fluent warm neutrals */
  --pb-line:#e1dfdd; --pb-line-2:#edebe9;
  --pb-surface:#f3f2f1; --pb-canvas:#e4e3e1; --pb-page:#f7f7f6; --pb-card:#fff;
  --pb-fabric:#0f6cbd;                                               /* Fabric accent — chrome only, never data */
  --pb-good:#107c41; --pb-warn:#b45309; --pb-bad:#c4314b;          /* fixed semantics, never rebranded */
  --pb-brand:var(--brand-primary,#012169); --pb-brand-2:var(--brand-secondary,#3f6fd6);
  font-family:'Segoe UI','Open Sans',system-ui,sans-serif; font-size:13px; font-variant-numeric:tabular-nums;
}
```
- **Radii:** chrome 3px, visuals 2px, filter chips 12px, badges 9px.
- **Chart palette:**
  - Neutral series use the brand colour and brand-2.
  - Signal colours: good `#107c41`, warn `#b45309`, bad `#c4314b`, info `#0f6cbd`.
  - Check categories use Power BI's categorical palette: BVN `#c4314b`, NIN `#e66c37`, AML `#118dff`, PEP `#744ec2`, FRAUD `#e044a7`, LIVENESS `#038387`.
  - Neutral fill: `#c8c6c4`.

**Page chrome, top to bottom**
1. **Suite bar** (44px): `#201f1e` background, `#f3f2f1` text.
   - Contents: waffle icon, Power BI mark (three bars `#e8b400 #f2c811 #f9e589`), "Power BI", a search pill (`rgba(255,255,255,.11)`, radius 3), "Fabric trial · 46 days left" (`#f2c811` with a `.4` border), bell/gear/help icons, and a 28px brand avatar.
2. **Nav rail:** 208px wide, collapsing to 48px. White with a line on the right edge.
   - Items: Home, Create, Browse, OneLake catalog, Apps, Workspaces, at 12.5px with radius 3.
   - A workspace chip sits at the bottom with `margin-bottom:34px`, which leaves room for the Launcher pill.
3. **Workspace header:** Fabric diamond, breadcrumb "Stanbic IBTC › Account Opening › **Control Tower**", a "Power BI report" tag, "1,284 rows in scope", "● Refreshed just now", and "Computed in-app · demo data".
4. **Command bar:**
   - Buttons: File, Export, Share, Chat in Teams (all disabled) | Refresh (the icon spins .8s) | range segments "24 hours · 48 hours · 7 days · 30 days" (pressed segment is brand fill) | "Simulate an application" | … | Filters (with a fabric-blue badge) | Edit.
   - Button style: `.pb-cmd-b` 12.5/500, padding `6px 11px`, radius 3. The `.on` state is `rgba(15,108,189,.1)` with fabric text.
5. **Lineage band:** 11.5px text, "**Lineage** Case store → OneLake → semantic model → this report".
6. **Canvas and sheet:**
   ```css
   .pb-canvas { background:var(--pb-canvas); padding:16px 18px; }                 /* #e4e3e1 */
   .pb-sheet  { background:var(--pb-page); border-radius:2px; box-shadow:0 1px 3px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.04); padding:12px; }
   ```
7. **Bottom page tabs:** `--pb-surface` background with a line on top.
   - The selected tab gets a **2px brand top border**, a white background and 600 weight.
   - Tabs: Overview · Exceptions & SLA (red badge) · Flow · Channels · Verification · Timing. On the right: "Page 1 of 6 · Fit to width".

**Visual containers**

A visual has **no border and no shadow until you hover it**:
```css
.pb-vis { background:#fff; border:1px solid transparent; border-radius:2px; transition:border-color .12s; }
.pb-vis:hover, .pb-vis:focus-within { border-color:#c8c6c4; }
.pb-vis-h .t b { font-size:13px; font-weight:600; }  .pb-vis-h .t em { font-size:11px; color:var(--pb-ink-2); }
.pb-vis-h .acts { opacity:0; } .pb-vis:hover .pb-vis-h .acts { opacity:1; }            /* table view / focus mode */
.pb-vis.focus { position:fixed; inset:56px; z-index:41; box-shadow:0 24px 60px -18px rgba(0,0,0,.4); }  /* scrim rgba(37,36,35,.34) */
```
- **Page grids** have fixed row heights and a 12px gap. For example, Overview is 4 columns with rows `auto 272px 200px 222px` and areas `'kpi kpi kpi kpi' 'a a a b' 'c c d b' 'e e f f'`.
- **KPI cards:**
  - Four cards in one white block, separated by hairlines.
  - Label 12 ink-2; value **30/600**; `%` suffix at 15.
  - Delta line: "▲ 12 (18%) vs prior 48 hours" in good or bad.
  - Target line: "On target · 80% goal".
  - Sparkline: 24px tall, brand line at 1.5px over an area at 8% opacity.
  - Selected state: `inset 0 -2px 0 fabric`.
- **Charts** are hand-drawn SVG with category axes, hairline gridlines (line-2), 10.5px ticks and labels, and **no grey track behind bars**. Types:
  - Combo: brand columns (at most 44px wide) with a brand-2 line (2px, white markers).
  - Gauge: 16px stroke; the target tick is 2px ink.
  - Funnel: centred brand bars, 24px tall.
  - Horizontal bars.
  - 100% stacked bar.
  - Heatmap: brand colour at opacity `.12 + .88·v/max`.
  - Sankey: 12px nodes; ribbons are gradients at `.32` opacity, `.8` when highlighted and `.07` when dimmed.
- **Cross-filtering:** clicking any mark filters every page. Unselected marks drop to `opacity .35`.
- **Filter pane** (264px): checkbox groups using `accent-color #0f6cbd`, and the note "Filters apply to every visual on every page." Applied-filter chips are fabric blue on `rgba(15,108,189,.08)` with radius 12, for example "Channel: Branch ✕".
- **Tooltip:** `#252423`, white 11.5px, radius 2, `0 4px 12px rgba(0,0,0,.28)`.
- **Inert chrome** is rendered `disabled` (opacity .62) rather than as clicks that do nothing.
- **Icons:** 24-grid, stroke 1.7, drawn at 13–17px.

### 8.6 `/cases`: case management as a **UiPath Maestro canvas**
This page keeps the bank top bar.

**Tokens**
```css
.inst.cm {
  --cm-done:#1f9d57;   --cm-done-bg:#f1faf4;   --cm-done-line:#bfe6cd;     /* green  = done */
  --cm-active:#2f6bd6; --cm-active-bg:#f2f6fd; --cm-active-line:#bcd2f4;   /* blue   = active */
  --cm-att:#dc4a3d;    --cm-att-bg:#fdf3f2;    --cm-att-line:#f3ccc7;      /* red    = attention */
  --cm-pend:#9aa6b2;   --cm-pend-line:#e3e7ec;                              /* grey   = not started */
  background:#fff; font-family:var(--i-num);
}
```
Gateway and waiting states use violet `#7a52c4`.

Task-kind chips (22px squares holding a 15px icon):

| Kind | Background | Icon colour |
|---|---|---|
| agent | `#eef0ff` | `#4c53c9` |
| robot | `#eaf4fb` | `#2f7fb8` |
| human | `#fdeef4` | `#c0468a` |
| app | `#eef6f0` | `#2f9e6f` |
| gateway | `#f3eefb` | `#7a52c4` |

**Layout, top to bottom**
1. **Top bar**, reading "Case Management".
2. **Sticky instance header:**
   - Package name in 12/600 ink-2.
   - Case picker: 13px, square, min 320px wide.
   - "STATUS" eyebrow and badge; the instance ID in mono.
   - Actions: "▶ Run in Maestro" (solid brand, square) and "Open in Maestro ↗" (brand text, line border, **7px radius**, the only rounded button on the page).
3. **Canvas head:**
   - "OnboardingCase" at 14/700.
   - An agent chip (radius 999): "**Case manager** / AI Orchestrator".
   - A legend of the five task kinds.
4. **Canvas:** padding `34px 22px`, `display:flex; width:max-content; margin-inline:auto`.

**Canvas elements**
- **Start node and connectors:**
  ```css
  .cm-start-node { width:70px; height:70px; border-radius:50%; background:#fff; border:2px solid var(--cm-pend-line); box-shadow:0 2px 10px -4px rgba(20,40,70,.25); }
  .cm-arrow { width:34px; height:2px; margin-top:68px; background:var(--cm-pend-line); }   /* + rotated-square arrowhead */
  ```
- **Stage card:**
  ```css
  .cm-stage { width:264px; background:#fff; border:2px solid var(--cm-pend-line); border-radius:0; padding:15px 15px 8px; box-shadow:0 4px 20px -12px rgba(20,40,70,.3); }
  .cm-stage.done { border-color:var(--cm-done-line); }
  .cm-stage.active { border-color:var(--cm-active-line); box-shadow:0 6px 24px -10px rgba(47,107,214,.4); }
  .cm-stage.attention { border-color:var(--cm-att-line); }
  .cm-stage-title b { font-size:16px; font-weight:700; }   .cm-stage-title span { font-size:11.5px; color:var(--i-ink-3); }
  ```
  - Stages and their subtitles: Intake "Capture & enrich" → Verification "KYC & identity" → Decision "Approve or refer" → Activation "Open the account" → Closure "Wrap & assure".
  - Meta line: "SLA: 4h · Duration: 28s".
  - Task groups: "Sequential tasks" and "Event-triggered tasks".
- **Task card:**
  - `padding:8px 9px; border:1px solid line-2; radius 0`. Done, active and attention states tint both the border and the background.
  - Gateways get a **dashed** border.
  - A red `*` marks a human-in-the-loop task, e.g. "Analyst review & exceptions*".
- **Status icons** (20px circles):
  - done: solid green with a white check (stroke 3.2)
  - active: a 13px spinner (`.7s`)
  - attention: "!" inside a red ring
  - waiting: a violet ◇
  - pending: an empty grey ring
  - A stage takes its state from its tasks: all done means done, any attention means attention, any active means active.
- **Divert chip:**
  - Dashed violet: `#f6f2fc / #dcccf4 / #6b4bb0`.
  - Copy: "◇ may route to EDD review · Pending customer · Declined / withdrawn".
- **Secondary and exception lanes:**
  - Heading "SECONDARY & EXCEPTION STAGES" under a dashed divider.
  - Lane cards are 236px wide and **dashed**, turning solid when active.
  - Lanes: Compliance escalations, EDD review, Pending customer, Declined / withdrawn.
  - Route lines: "◇ from Decision" (violet), "↺ returns to origin" (blue), "■ terminal — case closed" (red).

---

## 9. FaceID Verify console & kiosk

Files: `faceid/faceid.css` (1359 lines), `Console.tsx`, `EnrollWizard.tsx`, `LoginScreen.tsx`, `KioskWidget.tsx`, `LivenessPrescreen.tsx`, `LivenessScan.tsx`, `FaceMeshOverlay.tsx`, `ScrambleText.tsx`.

**How branding works here.** These pages were ported from a UiPath orange and teal app, and only three brand variables were remapped:
```ts
root.style.setProperty('--fc-primary', branding.primaryColor);   // #0033A1
root.style.setProperty('--fc-secondary', branding.secondaryColor); // #0091DA
root.style.setProperty('--fc-deep', branding.deepBlue || branding.primaryColor); // #012169
// title: "<app> — Verify Console" / "— Verify Kiosk"; kiosk also paints body = deepBlue
```
Many glows and tints are still hardcoded UiPath triplets and do not follow the brand: orange `250,70,22`, teal `11,162,179`, cyan `57,212,230`. If you port these pages, derive those values from the brand instead.

### 9.1 Console `/faceid`: family A (square, IBM Plex)
**Tokens**
```css
.pc-app {
  --orange:var(--fc-primary); --navy:var(--fc-deep); --navy-2:#1F2A30; --navy-3:#2A363D;
  --teal:var(--fc-secondary); --teal-deep:#0A7E8C; --teal-glow:rgba(11,162,179,.14);
  --amber:#DA9100; --amber-glow:rgba(218,145,0,.14);
  --magenta:#CC1956; --magenta-deep:#A81146; --magenta-glow:rgba(204,25,86,.12);
  --page:#fff; --card:#fff; --inset:#f5f7fa; --inset-2:#eef1f5; --line:#e6e9ef; --line-soft:#eef1f5;
  --text:var(--fc-deep); --muted:#566072; --faint:#9aa3b0;
  font-family:"IBM Plex Sans",system-ui,sans-serif;
}
.pc-shell { zoom:1.12; min-height:calc(100vh / 1.12); display:grid; grid-template-columns:236px 1fr; }
```
Every `.pc-*` radius is 0.

**Status palette:**

| Result | Colour |
|---|---|
| Pass | teal: `teal-glow` background with `#0A7E8C` text; approve button `#16A34A` |
| Fail / spoof | **magenta** `#CC1956` |
| Review / partial | amber `#DA9100` with `#8A5D00` text |

Result labels: "Verified", "Partial · Review", "No match", "Spoof blocked", "Inconclusive", "In progress". Pass thresholds are 80 for match and 70 for liveness.

**Layout**
- **Sidebar.** 236px wide on `--navy`, padding `18px 14px`.
  - A 34px favicon mark, the app name at 15/700, and "VERIFY CONSOLE" in Plex Mono 9px (`letter-spacing:1px`, `#7C8794`).
  - Nav groups: Operate (Dashboard, Verifications), Manage (Enroll identity, Identities), Configure (Settings). Group labels are 9.5px UPPER, `ls:1.4px`. Items are 13.5/500 in `#AEB7C0`.
  - The active item is `--navy-3` **with a 3px orange bar** at `left:-14px`. The ops and desk rails do not have this bar.
  - Footer: a residency card with a teal glowing dot ("{country} region / Liveness on · every check logged").
- **Topbar.** Sticky, `rgba(255,255,255,.85)` with 8px blur. `h1` at 18/700, subtitle at 12.
- **Content.** Padding 26px, max width 1180px.

**Dashboard components**
- **Metric tiles.** `repeat(auto-fit,minmax(180px,1fr))`. Each has a 32px tinted icon tile in teal, orange, magenta or amber, a value at 27/700 −.5px, and a mono delta in teal (up) or magenta (down).
- **Activity rows.** A 34px thumbnail, the name at 13.5/550, a mono meta line, a chip, a 62px mono score, and the date. Hover is `--inset`.
- **Chips.** A 6px `::before` dot on a glow background with deep-tone text.
- **Table.** Header cells `th` at 10.5/600 UPPER; body cells at 13px.
- **Toast.** `--fc-deep` background, 13/500, `0 16px 40px -12px rgba(0,0,0,.5)`, sliding up 80px over .3s.

**Verification record modal** (`.vr-console`). This is **rounded**, unlike the rest of the console: radius 20, font Inter, JetBrains Mono for numbers.
- **Header.** `linear-gradient(180deg,#FFF7F4,#fff)`. A mono live line: "SESSION COMPLETE" or "VERIFICATION FAILED · Spoof blocked".
- **Portraits.** Aspect 1/1.05, radius 14. Tags "Captured selfie" and "Reference on file". Over each portrait:
  - 10 teal mesh dots that pop in with `vrDot .5s`, staggered by .04s, then pulse over 5s.
  - A 44px teal scan band that sweeps for the first 4s.
  - A 48px match badge between the two portraits.
- **Confidence.** JetBrains Mono 34/600 in teal. It counts up with an ease-out cubic over 1100ms. Signal bars:
  - track: 6px
  - fill: `linear-gradient(90deg,#0A7E8C,teal)`, animated `width 1.1s cubic-bezier(.4,0,.2,1)`
  - failure fill: `#A81146→magenta`
  - threshold tick: a 2px amber tick at 80% or 70%
- **Checks grid.** A 2×2 grid; each tick draws in on a stagger.
- **Actions.**
  - "Overwrite & Approve": green, radius 10.
  - "Export report": ghost.
  - "Delete record": magenta outline.

**Enroll wizard**
- **Layout.** A 248px stepper beside the card.
- **Steps.** Identity profile → Document → Biometric → Screening → Consent & review.
- **Step markers.** 28px mono circles.
  - Active: orange fill with an orange title.
  - Done: teal with a check, joined by a 1.5×14 connector.
- **Card motion.** The card enters with `ewFade .25s`.
- **Footer.** "Step N of 5", then Back and Continue. The final button reads "Submit · enroll identity".
- **Inputs.** Focus state is an orange border with a `0 0 0 3px rgba(250,70,22,.1)` ring.
- **Drop zone.** 1.5px dashed `#CBD2DB`, turning orange on hover.
- **Screening rows.** Sanctions/AML "Clear" · PEP "Not a PEP" · Adverse media "None found" · Duplicate check "No existing match", then the result "Composite risk rating — LOW".

**Login gate** (rendered in a `srcDoc` iframe)
- **Two-column split.** Grid `1.08fr .92fr`.
- **Left panel.** Dark, with a 56px grid texture:
  ```css
  radial-gradient(900px 500px at 12% -8%, rgba(PRGB,.16), transparent 60%),
  radial-gradient(900px 600px at 90% 110%, rgba(SRGB,.18), transparent 60%),
  linear-gradient(160deg,#101826 0%, #0E1521 55%, #0A1019 100%);
  ```
  - Display face: Plus Jakarta Sans. `h1` at 44/700 reads "Verify a real, live person. *In seconds.*"
  - A 200px scan tile with teal corner brackets and a sweeping band.
  - Feature rows: Liveness / 1:1 match / Audit-ready.
- **Right panel.** Background `#FBFBFC`.
  - An 84px badge (radius 22) and an SSO button (radius 16, padding `19px 26px`, shadow `0 12px 26px -10px rgba(PRGB,.55)`).
  - Text: "Secured by {app} SSO · MFA enforced".

### 9.2 Kiosk `/faceid-kiosk`: dark, family B phone frame
**Frame.** The same 390px, 52px-radius bezel as §1.9. The widget background is `--fc-deep` with two brand glows (`color-mix(secondary 30%)` and `color-mix(primary 34%)`). Legacy dark tokens: `--bg:#0f1220; --card:#1a1f35; --border:#2a3150; --text:#e8ebf5; --muted:#9aa3c0`.

**Pre-screen**
- **Stages.**
  - `prep`, 7s: a static face, the scramble title "Let's verify it's you", 👍, and "Stay in Position" at 24/700.
  - `live`, 8s: the mirrored camera with the face mesh, "Face Scan", and a 0–100% bar.
  - Tapping advances to the next stage.
- **Backdrop.**
  ```css
  radial-gradient(120% 80% at 50% 32%, color-mix(in srgb, var(--fc-secondary) 22%, transparent), transparent 60%),
  linear-gradient(175deg, var(--fc-deep) 0%, #0a1226 100%);
  ```
- **Scan arc.** A 320×200 SVG, path `M10 70 Q160 20 310 70`, stroke 4. The gradient runs secondary to primary, with `drop-shadow(0 0 16px rgba(180,110,255,.9))`. It moves with `fsScan 4.6s ease-in-out infinite` (top 4.4% → 56%).
- **Progress bar.** A 4px track at `rgba(255,255,255,.18)`, filled with `linear-gradient(90deg, primary, secondary)`.

**Face mesh.** Decorative only: 29 points and 48 lines in a 100×120 viewBox.
- Lines: `rgba(160,215,255,.6)` at 0.5 width.
- Dots: `#eaf7ff`, r1.2, with `drop-shadow(0 0 6px rgba(120,200,255,.95))`.
- Lines fade .25↔.7 over 3s; dots fade .3↔1 over 2.2s, staggered.

**Scramble text.** Half-width katakana plus digits resolve left to right, one character locking every `(10+i*4+rand*8)/0.4` frames.
```css
.scr-flick { color:#4dffa3; text-shadow:0 0 6px rgba(77,255,163,.7); }  .scr-locked { color:#fff; text-shadow:none; }
```

**Oval guide (legacy stage).** `60%×74%`, `2px dashed rgba(57,212,230,.7)`, `border-radius:50% / 42%`. The outside is dimmed with `box-shadow:0 0 0 2000px rgba(5,8,15,.35)`. A sweep line travels 16% → 80% over 1.8s.

**Results**
- **Success.**
  - An 84px check draws its circle first (dasharray 151, .5s), then the tick (.35s after a .45s delay).
  - Heading: "Customer Verification Complete".
  - Rows: Face Match, Liveness Check, Verification Confidence 98.2%, Reference ID `VER-YYYYMMDD-#####`.
  - A pill, then "Done".
- **Status colours on dark.** Pass `#2fd07f`, fail `#ff6b81`, review `#f5b14c`, each on a 12% tint.
- **Failure copy.**
  - "Verification Failed"
  - "Liveness Check Failed"
  - "Verification Under Review"
  - "Partially Verified"
  - "That took a little too long. Center your face in the oval and try again."
- **Liveness hints.** "Center your face", "Come closer", "Move back", "Hold still", "More light", "One face only".
- **Primary CTA.** `--fc-primary`, radius 12, padding `14px 22px`, 15/600, full width.

---

## 10. Admin / branding console `/admin`

Files: `admin/App.tsx`, `admin.css`, `components/AdminShell.tsx`, `Dashboard.tsx`, `ProfilePicker.tsx`, `pages/BrandingTab.tsx`. The launcher does not link to this page.

**Branding.** The admin chrome is branded from `defaultConfig` (Aura orange `#FA4616` and teal `#0BA2B3`) at build time. It does **not** reflect the config being edited, and it still carries Zara-red `rgba(255,51,51,…)` tints. On this route, `admin.css` aliases the family name `'IBM Plex Sans'` to the Poppins files.

**Flow.** login → profiles → dashboard.

**Shell (screens before the dashboard)**
- Background `#f4f5f7` with three radial red tints.
- A centred 520px card: radius 20, padding `40px 36px 32px`, shadow `0 1px 2px rgba(24,33,38,.04), 0 24px 56px -12px rgba(24,33,38,.18), 0 12px 24px -8px rgba(24,33,38,.08)`.
- Wordmark in Poppins 24/600 with an "ADMIN" pill (accent `…14` background, `…40` border, radius 999).

**Dashboard layout**
- Max width 1280px, header padding `16px 32px`.
- Body card: white, radius 16, padding 32, shadow `0 8px 24px -8px rgba(24,33,38,.06)`.
- Sticky frosted footer: `rgba(255,255,255,.92)` with 12px blur. Buttons: "Publish to Data Fabric" and "Save configuration" (or "Save changes (v3 → v4)").

**Shared styles**
```ts
fieldLabel    = { fontSize:11, fontWeight:600, color:'rgba(24,33,38,0.55)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:6 }
fieldInput    = { fontFamily:"'Inter'", fontSize:14, padding:'11px 14px', borderRadius:10, border:'1.5px solid rgba(24,33,38,0.10)', color:'#182126' }
primaryButton = { fontFamily:"'Poppins'", fontSize:15, fontWeight:600, padding:'13px 18px', borderRadius:12, background:primary,
                  boxShadow:`0 6px 20px -6px ${primary}80, 0 2px 4px rgba(24,33,38,0.08)` }
secondaryButton = { fontSize:14, fontWeight:500, padding:'12px 18px', borderRadius:12, background:'rgba(24,33,38,0.06)' }
errorBanner   = { background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.28)', color:'#b91c1c', borderRadius:10 }
/* focus: border #0BA2B3 + 0 0 0 4px ring */
```

**Tabs.** Branding · Connection · Agents · Home Showcase · Demo Content · Notifications · Operations · Features · Strings. Each is Inter 13, padding `14px 18px`. The active tab has a 2px accent underline.

**Header buttons.** Ghost style: 12/500, padding `7px 13px`, radius 8. Labels: "Export JSON", "Import JSON", "Configurations", "Connect UiPath tenant", "Logout".

**Branding tab.** Sections, each introduced by a Poppins 16/600 header with a hairline under it:
- **Login screen.** Tagline, Logo, Logo size.
  - Logo size is a segmented control. The active option is filled `#182126`.
  - Logo preview: a 132×56 dashed box reading "No logo".
- **Market.** Country.
- **Inside the app.** Greeting.
- **Shared identity.** App name, plus four colours in a `repeat(auto-fit,minmax(220px,1fr))` grid.
  - Each colour is a native colour input (44×38, radius 8) beside a mono hex field. Only `#RRGGBB` is accepted.
- **Browser tab.** Favicon.
  - Preview: 40×40, radius 9.
  - Buttons: "Upload icon", "Replace icon", "Use auto".
  - Raster uploads are redrawn to a 128px PNG.

**Profile picker.** A dropdown with the groups "Built-in presets", "Your configurations" and "From Data Fabric". The live option shows a ✓ and "· currently live".

---

## 11. Porting checklist & known inconsistencies

### Checklist
1. **Pick the family** for each new page (§0), and don't mix families on one screen. The desk even forces embedded phone components into square corners.
2. **Brand plumbing.** Keep two brand variables plus their RGB triplets, and have a bridge that writes them from config on each surface. Derive navy, hover and on-navy values with `color-mix`. Leave good, warn and bad fixed.
3. **Fonts.**
   - Family A: IBM Plex Sans and Mono from Google Fonts, with Libre Franklin as the fallback.
   - Family B: Poppins and Inter, self-hosted with `font-display:block`.
4. **Numbers.** Everything numeric uses `tabular-nums`. Identifiers go in mono in family A.
5. **Family A.**
   - Corners are `border-radius:0` everywhere.
   - Use 1px hairlines instead of shadows.
   - Rails are 228–248px, with a 66px bar and a 1520px content column.
   - Eyebrows are 10.5px UPPERCASE with .1–.14em tracking.
   - KPIs sit in a hairline strip, not boxes.
6. **Family B.**
   - Cards 20–22px radius, tiles 16–18px, pills 999.
   - Brand-gradient heroes at 140–150deg, with translucent white decor circles.
   - Floating bottom nav, with a raised centre FAB on the customer app.
7. **The shared banking signatures:**
   - the role switcher ("Same workspace — different job")
   - the 5-segment Maestro stage bar (13×4px, radius 2; amber = parked, sky = running, green = done)
   - status tags (10.5/700 UPPERCASE with a 6px dot)
   - the "● Live" pulse
   - the severity spine on rows (3px red or amber, brand when selected)
   - the gold "your next move" accent, which is reserved and appears nowhere else
8. **Reserve the bottom-left corner** for a Home/Launcher pill.
9. **Reduced motion.** Honour `prefers-reduced-motion` everywhere.
10. **Voice.**
    - Sentence case, with `·` between metadata items.
    - Say why, not just what.
    - Staff tools translate system states into human terms. Customer copy is warm and always reassures that nothing is waiting on them.

### Inconsistencies (keep for pixel parity, fix for the intended language)
- **Ops warm grays** (`#f3f3ee`, `#f1f1ec`, `#ecece7`, `#f2f2ec`, `#a0a09a`) are leftovers. The intended neutral is the desk's cool `#f5f7fa`.
- **Two status palettes in family A.** The muted token set (`#12805c`, `#d1443a`, `#c99a3e`) and the bright inline set (`#16a34a`, `#dc2626`, `#d97706`) coexist.
- **Consumer vs `.cx` shell drift.** Page `#F4F5F8` vs `#F4F6FA`, good `#16A968` vs `#16A34A`, radius 22/18 vs 20/16.
- **Hardcoded UiPath and Zara colours.** FaceID and Admin still use orange `250,70,22`, teal `11,162,179` and red `255,51,51` instead of the brand.
- **Hardcoded Stanbic blue `#0033A1`** in ops (state tags, cockpit mini-rail, batch chip, avatars, Maestro toast) and in the Apply review checkbox.
- **Duplicated rules.** `.cx-spin` and `.cx-drop` are each defined twice in `customer.css`, and the later rule wins. `@keyframes vrPulse` is also defined twice.
- **Dead code, not a reference:** `src/ops/charts.tsx`, `src/ops/derive.ts`, `instruments.css:181-349` (`.cl-*`), and parts of `cases.css:165-199`.
