// The Research page's seafloor in three.js: terraces with lit tops and darker risers, a glowing
// contour along the top edge of every riser and a slow shimmer across the tops, stacked-slab
// formations, line-drawn jellyfish, the little blue crabs on the ledges, and drifting plankton. The
// layout (terrain, formations, where every creature goes) comes from src/lib/seafloor.ts, which
// scripts/check-seafloor.mjs tests so nothing passes through a terrace or a formation.
//
// This module is loaded only on /research/, only near the viewport and only when motion is
// welcome (src/scripts/seafloor.ts decides). With `still`, it renders one fixed frame and stops:
// render-assets uses that for the fallback image.
import * as THREE from 'three';
import { height, levels, heightFromLevels, LEV, STEP, viewer, slabs, jellies, jellyAt, crabs, crabAt, CRAB } from '../lib/seafloor';

// Bioluminescent colors. The scene is the deep sea in both themes, so they do not follow the page.
const C = {
  bg: 0x03080b,
  fog: 0x050d12,
  low: 0x07171c,
  high: 0x2f6e70,
  glow: 0x7cf2e0,
  caustic: 0x8ef5e4,
  jelly: [0xeba8c4, 0xc6b0ea, 0x7ccac3],
  crab: 0x6fb6ff,
  claw: 0xff8a7a,
  plankton: 0x8ef5e4,
};

export interface SeafloorOptions {
  /** Render one fixed frame and stop (the still image). */
  still?: boolean;
}

