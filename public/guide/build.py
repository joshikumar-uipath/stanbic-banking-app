#!/usr/bin/env python3
"""Render the feature guide (overview + BRD coverage + one page per persona) from content.py and brd.py.

    python3 <path>/guide/build.py

Screenshots live in shots/<id>.jpg (1440×900 captures of the real apps; see capture/README.md).
Everything project-specific lives in content.py (SITE, PAGES, …) and brd.py — this file is the engine.

Two banks: the Stanbic IBTC guide is written to guide/, the FirstBank one to guide/firstbank/ (its own
shots/ beside it). Every page checks which theme the admin dashboard has active (the same saved profile
the apps load) and moves to the matching bank's copy, so neither bank ever sees the other's branding.
content.py writes {BANK} for the bank's name and {ROOT} for the app's root.
Optional blocks (PAINS, JOURNEY, FEATURES, SAMPLES, brd.SECTIONS) are skipped when empty.
"""
import html
import os
import content as C

HERE = os.path.dirname(os.path.abspath(__file__))

# up = path from the bank's pages to guide/; root = path to the app. A missing screenshot renders a text-only
# step, so a bank without its own shot never falls back to the other bank's screen.
BANKS = [
    {'slug': 'stanbic', 'name': 'Stanbic IBTC', 'dir': HERE, 'up': './', 'root': '../',
     'logo': '../stanbic-logo.png', 'favicon': '../stanbic-favicon.png', 'css': ''},
    {'slug': 'firstbank', 'name': 'FirstBank', 'dir': os.path.join(HERE, 'firstbank'), 'up': '../', 'root': '../../',
     'logo': './logo.svg', 'favicon': './favicon.svg',
     'css': ':root { --brand: #003B65; --brand-rgb: 0, 59, 101; --accent: #F0BD2D; --accent-rgb: 240, 189, 45; --accent-ink: #003B65; }'},
]
B = BANKS[0]

# Keep the rule in step with src/config/bank.ts: the active admin profile's appName picks the bank; a built-in
# preset or no profile means Stanbic, as in every app surface. ?bank=stanbic|firstbank overrides it.
ROUTE = '''<script>(function () {
  var here = "%s", want = "stanbic";
  try {
    var q = new URLSearchParams(location.search).get("bank");
    if (q) want = q;
    else {
      var s = JSON.parse(localStorage.getItem("zara_local_profiles_v1") || "null");
      var p = s && s.profiles && s.profiles.find(function (x) { return x.id === s.activeId; });
      var n = (p && p.config && p.config.branding && p.config.branding.appName) || "";
      if (/first\\s*bank|\\bfbn\\b/i.test(n)) want = "firstbank";
    }
  } catch (e) {}
  if (want !== here && (want === "stanbic" || want === "firstbank")) {
    var f = location.pathname.split("/").pop() || "index.html";
    location.replace((here === "stanbic" ? "firstbank/" : "../") + f + location.hash);
  }
})();</script>'''
e = lambda s: html.escape(str(s), quote=True)

SITE = C.SITE
PAGES = C.PAGES
PAINS = getattr(C, 'PAINS', [])
JOURNEY = getattr(C, 'JOURNEY', [])
FEATURES = getattr(C, 'FEATURES', [])
SAMPLES = getattr(C, 'SAMPLES', [])
try:
    from brd import SECTIONS as BRD, STATUS
except ImportError:
    BRD, STATUS = [], {}

