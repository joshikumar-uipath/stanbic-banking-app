  // --- shared prelude (from shoot-template.js) -------------------------------------
  // BANK, BANK_NAME, OUT, FIX and THEME come from the per-bank header _assemble.sh writes above this line.
  const APP = 'http://localhost:5180/';
  const LOADING = /Loading…|Connecting to UiPath|Checking the live case…/;
  await page.setViewportSize({ width: 1440, height: 900 });
  // Put the bank's theme on before anything is shot — the same saved admin profile the apps (and the guide) read.
  // Stanbic is the built-in preset; any other bank is seeded from capture/<bank>-theme.json.
  if (!page.url().startsWith(APP)) await page.goto(APP);
  await page.evaluate(([theme, name]) => {
    const K = 'zara_local_profiles_v1';
    let s; try { s = JSON.parse(localStorage.getItem(K) || 'null'); } catch { s = null; }
    if (!s || !Array.isArray(s.profiles)) s = { activeId: null, profiles: [] };
    if (!theme) { s.activeId = '__preset_stanbic__'; }
    else {
      s.profiles = s.profiles.filter((p) => p.id !== 'guide-capture');
      s.profiles.push({ id: 'guide-capture', name, config: theme, updatedAt: new Date().toISOString() });
      s.activeId = 'guide-capture';
    }
    localStorage.setItem(K, JSON.stringify(s));
  }, [THEME, BANK_NAME]);
  const ctx = page.context();
  const log = [];
  let n = 0;
  const settle = async (ms = 900) => {
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
    try { await page.waitForFunction((re) => !new RegExp(re).test(document.body.innerText), LOADING.source, { timeout: 15000 }); } catch {}
    await page.waitForTimeout(ms);
  };
  const go = async (url, ms = 1500) => {
    n++;
    const [base, hash] = url.split('#');
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}g=${Date.now().toString(36)}${n}#${hash ?? ''}`);
    await settle(ms);
  };
  const toTop = async (text, offset = 90) => {
    const el = page.getByText(text, { exact: false }).first();
    await el.waitFor({ timeout: 15000 });
    await el.evaluate((e, off) => { e.scrollIntoView({ block: 'start' }); let p = e.parentElement; while (p) { if (p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) { p.scrollTop -= off; break; } p = p.parentElement; } }, offset);
    await page.waitForTimeout(400);
  };
  const tap = async (text, o = {}) => { await page.getByText(text, { exact: !!o.exact }).first().click({ timeout: 10000 }); await page.waitForTimeout(o.ms ?? 900); };
  const btn = async (name, o = {}) => { await page.getByRole(o.role || 'button', { name, exact: !!o.exact }).first().click({ timeout: 10000 }); await page.waitForTimeout(o.ms ?? 900); };
  const snap = async (id, opts = {}) => { await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: !!opts.full }); log.push(id); };
  const step = async (id, fn) => { try { await fn(); } catch (e) { log.push(`FAIL ${id}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); } };
  // --------------------------------------------------------------------------------