export function mountSeafloorScene(host: HTMLElement, opts: SeafloorOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.className = 'sea__gl';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 600);

  // ---- Terrain: a polar mesh centered on the viewer. The rings are close together near the ledge
  // and spread out with distance, so the near risers are smooth curves and far ones stay cheap.
  // Ring radii: geometric from the viewer's feet until the gap reaches 0.45, then even steps, so
  // even the far walls have rings close enough for smooth contours.
  const radii: number[] = [];
  for (let r = 0.4; r < 170; r = Math.min(r * 1.03, r + 0.45)) radii.push(r);
  const RINGS = radii.length;
  const SEGS = host.clientWidth < 700 ? 512 : 768; // fewer on phones, where the view is narrow
  const verts = new Float32Array((RINGS * SEGS + 1) * 3);
  const lvls = new Float32Array(RINGS * SEGS + 1);
  lvls[0] = levels(viewer.x, viewer.z);
  verts.set([viewer.x, heightFromLevels(lvls[0]), viewer.z], 0);
  for (let i = 0; i < RINGS; i++) {
    const r = radii[i];
    for (let k = 0; k < SEGS; k++) {
      const a = (k / SEGS) * Math.PI * 2;
      const x = viewer.x + Math.cos(a) * r;
      const z = viewer.z + Math.sin(a) * r;
      const n = 1 + i * SEGS + k;
      const l = levels(x, z);
      lvls[n] = l;
      verts[n * 3] = x;
      verts[n * 3 + 1] = heightFromLevels(l);
      verts[n * 3 + 2] = z;
    }
  }
  const index: number[] = [];
  for (let k = 0; k < SEGS; k++) index.push(0, 1 + ((k + 1) % SEGS), 1 + k);
  for (let i = 0; i < RINGS - 1; i++) {
    for (let k = 0; k < SEGS; k++) {
      const a = 1 + i * SEGS + k;
      const b = 1 + i * SEGS + ((k + 1) % SEGS);
      const c = a + SEGS;
      const d = b + SEGS;
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('aLev', new THREE.BufferAttribute(lvls, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();

  const uni = {
    uTime: { value: 0 },
    uStep: { value: STEP },
    uL: { value: LEV },
    uLow: { value: new THREE.Color(C.low) },
    uHigh: { value: new THREE.Color(C.high) },
    uGlow: { value: new THREE.Color(C.glow) },
    uCC: { value: new THREE.Color(C.caustic) },
    uFog: { value: new THREE.Color(C.fog) },
    uLight: { value: new THREE.Vector3(0.35, 1, 0.25).normalize() },
  };
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `uniform float uStep; attribute float aLev; varying float vLev; varying vec3 vN; varying vec3 vW; varying vec3 vV;
      void main(){
        #ifdef TERRAIN
        vLev=aLev;
        #else
        vLev=position.y/uStep;
        #endif
        vN=normal; vW=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime,uStep,uL; uniform vec3 uLow,uHigh,uGlow,uCC,uFog,uLight;
      varying float vLev; varying vec3 vN; varying vec3 vW; varying vec3 vV;
      void main(){
        vec3 n=normalize(vN);
        float fr=fract(vLev);
        float lev=floor(vLev+0.03)/uL;
        vec3 base=mix(uLow,uHigh,clamp(lev,0.0,1.0));
        float riser=1.0-smoothstep(0.5,0.9,n.y);
        #ifdef TERRAIN
        // On the terrain the riser is the top 45% of each level of the smooth field (see height()),
        // so its edges are as smooth as the field.
        float edge=smoothstep(0.93,0.985,fr)*(1.0-smoothstep(0.994,1.0,fr));
        riser=max(riser*0.6,smoothstep(0.56,0.62,fr)*(1.0-smoothstep(0.985,1.0,fr)));
        #else
        float edge=smoothstep(0.82,0.95,fr)*(1.0-smoothstep(0.985,1.0,fr));
        #endif
        float lam=max(dot(n,uLight),0.0);
        vec3 col=base*(0.35+0.9*lam);
        col=mix(col,base*0.36,riser);
        // The glowing contour (edge, above): the last stretch of each riser, under the next lip.
        float pulse=0.75+0.25*sin(uTime*0.8-lev*9.0);
        col+=uGlow*edge*1.05*pulse*(0.6+0.8*lev);
        // The slow shimmer across the terrace tops.
        vec2 p=vW.xz*0.22;
        float c=sin(p.x*3.1+uTime*1.1)+sin(p.y*2.7-uTime*0.9)+sin((p.x+p.y)*2.2+uTime*0.7);
        col+=uCC*pow(max(c/3.0,0.0),3.0)*0.22*(1.0-riser)*(0.4+lev);
        float d=length(vV); float f=1.0-exp(-d*d*0.0098*0.0098);
        gl_FragColor=vec4(mix(col,uFog,f),1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, terrainMat));
  terrainMat.defines = { TERRAIN: '' };
  // The formations share the uniforms; their levels come straight from height.
  const slabMat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: terrainMat.vertexShader, fragmentShader: terrainMat.fragmentShader });

  // ---- Formations: every slab is a short prism on the terrace grid, lit like the terraces.
  const slabGeos = slabs.map((s) => {
    const g = new THREE.CylinderGeometry(s.r * 0.97, s.r, s.y1 - s.y0, s.sides, 1);
    g.rotateY(s.rot);
    g.translate(s.x, (s.y0 + s.y1) / 2, s.z);
    return g;
  });
  for (const g of slabGeos) scene.add(new THREE.Mesh(g, slabMat));

  // ---- Plankton.
  const P = 1800;
  const pArr = new Float32Array(P * 3);
  let seed = 9;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < P; i++) {
    pArr[i * 3] = viewer.x + (r() - 0.5) * 170;
    pArr[i * 3 + 1] = 1 + r() * 55;
    pArr[i * 3 + 2] = viewer.z + (r() - 0.5) * 170;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  const plankton = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: C.plankton, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  plankton.position.set(viewer.x, 0, viewer.z);
  pGeo.translate(-viewer.x, 0, -viewer.z);
  scene.add(plankton);

  // ---- Jellyfish, upright, drawn in lines: a bell of meridians and rings, and swaying tentacles.
  const additive = (color: number, opacity = 0.95) =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const jellyMats = C.jelly.map((c) => additive(c));
  const TP = 30;
  const jellyObjs = jellies.map((j) => {
    const mat = jellyMats[j.color];
    const grp = new THREE.Group();
    const bell = new THREE.Group();
    grp.add(bell);
    for (let k = 0; k < 12; k++) {
      const phi = (k / 12) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 0.52;
        pts.push(new THREE.Vector3(Math.sin(a) * Math.cos(phi), Math.cos(a) * 0.72, Math.sin(a) * Math.sin(phi)));
      }
      bell.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    for (const yy of [0, 0.32, 0.56]) {
      const rad = yy === 0 ? 1 : Math.sqrt(Math.max(0, 1 - (yy / 0.72) ** 2));
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * rad, yy + (yy === 0 ? 0.04 * Math.sin(t * 8) : 0), Math.sin(t) * rad));
      }
      bell.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    const tents = Array.from({ length: 10 }, (_, k) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TP * 3), 3));
      grp.add(new THREE.Line(g, mat));
      // Lengths up to 4.0; outer ones hang at 1.3x, so the longest reaches 5.2 (JELLY.below).
      return { g, phi: (k / 10) * Math.PI * 2, len: 2.4 + (((k * 37) % 10) / 10) * 1.6, inner: k % 3 === 0 };
    });
    grp.scale.setScalar(j.s);
    scene.add(grp);
    return { j, grp, bell, tents };
  });
  const animJelly = (o: (typeof jellyObjs)[number], t: number) => {
    const p = jellyAt(o.j, t);
    o.bell.scale.set(1 + 0.08 * p.pulse, 1 - 0.1 * p.pulse, 1 + 0.08 * p.pulse);
    o.grp.position.set(p.x, p.y, p.z);
    for (const tn of o.tents) {
      const arr = tn.g.attributes.position.array as Float32Array;
      const rad = tn.inner ? 0.25 : 0.9;
      for (let i = 0; i < TP; i++) {
        const v = i / (TP - 1);
        const sway = Math.sin(t * 1.2 + o.j.ph + v * 4 + tn.phi) * 0.35 * v;
        arr[i * 3] = Math.cos(tn.phi) * rad * (1 - v * 0.3) + sway;
        arr[i * 3 + 1] = -v * tn.len * (tn.inner ? 0.8 : 1.3);
        arr[i * 3 + 2] = Math.sin(tn.phi) * rad * (1 - v * 0.3) + Math.cos(t + v * 3 + tn.phi) * 0.25 * v;
      }
      tn.g.attributes.position.needsUpdate = true;
    }
  };

  // ---- The little blue crabs, in lines: a shell, eight walking legs and two claws.
  const bodyMat = additive(C.crab, 1);
  const clawMat = additive(C.claw, 1);
  const crabObjs = crabs.map((c) => {
    const grp = new THREE.Group();
    const shell: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const rx = 1.6 + 0.55 * Math.pow(Math.abs(Math.cos(t)), 6);
      shell.push(new THREE.Vector3(Math.cos(t) * rx, 0.25, Math.sin(t) * 0.75));
    }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(shell), bodyMat));
    const legs: { g: THREE.BufferGeometry; sd: number; k: number }[] = [];
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
        grp.add(new THREE.Line(g, k === 3 ? clawMat : bodyMat));
        legs.push({ g, sd, k });
      }
      const claw = [
        [0.7, 0.25, 0.7],
        [1.1, 0.35, 1.6],
        [0.5, 0.4, 2.2],
        [0.15, 0.35, 2.0],
        [0.55, 0.38, 2.3],
      ].map(([x, y, z]) => new THREE.Vector3(sd * x, y, z));
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(claw), clawMat));
    }
    grp.scale.setScalar(CRAB.scale);
    scene.add(grp);
    return { c, grp, legs };
  });
  const animCrab = (o: (typeof crabObjs)[number], t: number) => {
    const p = crabAt(o.c, t);
    o.grp.position.set(p.x, p.y, p.z);
    for (const L of o.legs) {
      const z0 = -0.5 + L.k * 0.35;
      const sw = Math.sin(t * 6 + L.k * 1.3 + (L.sd > 0 ? 0 : Math.PI)) * 0.25;
      (L.g.attributes.position.array as Float32Array).set([L.sd * 1.4, 0.25, z0, L.sd * 2.3, 0.6, z0 - 0.3 + sw, L.sd * 2.9, 0, z0 - 0.6 + sw * 1.4]);
      L.g.attributes.position.needsUpdate = true;
    }
  };

  // ---- Camera: standing on the ledge. Drag or the arrow keys look around.
  const cam = { yaw: 0.25, pitch: -0.16 };
  const clampPitch = (p: number) => Math.max(-1.3, Math.min(1.25, p));
  const look = new THREE.Vector3();
  camera.position.set(viewer.x, viewer.eye, viewer.z);
  const aim = () => {
    look.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(look.add(camera.position));
  };

  const size = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 600 ? 80 : 68;
    camera.updateProjectionMatrix();
  };

  const t0 = performance.now();
  let tNow = 4;
  const draw = () => {
    uni.uTime.value = tNow;
    jellyObjs.forEach((o) => animJelly(o, tNow));
    crabObjs.forEach((o) => animCrab(o, tNow));
    plankton.rotation.y = tNow * 0.01;
    plankton.position.y = Math.sin(tNow * 0.2) * 0.6;
    aim();
    renderer.render(scene, camera);
  };

  size();
  if (opts.still) {
    new ResizeObserver(() => {
      size();
      draw();
    }).observe(host);
    draw();
    host.dataset.ready = 'still';
    return { draw, cam, clampPitch, setAnimating: () => {}, dispose: () => {} };
  }

  // ---- Interaction and the loop.
  let dragging = false;
  let lx = 0;
  let ly = 0;
  let idle = 0;
  let animating = true;
  host.addEventListener('pointerdown', (e) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    cam.yaw -= (e.clientX - lx) * 0.004;
    cam.pitch = clampPitch(cam.pitch + (e.clientY - ly) * 0.003);
    lx = e.clientX;
    ly = e.clientY;
    idle = 0;
    if (!animating) draw();
  });
  const up = () => (dragging = false);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('keydown', (e) => {
    const k = ({ ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] } as Record<string, number[]>)[e.key];
    if (!k) return;
    e.preventDefault();
    cam.yaw += k[0];
    cam.pitch = clampPitch(cam.pitch + k[1]);
    idle = 0;
    if (!animating) draw();
  });

  // One loop that runs only while the scene is on screen and the tab is visible.
  let onScreen = true;
  let raf = 0;
  const loop = () => {
    raf = 0;
    if (!animating || !onScreen || document.hidden) return;
    tNow = (performance.now() - t0) / 1000 + 4;
    if (!dragging && ++idle > 150) cam.yaw += 0.0007;
    draw();
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf && animating && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    kick();
  });
  io.observe(host);
  document.addEventListener('visibilitychange', kick);
  const ro = new ResizeObserver(() => {
    size();
    draw();
  });
  ro.observe(host);
  kick();

  return {
    draw,
    cam,
    clampPitch,
    /** Stop or restart the motion (reduced motion turned on or off while the page is open). */
    setAnimating(on: boolean) {
      animating = on;
      if (on) kick();
      else draw();
    },
    dispose() {
      animating = false;
      io.disconnect();
      ro.disconnect();
      renderer.dispose();
    },
  };
}
