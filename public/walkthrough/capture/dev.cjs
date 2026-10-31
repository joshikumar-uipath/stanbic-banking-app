// Dev helpers for explore.cjs: list what is clickable, take a scratch screenshot, run scenes.
const DIR = __dirname + '/';
const SCRATCH = process.env.SCRATCH || '/tmp';

const dump = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const out = [];
  document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=tab], label').forEach((e) => {
    if (!vis(e)) return;
    const r = e.getBoundingClientRect();
    const t = (e.innerText || e.value || e.placeholder || e.getAttribute('aria-label') || e.name || '').replace(/\s+/g, ' ').trim().slice(0, 70);
    out.push(`${e.tagName.toLowerCase()}${e.type ? ':' + e.type : ''} [${Math.round(r.x)},${Math.round(r.y)}] ${t}${e.name ? ' name=' + e.name : ''}${e.disabled ? ' (disabled)' : ''}`);
  });
  return location.href + '\n' + out.join('\n');
});

const shot = (page, n) => page.screenshot({ path: `${SCRATCH}/x${n}.png` }).then(() => 'shot ' + n);

function fresh() {
  for (const k of Object.keys(require.cache)) if (k.startsWith(DIR) && !k.endsWith('dev.cjs')) delete require.cache[k];
  return { lib: require(DIR + 'lib.cjs'), scenes: require(DIR + 'scenes.cjs') };
}

/** Run scenes [from, to) (by id), appending to state.frames. from === first scene resets. */
async function run(page, state, fromId, toId) {
  const { lib, scenes } = fresh();
  const list = scenes.SCENES;
  const a = fromId ? list.findIndex((x) => x.id === fromId) : 0;
  const b = toId ? list.findIndex((x) => x.id === toId) : list.length;
  if (a === 0 || !state.frames) {
    state.frames = []; state.s = {};
    await lib.reset(page);
    // Warm-up: the workspace loads every application, so the overlay knows which to hide.
    const cfg = require(DIR + 'config.cjs');
    if (cfg.warmUpUrl) { await page.goto(cfg.warmUpUrl); await page.waitForTimeout(9000); }
  }
  else {
    // Re-running from a scene: drop its frames and everything after.
    const cut = state.frames.findIndex((f) => f.kind === 'scene' && f.id === list[a].id);
    if (cut >= 0) state.frames.splice(cut);
  }
  const R = lib.makeRecorder(page, state.frames, state.ov);
  for (const sc of list.slice(a, b)) {
    R.scene({ id: sc.id, act: sc.act, persona: sc.persona, title: sc.title });
    await sc.run(R, state.s);
    lib.save(state.frames);
  }
  return `${state.frames.filter((f) => !f.kind).length} frames · ref ${state.s.ref ?? '—'}`;
}

module.exports = { dump, shot, run };
