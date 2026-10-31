async (page) => {
  // Template for one persona's screenshots. Copy to shoot-<persona>.js, set OUT and APP,
  // then add one step() per screenshot id used in content.py. Run with route.js installed.
  // Each step is isolated: a failure is logged as "FAIL <id>: …" and the rest carry on.
  const OUT = '/ABSOLUTE/PATH/TO/guide/capture/png';  // TODO: PNGs land here; convert with to-jpeg.sh
  const APP = 'http://localhost:TODO/';                // TODO
  // TODO: every text your apps show while loading, so shots never catch a spinner.
  const LOADING = /Loading|Connecting to UiPath|Preparing/;
  await page.setViewportSize({ width: 1440, height: 900 });
  const ctx = page.context();
  ctx._ov = ctx._ov || {};
  const log = [];
  let n = 0;
  const settle = async (ms = 900) => {
    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
    try { await page.waitForFunction((re) => !new RegExp(re).test(document.body.innerText), LOADING.source, { timeout: 40000 }); } catch {}
    await page.waitForTimeout(ms);
  };
  // Cache-busting query before the hash so every visit is a fresh load of the SPA route.
  const go = async (url, ms) => {
    n++;
    const [base, hash] = url.split('#');
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}g=${Date.now().toString(36)}${n}#${hash ?? '/'}`);
    await settle(ms);
  };
  // Scroll so a heading or element sits just under the app's sticky header.
  const toTop = async (text, offset = 90) => {
    const el = page.getByText(text, { exact: false }).first();
    await el.waitFor({ timeout: 20000 });
    await el.evaluate((e, off) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -off); }, offset);
    await page.waitForTimeout(400);
  };
  const toSel = async (sel, offset = 90) => {
    const el = page.locator(sel).first();
    await el.waitFor({ timeout: 20000 });
    await el.evaluate((e, off) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -off); }, offset);
    await page.waitForTimeout(400);
  };
  const snap = async (id, opts = {}) => { await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: !!opts.full }); log.push(id); };
  const step = async (id, fn) => { try { await fn(); } catch (e) { log.push(`FAIL ${id}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); } };

  // --- one line per screenshot id in content.py -------------------------------------
  await step('c-apply-start', async () => { await go(APP + '#/TODO', 1500); await snap('c-apply-start'); });
  // await step('c-apply-docs', async () => { await toTop('Your documents'); await snap('c-apply-docs'); });
  // Force a stage for one case without touching the tenant: ctx._ov['TODO-0004'] = { Stage: 'KYC review' };

  return log.join('\n') + `\nwrites swallowed: ${(ctx._writes || []).length}`;
}
