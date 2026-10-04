import Lenis from 'lenis';
import { JungleScene, TEMPLE_POS, PROJ_POS, PORTAL_POS } from './scene.js';
import { JungleAudio } from './audio.js';
import { decode, splitWords } from './decode.js';
import { projects } from './projects.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const audio = new JungleAudio();

document.body.classList.add('locked');
scrollTo(0, 0);
history.scrollRestoration = 'manual';

/* ---------------- loader ---------------- */
const MSGS = ['SE CALIBREAZĂ SENZORII', 'SE CURĂȚĂ MUȘCHIUL', 'SE TREZESC LICURICII', 'SE CAUTĂ ARTEFACTELE', 'SEMNAL STABIL'];
let realLoad = 0;
let shown = 0;
const t0 = performance.now();
const loaderTick = () => {
  const minTime = Math.min((performance.now() - t0) / 2600, 1);
  const target = Math.min(realLoad, minTime);
  shown += (target - shown) * 0.12;
  if (target >= 1 && shown > 0.995) shown = 1;
  $('#pct').textContent = String(Math.round(shown * 100)).padStart(3, '0');
  $('#bar').style.width = shown * 100 + '%';
  const m = MSGS[Math.min((shown * MSGS.length) | 0, MSGS.length - 1)];
  if ($('#loadmsg').dataset.text !== m) {
    $('#loadmsg').dataset.text = m;
    decode($('#loadmsg'), { duration: 500 });
  }
  if (shown < 1) requestAnimationFrame(loaderTick);
  else {
    $('#enter').hidden = false;
    $$('#enter .btn').forEach((b, i) => decode(b, { delay: i * 150 }));
  }
};
requestAnimationFrame(loaderTick);

// câte modele au răspuns (încărcate sau lipsă) → progres real
let answered = 0;
const modelState = {};
const onModel = (key, ok) => {
  modelState[key] = ok;
  answered++;
  realLoad = answered / 5;
  updateLabelTexts();
};

/* ---------------- scena ---------------- */
const scene = new JungleScene($('#gl'), { onModel });
window.__scene = scene;
setTimeout(() => (realLoad = 1), 8000); // nu bloca intrarea dacă rețeaua e lentă

/* ---------------- scroll ---------------- */
const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9 });
lenis.stop();

function enter(withSound) {
  audio.setOn(withSound);
  setSoundUI(withSound);
  $('#loader').classList.add('out');
  document.body.classList.remove('locked');
  lenis.start();
  setTimeout(() => {
    $('.s-hero').classList.add('in');
    $$('.s-hero [data-decode], .hud [data-decode]').forEach((el, i) => decode(el, { delay: i * 120 }));
  }, 500);
}
$$('#enter .btn').forEach((b) => b.addEventListener('click', () => enter(b.dataset.sound === '1')));

/* ---------------- sunet ---------------- */
function setSoundUI(on) {
  $('#hud').classList.toggle('sound-on', on);
  $('#soundTxt').dataset.text = on ? 'SUNET ON' : 'SUNET OFF';
  decode($('#soundTxt'), { duration: 400 });
}
$('#soundBtn').addEventListener('click', () => {
  audio.setOn(!audio.on);
  setSoundUI(audio.on);
});

/* ---------------- texte ---------------- */
$$('[data-split]').forEach(splitWords);
const revealWords = $$('[data-reveal]').map((el) => ({ el, words: splitWords(el) }));

const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting || e.target.classList.contains('in')) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-decode]').forEach((el, i) => decode(el, { delay: i * 120 }));
      e.target.querySelectorAll('[data-count]').forEach((el) => countUp(el));
    }),
  { threshold: 0.35 }
);
$$('.s').forEach((s) => s !== $('.s-hero') && io.observe(s));

function countUp(el) {
  const end = +el.dataset.count;
  const st = performance.now();
  const step = (now) => {
    const p = Math.min((now - st) / 1400, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// linkuri cu decodare la hover + sunet
$$('a, button').forEach((el) => {
  el.addEventListener('mouseenter', () => {
    audio.blip(1200 + Math.random() * 600);
    $('#cursor').classList.add('hover');
    if (el.hasAttribute('data-decode')) decode(el, { duration: 450 });
  });
  el.addEventListener('mouseleave', () => $('#cursor').classList.remove('hover'));
});

// navigare internă cu lenis
$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const t = $(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { duration: 2.4 });
  })
);

/* ---------------- etichete 3D ---------------- */
const labelDefs = [
  { key: 'temple', pos: TEMPLE_POS.clone().setY(7.9), file: 'templu.glb', name: 'TEMPLUL CST', sub: 'ARTEFACT CENTRAL' },
  ...PROJ_POS.map((p, i) => ({ key: i, pos: p.clone().setY(p.y + 1.55), file: `proiect-${i + 1}.glb`, name: projects[i].title, sub: projects[i].tag })),
  { key: 'portal', pos: PORTAL_POS.clone().setY(PORTAL_POS.y + 5.2), name: 'PORTALUL', sub: 'IEȘIRE / CONTACT' },
];
const labelEls = labelDefs.map((d) => {
  const el = document.createElement('div');
  el.className = 'lbl';
  $('#labels').appendChild(el);
  return el;
});
function updateLabelTexts() {
  labelDefs.forEach((d, i) => {
    const missing = d.file && modelState[d.key] === false;
    labelEls[i].classList.toggle('wait', missing);
    labelEls[i].innerHTML = missing
      ? `${d.file}<small>ÎN AȘTEPTAREA MODELULUI</small>`
      : `${typeof d.key === 'number' ? '0' + (d.key + 1) + ' · ' : ''}${d.name}<small>${d.sub}</small>`;
  });
}
updateLabelTexts();

