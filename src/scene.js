import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const isMobile = matchMedia('(max-width: 760px)').matches;
const BG = new THREE.Color('#03110a');
const FIREFLY = new THREE.Color('#d4ff8a');
const GOLD = new THREE.Color('#d8b45a');

// pozițiile din lume
export const TEMPLE_POS = new THREE.Vector3(0, 0, 0);
export const PROJ_POS = [
  new THREE.Vector3(-3, 2.1, -12),
  new THREE.Vector3(3, 2.4, -20),
  new THREE.Vector3(-3, 1.9, -28),
  new THREE.Vector3(3, 2.2, -36),
];
export const PORTAL_POS = new THREE.Vector3(0, 3.4, -50);

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// cadre cheie de cameră: unul pe secțiune (8)
function buildKeys() {
  const proj = PROJ_POS.map((p) => ({
    pos: p.clone().add(isMobile ? v(0, 0.6, 7.2) : v(0, 0.35, 4.6)),
    look: isMobile ? p.clone().add(v(0, -0.9, 0)) : p.clone().add(v(-1.35, 0, 0)),
  }));
  return [
    { pos: v(0, 2.2, 22), look: v(0, 3.2, 0) },
    { pos: v(-4.5, 3.6, 12), look: v(0.5, 3.4, 0) },
    { pos: v(5, 1.3, 7), look: v(-1, 4.2, -1) },
    ...proj,
    { pos: v(0, 3, -41), look: PORTAL_POS },
  ];
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------------- shadere ---------------- */
const particleVert = /* glsl */ `
  uniform float uTime; uniform float uSize; uniform float uPixel;
  uniform vec3 uMouse; uniform float uFall;
  attribute float aSeed; attribute float aScale;
  varying float vBlink; varying float vSeed;
  void main(){
    vec3 p = position;
    float t = uTime * (0.3 + aSeed * 0.4);
    p.x += sin(t + aSeed * 30.0) * 0.6;
    p.y += sin(t * 1.3 + aSeed * 12.0) * 0.4 - mod(uTime * uFall * (0.5 + aSeed), 8.0);
    p.y = mod(p.y, 8.0);
    p.z += cos(t * 0.8 + aSeed * 20.0) * 0.6;
    vec3 d = p - uMouse; float dist = length(d);
    p += normalize(d) * smoothstep(2.4, 0.0, dist) * 1.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vBlink = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.5) + aSeed * 50.0), 3.0);
    vSeed = aSeed;
    gl_PointSize = uSize * aScale * uPixel * (10.0 / -mv.z);
  }`;
const particleFrag = /* glsl */ `
  uniform vec3 uColA; uniform vec3 uColB; uniform float uGlow;
  varying float vBlink; varying float vSeed;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d); a *= a;
    vec3 c = mix(uColA, uColB, step(0.8, vSeed));
    gl_FragColor = vec4(c * uGlow * vBlink, a * vBlink);
  }`;

const shaftVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const shaftFrag = /* glsl */ `
  uniform float uTime; uniform float uSeed; uniform vec3 uCol; varying vec2 vUv;
  void main(){
    float x = abs(vUv.x - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
    a *= 0.55 + 0.45 * sin(uTime * 0.6 + uSeed * 9.0 + vUv.y * 3.0);
    gl_FragColor = vec4(uCol, a * 0.11);
  }`;

const noise = /* glsl */ `
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }`;
const mistFrag = /* glsl */ `
  uniform float uTime; uniform float uSeed; varying vec2 vUv; ${noise}
  void main(){
    vec2 p = vUv * 7.0 + vec2(uTime * 0.03, uTime * 0.015) + uSeed * 10.0;
    float f = fbm(p + fbm(p * 0.7 + uTime * 0.02));
    float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    gl_FragColor = vec4(vec3(0.3, 0.5, 0.34), smoothstep(0.5, 0.9, f) * 0.11 * edge);
  }`;

const portalVert = /* glsl */ `
  uniform float uTime; uniform float uPixel; uniform float uPower;
  attribute float aSeed; attribute float aR; attribute float aA;
  varying float vR; varying float vSeed;
  void main(){
    float ang = aA + uTime * (0.25 + 1.4 / (aR + 0.4)) * (0.6 + uPower);
    float r = aR * (1.0 + sin(uTime * 0.7 + aSeed * 20.0) * 0.04);
    vec3 p = vec3(cos(ang) * r, sin(ang) * r, -aR * 1.6 * (0.4 + aSeed * 0.6) + sin(uTime + aSeed * 40.0) * 0.15);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vR = aR; vSeed = aSeed;
    gl_PointSize = (1.0 + aSeed * 2.0) * uPixel * (10.0 / -mv.z);
  }`;
const portalFrag = /* glsl */ `
  uniform float uPower; uniform vec3 uColA; uniform vec3 uColB;
  varying float vR; varying float vSeed;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 c = mix(uColA * 2.2, uColB, smoothstep(0.3, 4.5, vR));
    gl_FragColor = vec4(c * (0.6 + uPower * 1.6), a * (0.35 + uPower * 0.65));
  }`;

const sphereVert = /* glsl */ `
  uniform float uTime; uniform float uPixel; uniform float uScan;
  attribute float aSeed; varying float vA;
  void main(){
    vec3 p = position;
    float band = smoothstep(0.12, 0.0, abs(p.y - uScan));
    p *= 1.0 + band * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = 0.42 + band * 0.9 + 0.12 * sin(uTime * 2.0 + aSeed * 60.0);
    gl_PointSize = (1.8 + band * 2.5) * uPixel * (10.0 / -mv.z);
  }`;
const sphereFrag = /* glsl */ `
  uniform vec3 uCol; uniform float uOpacity; varying float vA;
  void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol * 1.6, smoothstep(0.5, 0.0, d) * vA * uOpacity); }`;

const finalShader = {
  uniforms: { tDiffuse: { value: null }, uVel: { value: 0 }, uTime: { value: 0 } },
  vertexShader: shaftVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVel; uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      float k = 0.002 + uVel * 0.02;
      vec2 off = c * k;
      vec2 uv = vUv + vec2(0.0, sin(vUv.y * 40.0 + uTime * 8.0) * uVel * 0.002);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* ---------------- efect de apariție (scanare) pentru GLB-uri ---------------- */
function addReveal(material, uniforms) {
  material.onBeforeCompile = (s) => {
    s.uniforms.uReveal = uniforms.uReveal;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRevealPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRevealPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRevealPos;\nuniform float uReveal;')
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float rd = vRevealPos.y - uReveal;
        if (rd > 0.0) discard;
        gl_FragColor.rgb += vec3(0.83, 1.0, 0.54) * smoothstep(-0.18, 0.0, rd) * 3.0;`
      );
  };
  material.needsUpdate = true;
}

function fitObject(obj, size, mode = 'height') {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const k = size / (mode === 'height' ? s.y : Math.max(s.x, s.y, s.z));
  obj.scale.multiplyScalar(k);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= mode === 'height' ? box2.min.y : c.y;
}

/* ================================================================== */
export class JungleScene {
  constructor(canvas, { onProgress, onModel } = {}) {
    this.onModel = onModel || (() => {});
    this.clock = new THREE.Clock();
    this.progress = 0;
    this.smoothProgress = 0;
    this.velocity = 0;
    this.mouse = new THREE.Vector2();
    this.mouseSmooth = new THREE.Vector2();
    this.pixel = Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75);
    this.keys = buildKeys();
    this.reveals = [];

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' }));
    r.setPixelRatio(this.pixel);
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;

    const scene = (this.scene = new THREE.Scene());
    scene.background = BG;
    scene.fog = new THREE.FogExp2(BG, 0.055);
    this.camera = new THREE.PerspectiveCamera(isMobile ? 55 : 42, innerWidth / innerHeight, 0.1, 200);
    this.camera.position.copy(this.keys[0].pos);
    this.lookTarget = this.keys[0].look.clone();

    // lumini
    scene.add(new THREE.HemisphereLight('#a6d9a0', '#04120a', 0.9));
    const sun = new THREE.DirectionalLight('#ffe2a0', 2.4);
    sun.position.set(-6, 14, -8);
    scene.add(sun);
    const glow = new THREE.PointLight('#9eff7a', 30, 18, 2);
    glow.position.set(0, 2.5, 4);
    scene.add(glow);

    // sol
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: '#061a0e', roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    this.uniforms = { uTime: { value: 0 } };
    this._fireflies();
    this._spores();
    this._shafts();
    this._mist();
    this._portal();
    this._slots();
    this._post();
    this._load(onProgress);

    this.raycaster = new THREE.Raycaster();
    addEventListener('resize', () => this.resize());
  }

  _particles(count, box, opts) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.randFloat(box[0], box[1]);
      pos[i * 3 + 1] = THREE.MathUtils.randFloat(box[2], box[3]);
      pos[i * 3 + 2] = THREE.MathUtils.randFloat(box[4], box[5]);
      seed[i] = Math.random();
      scale[i] = 0.4 + Math.random() * 0.9;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.uniforms.uTime,
        uPixel: { value: this.pixel },
        uMouse: this.mouseWorld || (this.mouseWorld = { value: new THREE.Vector3(0, -99, 0) }),
        uSize: { value: opts.size },
        uFall: { value: opts.fall },
        uGlow: { value: opts.glow },
        uColA: { value: opts.a },
        uColB: { value: opts.b },
      },
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }

  _fireflies() {
    this._particles(isMobile ? 380 : 800, [-11, 11, 0.3, 7.5, -54, 26], { size: 9, fall: 0, glow: 2.4, a: FIREFLY, b: GOLD });
  }

  _spores() {
    this._particles(isMobile ? 600 : 1500, [-14, 14, 0, 8, -56, 28], { size: 2.6, fall: 0.12, glow: 0.7, a: new THREE.Color('#bfe3b0'), b: GOLD });
  }

  _shafts() {
    this.shafts = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: shaftVert,
        fragmentShader: shaftFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: this.uniforms.uTime, uSeed: { value: Math.random() }, uCol: { value: new THREE.Color('#fff1b8') } },
      });
      const holder = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + Math.random() * 1.6, 18), m);
      mesh.rotation.z = 0.32 + Math.random() * 0.1;
      holder.add(mesh);
      holder.position.set(-5 + i * 1.7 + Math.random(), 6, -2 - Math.random() * 6 - (i % 3) * 10);
      this.scene.add(holder);
      this.shafts.push(holder);
    }
  }

  _mist() {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: shaftVert,
        fragmentShader: mistFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: this.uniforms.uTime, uSeed: { value: Math.random() } },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 90), m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.15 + i * 0.3, -14);
      this.scene.add(mesh);
    }
  }

  _portal() {
    const count = isMobile ? 2500 : 6000;
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(count);
    const rr = new Float32Array(count);
    const aa = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i] = Math.random();
      rr[i] = 0.3 + Math.pow(Math.random(), 0.55) * 4.6;
      aa[i] = Math.random() * Math.PI * 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
    g.setAttribute('aA', new THREE.BufferAttribute(aa, 1));
    this.portalUni = {
      uTime: this.uniforms.uTime,
      uPixel: { value: this.pixel },
      uPower: { value: 0 },
      uColA: { value: FIREFLY },
      uColB: { value: new THREE.Color('#1f6b3a') },
    };
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: portalVert,
        fragmentShader: portalFrag,
        uniforms: this.portalUni,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    pts.frustumCulled = false;
    pts.position.copy(PORTAL_POS);
    this.scene.add(pts);
  }

  _fieldSphere(radius, count) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = ga * i;
      pos.set([Math.cos(th) * rad * radius, y * radius, Math.sin(th) * rad * radius], i * 3);
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const uni = { uTime: this.uniforms.uTime, uPixel: { value: this.pixel }, uScan: { value: 0 }, uCol: { value: FIREFLY }, uOpacity: { value: 1 } };
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ vertexShader: sphereVert, fragmentShader: sphereFrag, uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    pts.userData.uni = uni;
    pts.userData.radius = radius;
    return pts;
  }

  // sloturile pentru GLB-uri: templu + 4 artefacte, fiecare cu un câmp de scanare
  _slots() {
    this.temple = new THREE.Group();
    this.temple.position.copy(TEMPLE_POS);
    this.templeField = this._fieldSphere(4.2, isMobile ? 900 : 1800);
    this.templeField.position.y = 3.2;
    this.templeField.scale.y = 0.85;
    this.temple.add(this.templeField);
    this.scene.add(this.temple);

    this.slots = PROJ_POS.map((p, i) => {
      const group = new THREE.Group();
      group.position.copy(p);
      const field = this._fieldSphere(1.25, isMobile ? 500 : 900);
      group.add(field);
      const holder = new THREE.Group();
      group.add(holder);
      // sferă invizibilă pentru click
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData.proj = i;
      group.add(hit);
      this.scene.add(group);
      return { group, field, holder, hit, loaded: false };
    });
  }

  _post() {
    const c = (this.composer = new EffectComposer(this.renderer));
    c.setPixelRatio(this.pixel);
    c.setSize(innerWidth, innerHeight);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.85, 0.7, 0.62);
    c.addPass(this.bloom);
    this.finalPass = new ShaderPass(finalShader);
    c.addPass(this.finalPass);
    c.addPass(new OutputPass());
  }

  _load(onProgress) {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_u, loaded, total) => onProgress && onProgress(loaded / total);
    const loader = new GLTFLoader(manager);
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);

    const prep = (root, target, size, mode) => {
      const uni = { uReveal: { value: -50 } };
      root.traverse((o) => {
        if (o.isMesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => addReveal(m, uni));
        }
      });
      fitObject(root, size, mode);
      target.add(root);
      target.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      this.reveals.push({ uni, from: box.min.y - 0.2, to: box.max.y + 0.3, t: 0 });
    };

    loader.load(
      '/models/templu.glb',
      (gltf) => {
        prep(gltf.scene, this.temple, 7.5, 'height');
        this.templeField.userData.uni.uOpacity.value = 0.25;
        this.onModel('temple', true);
      },
      undefined,
      () => this.onModel('temple', false)
    );
    this.slots.forEach((s, i) =>
      loader.load(
        `/models/proiect-${i + 1}.glb`,
        (gltf) => {
          prep(gltf.scene, s.holder, 1.6, 'max');
          s.loaded = true;
          s.field.userData.uni.uOpacity.value = 0.35;
          this.onModel(i, true);
        },
        undefined,
        () => this.onModel(i, false)
      )
    );
  }

  setMouse(x, y) {
    this.mouse.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  }

  pick(x, y) {
    const m = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(m, this.camera);
    const hit = this.raycaster.intersectObjects(this.slots.map((s) => s.hit))[0];
    return hit ? hit.object.userData.proj : -1;
  }

  project(vec) {
    const p = vec.clone().project(this.camera);
    const behind = p.z > 1;
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, visible: !behind, dist: vec.distanceTo(this.camera.position) };
  }

  resize() {
    this.keys = buildKeys();
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  update() {
    const rawDt = Math.min(this.clock.getDelta(), 0.5);
    const dt = Math.min(rawDt, 0.05);
    const t = (this.uniforms.uTime.value += dt);

    const prev = this.smoothProgress;
    this.smoothProgress += (this.progress - this.smoothProgress) * (1 - Math.exp(-rawDt * 4));
    const vel = Math.abs(this.smoothProgress - prev) / Math.max(rawDt, 0.001);
    this.velocity += (Math.min(vel * 2.5, 1) - this.velocity) * 0.1;

    // camera pe cadre cheie
    const n = this.keys.length - 1;
    const f = this.smoothProgress * n;
    const i = Math.min(Math.floor(f), n - 1);
    const k = ease(f - i);
    const A = this.keys[i], B = this.keys[i + 1];
    const pos = A.pos.clone().lerp(B.pos, k);
    const look = A.look.clone().lerp(B.look, k);
    // arc ușor între cadre, ca un zbor
    pos.y += Math.sin(k * Math.PI) * 0.6;

    this.mouseSmooth.lerp(this.mouse, 0.05);
    pos.x += this.mouseSmooth.x * 0.35;
    pos.y += this.mouseSmooth.y * 0.2;
    pos.y += Math.sin(t * 0.5) * 0.05;
    this.camera.position.copy(pos);
    this.lookTarget.lerp(look, 1 - Math.exp(-rawDt * 12));
    this.camera.lookAt(this.lookTarget);

    // mouse în lume (licuricii fug de cursor)
    this.raycaster.setFromCamera(this.mouseSmooth, this.camera);
    this.mouseWorld.value.copy(this.raycaster.ray.at(6, new THREE.Vector3()));

    // raze de lumină întoarse spre cameră
    this.shafts.forEach((s) => (s.rotation.y = Math.atan2(pos.x - s.position.x, pos.z - s.position.z)));

    // câmpurile de scanare + artefactele care plutesc
    this.templeField.userData.uni.uScan.value = Math.sin(t * 0.6) * 4;
    this.templeField.rotation.y = t * 0.05;
    this.slots.forEach((s, j) => {
      s.field.userData.uni.uScan.value = Math.sin(t * 1.1 + j) * 1.25;
      s.field.rotation.y = t * 0.15;
      s.holder.rotation.y = t * 0.35 + j;
      s.holder.position.y = Math.sin(t * 0.9 + j * 2) * 0.12;
    });

    // apariția GLB-urilor (scanare de jos în sus)
    this.reveals.forEach((r) => {
      r.t = Math.min(r.t + dt / 2.6, 1);
      r.uni.uReveal.value = THREE.MathUtils.lerp(r.from, r.to, ease(r.t)) + (r.t >= 1 ? 99 : 0);
    });

    // portalul se aprinde la final
    this.portalUni.uPower.value = THREE.MathUtils.smoothstep(this.smoothProgress, 0.8, 1);
    this.bloom.strength = 0.85 + this.portalUni.uPower.value * 0.6;

    this.finalPass.uniforms.uVel.value = this.velocity;
    this.finalPass.uniforms.uTime.value = t;
    this.composer.render();
    return { pos, smooth: this.smoothProgress };
  }
}
