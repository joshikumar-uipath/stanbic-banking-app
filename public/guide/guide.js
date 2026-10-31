// Feature guide: screenshot lightbox (click, ←/→, Esc) and table-of-contents highlight.
(() => {
  const shots = [...document.querySelectorAll('.g-shot')];
  const lb = document.getElementById('lb');
  if (lb && shots.length) {
    const img = lb.querySelector('img');
    const cap = lb.querySelector('figcaption');
    let at = 0;
    const show = (i) => {
      at = (i + shots.length) % shots.length;
      img.src = shots[at].dataset.src;
      img.alt = shots[at].dataset.cap;
      cap.textContent = `${shots[at].dataset.cap}  ·  ${at + 1} of ${shots.length}`;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
    };
    const close = () => { lb.hidden = true; document.body.style.overflow = ''; shots[at]?.focus(); };
    shots.forEach((s, i) => s.addEventListener('click', () => show(i)));
    lb.querySelector('.g-lb-x').addEventListener('click', close);
    lb.querySelector('.g-lb-p').addEventListener('click', () => show(at - 1));
    lb.querySelector('.g-lb-n').addEventListener('click', () => show(at + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(at + 1);
      if (e.key === 'ArrowLeft') show(at - 1);
    });
  }

  const links = [...document.querySelectorAll('.g-toc a')];
  const flows = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (flows.length) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${en.target.id}`));
      }
    }, { rootMargin: '-130px 0px -60% 0px' });
    flows.forEach((f) => io.observe(f));
  }
})();