/* ---------------- panou proiect ---------------- */
let activeProj = -1;
function showProj(i) {
  if (i === activeProj) return;
  activeProj = i;
  const panel = $('#projPanel');
  if (i < 0) return panel.classList.remove('on');
  const p = projects[i];
  $('#ppIdx').textContent = '0' + (i + 1);
  $('#ppYear').textContent = p.year;
  $('#ppRole').textContent = p.role;
  $('#ppStack').textContent = p.stack;
  $('#ppLink').href = p.url;
  [['#ppTag', p.tag], ['#ppTitle', p.title], ['#ppDesc', p.desc]].forEach(([s, txt], k) => {
    $(s).dataset.text = txt;
    decode($(s), { duration: s === '#ppDesc' ? 700 : 500, delay: k * 80 });
  });
  panel.classList.add('on');
  audio.blip(900);
}

function openDetail(i) {
  const p = projects[i];
  $('#dKicker').textContent = `// ARTEFACT 0${i + 1} — ${p.tag} — ${p.year}`;
  $('#dTitle').textContent = p.title;
  $('#dBody').textContent = p.body;
  $('#dFrame').src = p.url;
  const d = $('#detail');
  d.hidden = false;
  requestAnimationFrame(() => d.classList.add('open'));
  decode($('#dKicker'));
  lenis.stop();
  audio.blip(600);
}
function closeDetail() {
  const d = $('#detail');
  d.classList.remove('open');
  setTimeout(() => {
    d.hidden = true;
    $('#dFrame').src = 'about:blank';
  }, 900);
  lenis.start();
}
$('#ppOpen').addEventListener('click', () => activeProj >= 0 && openDetail(activeProj));
$('#detailClose').addEventListener('click', closeDetail);
addEventListener('keydown', (e) => e.key === 'Escape' && closeDetail());

/* ---------------- cursor + click pe artefacte ---------------- */
const cur = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2 };
addEventListener('pointermove', (e) => {
  cur.x = e.clientX;
  cur.y = e.clientY;
  scene.setMouse(e.clientX, e.clientY);
});
$('#gl').style.pointerEvents = 'none';
addEventListener('click', (e) => {
  if (e.target.closest('a, button, .detail, .proj-panel')) return;
  const i = scene.pick(e.clientX, e.clientY);
  if (i >= 0) openDetail(i);
});

/* ---------------- buclă ---------------- */
const SECTORS = $$('.s').map((s) => s.dataset.sector);
const rail = $$('.hud-rail li');
let lastSector = -1;
const fmt = (n) => (n < 0 ? '-' : ' ') + Math.abs(n).toFixed(2).padStart(5, '0');

function frame(time) {
  lenis.raf(time);
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
  scene.progress = p;
  const { pos, smooth } = scene.update();
  audio.setScroll(smooth);

  // HUD
  $('#coords').textContent = `X${fmt(pos.x)} · Y${fmt(pos.y)} · Z${fmt(pos.z)}`;
  $('#scrollPct').textContent = String(Math.round(p * 100)).padStart(3, '0');
  $('#rail').style.height = p * 100 + '%';
  const sec = Math.round(smooth * (SECTORS.length - 1));
  if (sec !== lastSector) {
    lastSector = sec;
    $('#sectorNum').textContent = String(sec + 1).padStart(2, '0');
    $('#sectorName').dataset.text = SECTORS[sec];
    decode($('#sectorName'), { duration: 500 });
    rail.forEach((li, k) => li.classList.toggle('on', k === sec));
  }

  // panou proiect activ când camera stă în fața artefactului
  const f = smooth * (SECTORS.length - 1);
  const pi = Math.round(f) - 3;
  showProj(pi >= 0 && pi < 4 && Math.abs(f - Math.round(f)) < 0.3 ? pi : -1);

  // manifest: cuvintele se aprind pe măsură ce dai scroll
  revealWords.forEach(({ el, words }) => {
    const r = el.getBoundingClientRect();
    const q = Math.min(Math.max((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35), 0), 1);
    const lit = Math.floor(q * words.length);
    words.forEach((w, k) => w.classList.toggle('lit', k < lit));
  });

  // etichete
  labelDefs.forEach((d, i) => {
    const s = scene.project(d.pos);
    const el = labelEls[i];
    const op = s.visible ? Math.max(0, Math.min(1, (16 - s.dist) / 6)) * Math.min(1, s.dist / 2.5) : 0;
    el.style.opacity = op.toFixed(2);
    el.style.transform = `translate(${(s.x + 18).toFixed(1)}px, ${s.y.toFixed(1)}px)`;
  });

  // cursor
  cur.sx += (cur.x - cur.sx) * 0.2;
  cur.sy += (cur.y - cur.sy) * 0.2;
  $('#cursor').style.transform = `translate(${cur.sx}px, ${cur.sy}px)`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
