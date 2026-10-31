// Demo walkthrough player: plays walkthrough.json (frames captured from the real apps
// by capture/run.cjs) with an animated cursor, typing, click ripples and captions.
(() => {
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed') === '1') document.documentElement.classList.add('embed');

  const CFG = window.WT_CONFIG || {};
  const APPS = CFG.apps || {};
  const PFX = CFG.storagePrefix || 'wt';
  // Header, tab title and icon from config.js.
  // The tab carries the full title; the header, next to the bank's logo, just the short one.
  if (CFG.title) { document.title = CFG.title; $('brand-t').textContent = CFG.shortTitle || CFG.title; $('brand').title = CFG.title; }
  if (CFG.description) document.querySelector('meta[name=description]').content = CFG.description;
  if (CFG.brandIcon) { $('brand-img').src = CFG.brandIcon; $('favicon').href = CFG.brandIcon; } else $('brand-img').remove();
  if (CFG.launcherHref === '') $('brand').removeAttribute('href'); else if (CFG.launcherHref) $('brand').href = CFG.launcherHref;
  const STAFF = /manager|credit|collateral|legal|insurance|booking|head|ops|team/i;

  let scenes = [];
  let steps = [];
  // Short version: skips the routine detail (each field typed, each box ticked); remembered per browser.
  const SHORT_KEY = `${PFX}.walkthrough.short`;
  let short = true;
  try { short = localStorage.getItem(SHORT_KEY) !== '0'; } catch { /* default */ }
  let cur = -1;
  let playing = false;
  let speed = 1;
  let token = 0;
  let front = $('imgA');
  let back = $('imgB');
  const cache = new Map();

  const load = (src) => {
    if (!cache.has(src)) cache.set(src, new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => res(src); im.src = src; }));
    return cache.get(src);
  };
  const wait = (ms, t) => new Promise((res) => setTimeout(() => res(t === token), ms / speed));
  const pct = (v, of) => `${(v / of) * 100}%`;

  function build(data) {
    let sc = null;
    for (const f of data.frames) {
      if (f.kind === 'scene') { sc = { ...f, all: [], index: scenes.length }; scenes.push(sc); continue; }
      if (!sc) continue;
      // Tagged with the capture time: a new capture never shows a cached old frame.
      f.img = `${CFG.frames || 'frames/'}${f.img}?v=${encodeURIComponent(data.captured || '')}`;
      if (f.video) f.video = `${f.video}?v=${encodeURIComponent(data.captured || '')}`;
      sc.all.push(f);
    }
    scenes = scenes.filter((s) => s.all.length);
    scenes.forEach((s, i) => { s.index = i; s.all.forEach((f) => (f.sceneIndex = i)); });
    // Each act is a flow of its own: scenes are numbered within it.
    scenes.forEach((s) => { const inAct = scenes.filter((x) => x.act === s.act); s.pos = inAct.indexOf(s) + 1; s.of = inAct.length; });
    // An empty caption continues the one before it in the scene.
    for (const s of scenes) { let last = ''; for (const f of s.all) { if (f.caption) last = f.caption; else f.caption = last; } }
    buildFlows();
  }

  // ── One flow at a time ─────────────────────────────────────────────────────────────
  // Each act is a flow of its own (Individual · upload, Corporate · fill in, …). The
  // dropdown on the left picks one; the header, the scene list and the counter show only
  // its scenes, and Play runs it to its end.
  let flow = '';
  const flowScenes = () => scenes.filter((s) => s.act === flow);

  /** The dropdown: the account-opening flows ("Individual · upload" …) first, then the rest. */
  function buildFlows() {
    const sel = $('flow');
    const groups = new Map();
    for (const act of [...new Set(scenes.map((s) => s.act))]) {
      const g = act.includes(' · ') ? 'Account opening' : 'More';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(act);
    }
    for (const [g, acts] of groups) {
      const og = document.createElement('optgroup');
      og.label = g;
      for (const act of acts) { const o = document.createElement('option'); o.value = act; o.textContent = act; og.appendChild(o); }
      sel.appendChild(og);
    }
    sel.onchange = () => { setPlaying(false); setFlow(sel.value); go(0); sel.blur(); };
  }

  function setFlow(act) {
    if (act === flow) return;
    flow = act;
    $('flow').value = act;
    derive();
    const rail = $('rail'), prog = $('prog');
    rail.innerHTML = ''; prog.innerHTML = '';
    const h = document.createElement('p'); h.className = 'wt-act'; h.textContent = act; rail.appendChild(h);
    for (const s of flowScenes()) {
      const open = () => go(steps.indexOf(s.frames[0]), true);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wt-sc'; b.dataset.i = s.index;
      b.innerHTML = `<span class="n">${s.pos}</span><span><b></b><small></small></span>`;
      b.querySelector('b').textContent = s.title; b.querySelector('small').textContent = s.persona;
      b.onclick = open;
      rail.appendChild(b);
      // The header: this flow's scenes, each filling as it plays.
      const g = document.createElement('button');
      g.type = 'button'; g.className = 'wt-stage-seg'; g.dataset.i = s.index; g.title = `${s.pos}. ${s.title}`;
      g.innerHTML = `<span class="lab"><em>${s.pos}</em></span><span class="bar"><i></i></span>`;
      g.querySelector('.lab').append(s.tag || s.title);
      g.onclick = open;
      prog.appendChild(g);
    }
  }

  /** The frames this version plays. */
  function derive() {
    steps = [];
    for (const s of scenes) {
      s.frames = short ? s.all.filter((f) => !f.minor) : s.all.slice();
      if (!s.frames.length) s.frames = [s.all[0]];
      s.frames.forEach((f, i) => { f.first = i === 0; });
      if (s.act === flow) steps.push(...s.frames);
    }
  }

  function setShort(v) {
    const was = steps[cur];
    short = v;
    try { localStorage.setItem(SHORT_KEY, v ? '1' : '0'); } catch { /* not remembered */ }
    document.querySelectorAll('.wt-ver button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'short') === v));
    derive();
    if (!was) return;
    // Stay at the same point in the story: the same frame, or the next one this version keeps.
    const s = scenes[was.sceneIndex];
    const from = s.all.indexOf(was);
    const keep = s.all.slice(from).find((f) => steps.includes(f)) ?? s.frames[s.frames.length - 1];
    cur = steps.indexOf(keep);
    chrome(keep);
  }

  function chrome(f) {
    const s = scenes[f.sceneIndex];
    const port = (f.url.match(/localhost:(\d+)/) || [])[1];
    const route = (f.url.match(/#([a-z-]+)/) || [])[1];
    const host = Object.entries(CFG.hosts || {}).find(([k]) => f.url.includes(k));
    $('app').textContent = f.pdf ? 'PDF' : host ? host[1] : (CFG.routes && CFG.routes[route]) || APPS[port] || 'App';
    // Shown as the product's own address rather than the local dev server.
    $('url').textContent = f.pdf ? f.url : f.url.replace(/^https?:\/\//, '').replace(/^localhost:\d+/, (m) => CFG.displayHost || m).replace(/\?phone=0/, '');
    const chip = $('persona');
    chip.textContent = s.persona;
    chip.className = 'wt-chip' + (/agent/i.test(s.persona) ? ' agent' : STAFF.test(s.persona) ? ' staff' : '');
    $('scene').textContent = `${s.pos}. ${s.title}`;
    $('step').textContent = `step ${s.frames.indexOf(f) + 1} of ${s.frames.length}`;
    $('caption').textContent = (short && f.short) || f.caption;
    $('count').textContent = `Scene ${s.pos} of ${s.of}`;
    document.querySelectorAll('.wt-sc').forEach((b) => { const i = Number(b.dataset.i); b.classList.toggle('on', i === s.index); b.classList.toggle('done', i < s.index); });
    document.querySelectorAll('.wt-stage-seg').forEach((b) => {
      const i = Number(b.dataset.i);
      const frac = i < s.index ? 1 : i > s.index ? 0 : (s.frames.indexOf(f) + 1) / s.frames.length;
      b.classList.toggle('on', i === s.index); b.classList.toggle('done', i < s.index);
      b.querySelector('.bar i').style.width = `${Math.round(frac * 100)}%`;
    });
    const on = document.querySelector('.wt-sc.on');
    if (on && !$('wt').classList.contains('norail')) on.scrollIntoView({ block: 'nearest' });
    try { history.replaceState(null, '', `#${s.id}`); } catch { /* file:// */ }
  }

  async function swap(src) {
    await load(src);
    back.src = src;
    await new Promise((r) => requestAnimationFrame(r));
    back.style.opacity = '1';
    front.style.opacity = '0';
    [front, back] = [back, front];
  }

  async function show(i, opts = {}) {
    const t = ++token;
    cur = i;
    const f = steps[i];
    const s = scenes[f.sceneIndex];
    const ring = $('ring'), cursor = $('cursor'), typed = $('typed'), ripple = $('ripple'), title = $('title');
    ring.classList.remove('on');
    typed.textContent = ''; typed.classList.remove('done');
    // A recorded clip shows only on its own frame.
    const vid = $('vid');
    vid.pause(); vid.classList.remove('on');
    chrome(f);
    if (steps[i + 1]) load(steps[i + 1].img);
    if (steps[i + 2]) load(steps[i + 2].img);

    if (f.first && opts.title !== false) {
      $('titleAct').textContent = `${s.act} · scene ${s.pos}`;
      $('titleText').textContent = s.title;
      $('titleWho').textContent = s.persona;
      title.classList.add('on');
      await swap(f.img);
      if (!(await wait(1900, t))) return;
      title.classList.remove('on');
      if (!(await wait(350, t))) return;
    } else {
      title.classList.remove('on');
      await swap(f.img);
    }
    if (t !== token) return;

    let extra = 0;
    if (f.box) {
      const cx = f.box.x + Math.min(f.box.w / 2, f.action === 'type' ? 40 : f.box.w / 2);
      const cy = f.box.y + f.box.h / 2;
      Object.assign(ring.style, { left: pct(f.box.x - 4, 1440), top: pct(f.box.y - 4, 900), width: pct(f.box.w + 8, 1440), height: pct(f.box.h + 8, 900) });
      cursor.classList.add('on');
      cursor.style.left = pct(cx, 1440);
      cursor.style.top = pct(cy, 900);
      if (!(await wait(750, t))) return;
      ring.classList.add('on');
      if (f.action === 'click') {
        cursor.classList.add('press');
        ripple.style.left = pct(cx, 1440); ripple.style.top = pct(cy, 900);
        ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
        if (!(await wait(160, t))) return;
        cursor.classList.remove('press');
      } else if (f.action === 'type' && f.text) {
        // Click into the field, then move the pointer aside so it never sits on the text.
        cursor.classList.add('press');
        ripple.style.left = pct(cx, 1440); ripple.style.top = pct(cy, 900);
        ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
        if (!(await wait(160, t))) return;
        cursor.classList.remove('press');
        cursor.style.left = pct(f.box.x + f.box.w - 14, 1440);
        cursor.style.top = pct(f.box.y + f.box.h + 4, 900);
        if (!(await wait(250, t))) return;
        Object.assign(typed.style, { left: pct(f.box.x, 1440), top: pct(f.box.y, 900), width: pct(f.box.w, 1440), height: pct(f.box.h, 900) });
        if (/₦|naira/i.test(f.caption) || /^[\d,]+$/.test(f.text)) typed.style.paddingLeft = '2.2cqw'; else typed.style.paddingLeft = '';
        for (let k = 1; k <= f.text.length; k++) {
          typed.textContent = f.text.slice(0, k);
          if (!(await wait(45, t))) return;
        }
        typed.classList.add('done');
        extra = 200;
      }
    } else if (f.nav) {
      cursor.classList.remove('on');
    }

    // A recorded clip plays over the frame, start to end, before the step moves on.
    if (f.video) {
      cursor.classList.remove('on');
      if (!vid.src.endsWith(f.video)) vid.src = f.video;
      vid.currentTime = 0; vid.playbackRate = speed;
      vid.classList.add('on');
      await vid.play().catch(() => {});
      while (t === token && !vid.ended && !vid.error) await new Promise((r) => setTimeout(r, 200));
      if (t !== token) return;
      if (!(await wait(1500, t))) return;
      if (playing) next();
      return;
    }

    const dwell = Math.max(2300, 700 + ((short && f.short) || f.caption || '').length * 42) + extra;
    if (!(await wait(dwell, t))) return;
    if (playing) next();
  }

  function go(i, title = true) {
    if (i < 0 || i >= steps.length) { if (i >= steps.length) setPlaying(false); return; }
    show(i, { title });
  }
  const next = () => go(cur + 1);

  const screenOf = (f) => (f.pdf ? 'pdf:' + f.img : f.url.replace(/[?&]g=[^&#]*/, ''));
  // Past everything on the current screen: the next frame on a different page, or the next scene.
  const nextScreen = () => {
    const f = steps[cur];
    if (!f) return;
    let i = cur + 1;
    while (i < steps.length && steps[i].sceneIndex === f.sceneIndex && screenOf(steps[i]) === screenOf(f)) i++;
    go(i);
  };
  const nextScene = () => {
    const f = steps[cur];
    const s = f ? scenes[f.sceneIndex + 1] : flowScenes()[0];
    if (s && s.act === flow) go(steps.indexOf(s.frames[0]));
  };
  const prev = () => go(cur - 1, false);

  function setPlaying(p) {
    playing = p;
    $('play').textContent = p ? 'Pause' : (cur >= steps.length - 1 ? 'Replay' : 'Play');
    if (p) { if (cur >= steps.length - 1) go(0); else next(); }
  }

  // Scene list: collapsed by default so the screen gets the room; remembered per browser.
  const RAIL_KEY = `${PFX}.walkthrough.rail`;
  const setRail = (open) => {
    $('wt').classList.toggle('norail', !open);
    $('railbtn').setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(RAIL_KEY, open ? '1' : '0'); } catch { /* not remembered */ }
  };
  let railOpen = false;
  try { railOpen = localStorage.getItem(RAIL_KEY) === '1'; } catch { /* default */ }
  setRail(railOpen);
  $('railbtn').onclick = () => setRail($('wt').classList.contains('norail'));

  $('play').onclick = () => setPlaying(!playing);
  $('restartscene').onclick = () => { setPlaying(false); const f = steps[cur]; if (f) go(steps.indexOf(scenes[f.sceneIndex].frames[0])); };
  $('restartall').onclick = () => { setPlaying(false); go(0); };
  $('skipscreen').onclick = () => { setPlaying(false); nextScreen(); };
  $('skipscene').onclick = () => { setPlaying(false); nextScene(); };
  document.querySelectorAll('.wt-ver button').forEach((b) => (b.onclick = () => setShort(b.dataset.v === 'short')));
  document.querySelectorAll('.wt-ver button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'short') === short));
  $('next').onclick = () => { setPlaying(false); next(); };
  $('prev').onclick = () => { setPlaying(false); prev(); };
  document.querySelectorAll('.wt-sp button').forEach((b) => (b.onclick = () => {
    speed = Number(b.dataset.sp);
    document.querySelectorAll('.wt-sp button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const key = (k) => {
    if (k === 'ShiftArrowRight') { setPlaying(false); nextScreen(); return true; }
    if (k === 'ArrowRight' || k === ' ') { setPlaying(false); next(); return true; }
    if (k === 'ArrowLeft') { setPlaying(false); prev(); return true; }
    if (k.toLowerCase() === 'p') { setPlaying(!playing); return true; }
    if (k.toLowerCase() === 's') { setRail($('wt').classList.contains('norail')); return true; }
    return false;
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (key(e.shiftKey && e.key === 'ArrowRight' ? 'ShiftArrowRight' : e.key)) e.preventDefault();
  });
  // Keys pressed in the demo director while this plays inside it.
  window.addEventListener('message', (e) => { if (e.data && e.data.type === 'wt-key') key(String(e.data.key)); });

  fetch(CFG.data || './walkthrough.json', { cache: 'no-store' }).then((r) => r.json()).then((data) => {
    build(data);
    const want = location.hash.slice(1);
    const sc = scenes.find((s) => s.id === want);
    setFlow(sc ? sc.act : scenes[0].act);
    go(sc ? steps.indexOf(sc.frames[0]) : 0);
    if (qs.get('autoplay') === '1') setPlaying(true);
    window.addEventListener('hashchange', () => {
      const s = scenes.find((x) => x.id === location.hash.slice(1));
      if (!s || s.index === steps[cur]?.sceneIndex) return;
      setFlow(s.act);
      go(steps.indexOf(s.frames[0]));
    });
  }).catch(() => { $('caption').textContent = 'The walkthrough has not been captured yet. Run capture/run.cjs (see capture/README.md).'; });
})();
