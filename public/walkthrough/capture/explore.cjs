// Dev helper: a capture browser that takes commands over HTTP (POST /run with an async function body).
const http = require('http');
const { chromium } = require(process.env.PW || 'playwright-core');
const { install } = require('./overlay.cjs');
// A simulated camera (a drawn portrait) so face checks run as they would on a phone.
const CAMERA_FILE = require('path').join(__dirname, 'fake-camera.y4m'); // make-camera.py creates it
const CAMERA_ARGS = require('fs').existsSync(CAMERA_FILE) ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${CAMERA_FILE}`] : [];
(async () => {
  const ctx = await chromium.launchPersistentContext(process.env.PROFILE || require('path').join(require('os').tmpdir(), 'wt-aof-profile'), { channel: 'chrome', headless: true, serviceWorkers: 'block', permissions: ['camera', 'microphone'], viewport: { width: 1440, height: 900 }, args: CAMERA_ARGS });
  const ov = await install(ctx);
  let page = ctx.pages()[0] || await ctx.newPage();
  const state = {};
  http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', async () => {
      try {
        const fn = new Function('page', 'ctx', 'ov', 'state', 'require', `return (async () => { ${b} })()`);
        const out = await fn(page, ctx, ov, state, require);
        res.end(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
      } catch (e) { res.end('ERR ' + (e && e.message || e)); }
    });
  }).listen(9555, () => console.log('ready'));
})();
