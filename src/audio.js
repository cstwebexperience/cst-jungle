// Ambianță de junglă generată din cod (Web Audio), fără fișiere audio.
export class JungleAudio {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // zgomot "brun" = vânt/frunziș
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    this.noiseBuf = buf;

    const bed = ctx.createBufferSource();
    bed.buffer = buf;
    bed.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain).connect(bedGain.gain);
    bed.connect(lp).connect(bedGain).connect(this.master);
    bed.start();
    lfo.start();

    // dronă joasă, se deschide cu scroll-ul
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 200;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.08;
    [55, 82.4, 110.6].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      o.connect(this.droneFilter);
      o.start();
    });
    this.droneFilter.connect(droneGain).connect(this.master);

    // insecte (greieri/cicade)
    const ins = ctx.createBufferSource();
    const wn = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const wd = wn.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    ins.buffer = wn;
    ins.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 12;
    const am = ctx.createGain();
    am.gain.value = 0;
    const amOsc = ctx.createOscillator();
    amOsc.frequency.value = 38;
    const amDepth = ctx.createGain();
    amDepth.gain.value = 0.05;
    amOsc.connect(amDepth).connect(am.gain);
    this.insectGain = ctx.createGain();
    this.insectGain.gain.value = 0;
    ins.connect(bp).connect(am).connect(this.insectGain).connect(this.master);
    ins.start();
    amOsc.start();
    this._insects();
    this._birds();
  }

  _insects() {
    const t = this.ctx.currentTime;
    const g = this.insectGain.gain;
    g.setTargetAtTime(Math.random() < 0.6 ? 1 : 0, t, 0.8);
    setTimeout(() => this._insects(), 2500 + Math.random() * 5000);
  }

  _birds() {
    if (this.on) {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const n = 1 + ((Math.random() * 3) | 0);
      const base = 1800 + Math.random() * 1800;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const s = t + i * 0.14;
        o.frequency.setValueAtTime(base, s);
        o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.5), s + 0.08);
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.025, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;
        o.connect(g).connect(pan).connect(this.master);
        o.start(s);
        o.stop(s + 0.15);
      }
    }
    setTimeout(() => this._birds(), 2500 + Math.random() * 6000);
  }

  setOn(v) {
    this.init();
    this.on = v;
    this.ctx.resume();
    this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.6);
  }

  setScroll(p) {
    if (!this.ctx) return;
    this.droneFilter.frequency.setTargetAtTime(160 + p * 900, this.ctx.currentTime, 0.3);
  }

  blip(f = 1400) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.08);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.12);
  }
}
