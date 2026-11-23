/* Hero 3D: a night city of short-stay apartments. Windows light up ember as nights get booked; sparks rise. */
(() => {
  const canvas = document.getElementById("hero3d");
  if (!canvas || !window.THREE) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return; }
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || innerWidth < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06080e, 0.028);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  const EMBER = new THREE.Color(0xff7a3d), GOLD = new THREE.Color(0xffb547), COOL = new THREE.Color(0x86c8ff);
  const root = new THREE.Group(); scene.add(root);

  scene.add(new THREE.AmbientLight(0x8090c0, 0.35));
  const key = new THREE.PointLight(0xff8a4a, 2.2, 60); key.position.set(6, 10, 8); scene.add(key);
  const rim = new THREE.PointLight(0x6fb6ff, 1.2, 60); rim.position.set(-10, 6, -6); scene.add(rim);

  // ground grid
  const grid = new THREE.GridHelper(120, 80, 0x2a3350, 0x161c2e);
  grid.material.transparent = true; grid.material.opacity = 0.55; root.add(grid);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.09, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01; root.add(glow);

  // building helper: body + edges + instanced windows
  const winGeo = new THREE.PlaneGeometry(0.34, 0.42);
  const windows = []; // {mesh, count, lit[], phase[]}
  function building(x, z, w, d, floors, hero) {
    const fh = 0.9, h = floors * fh;
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: hero ? 0x10162a : 0x0b1020, metalness: 0.6, roughness: 0.35 }));
    body.position.y = h / 2; g.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: hero ? 0xff9a5c : 0x2b3654, transparent: true, opacity: hero ? 0.75 : 0.5 }));
    edges.position.y = h / 2; g.add(edges);
    if (hero) { // floor slabs = 9 modules
      for (let f = 1; f < floors; f++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.05, d + 0.18), new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.35 }));
        slab.position.y = f * fh; g.add(slab);
      }
    }
    const cols = Math.max(2, Math.floor(w / 0.6)), colsD = Math.max(2, Math.floor(d / 0.6));
    const slots = [];
    for (let f = 0; f < floors; f++) {
      const y = f * fh + fh * 0.55;
      for (let c = 0; c < cols; c++) { const px = -w / 2 + (c + 0.5) * (w / cols); slots.push([px, y, d / 2 + 0.01, 0]); slots.push([px, y, -d / 2 - 0.01, Math.PI]); }
      for (let c = 0; c < colsD; c++) { const pz = -d / 2 + (c + 0.5) * (d / colsD); slots.push([w / 2 + 0.01, y, pz, Math.PI / 2]); slots.push([-w / 2 - 0.01, y, pz, -Math.PI / 2]); }
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, toneMapped: false });
    const mesh = new THREE.InstancedMesh(winGeo, mat, slots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
    const lit = [], phase = [];
    slots.forEach((p, i) => {
      e.set(0, p[3], 0); q.setFromEuler(e); m.compose(new THREE.Vector3(p[0], p[1], p[2]), q, s); mesh.setMatrixAt(i, m);
      lit.push(Math.random() < (hero ? 0.35 : 0.18) ? 1 : 0); phase.push(Math.random() * 100);
    });
    g.add(mesh); root.add(g);
    windows.push({ mesh, count: slots.length, lit, phase, hero, cur: new Float32Array(slots.length) });
    return g;
  }

  const hero = building(0, 0, 3.2, 2.4, 9, true);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const spots = [[-5.5, -2], [5, -3.5], [-4, 4], [4.6, 3.6], [-8.5, 1.5], [8.2, 0.5], [0, -7], [-7.5, -6.5], [7.5, -7], [-2.5, 7.5], [3, 8], [-11, -3], [11, -2.5]];
  spots.forEach(([x, z]) => building(x + rnd(-0.6, 0.6), z + rnd(-0.6, 0.6), rnd(1.4, 2.6), rnd(1.4, 2.4), Math.round(rnd(3, 7)), false));

  // booked-night ring around the hero tower (30 nights)
  const ring = new THREE.Group(); ring.position.y = 9 * 0.9 + 0.9; root.add(ring);
  const tiles = [];
  for (let i = 0; i < 30; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ color: 0x2a3350, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false }));
    const a = (i / 30) * Math.PI * 2; t.position.set(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1); t.lookAt(0, 0, 0);
    ring.add(t); tiles.push(t);
  }

  // rising sparks
  const N = lowPower ? 260 : 600;
  const pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-14, 14); pos[i * 3 + 1] = rnd(0, 16); pos[i * 3 + 2] = rnd(-12, 10); spd[i] = rnd(0.2, 0.9); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement("canvas"); dot.width = dot.height = 64; const dc = dot.getContext("2d");
  const gr = dc.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,200,140,1)"); gr.addColorStop(0.3, "rgba(255,122,61,.8)"); gr.addColorStop(1, "rgba(255,122,61,0)");
  dc.fillStyle = gr; dc.fillRect(0, 0, 64, 64);
  const sparks = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(sparks);

  // layout: tower sits right on desktop, centered and dimmer on phones
  let mobile = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    mobile = w < 900;
    root.position.x = mobile ? 0 : 6.5;
    canvas.style.opacity = mobile ? 0.45 : 1;
  }
  addEventListener("resize", resize); resize();

  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);

  const col = new THREE.Color(), off = new THREE.Color(0x1a2133);
  let booked = 0, last = 0;
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    const ang = (reduce ? 0.6 : t * 0.07) + mx * 0.6;
    const R = mobile ? 30 : 29;
    camera.position.set(Math.sin(ang) * R + (mobile ? 0 : 6.5), 8.5 + my * -3, Math.cos(ang) * R);
    camera.lookAt(mobile ? 0 : 3.2, 4.6, 0);

    // windows: randomly book/unbook, hero tower trends to full
    if (t - last > 0.12) {
      last = t;
      windows.forEach((W) => {
        const i = (Math.random() * W.count) | 0;
        W.lit[i] = Math.random() < (W.hero ? 0.72 : 0.3) ? 1 : 0;
      });
      booked = (booked + 1) % 60;
    }
    windows.forEach((W) => {
      for (let i = 0; i < W.count; i++) {
        W.cur[i] += (W.lit[i] - W.cur[i]) * 0.08;
        const flick = 0.85 + 0.15 * Math.sin(t * 3 + W.phase[i]);
        col.copy(off).lerp(W.hero ? (i % 5 === 0 ? GOLD : EMBER) : (i % 4 === 0 ? COOL : EMBER), W.cur[i] * flick);
        W.mesh.setColorAt(i, col);
      }
      W.mesh.instanceColor.needsUpdate = true;
    });
    // night tiles fill one by one
    const n = booked < 30 ? booked : 60 - booked;
    tiles.forEach((tl, i) => tl.material.color.lerp(i < n ? EMBER : off, 0.15));
    ring.rotation.y = t * 0.25;
    ring.position.y = 9 * 0.9 + 0.9 + Math.sin(t * 0.8) * 0.15;

    const p = pg.attributes.position.array;
    for (let i = 0; i < N; i++) {
      p[i * 3 + 1] += spd[i] * 0.02 * (reduce ? 0 : 1);
      p[i * 3] += Math.sin(t + i) * 0.002;
      if (p[i * 3 + 1] > 16) p[i * 3 + 1] = 0;
    }
    pg.attributes.position.needsUpdate = true;
    glow.material.opacity = 0.07 + Math.sin(t * 1.5) * 0.03;
    renderer.render(scene, camera);
  }
  frame();
})();
