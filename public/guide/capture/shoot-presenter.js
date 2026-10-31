async (page) => {
  // Screenshots for guide/presenter.html (stanbic) — generated from _prelude.js + _presenter.body.js by _assemble.sh.
  const BANK = 'stanbic', BANK_NAME = 'Stanbic IBTC';
  const OUT = '/Users/joshikumar/Documents/coded-demo/first app/Stanbic Banking App/public/guide/capture/png';
  const FIX = 'fixtures';
  const THEME = null;
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
  // Presenter and admin tools. Case management: never press "Run in Maestro" or "Approve {Stage}".
  await step('p-launcher', async () => { await go(APP, 3000); await snap('p-launcher'); });
  await step('p-launcher-tools', async () => { await toTop('Behind the scenes', 60); await snap('p-launcher-tools'); });
  await step('p-reset', async () => { await btn(/Reset demo data/); await toTop('Reset the pipeline', 300); await snap('p-reset'); await btn('Cancel'); });
  await step('p-cases', async () => { await go(APP + '#cases', 5000); await snap('p-cases'); });
  await step('p-cases-secondary', async () => { await toTop('Secondary', 80); await snap('p-cases-secondary'); });
  await step('p-cases-pick', async () => { await page.evaluate(() => window.scrollTo(0, 0)); const sel = page.locator('select').first(); const opt = await sel.locator('option').filter({ hasText: 'Amina Obi' }).first().getAttribute('value'); await sel.selectOption(opt); await page.waitForTimeout(2000); await snap('p-cases-pick'); });
  await step('p-kafka', async () => { await go(APP + '#kafka', 4000); await snap('p-kafka'); });
  await step('p-kafka-topic', async () => { await tap('account-created', { ms: 1500 }); await snap('p-kafka-topic'); });
  await step('p-finacle', async () => { await go(APP + '#finacle', 4000); await snap('p-finacle'); });
  await step('p-finacle-account', async () => { await page.getByText('Blessing Eze', { exact: true }).first().click(); await page.waitForTimeout(1500); await snap('p-finacle-account'); });
  await step('p-comms', async () => { await go(APP + '#comms', 4000); await snap('p-comms'); });
  await step('p-comms-thread', async () => { await page.getByText('Blessing Eze').first().click(); await page.waitForTimeout(1500); await snap('p-comms-thread'); });
  await step('p-faceid-login', async () => { await go(APP + '#faceid', 4000); await snap('p-faceid-login'); });
  await step('p-faceid', async () => { await page.frameLocator('iframe').first().getByText(/^Sign in with/).first().click(); await page.waitForTimeout(3000); await snap('p-faceid'); });
  await step('p-faceid-verifications', async () => { await page.evaluate((l) => [...document.querySelectorAll('button, a, [role=button], li, div')].filter((e) => e.children.length < 4 && e.textContent.trim().startsWith(l)).pop().click(), 'Verifications'); await page.waitForTimeout(2000); await snap('p-faceid-verifications'); });
  await step('p-faceid-identities', async () => { await page.evaluate((l) => [...document.querySelectorAll('button, a, [role=button], li, div')].filter((e) => e.children.length < 4 && e.textContent.trim().startsWith(l)).pop().click(), 'Identities'); await page.waitForTimeout(2000); await snap('p-faceid-identities'); });
  await step('p-faceid-settings', async () => { await page.getByText('Settings', { exact: true }).first().click({ force: true }); await page.waitForTimeout(2000); await snap('p-faceid-settings'); });
  await step('p-kiosk-success', async () => { await go(APP + '?demo=success#faceid-kiosk', 4000); await snap('p-kiosk-success'); });
  await step('p-kiosk-mismatch', async () => { await go(APP + '?demo=mismatch#faceid-kiosk', 4000); await snap('p-kiosk-mismatch'); });
  await step('p-kiosk-start', async () => { await go(APP + '#faceid-kiosk', 4000); await snap('p-kiosk-start'); });
  await step('p-admin-login', async () => { await page.evaluate(() => localStorage.removeItem('aura_admin_session')); await go(APP + '#admin', 3000); await snap('p-admin-login'); });
  await step('p-admin-picker', async () => { const i = page.locator('input:visible'); await i.nth(0).fill('admin'); await i.nth(1).fill('admin'); await btn('Continue', { ms: 2500 }); await snap('p-admin-picker'); });
  await step('p-admin-branding', async () => { await page.getByRole('button', { name: /Load & edit|Load preset/ }).first().click(); await page.waitForTimeout(2500); await snap('p-admin-branding'); });
  await step('p-admin-ops', async () => { await page.getByRole('button', { name: 'Operations', exact: true }).first().click(); await page.waitForTimeout(1500); await snap('p-admin-ops'); });
  await step('p-admin-features', async () => { await page.getByRole('button', { name: 'Features', exact: true }).first().click(); await page.waitForTimeout(1500); await snap('p-admin-features'); });
  return log.join('\n') + `\nwrites swallowed: ${(ctx._writes || []).length}`;
}
