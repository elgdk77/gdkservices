// Site behaviour and motion. Uses Motion (https://motion.dev), vendored in assets/vendor.
//
// Where each animation lives:
//   Hero entrance ............ CSS keyframes in site.css (starts on first paint, before this file loads)
//   Hero dot grid ............ initHeroGrid()   canvas, reacts to the cursor on mouse/trackpad devices only
//   Section/card reveals ..... initReveals()    [data-reveal], and children of [data-reveal-group]
//   Project image parallax ... initParallax()   [data-parallax], the one scroll-linked effect
//   Project card tilt ........ initTilt()       [data-tilt]
//   Magnetic buttons ......... initMagnetic()   [data-magnetic]
//   Sticky nav highlight ..... initNav()
import { animate, inView, scroll, stagger } from './vendor/motion-14.5.0.min.js';

window.__motionReady = true;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const EASE_OUT = [0.22, 1, 0.36, 1];

/* ---------- Scroll reveals ---------- */
function initReveals() {
  const clearTransform = (el) => { if (!el.hasAttribute('data-tilt')) el.style.transform = ''; };

  inView('[data-reveal]', (el) => {
    const a = reduceMotion
      ? animate(el, { opacity: [0, 1] }, { duration: 0.3 })
      : animate(el, { opacity: [0, 1], y: [24, 0] }, { duration: 0.6, ease: EASE_OUT });
    a.then(() => clearTransform(el));
  }, { amount: 0.15 });

  inView('[data-reveal-group]', (group) => {
    const kids = Array.from(group.children);
    const a = reduceMotion
      ? animate(kids, { opacity: [0, 1] }, { duration: 0.3 })
      : animate(kids, { opacity: [0, 1], y: [20, 0] }, { duration: 0.5, delay: stagger(0.07), ease: EASE_OUT });
    a.then(() => kids.forEach(clearTransform));
  }, { amount: 0.1 });
}

/* ---------- Parallax on project images (scroll-linked) ---------- */
function initParallax() {
  if (reduceMotion) return;
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    scroll(
      animate(el, { y: ['-6%', '6%'] }, { ease: 'linear' }),
      { target: el.parentElement, offset: ['start end', 'end start'] }
    );
  });
}

/* ---------- Card tilt + lift ---------- */
function initTilt() {
  if (reduceMotion || !finePointer) return;
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    let frame = 0;
    const opts = { duration: 0.4, ease: EASE_OUT };
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        const max = card.classList.contains('project--feature') ? 2 : 4; // big card tilts less
        animate(card, { rotateY: px * max, rotateX: -py * max, y: -4, transformPerspective: 1200 }, opts);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      animate(card, { rotateY: 0, rotateX: 0, y: 0 }, { duration: 0.5, ease: EASE_OUT });
    });
  });
}

/* ---------- Magnetic buttons ---------- */
function initMagnetic() {
  if (reduceMotion || !finePointer) return;
  const spring = { type: 'spring', stiffness: 320, damping: 20, mass: 0.6 };
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const clamp = (v) => Math.max(-10, Math.min(10, v));
      animate(el, {
        x: clamp((e.clientX - (r.left + r.width / 2)) * 0.25),
        y: clamp((e.clientY - (r.top + r.height / 2)) * 0.35),
      }, spring);
    });
    el.addEventListener('pointerleave', () => animate(el, { x: 0, y: 0 }, spring));
  });
}

/* ---------- Hero dot grid ----------
   Static on touch screens and with reduced motion. On mouse devices the dots
   near the cursor swell, push outward and take the accent colour. The render
   loop only runs while the cursor is moving or easing back, never idles. */
