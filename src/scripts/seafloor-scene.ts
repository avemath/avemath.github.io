// The Research page's seafloor in three.js, behind the whole page: terraces with lit tops and
// darker risers, a glowing contour along the top edge of every riser and a slow shimmer across the
// tops, stacked-slab formations, line-drawn jellyfish, the little blue crabs on the ledges, light
// shafts, and drifting plankton. The layout (terrain, formations, where every creature goes, the
// camera's way down) comes from src/lib/seafloor.ts, which scripts/check-seafloor.mjs tests so
// nothing passes through a terrace or a formation.
//
// Depth (0 at the top of the page, 1 at the bottom) moves the camera down the slope and shifts the
// water from shallow and murky green, with light shafts, like Barataria Bay, to dark water that
// glows. The page's scroll sets the depth; dragging on open water turns the view (see
// src/scripts/seafloor.ts, which also decides whether this module loads at all). With `still`, it
// renders one fixed frame at the given depth and stops: render-assets uses that for the images.
import * as THREE from 'three';
import { levels, heightFromLevels, LEV, STEP, viewer, slabs, jellies, jellyAt, crabs, crabAt, CRAB, cameraAt } from '../lib/seafloor';

// The water at the top of the page (shallow, murky green, sunlit) and at the bottom (deep, dark,
// bioluminescent). The scene keeps its own colors in both themes.
const SHALLOW = { bg: 0x40593f, low: 0x2c4232, high: 0x6f8a5e, glow: 0x9fe0b8, glowAmt: 0.14, caustic: 0xeef2c4, causticAmt: 0.55, fog: 0.021 };
const DEEP = { bg: 0x03080b, low: 0x07171c, high: 0x2f6e70, glow: 0x7cf2e0, glowAmt: 1.05, caustic: 0x8ef5e4, causticAmt: 0.22, fog: 0.0098 };
const C = {
  jelly: [0xeba8c4, 0xc6b0ea, 0x7ccac3],
  crab: 0x6fb6ff,
  claw: 0xff8a7a,
  plankton: 0x8ef5e4,
  shaft: 0xf4f0c8,
};
const mixC = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export interface SeafloorOptions {
  /** Render one fixed frame and stop (the still images). */
  still?: boolean;
  /** Depth for a still frame, 0 to 1. */
  depth?: number;
  /** Fraction of the device pixel ratio to render at (phones use less). */
  scale?: number;
  /** Leave the light shafts out (the home page's still of the deep). */
  noShafts?: boolean;
  /** Pitch for a still frame, radians. */
  pitch?: number;
}