ICONS = {
    'user': 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    'users': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
    'home': 'M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5 M9.5 21v-6h5v6',
    'bank': 'M3 10 12 4l9 6 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 21h18',
    'card': 'M2 6h20v12H2z M2 10h20 M6 15h4',
    'phone': 'M7 2h10v20H7z M11 18h2',
    'id': 'M3 5h18v14H3z M8 11a2 2 0 1 0 0-.01 M5.5 16a3 3 0 0 1 5 0 M14 10h4 M14 14h4',
    'briefcase': 'M3 7h18v13H3z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 12h18',
    'layers': 'M12 3 2 8l10 5 10-5-10-5Z M2 16l10 5 10-5 M2 12l10 5 10-5',
    'shield': 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z M9 12l2 2 4-4',
    'dashboard': 'M4 4h6v7H4z M14 4h6v4h-6z M14 12h6v8h-6z M4 15h6v5H4z',
    'play': 'M3 4h18v12H3z M8 20h8 M12 16v4 M10 7.5v5l4.5-2.5z',
    'book': 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z M4 17a3 3 0 0 1 3-3h11',
    'ext': 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
    'check': 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
}


def icon(name, size=20):
    paths = ''.join(f'<path d="{("M" + p) if i else p}"/>' for i, p in enumerate(ICONS[name].split(' M')))
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>'


def shot_exists(sid):
    return bool(sid) and os.path.exists(os.path.join(B['dir'], 'shots', f'{sid}.jpg'))


def head(title, desc):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{e(title)}</title>
{ROUTE % B['slug']}
<meta name="description" content="{e(desc)}" />
<link rel="icon" href="{e(B['favicon'])}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="{B['up']}guide.css" />
{f'<style>{B["css"]}</style>' if B['css'] else ''}
</head>
<body>
'''


def topbar(active):
    tabs = [('index', 'Overview', 'book')] + ([('brd', 'BRD coverage', 'check')] if BRD else []) + [(p['slug'], p['name'], p['icon']) for p in PAGES]
    links = ''.join(
        f'<a href="./{s}.html" class="{"on" if s == active else ""}"{" aria-current=page" if s == active else ""}>{icon(i, 15)}<span>{e(n)}</span></a>'
        for s, n, i in tabs
    )
    back = f'<a class="g-back" href="{e(SITE["launcher_href"])}">← {e(SITE.get("launcher_label", "Launcher"))}</a>' if SITE.get('launcher_href') else ''
    return f'''<header class="g-top">
  <div class="g-top-in">
    <a class="g-brand" href="./index.html"><img src="{e(B['logo'])}" alt="{e(B['name'])}" /><span><b>Feature guide</b><em>{e(SITE['subtitle'])}</em></span></a>
    {back}
  </div>
  <nav class="g-tabs" aria-label="Personas"><div class="g-tabs-in">{links}</div></nav>
</header>
'''


FOOT_T = '''<div class="g-lb" id="lb" hidden>
  <button type="button" class="g-lb-x" aria-label="Close">✕</button>
  <button type="button" class="g-lb-p" aria-label="Previous screenshot">‹</button>
  <figure><img alt="" /><figcaption></figcaption></figure>
  <button type="button" class="g-lb-n" aria-label="Next screenshot">›</button>
</div>
<script src="{UP}guide.js"></script>
</body>
</html>
'''


def persona_page(p, idx):
    total_steps = sum(len(f['steps']) for f in p['flows'])
    toc = ''.join(
        f'<li><a href="#{e(f["id"])}"><span class="n">{i + 1:02d}</span><span class="t">{e(f["title"])}</span><span class="c">{len(f["steps"])}</span></a></li>'
        for i, f in enumerate(p['flows'])
    )
    before = ''.join(f'<li>{e(b)}</li>' for b in p['before'])
    flows = []
    for i, f in enumerate(p['flows']):
        steps = []
        for k, (title, text, sid, see) in enumerate(f['steps']):
            img = (
                f'<button type="button" class="g-shot" data-src="./shots/{sid}.jpg" data-cap="{e(p["name"])} · {e(f["title"])} · step {k + 1}: {e(title)}">'
                f'<img loading="lazy" src="./shots/{sid}.jpg" alt="Screenshot: {e(title)}" width="1440" height="900" /><span class="zoom">Click to enlarge</span></button>'
                if shot_exists(sid) else ''
            )
            steps.append(f'''<li class="g-step{' noshot' if not img else ''}" id="{e(f['id'])}-{k + 1}">
  <div class="g-step-txt">
    <p class="g-step-h"><span class="num">{k + 1}</span>{e(title)}</p>
    <p class="g-step-b">{e(text)}</p>
    {f'<p class="g-see"><b>You should see</b>{e(see)}</p>' if see else ''}
  </div>
  {img}