function initHeroGrid() {
  const canvas = document.querySelector('.hero-grid');
  if (!canvas) return;
  const hero = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c5f82a';
  const GAP = 26, RADIUS = 150, PUSH = 7;
  let w = 0, h = 0, raf = 0;
  const p = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, s: 0, ts: 0 }; // position + strength, eased

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const cols = Math.ceil(w / GAP) + 1, rows = Math.ceil(h / GAP) + 1;
    const ox = (w % GAP) / 2, oy = (h % GAP) / 2;
    const hot = [];
    ctx.fillStyle = 'rgba(255,255,255,0.17)';
    ctx.beginPath();
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = ox + i * GAP, y = oy + j * GAP;
        const dx = x - p.x, dy = y - p.y;
        const d = Math.hypot(dx, dy);
        if (p.s > 0.01 && d < RADIUS) {
          let t = 1 - d / RADIUS; t = t * t * (3 - 2 * t) * p.s;
          if (d > 0) { x += (dx / d) * t * PUSH; y += (dy / d) * t * PUSH; }
          hot.push(x, y, t);
        } else {
          ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }
    }
    ctx.fill();
    ctx.fillStyle = accent;
    for (let k = 0; k < hot.length; k += 3) {
      const t = hot[k + 2], s = 1.5 + t * 2;
      ctx.globalAlpha = 0.15 + t * 0.85;
      ctx.fillRect(hot[k] - s / 2, hot[k + 1] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function tick() {
    p.x += (p.tx - p.x) * 0.18; p.y += (p.ty - p.y) * 0.18; p.s += (p.ts - p.s) * 0.12;
    draw();
    const settled = Math.abs(p.tx - p.x) < 0.3 && Math.abs(p.ty - p.y) < 0.3 && Math.abs(p.ts - p.s) < 0.01;
    raf = settled ? 0 : requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  new ResizeObserver(resize).observe(hero);
  resize();
  canvas.classList.add('is-ready');

  if (reduceMotion || !finePointer) return;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    p.tx = e.clientX - r.left; p.ty = e.clientY - r.top; p.ts = 1;
    if (p.s < 0.01) { p.x = p.tx; p.y = p.ty; } // don't sweep in from off-screen
    wake();
  });
  hero.addEventListener('pointerleave', () => { p.ts = 0; wake(); });
}

/* ---------- Nav: mobile menu, current-section highlight, scrolled border ---------- */
function initNav() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  const links = Array.from(menu.querySelectorAll('a'));

  const setMenu = (open) => { toggle.setAttribute('aria-expanded', String(open)); menu.classList.toggle('open', open); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    setMenu(open);
    if (open) links[0].focus();
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) setMenu(false); });

  const sections = ['top', ...links.map((a) => a.hash.slice(1))].map((id) => document.getElementById(id));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => {
        if (a.hash === '#' + entry.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => s && io.observe(s));

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Contact form: validate, then send via server.js (Postmark) ---------- */
function initForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const fields = {
    name: { el: form.elements.name, msg: 'Please enter your name.' },
    email: { el: form.elements.email, msg: 'Please enter a valid email address.' },
    message: { el: form.elements.message, msg: 'Please enter a message.' },
  };
  const status = document.getElementById('cf-status');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstInvalid = null;
    for (const f of Object.values(fields)) {
      const ok = f.el.value.trim() !== '' && f.el.checkValidity();
      f.el.setAttribute('aria-invalid', String(!ok));
      document.getElementById(f.el.id + '-err').textContent = ok ? '' : f.msg;
      if (!ok && !firstInvalid) firstInvalid = f.el;
    }
    if (firstInvalid) { firstInvalid.focus(); return; }

    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name.el.value.trim(),
          email: fields.email.el.value.trim(),
          message: fields.message.el.value.trim(),
          website: form.elements.website.value,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Sorry, the message could not be sent.');
      form.reset();
      status.textContent = "Thanks, your message has been sent. I'll get back to you soon.";
    } catch (err) {
      status.textContent = `${err.message || 'Sorry, the message could not be sent.'} You can also email gavinknowles@gmail.com directly.`;
    } finally {
      button.disabled = false;
    }
  });
}

initNav();
initForm();
initReveals();
initParallax();
initTilt();
initMagnetic();
initHeroGrid();
document.getElementById('year').textContent = new Date().getFullYear();
