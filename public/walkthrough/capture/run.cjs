// Capture the whole walkthrough in one go (about 15 minutes): node run.cjs
//
// Needs every local app running and a browser profile signed in to staging (PROFILE).
// Every write is answered by overlay.cjs and kept in this browser: nothing reaches staging.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright-core');
const { install } = require('./overlay.cjs');
// A simulated camera (a drawn portrait) so face checks run as they would on a phone.
const CAMERA_FILE = require('path').join(__dirname, 'fake-camera.y4m'); // make-camera.py creates it
const CAMERA_ARGS = require('fs').existsSync(CAMERA_FILE) ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${CAMERA_FILE}`] : [];
// Stage the run; the live walkthrough is replaced only if every scene succeeds.
const BRAND_OUT = require('./config.cjs').out;   // per brand (BRAND=stanbic → ../stanbic)
const LIVE_FRAMES = path.join(BRAND_OUT, 'frames');
const LIVE_JSON = path.join(BRAND_OUT, 'walkthrough.json');
process.env.WT_FRAMES = path.join(BRAND_OUT, 'frames.next');
process.env.WT_JSON = path.join(BRAND_OUT, 'walkthrough.next.json');
const { makeRecorder, save, reset, OUT } = require('./lib.cjs');
const { SCENES } = require('./scenes.cjs');
const CONFIG = require('./config.cjs');
// KEEP=<scene>=<live scene>,…: take a scene's frames from the live capture instead of running
// it — e.g. KEEP=indf-maestro=ind-maestro when the capture profile is not signed in to staging.
const KEEP = Object.fromEntries((process.env.KEEP || '').split(',').filter(Boolean).map((p) => p.split('=')));
const LIVE = Object.keys(KEEP).length && fs.existsSync(LIVE_JSON) ? JSON.parse(fs.readFileSync(LIVE_JSON, 'utf8')).frames : [];
// ONLY_SCENES=<id>,…: run just these scenes (a trial into WT_FRAMES / WT_JSON; never swapped in).
const ONLY = (process.env.ONLY_SCENES || '').split(',').filter(Boolean);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.jpg')) fs.unlinkSync(path.join(OUT, f));
  const ctx = await chromium.launchPersistentContext(process.env.PROFILE || require('path').join(require('os').tmpdir(), 'wt-aof-profile'), { channel: 'chrome', headless: true, serviceWorkers: 'block', permissions: ['camera', 'microphone'], viewport: { width: 1440, height: 900 }, args: CAMERA_ARGS });
  const ov = await install(ctx);
  const page = ctx.pages()[0] || (await ctx.newPage());
  await reset(page);
  // Warm-up: a staff screen that lists every case, so the overlay knows which ones to hide.
  if (CONFIG.warmUpUrl) { await page.goto(CONFIG.warmUpUrl); await page.waitForTimeout(9000); }
  const frames = [];
  const R = makeRecorder(page, frames, ov);
  const s = {};
  for (const sc of ONLY.length ? SCENES.filter((x) => ONLY.includes(x.id)) : SCENES) {
    const t0 = Date.now();
    R.scene({ id: sc.id, act: sc.act, persona: sc.persona, title: sc.title, tag: sc.tag });
    // A scene that shows nothing of the application reuses another flow's frames.
    if (sc.same) frames.push(...frames.filter((f) => !f.kind && f.scene === sc.same).map((f) => ({ ...f, scene: sc.id })));
    else if (KEEP[sc.id]) {
      const kept = LIVE.filter((f) => !f.kind && f.scene === KEEP[sc.id]);
      if (!kept.length) throw new Error(`KEEP: no scene ${KEEP[sc.id]} in the live capture`);
      for (const f of kept) { fs.copyFileSync(path.join(LIVE_FRAMES, f.img), path.join(OUT, `kept-${f.img}`)); frames.push({ ...f, img: `kept-${f.img}`, scene: sc.id }); }
    } else await sc.run(R, s);
    save(frames);
    console.log(`${sc.id.padEnd(10)} ${String(frames.filter((f) => f.scene === sc.id).length).padStart(3)} frames  ${Math.round((Date.now() - t0) / 1000)}s  ${s.ref ?? ''}`);
  }
  // Every click and every typed field must be fully on screen in its frame.
  const off = frames.filter((f) => !f.kind && f.box && (f.action === 'click' || f.action === 'type') && (f.box.y < 0 || f.box.y + f.box.h > 900 || f.box.x < 0 || f.box.x + f.box.w > 1440));
  for (const f of off) console.log(`OFF SCREEN: frame ${f.n} (${f.scene}, ${f.action}) box y=${f.box.y} h=${f.box.h} — ${f.caption.slice(0, 60)}`);
  console.log(`Done: ${frames.filter((f) => !f.kind).length} frames · ${ov.writes.length} writes answered locally (none sent) · ${ov.cases.size} simulated cases`);
  if (ONLY.length) { console.log(`Trial only: left in ${OUT}`); await ctx.close(); return; }
  // Success: swap the staged capture in.
  fs.rmSync(LIVE_FRAMES, { recursive: true, force: true });
  fs.renameSync(OUT, LIVE_FRAMES);
  fs.renameSync(process.env.WT_JSON, LIVE_JSON);
  await ctx.close();
})().catch((e) => { console.error(e); console.error('Capture failed: the live walkthrough was left unchanged.'); process.exit(1); });