</li>''')
        open_btn = f'<a class="g-open" href="{e(f["open"])}" target="_blank" rel="noopener">{icon("ext", 14)} Open it</a>' if f.get('open') else ''
        flows.append(f'''<section class="g-flow" id="{e(f['id'])}">
  <div class="g-flow-h">
    <span class="g-flow-no">{i + 1:02d}</span>
    <div class="g-flow-t">
      <h2>{e(f['title'])}</h2>
      <p class="g-meta"><span>{e(f['time'])}</span><span>Sample · {e(f['sample'])}</span><span>{len(f['steps'])} step{'s' if len(f['steps']) != 1 else ''}</span></p>
    </div>
    {open_btn}
  </div>
  <p class="g-why">{e(f['why'])}</p>
  <ol class="g-steps">{''.join(steps)}</ol>
</section>''')
    prev_p = PAGES[idx - 1] if idx > 0 else None
    next_p = PAGES[idx + 1] if idx + 1 < len(PAGES) else None
    pager = '<nav class="g-pager">' + (
        f'<a href="./{prev_p["slug"]}.html"><em>Previous</em>{e(prev_p["name"])}</a>' if prev_p else '<a href="./index.html"><em>Back to</em>Overview</a>'
    ) + (f'<a class="nx" href="./{next_p["slug"]}.html"><em>Next</em>{e(next_p["name"])}</a>' if next_p else '<a class="nx" href="./index.html"><em>Back to</em>Overview</a>') + '</nav>'

    body = f'''{topbar(p['slug'])}
<main class="g-wrap">
  <section class="g-hero">
    <span class="g-hero-ic">{icon(p['icon'], 26)}</span>
    <div class="g-hero-t">
      <p class="g-eyebrow">Persona guide · {len(p['flows'])} flows · {total_steps} steps</p>
      <h1>{e(p['name'])}</h1>
      <p class="g-who">{e(p['who'])} · {e(p['app'])}</p>
      <p class="g-intro">{e(p['intro'])}</p>
    </div>
    <a class="g-open lg" href="{e(p['url'])}" target="_blank" rel="noopener">{icon('ext', 15)} Open {e(p['app'].split(' · ')[0])}</a>
  </section>
  <section class="g-before"><p class="h">Before you start</p><ul>{before}</ul></section>
  <div class="g-grid">
    <aside class="g-toc"><p class="h">Flows on this page</p><ol>{toc}</ol><button type="button" class="g-print" onclick="window.print()">Print or save as PDF</button></aside>
    <div class="g-main">{''.join(flows)}{pager}</div>
  </div>
</main>
'''
    return head(f'{p["name"]} guide — {SITE["short"]}', p['intro']) + body + FOOT_T.replace('{UP}', B['up'])


def brd_counts(rows):
    out = {k: 0 for k in STATUS}
    for r in rows:
        out[r[2]] += 1
    return out


def brd_tiles(href):
    """The section tiles: on the overview they open brd.html, on the BRD page they jump in place."""
    return ''.join(
        f'<a class="g-bsec" href="{href}#{e(sec["id"])}"><span class="r">{e(sec["ref"])}</span><b>{e(sec["title"])}</b>'
        + '<span class="bar">' + ''.join(f'<i class="{k}" style="flex:{v}" title="{v} {e(STATUS[k][0].lower())}"></i>' for k, v in brd_counts(sec['rows']).items() if v) + '</span>'
        + f'<span class="c">{len(sec["rows"])}</span></a>'
        for sec in BRD
    )


def index_page():
    cards = ''.join(f'''<a class="g-card" href="./{p['slug']}.html">
  <span class="g-card-ic">{icon(p['icon'], 22)}</span>
  <span class="g-card-t"><b>{e(p['name'])}</b><em>{e(p['app'])}</em>
  <span class="d">{e(p['intro'])}</span>
  <span class="s">{len(p['flows'])} flows · {sum(len(f['steps']) for f in p['flows'])} steps with screenshots</span></span>
