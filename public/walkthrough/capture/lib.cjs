// Capture helpers: every call records one frame of the walkthrough.
//
// A frame is a screenshot taken just before the action, the box of the element
// the action targets (in 1440 x 900 page pixels), the action itself and a caption.
// The player animates a cursor to the box and plays the action over the image.
const fs = require('fs');
const path = require('path');

// A run writes to a staging folder (run.cjs sets these) and replaces the live walkthrough only when it succeeds.
const C = require('./config.cjs');
const OUT = process.env.WT_FRAMES || path.join(C.out, 'frames');
const JSON_OUT = process.env.WT_JSON || path.join(C.out, 'walkthrough.json');
const W = 1440;
const H = 900;

// Hide the demo chrome that is not part of the product screen.
const HIDE = `${C.hide ? `${C.hide} { display: none !important; }` : ''}
* { caret-color: transparent !important; }`;

function samplePdf(title) {
  const text = `Sample document: ${title}`.replace(/[()\\]/g, '');
  const stream = `BT /F1 14 Tf 60 760 Td (${text}) Tj ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  // Padded past the portal's 2 KB "this file looks empty" check.
  let out = '%PDF-1.4\n' + ('%' + ' sample document '.repeat(4) + '\n').repeat(40); const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out);
}

function makeRecorder(page, frames, ov) {
  let scene = null;

  let keepToasts = false;
  const settle = async (ms = 700) => {
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
    try {
      await page.waitForFunction((src) => !new RegExp(src).test(document.body.innerText), C.loadingText.source, { timeout: 40000 });
    } catch {}
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    await page.waitForTimeout(ms);
    // Portal notices pop up as the customer's cases change: closed unless a step shows them.
    if (!keepToasts && C.toastClose) for (const x of await page.locator(C.toastClose).all()) await x.click().catch(() => {});
  };

  const loc = (t) => (typeof t === 'string' ? page.getByText(t, { exact: false }) : t).first();

  // Scroll so the item is on screen *with the heading of its section*: the outermost section
  // heading that keeps the item in the top half of the screen goes just under the app's
  // sticky top bar.
  const contextScroll = (l) => l.evaluate((el) => {
    const bar = Math.max(0, ...[...document.querySelectorAll('body *')].filter((e) => {
      const cs = getComputedStyle(e);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') return false;
      const r = e.getBoundingClientRect();
      return r.top <= 2 && r.width > 300 && r.height < 200;
    }).map((e) => e.getBoundingClientRect().bottom));
    const isHead = (e) => {
      if (/^H[1-4]$/.test(e.tagName)) return true;
      if (e.children.length || !e.textContent) return false;
      const t = e.textContent.trim();
      if (t.length < 3 || t.length > 90 || e.closest('button, a, label, td, th')) return false;
      const cs = getComputedStyle(e);
      // Small-caps section labels, or short bold titles.
      return (t.length < 50 && cs.textTransform === 'uppercase') || (Number(cs.fontWeight) >= 600 && parseFloat(cs.fontSize) >= 14);
    };
    const before = (h) => !!(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) || h.contains(el) || h === el;
    const er = el.getBoundingClientRect();
    // Buttons and fields may sit anywhere on screen, so their whole section (heading included) shows.
    const control = !!el.closest('button, a, input, select, textarea, label, [role=button]');
    let best = null;
    for (let a = el.parentElement, i = 0; a && a !== document.body && i < 10; a = a.parentElement, i++) {
      const h = [...a.querySelectorAll('*')].find((x) => isHead(x) && before(x) && x.getBoundingClientRect().height > 0);
      if (!h) continue;
      const shift = h.getBoundingClientRect().top - (bar + 14);
      // Further-out headings push the item lower: stop once it would leave the top half.
      if (er.bottom - shift > innerHeight - 30 || (!control && er.top - shift > bar + (innerHeight - bar) * 0.5)) break;
      best = h;
    }
    // A heading-like item (short text, not a control) goes to the top itself.
    const own = (el.textContent || '').trim();
    if (!best && own.length > 0 && own.length < 60 && !el.closest('button, a, input, select, textarea, label, [role=button]')) best = el;
    if (!best) {
      // The item's own section is too tall to show with its heading: use the closest headings
      // above it on the page instead (the furthest one that still keeps it in the top half).
      const above = [...document.querySelectorAll('body *')].filter((x) => isHead(x) && x.getBoundingClientRect().height > 0 && x.getBoundingClientRect().top < er.top && before(x) && !x.contains(el));
      for (const h of above.reverse()) {
        const shift = h.getBoundingClientRect().top - (bar + 14);
        if (er.bottom - shift > innerHeight - 30 || (!control && er.top - shift > bar + (innerHeight - bar) * 0.5)) break;
        best = h;
      }
    }
    const target = best || el;
    const offset = bar + (best ? 14 : 24);
    target.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -offset);
    // Inner scrolling panels: make sure the item itself is in view too.
    const r = el.getBoundingClientRect();
    if (r.top < bar || r.bottom > innerHeight) el.scrollIntoView({ block: 'center' });
    // A sticky side panel taller than the screen only shows its bottom once the page is
    // scrolled further down: keep scrolling until the item is really in view.
    for (let i = 0; i < 40; i++) {
      const q = el.getBoundingClientRect();
      if (q.bottom <= innerHeight - 12 && q.top >= bar) break;
      const y = window.scrollY;
      window.scrollBy(0, q.bottom > innerHeight - 12 ? Math.min(240, q.bottom - innerHeight + 40) : -Math.min(240, bar - q.top + 40));
      if (window.scrollY === y) break;
    }
  });

  // Views and scrolls always frame their item with its heading; a click or a typed field
  // only moves the page when the item is not already fully on screen.
  const onScreen = (l) => l.evaluate((el) => {
    const bar = Math.max(0, ...[...document.querySelectorAll('body *')].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.position === 'sticky' || cs.position === 'fixed') && e.getBoundingClientRect().top <= 2 && e.getBoundingClientRect().width > 300 && e.getBoundingClientRect().height < 200;
    }).map((e) => e.getBoundingClientRect().bottom));
    const r = el.getBoundingClientRect();
    if (r.top < bar + 4 || r.bottom > innerHeight - 2) return false;
    // Not hidden behind a sticky bar at the bottom either.
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (el.contains(hit) || hit.contains(el));
  });
  const boxOf = async (l, frameIt = false) => {
    await l.waitFor({ state: 'visible', timeout: 20000 });
    if (frameIt || !(await onScreen(l))) await contextScroll(l);
    await page.waitForTimeout(350);
    const b = await l.boundingBox();
    return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };

  // Face checks (portal submit, e-signing, seller deed): complete any that opens, through the
  // app's own no-camera path. The headless browser has no camera, so the app offers a demo capture.
  const passFace = async () => {
    if (!C.face.consent) return; // this project has no in-page face check
    for (let i = 0; i < 6; i++) {
      const consent = page.locator(C.face.consent).first();
      if (!(await consent.isVisible().catch(() => false))) return;
      await consent.check().catch(() => {});
      await page.getByRole('button', { name: C.face.start }).first().click().catch(() => {});
      const demo = page.getByRole('button', { name: C.face.fallback }).first();
      await demo.waitFor({ state: 'visible', timeout: 8000 }).then(() => demo.click()).catch(() => {});
      const next = page.locator(C.face.modal).getByRole('button', { name: C.face.done }).first();
      await next.waitFor({ state: 'visible', timeout: 25000 }).then(() => next.click()).catch(() => {});
      await page.waitForTimeout(800);
    }
  };
  /** A face check on screen: consent, the live check, the result (opened by the previous click). */
  const showFace = async (who, captions = {}) => {
    const consent = page.locator(C.face.consent).first();
    await consent.waitFor({ state: 'visible', timeout: 15000 });
    const modal = page.locator(C.face.modal).first();
    const mb = async () => { const b = await modal.boundingBox(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    await frame({ action: 'view', caption: captions.intro ?? `A quick live face check for ${who}, compared with the photo on their ID and their NIN/BVN record. Only the result is kept, never the image.`, box: await mb(), opts: captions.opts });
    const cb = await consent.boundingBox();
    await frame({ action: 'click', caption: captions.consent ?? 'They agree to the check…', box: cb && { x: Math.round(cb.x), y: Math.round(cb.y), w: Math.round(cb.width), h: Math.round(cb.height) }, opts: { minor: true } });
    await consent.check();
    const start = page.getByRole('button', { name: C.face.start }).first();
    const sb = await start.boundingBox();
    await frame({ action: 'click', caption: '…and start it.', box: sb && { x: Math.round(sb.x), y: Math.round(sb.y), w: Math.round(sb.width), h: Math.round(sb.height) }, opts: { minor: true } });
    await start.click();
    // The live check: wait for a prompt such as "Turn your head a little to the left".
    await page.getByText(C.face.live).first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    await frame({ action: 'view', caption: captions.live ?? 'The camera checks it is a live person — blink, turn a little left, then right — so a photo or a video cannot pass.', box: await mb(), opts: captions.liveOpts });
    const demo = page.getByRole('button', { name: C.face.fallback }).first();
    if (await demo.isVisible().catch(() => false)) await demo.click();
    const next = page.locator(C.face.modal).getByRole('button', { name: C.face.done }).first();
    await next.waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(500);
    await frame({ action: 'view', caption: captions.result ?? `Verified: a live person, and the face matches ${who}'s NIN/BVN record. Liveness and match scores are kept as evidence.`, box: await mb(), opts: captions.resultOpts });
    await next.click();
    await settle(900);
  };

  /** Verify every applicant's face on a page that asks for it (no frames). */
  const verifyFaces = async () => {
    // The face-check card loads its results after the page: give it time to appear.
    await page.getByRole('button', { name: C.face.open }).first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
    for (let i = 0; i < 4; i++) {
      const b = page.getByRole('button', { name: C.face.open }).first();
      if (!(await b.isVisible().catch(() => false))) return;
      await b.click(); await page.waitForTimeout(500);
      await passFace();
      await settle(800);
    }
  };

  const frame = async (f) => {
    if (!scene) throw new Error('frame before scene()');
    // A control flush with the bottom/right edge can measure a pixel past it: clamp.
    if (f.box) { f.box.h = Math.min(f.box.h, H - f.box.y); f.box.w = Math.min(f.box.w, W - f.box.x); }
    const n = frames.length + 1;
    const img = `f${String(n).padStart(3, '0')}.jpg`;
    // Links in message text use the product's address, as the address bar does.
    await page.evaluate((host) => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) if (host && /https?:\/\/localhost:\d+\//.test(t.nodeValue)) t.nodeValue = t.nodeValue.replace(/https?:\/\/localhost:\d+\//g, `https://${host}/`);
    }, C.displayHost).catch(() => {});
    await page.screenshot({ path: path.join(OUT, img), type: 'jpeg', quality: 74 });
    const url = page.url().replace(/[?&]g=[^&#]*/, '').replace(/\?phone=0&?/, '?').replace(/\?(#|$)/, '$1');
    // minor: routine detail the short version skips; short: the caption the short version shows.
    const { opts = {}, ...rest } = f;
    frames.push({ n, img, scene: scene.id, url, ...rest, ...(opts.minor ? { minor: true } : {}), ...(opts.short ? { short: opts.short } : {}) });
    return n;
  };

  return {
    settle,
    page,
    verifyFaces,
    passFace,
    showFace,
    /** Leave portal notices on screen (to show one), or close them again. */
    keepToasts(on) { keepToasts = on; },
    /** Start a scene: id, title, persona, act. */
    scene(s) { scene = s; frames.push({ kind: 'scene', ...s }); },
    async go(url, caption, opts = {}) {
      // The workspace remembers its role per browser: set the one this scene's persona uses.
      if (opts.role) {
        const origin = new URL(url).origin;
        if (!page.url().startsWith(origin)) { await page.goto(origin + '/'); await page.waitForTimeout(1500); }
        if (C.roleStorageKey) await page.evaluate(([k, r]) => localStorage.setItem(k, r), [C.roleStorageKey, opts.role]);
      }
      // A fresh query each time, so the app reloads and reads the latest data.
      const [base, hash] = url.split('#');
      await page.goto(`${base}${base.includes('?') ? '&' : '?'}g=${Date.now().toString(36)}${hash !== undefined ? '#' + hash : ''}`);
      await settle(opts.wait ?? 900);
      if (caption) await frame({ action: 'view', caption, nav: true });
    },
    /** Show the screen, optionally pointing at something. */
    /** Scroll the page back to the top (no frame). */
    async top() { await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop && getComputedStyle(e).overflowY !== 'visible') e.scrollTop = 0; }); }); await page.waitForTimeout(300); },
    async view(caption, target, opts = {}) {
      const still = async (l) => { const b = await l.boundingBox(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const box = target ? (opts.stay ? await still(loc(target)) : await boxOf(loc(target), true)) : undefined;
      return frame({ action: 'view', caption, box, opts });
    },
    async click(target, caption, opts = {}) {
      const l = loc(target);
      // stay: never scroll (e.g. report tabs pinned inside their own scrolling panel).
      const box = opts.stay ? await l.boundingBox().then((b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }) : await boxOf(l);
      await frame({ action: 'click', caption, box, opts });
      await l.click(opts.force ? { force: true } : undefined);
      await page.waitForTimeout(400);
      if (!opts.keepFace) await passFace();
      await settle(opts.wait ?? 700);
    },
    async type(target, text, caption, opts = {}) {
      const l = loc(target);
      const box = await boxOf(l);
      await l.fill('');
      // Hide the field's hint text for the screenshot: the player types over this image.
      // (The element itself, since the locator may find it by that very hint.)
      const el = await l.elementHandle();
      const hint = await el.evaluate((e) => { const p = e.getAttribute('placeholder'); e.setAttribute('placeholder', ''); return p; });
      await page.waitForTimeout(150);
      await frame({ action: 'type', caption, box, text, opts });
      await el.evaluate((e, p) => { if (p !== null) e.setAttribute('placeholder', p); }, hint);
      await el.fill(text);
      await page.keyboard.press('Tab').catch(() => {});
      await page.waitForTimeout(300);
    },
    /** Click an upload card and attach a file to its input: a small sample PDF, or opts.path. */
    async upload(card, name, caption, opts = {}) {
      card = card.first();
      const box = await boxOf(card);
      await frame({ action: 'click', caption, box, file: name, opts });
      // opts.path: a real file (e.g. a scanned form the app reads); otherwise a small sample PDF.
      const file = opts.path ? opts.path : { name, mimeType: 'application/pdf', buffer: samplePdf(name) };
      if (await card.locator('input[type=file]').count()) await card.locator('input[type=file]').setInputFiles(file);
      else {
        // A button that opens the system file chooser.
        const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), card.click()]);
        await chooser.setFiles(file);
      }
      await settle(opts.wait ?? 1200);
    },
    ov,
    /** A frame from a still image (e.g. a recording), not the browser: `file` is copied in
     *  as the frame, `label` shows in the address bar. */
    async still(file, label, caption, opts = {}) {
      if (!scene) throw new Error('frame before scene()');
      const n = frames.length + 1;
      const img = `f${String(n).padStart(3, '0')}.jpg`;
      fs.copyFileSync(file, path.join(OUT, img));
      frames.push({ n, img, scene: scene.id, url: label, action: 'view', caption, ...(opts.box ? { box: opts.box } : {}), ...(opts.minor ? { minor: true } : {}), ...(opts.short ? { short: opts.short } : {}) });
      return n;
    },
    /** A frame that plays a recorded clip: `poster` (a still of its first frame) is copied in
     *  as the frame image; `video` is the clip's path relative to the walkthrough folder. */
    async video(video, poster, label, caption, opts = {}) {
      if (!scene) throw new Error('frame before scene()');
      const n = frames.length + 1;
      const img = `f${String(n).padStart(3, '0')}.jpg`;
      fs.copyFileSync(poster, path.join(OUT, img));
      frames.push({ n, img, video, scene: scene.id, url: label, action: 'view', caption, ...(opts.short ? { short: opts.short } : {}) });
      return n;
    },
    /** Set a field without a frame (details the audience does not need to watch). */
    async fill(target, value) { await loc(target).fill(value); },
    /** Run automated case steps (no frame): fn(engine, ...args) evaluated in the workspace. */
    async engine(fn, ...args) {
      if (!C.engine?.global) throw new Error('config.cjs engine is not set: R.engine() needs a dev hook in the app (see reference/app-hook).');
      if (!page.url().startsWith(new URL(C.engine.url).origin)) await page.goto(C.engine.url);
      await page.waitForFunction((g) => !!window[g], C.engine.global, { timeout: 60000 });
      const out = await page.evaluate(([src, a, g]) => (0, eval)(`(${src})`)(window[g], ...a), [fn.toString(), args, C.engine.global]);
      await page.waitForTimeout(400);
      return out;
    },
    /** Click something that opens a PDF in a new tab, and show the PDF as its own frame. */
    async pdf(target, label, caption, captionPdf) {
      const l = loc(target);
      const box = await boxOf(l);
      await frame({ action: 'click', caption, box });
      const [tab] = await Promise.all([page.context().waitForEvent('page', { timeout: 20000 }), l.click()]);
      await tab.setViewportSize({ width: W, height: H });
      await tab.waitForTimeout(2500);
      const n = frames.length + 1;
      const img = `f${String(n).padStart(3, '0')}.jpg`;
      await tab.screenshot({ path: path.join(OUT, img), type: 'jpeg', quality: 74 });
      frames.push({ n, img, scene: scene.id, url: label, pdf: true, action: 'view', caption: captionPdf });
      await tab.close();
      await page.bringToFront();
    },
    async pick(target, value, caption, opts = {}) {
      const l = loc(target);
      const box = await boxOf(l);
      await frame({ action: 'click', caption, box, text: value, opts });
      await l.selectOption({ label: value }).catch(() => l.selectOption(value));
      await page.waitForTimeout(300);
    },
    async scrollTo(target, caption, opts = {}) {
      const l = loc(target);
      await l.waitFor({ state: 'visible', timeout: 20000 });
      await contextScroll(l);
      await page.waitForTimeout(450);
      if (caption) return frame({ action: 'view', caption, opts, box: await l.boundingBox().then((b) => b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }) });
    },
  };
}

/** Empty the app's browser storage (records, links, uploads), so a run starts clean.
 *  The overlay re-seeds the theme on the next load. */
async function reset(page) {
  await page.goto(C.apps.launcher);
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear();
    for (const d of (await indexedDB.databases?.()) ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
}

function save(frames) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ w: W, h: H, captured: new Date().toISOString(), frames }, null, 1));
}

module.exports = { makeRecorder, save, reset, OUT };