export function mountSeafloorScene(host: HTMLElement, opts: SeafloorOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !opts.scale || opts.scale >= 1, preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * (opts.scale ?? 1));
  const canvas = renderer.domElement;
  canvas.className = 'sea__gl';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DEEP.bg);
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
    uLow: { value: new THREE.Color(DEEP.low) },
    uHigh: { value: new THREE.Color(DEEP.high) },
    uGlow: { value: new THREE.Color(DEEP.glow) },
    uCC: { value: new THREE.Color(DEEP.caustic) },
    uFog: { value: new THREE.Color(DEEP.bg) },
    uGlowAmt: { value: DEEP.glowAmt },
    uCausticAmt: { value: DEEP.causticAmt },
    uFogD: { value: DEEP.fog },
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
    fragmentShader: `uniform float uTime,uStep,uL,uGlowAmt,uCausticAmt,uFogD; uniform vec3 uLow,uHigh,uGlow,uCC,uFog,uLight;
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
        col+=uGlow*edge*uGlowAmt*pulse*(0.6+0.8*lev);
        // The slow shimmer across the terrace tops.
        vec2 p=vW.xz*0.22;
        float c=sin(p.x*3.1+uTime*1.1)+sin(p.y*2.7-uTime*0.9)+sin((p.x+p.y)*2.2+uTime*0.7);
        col+=uCC*pow(max(c/3.0,0.0),3.0)*uCausticAmt*(1.0-riser)*(0.4+lev);
        float d=length(vV); float f=1.0-exp(-d*d*uFogD*uFogD);
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
  // Spread along the whole way down, from the rim to the basin.
  for (let i = 0; i < P; i++) {
    pArr[i * 3] = viewer.x + (r() - 0.5) * 150;
    pArr[i * 3 + 1] = 1 + r() * 62;
    pArr[i * 3 + 2] = viewer.z + (r() - 0.5) * 150;
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

  // ---- Light shafts from the surface, strongest in the shallows and gone by the deep.
  const shafts = new THREE.Group();
  const shaftMat = new THREE.MeshBasicMaterial({ color: C.shaft, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    // Tall enough that their tops are always above the view.
    const h = 150;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1 + r() * 1.5, 4 + r() * 4, h, 14, 1, true), shaftMat);
    m.position.set((r() - 0.5) * 80, 130 - h / 2, 40 + r() * 70);
    m.rotation.z = 0.16;
    m.rotation.x = 0.07;
    shafts.add(m);
  }
  scene.add(shafts);

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

  // ---- Camera: on the way down. Depth comes from the page; yaw and pitch from dragging.
  const cam = { yaw: 0, pitch: opts.pitch ?? -0.22, depth: opts.depth ?? 0 };
  const clampPitch = (p: number) => Math.max(-1.3, Math.min(1.25, p));
  const look = new THREE.Vector3();
  const aim = () => {
    const c = cameraAt(cam.depth);
    camera.position.set(c.x, c.y, c.z);
    look.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.lookAt(look.add(camera.position));
  };
  /** The water's colors at a depth: murky green and sunlit at the top, dark and glowing below. */
  const tint = (d: number) => {
    const t = Math.min(1, Math.max(0, d)) ** 0.85;
    const bg = mixC(SHALLOW.bg, DEEP.bg, t);
    (scene.background as THREE.Color).copy(bg);
    uni.uFog.value.copy(bg);
    uni.uLow.value.copy(mixC(SHALLOW.low, DEEP.low, t));
    uni.uHigh.value.copy(mixC(SHALLOW.high, DEEP.high, t));
    uni.uGlow.value.copy(mixC(SHALLOW.glow, DEEP.glow, t));
    uni.uCC.value.copy(mixC(SHALLOW.caustic, DEEP.caustic, t));
    uni.uGlowAmt.value = SHALLOW.glowAmt + (DEEP.glowAmt - SHALLOW.glowAmt) * t;
    uni.uCausticAmt.value = SHALLOW.causticAmt + (DEEP.causticAmt - SHALLOW.causticAmt) * t;
    uni.uFogD.value = SHALLOW.fog + (DEEP.fog - SHALLOW.fog) * t;
    shaftMat.opacity = 0.05 * (1 - t) ** 1.6;
    shafts.visible = !opts.noShafts && shaftMat.opacity > 0.003;
    (plankton.material as THREE.PointsMaterial).opacity = 0.35 + 0.55 * t;
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
    tint(cam.depth);
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
    return { draw, cam, clampPitch, setDepth: () => {}, look: () => {}, setAnimating: () => {}, dispose: () => {} };
  }

  // ---- The loop: one rAF while animating and the tab is visible. Scrolling and dragging only
  // change cam; the next frame draws it. Left alone, the view drifts slowly round.
  let animating = true;
  let idle = 0;
  let raf = 0;
  const loop = () => {
    raf = 0;
    if (!animating || document.hidden) return;
    tNow = (performance.now() - t0) / 1000 + 4;
    if (++idle > 240) cam.yaw += 0.0005;
    draw();
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf && animating && !document.hidden) raf = requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', kick);
  const ro = new ResizeObserver(() => {
    size();
    draw();
  });
  ro.observe(host);
  kick();

  // For the tests: where the camera looks.
  (window as unknown as { __seafloor: unknown }).__seafloor = { cam };

  return {
    draw,
    cam,
    clampPitch,
    /** Page depth, 0 at the top and 1 at the bottom. */
    setDepth(d: number) {
      cam.depth = Math.min(1, Math.max(0, d));
      if (!animating) draw();
    },
    /** Turn the view by a yaw and pitch step (radians). */
    look(dyaw: number, dpitch: number) {
      cam.yaw += dyaw;
      cam.pitch = clampPitch(cam.pitch + dpitch);
      idle = 0;
      if (!animating) draw();
    },
    /** Stop or restart the motion (reduced motion turned on or off while the page is open). */
    setAnimating(on: boolean) {
      animating = on;
      if (on) kick();
      else draw();
    },
    dispose() {
      animating = false;
      ro.disconnect();
      renderer.dispose();
    },
  };
}