</a>''' for p in PAGES)
    parts = []
    # How to use: items are trusted HTML written by us (links allowed).
    parts.append(f'''<section class="g-before">
    <p class="h">How to use this guide</p>
    <ul>{''.join(f'<li>{li}</li>' for li in SITE['how_to_use_html'])}</ul>
  </section>''')
    if BRD:
        brd_summary = brd_tiles('./brd.html')
        n = sum(len(x['rows']) for x in BRD)
        parts.append(f'''<h2 class="g-sec">Everything in the BRD</h2>
  <p class="g-lead">{e(SITE.get('brd_lead') or f'{n} items across {len(BRD)} sections of the {SITE["brd_name"]}, each with its status in the POC.')}</p>
  <p class="g-bkey">{''.join(f'<i class="{k}"></i>{e(v[0])} ' for k, v in STATUS.items())}</p>
  <div class="g-bsum">{brd_summary}</div>
  <a class="g-open lg" href="./brd.html">{icon('check', 15)} Open the full BRD coverage</a>''')
    if PAINS:
        def pain_links(links):
            return ' · '.join('<a href="./%s">%s</a>' % (e(u), e(t)) for t, u in links)
        pains = ''.join(
            f'<div class="g-pain"><p class="q"><span class="num">{i + 1}</span>“{e(q)}”</p><p class="a">{e(a)}</p><p class="l">{pain_links(links)}</p></div>'
            for i, (q, a, links) in enumerate(PAINS)
        )
        parts.append(f'''<h2 class="g-sec">What the customer told us</h2>
  <p class="g-lead">{e(SITE.get('pains_lead', 'Raised in conversation on top of the BRD, and where the POC solves each one.'))}</p>
  <div class="g-pains">{pains}</div>''')
    parts.append(f'<h2 class="g-sec">Pick a persona</h2>\n  <div class="g-cards">{cards}</div>')
    if JOURNEY:
        journey = ''.join(
            f'<tr><td class="num">{n}</td><td><b>{e(stage)}</b></td><td>{e(who)}</td><td><a href="./{slug}.html#{fid}">Guide →</a></td></tr>'
            for n, stage, who, slug, fid in JOURNEY
        )
        parts.append(f'''<h2 class="g-sec" id="journey">{e(SITE.get('journey_title', 'The case, stage by stage'))}</h2>
  <p class="g-lead">{e(SITE.get('journey_lead', ''))}</p>
  <div class="g-table"><table><thead><tr><th>#</th><th>Stage</th><th>Who acts</th><th></th></tr></thead><tbody>{journey}</tbody></table></div>''')
    if FEATURES:
        feats = ''.join(
            f'<tr><td><b>{e(name)}</b><span class="sub">{e(desc)}</span></td><td>{e(who)}</td><td><a href="./{slug}.html#{fid}">Steps →</a></td></tr>'
            for name, who, slug, fid, desc in FEATURES
        )
        parts.append(f'<h2 class="g-sec">Every feature</h2>\n  <div class="g-table"><table><thead><tr><th>Feature</th><th>Used by</th><th></th></tr></thead><tbody>{feats}</tbody></table></div>')
    if SAMPLES:
        samples = ''.join(
            f'<tr><td class="num">{e(r)}</td><td>{e(n)}</td><td>{e(st)}</td><td>{e(use)}</td></tr>' for r, n, st, use in SAMPLES
        )
        c1, c2, c3 = SITE.get('samples_cols', ('Applicant', 'Stage', 'Use it for'))
        parts.append(f'''<h2 class="g-sec">{e(SITE.get('samples_title', 'Sample cases'))}</h2>
  <div class="g-table"><table><thead><tr><th>Reference</th><th>{e(c1)}</th><th>{e(c2)}</th><th>{e(c3)}</th></tr></thead><tbody>{samples}</tbody></table></div>''')
    parts.append(f'<p class="g-fine">{e(SITE["fine_print"])} Regenerate this guide with <code>{e(SITE["rebuild_cmd"])}</code>.</p>')

    total_flows = sum(len(p['flows']) for p in PAGES)
    total_steps = sum(len(f['steps']) for p in PAGES for f in p['flows'])
    body = f'''{topbar('index')}
<main class="g-wrap">
  <section class="g-hero index">
    <div class="g-hero-t">
      <p class="g-eyebrow">{len(PAGES)} personas · {total_flows} flows · {total_steps} steps</p>
      <h1>{e(SITE.get('hero_title', 'Every feature, step by step'))}</h1>
      <p class="g-intro">{e(SITE['hero_intro'])}</p>
    </div>
  </section>

  {chr(10).join('  ' + x for x in parts)}
</main>
'''
    return head(f'Feature guide — {SITE["short"]}', SITE['description']) + body + FOOT_T.replace('{UP}', B['up'])


