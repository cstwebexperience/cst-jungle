// Efectul de text "decodat" (literele se amestecă și apoi se așază)
const GLYPHS = 'ΔΣΞΨΩ#%&/<>_=+*01ĂÎȘȚ';

export function decode(el, { duration = 900, delay = 0 } = {}) {
  const target = el.dataset.text ?? (el.dataset.text = el.textContent);
  if (el._decodeRaf) cancelAnimationFrame(el._decodeRaf);
  const start = performance.now() + delay;
  const len = target.length;

  const tick = (now) => {
    const p = Math.min(Math.max((now - start) / duration, 0), 1);
    let out = '';
    for (let i = 0; i < len; i++) {
      const c = target[i];
      if (c === ' ' || i / len < p) out += c;
      else if (i / len < p + 0.25) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += ' ';
    }
    el.textContent = out;
    if (p < 1) el._decodeRaf = requestAnimationFrame(tick);
    else el.textContent = target;
  };
  el._decodeRaf = requestAnimationFrame(tick);
}

// Împarte textul în cuvinte (pentru apariții cuvânt cu cuvânt)
export function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  return [...el.querySelectorAll('.w')];
}
