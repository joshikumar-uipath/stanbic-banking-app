// Re-capture scenes that do not depend on the story's application (e.g. ONLY=tower node only.cjs),
// replacing their frames in walkthrough.json.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright-core');
const { install } = require('./overlay.cjs');
// A simulated camera (a drawn portrait) so face checks run as they would on a phone.
const CAMERA_FILE = require('path').join(__dirname, 'fake-camera.y4m'); // make-camera.py creates it
const CAMERA_ARGS = require('fs').existsSync(CAMERA_FILE) ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${CAMERA_FILE}`] : [];
const { makeRecorder, save, OUT } = require('./lib.cjs');
const { SCENES } = require('./scenes.cjs');
(async () => {
  const ids = (process.env.ONLY || '').split(',').filter(Boolean);
  const data = JSON.parse(fs.readFileSync(path.join(OUT, '..', 'walkthrough.json'), 'utf8'));
  const frames = data.frames.filter((f) => !ids.includes(f.kind === 'scene' ? f.id : f.scene));
  const ctx = await chromium.launchPersistentContext(process.env.PROFILE || require('path').join(require('os').tmpdir(), 'wt-aof-profile'), { channel: 'chrome', headless: true, serviceWorkers: 'block', permissions: ['camera', 'microphone'], viewport: { width: 1440, height: 900 }, args: CAMERA_ARGS });
  const ov = await install(ctx);
  const page = ctx.pages()[0] || (await ctx.newPage());
  const R = makeRecorder(page, frames, ov);
  for (const sc of SCENES.filter((x) => ids.includes(x.id))) {
    R.scene({ id: sc.id, act: sc.act, persona: sc.persona, title: sc.title, tag: sc.tag });
    if (sc.same) frames.push(...frames.filter((f) => !f.kind && f.scene === sc.same).map((f) => ({ ...f, scene: sc.id })));
    else await sc.run(R, {});
  }
  save(frames);
  console.log(`${frames.filter((f) => !f.kind).length} frames`);
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