def brd_page():
    all_rows = [r for sec in BRD for r in sec['rows']]
    tot = brd_counts(all_rows)
    strip = ''.join(f'<button type="button" class="g-bstat {k}" data-f="{k}"><b class="num">{tot[k]}</b><span>{e(STATUS[k][0])}</span></button>' for k in STATUS)
    toc = ''.join(
        f'<li><a href="#{e(sec["id"])}"><span class="n">{e(sec["ref"])}</span><span class="t">{e(sec["title"])}</span><span class="c">{len(sec["rows"])}</span></a></li>'
        for sec in BRD
    )
    secs = []
    for sec in BRD:
        c = brd_counts(sec['rows'])
        mini = ' · '.join(f'{c[k]} {STATUS[k][0].lower()}' for k in STATUS if c[k])
        rows = ''.join(
            f'<tr data-s="{st}"><td class="num">{e(rid)}</td><td><b>{e(text)}</b></td><td><span class="g-st {st}">{e(STATUS[st][0])}</span></td>'
            f'<td>{e(how)}</td><td class="lk">{"<br>".join(f"<a href=\"./{e(u)}\">{e(t)} →</a>" for t, u in links)}</td></tr>'
            for rid, text, st, how, links in sec['rows']
        )
        secs.append(f'''<section class="g-flow g-brd" id="{e(sec['id'])}">
  <div class="g-flow-h"><span class="g-flow-no">{e(sec['ref'])}</span><div class="g-flow-t"><h2>{e(sec['title'])}</h2><p class="g-meta"><span>{len(sec['rows'])} items</span><span>{e(mini)}</span></p></div><a class="g-up" href="#sections">↑ All sections</a></div>
  {f'<p class="g-why">{e(sec["lead"])}</p>' if sec.get('lead') else ''}
  <div class="g-table"><table><thead><tr><th>Ref</th><th>What the BRD asks for</th><th>POC</th><th>How the POC answers it</th><th>See it</th></tr></thead><tbody>{rows}</tbody></table></div>
</section>''')
    legend = ''.join(f'<li><span class="g-st {k}">{e(v[0])}</span>{e(v[1])}</li>' for k, v in STATUS.items())
    body = f'''{topbar('brd')}
<main class="g-wrap">
  <section class="g-hero">
    <span class="g-hero-ic">{icon('check', 26)}</span>
    <div class="g-hero-t">
      <p class="g-eyebrow">{e(SITE['brd_name'])} · {len(all_rows)} items across {len(BRD)} sections</p>
      <h1>BRD coverage</h1>
      <p class="g-intro">{e(SITE.get('brd_intro', f'Every problem, requirement, rule, use case, integration, control, dashboard metric and acceptance criterion in the {SITE["brd_name"]} — with an honest status and where to see it in the POC.'))}</p>
    </div>
  </section>
  <div class="g-bstats" role="group" aria-label="Filter by status"><button type="button" class="g-bstat all on" data-f="all"><b class="num">{len(all_rows)}</b><span>Everything</span></button>{strip}</div>
  <section class="g-before"><p class="h">What the statuses mean</p><ul class="g-legend">{legend}</ul></section>
  <h2 class="g-sec" id="sections">Every section</h2>
  <div class="g-bsum">{brd_tiles('')}</div>
  <div class="g-grid">
    <aside class="g-toc"><p class="h">BRD sections</p><ol>{toc}</ol><button type="button" class="g-print" onclick="window.print()">Print or save as PDF</button></aside>
    <div class="g-main">{''.join(secs)}</div>
  </div>
</main>
<script>
document.querySelectorAll('.g-bstat').forEach((b) => b.addEventListener('click', () => {{
  const f = b.dataset.f;
  document.querySelectorAll('.g-bstat').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.g-brd tr[data-s]').forEach((tr) => {{ tr.hidden = f !== 'all' && tr.dataset.s !== f; }});
  document.querySelectorAll('.g-brd').forEach((sec) => {{ sec.hidden = ![...sec.querySelectorAll('tr[data-s]')].some((tr) => !tr.hidden); }});
}}));
</script>
'''
    return head(f'BRD coverage — {SITE["short"]}', f'Every item in the {SITE["brd_name"]} and where the POC answers it.') + body + FOOT_T.replace('{UP}', B['up'])


def check():
    """Catch the mistakes that otherwise only show up as broken links."""
    problems = []
    slugs = {p['slug'] for p in PAGES}
    anchors = {f'{p["slug"]}.html#{f["id"]}' for p in PAGES for f in p['flows']} | {f'{s}.html' for s in slugs} | {'index.html#journey', '#journey', 'brd.html'}
    for p in PAGES:
        ids = [f['id'] for f in p['flows']]
        if len(ids) != len(set(ids)):
            problems.append(f'{p["slug"]}: duplicate flow id')
        for f in p['flows']:
            for st in f['steps']:
                if len(st) != 4:
                    problems.append(f'{p["slug"]}#{f["id"]}: step must be (title, text, shot_id, you_should_see) — got {len(st)} fields')
    for row in JOURNEY + [(None, None, None, s, f) for (_, _, s, f, _) in FEATURES]:
        if f'{row[3]}.html#{row[4]}' not in anchors:
            problems.append(f'link to missing flow {row[3]}.html#{row[4]}')
    for _, _, links in PAINS:
        problems += [f'pain link to missing flow {u}' for _, u in links if u not in anchors]
    for sec in BRD:
        for r in sec['rows']:
            if r[2] not in STATUS:
                problems.append(f'BRD {r[0]}: unknown status {r[2]!r}')
            problems += [f'BRD {r[0]}: link to missing flow {u}' for _, u in r[4] if u not in anchors and u.split('#')[0] not in {'index.html'}]
    return problems


def write(name, text):
    with open(os.path.join(B['dir'], name), 'w') as f:
        f.write(text.replace('{BANK}', B['name']).replace('{ROOT}', B['root']))


def main():
    global B
    for B in BANKS:
        os.makedirs(os.path.join(B['dir'], 'shots'), exist_ok=True)
        if BRD:
            write('brd.html', brd_page())
        write('index.html', index_page())
        for i, p in enumerate(PAGES):
            write(f'{p["slug"]}.html', persona_page(p, i))
        missing = [s for p in PAGES for fl in p['flows'] for (_, _, s, _) in fl['steps'] if s and not shot_exists(s)]
        steps = sum(len(f['steps']) for p in PAGES for f in p['flows'])
        print(f'{B["name"]}: built index{" + BRD" if BRD else ""} + {len(PAGES)} persona pages ({steps} steps).'
              + (f' Missing shots ({len(missing)}): {missing}' if missing else ' All screenshots present.'))
    for pr in check():
        print('  check:', pr)


if __name__ == '__main__':
    main()
