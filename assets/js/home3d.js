/* ==========================================================================
   Page d'accueil : scène 3D « usine intelligente » (Three.js)
   - bras robotique industriel en mouvement (prise et dépose) ;
   - son jumeau numérique filaire qui le suit en temps réel ;
   - flux de données entre le réel et le virtuel ;
   - puce d'IA embarquée (Edge AI) et réseau de neurones lumineux ;
   - casque de réalité virtuelle en orbite.
   ========================================================================== */
import * as THREE from "./vendor/three.module.min.js";

const host = document.getElementById("hero3d");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }

if (host && webglOK()) {
  const NAVY = 0x0b2e5f, CORAL = 0xe4513f, CYAN = 0x38d9f5, BLUE = 0x1c5aa6;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x061a38, 14, 34);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const camBase = new THREE.Vector3(0, 5.6, 18);
  let focusX = 0, focusY = 2.9; // décale la scène vers la droite sur grand écran (le texte reste lisible à gauche)
  camera.position.copy(camBase);

  /* Lumières */
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x0b1a33, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 9, 6); scene.add(key);
  const rim = new THREE.PointLight(CYAN, 30, 18); rim.position.set(4.5, 3, -2); scene.add(rim);
  const warm = new THREE.PointLight(CORAL, 22, 14); warm.position.set(-4, 2.5, 3); scene.add(warm);

  /* Sol : grille lumineuse + disques */
  const grid = new THREE.GridHelper(40, 40, 0x2b6cc4, 0x123a6e); grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide });
  const padL = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 64), ringMat(CORAL, 0.8)); padL.rotation.x = -Math.PI / 2; padL.position.set(-3.2, 0.01, 0); scene.add(padL);
  const padR = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 64), ringMat(CYAN, 0.8)); padR.rotation.x = -Math.PI / 2; padR.position.set(3.2, 0.01, 0); scene.add(padR);
  const scan = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.18, 64), ringMat(CYAN, 0.6)); scan.rotation.x = -Math.PI / 2; scan.position.set(3.2, 0.02, 0); scene.add(scan);

  /* ---------- Bras robotique (réel) et son jumeau numérique (filaire) ---------- */
  function makeArm(twin) {
    const metal = twin ? new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.55 })
      : new THREE.MeshStandardMaterial({ color: 0xeef3fb, metalness: 0.55, roughness: 0.32 });
    const accent = twin ? new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.9 })
      : new THREE.MeshStandardMaterial({ color: CORAL, metalness: 0.4, roughness: 0.35, emissive: 0x3a0d06 });
    const dark = twin ? accent : new THREE.MeshStandardMaterial({ color: 0x1a2c48, metalness: 0.6, roughness: 0.4 });
    const seg = twin ? 10 : 32;
    const root = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.45, seg), dark); base.position.y = 0.22; root.add(base);
    const yaw = new THREE.Group(); yaw.position.y = 0.45; root.add(yaw);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.75, 0.55, seg), metal); turret.position.y = 0.27; yaw.add(turret);
    const shoulder = new THREE.Group(); shoulder.position.y = 0.72; yaw.add(shoulder);
    shoulder.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, seg, seg / 2), accent));
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.1, 0.5), metal); upper.position.y = 1.05; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = 2.1; shoulder.add(elbow);
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, seg, seg / 2), accent));
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.7, 0.4), metal); fore.position.y = 0.85; elbow.add(fore);
    const wrist = new THREE.Group(); wrist.position.y = 1.7; elbow.add(wrist);
    wrist.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, seg, seg / 2), accent));
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.35, seg), dark); head.position.y = 0.3; wrist.add(head);
    const fingers = [];
    [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.22), accent); f.position.set(0.14 * s, 0.62, 0); wrist.add(f); fingers.push(f); });
    return { root, yaw, shoulder, elbow, wrist, fingers };
  }
  const real = makeArm(false); real.root.position.set(-3.2, 0, 0); scene.add(real.root);
  const twin = makeArm(true); twin.root.position.set(3.2, 0, 0); twin.root.scale.setScalar(1); scene.add(twin.root);

  /* Pièce manipulée */
  const part = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffc64d, metalness: 0.2, roughness: 0.4, emissive: 0x332000 }));
  scene.add(part);
  const partTwin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshBasicMaterial({ color: 0xffc64d, wireframe: true })); scene.add(partTwin);

  /* ---------- Flux de données réel → jumeau ---------- */
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.2, 1.6, 0), new THREE.Vector3(-1.5, 4.6, -0.8), new THREE.Vector3(0, 5.4, -1.2), new THREE.Vector3(1.5, 4.6, -0.8), new THREE.Vector3(3.2, 1.6, 0)]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.012, 6, false), new THREE.MeshBasicMaterial({ color: 0x4f8fe0, transparent: true, opacity: 0.35 })); scene.add(tube);
  const N = 70; const pPos = new Float32Array(N * 3); const pOff = Array.from({ length: N }, () => Math.random());
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(120,220,255,.9)"); r.addColorStop(1, "rgba(56,217,245,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(pts);

  /* ---------- Puce Edge AI + réseau de neurones ---------- */
  const chip = new THREE.Group(); chip.position.set(0, 5.9, -1.2); scene.add(chip);
  const die = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.5), new THREE.MeshStandardMaterial({ color: 0x14243f, metalness: 0.7, roughness: 0.3 })); chip.add(die);
  const coreMat = new THREE.MeshStandardMaterial({ color: CORAL, emissive: CORAL, emissiveIntensity: 1.2 });
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), coreMat); core.position.y = 0.14; chip.add(core);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.9, roughness: 0.25 });
  for (let i = 0; i < 7; i++) for (const [x, z, rx] of [[-0.6 + i * 0.2, 0.86, 0], [-0.6 + i * 0.2, -0.86, 0], [0.86, -0.6 + i * 0.2, 1], [-0.86, -0.6 + i * 0.2, 1]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(rx ? 0.24 : 0.06, 0.04, rx ? 0.06 : 0.24), pinMat); p.position.set(x, -0.04, z); chip.add(p);
  }
  const nnNodes = []; const nnGroup = new THREE.Group(); chip.add(nnGroup);
  const nodeMat = new THREE.MeshBasicMaterial({ color: CYAN });
  [[-1.9, 3], [0, 4], [1.9, 3]].forEach(([x, n], li) => { for (let k = 0; k < n; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), nodeMat.clone()); s.position.set(x * 0.9, 0.9 + (k - (n - 1) / 2) * 0.42, 0); nnGroup.add(s); nnNodes.push({ s, li }); } });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.35 });
  nnNodes.forEach((a) => nnNodes.forEach((b) => { if (b.li === a.li + 1) nnGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.s.position, b.s.position]), lineMat)); }));
  nnGroup.rotation.x = -0.15;

  /* ---------- Casque de réalité virtuelle en orbite ---------- */
  const vr = new THREE.Group(); scene.add(vr);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.55), new THREE.MeshStandardMaterial({ color: 0xf4f6fb, metalness: 0.2, roughness: 0.25 }));
  vr.add(shell);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x0c1a30, metalness: 0.8, roughness: 0.1, emissive: 0x0a3a6a, emissiveIntensity: 0.6 }));
  visor.position.z = 0.29; vr.add(visor);
  [-0.28, 0.28].forEach((x) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: CYAN })); l.position.set(x, 0, 0.325); vr.add(l); });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: NAVY })); strap.rotation.set(Math.PI / 2, 0, 0); strap.position.z = -0.2; vr.add(strap);
  vr.scale.setScalar(0.85);

  /* Particules d'ambiance */
  const SP = 260; const sPos = new Float32Array(SP * 3);
  for (let i = 0; i < SP; i++) { sPos[i * 3] = (Math.random() - 0.5) * 30; sPos[i * 3 + 1] = Math.random() * 12; sPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4; }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.08, color: 0x9cc7ff, transparent: true, opacity: 0.7, depthWrite: false })); scene.add(stars);

  /* ---------- Animation ---------- */
  const pose = (arm, t) => {
    // cycle de prise et dépose (8 s)
    const c = (t % 8) / 8; const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(x, 0), 1));
    const k = c < 0.5 ? ease(c * 2) : 1 - ease((c - 0.5) * 2);
    arm.yaw.rotation.y = -1.1 + 2.2 * k;
    const dip = Math.max(0, Math.sin(c * Math.PI * 4)) ** 3; // descente aux extrémités
    arm.shoulder.rotation.z = -0.35 - 0.25 * (1 - Math.abs(Math.sin(c * Math.PI * 2))) + 0.1 * Math.sin(t * 0.7);
    arm.elbow.rotation.z = -1.25 + 0.45 * Math.abs(Math.sin(c * Math.PI * 2));
    arm.wrist.rotation.z = -0.55;
    arm.wrist.rotation.y = t * 0.8;
    const grip = c > 0.02 && c < 0.48 ? 1 : 0;
    arm.fingers.forEach((f, i) => { f.position.x = (i ? 1 : -1) * (grip ? 0.24 : 0.14); });
    return { k, grip, dip };
  };
  const tmp = new THREE.Vector3();
  const mouse = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = (e.clientY / window.innerHeight) * 2 - 1; }, { passive: true });

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(host);
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 700 ? 54 : 38; focusX = w > 900 ? -3.1 * Math.min(1, w / 1500) : 0; focusY = w < 760 ? 0.2 : 2.9; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();

  const clock = new THREE.Clock(); let t = 0;
  const frame = () => {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05); t += reduce ? dt * 0.25 : dt;
    const r = pose(real, t); pose(twin, t - 0.35); // le jumeau suit avec un léger retard (latence réseau)
    // pièce tenue dans la pince
    const place = (arm, obj, rr) => {
      if (rr.grip) { arm.wrist.updateWorldMatrix(true, false); tmp.set(0, 0.62, 0); arm.wrist.localToWorld(tmp); obj.position.copy(tmp); obj.rotation.y = arm.yaw.rotation.y; }
      else { arm.root.updateWorldMatrix(true, false); tmp.set(1.1 * Math.cos(1.1), 0.21, 1.1 * Math.sin(1.1)); obj.position.copy(arm.root.localToWorld(tmp)); }
    };
    place(real, part, r); place(twin, partTwin, pose(twin, t - 0.35));
    // flux de données
    for (let i = 0; i < N; i++) { const u = (pOff[i] + t * 0.18) % 1; curve.getPointAt(u, tmp); pPos[i * 3] = tmp.x; pPos[i * 3 + 1] = tmp.y + Math.sin(t * 3 + i) * 0.04; pPos[i * 3 + 2] = tmp.z; }
    pGeo.attributes.position.needsUpdate = true;
    // puce IA
    chip.rotation.y = Math.sin(t * 0.5) * 0.5; chip.position.y = 5.9 + Math.sin(t * 1.3) * 0.12;
    coreMat.emissiveIntensity = 0.8 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4));
    nnNodes.forEach(({ s, li }, i) => { const v = 0.5 + 0.5 * Math.sin(t * 5 - li * 1.4 + i * 0.3); s.material.color.setRGB(0.2 + 0.8 * v, 0.6 + 0.3 * v, 1); s.scale.setScalar(0.8 + v * 0.6); });
    // casque VR en orbite
    const a = t * 0.45; vr.position.set(Math.cos(a) * 6.4, 3.4 + Math.sin(t * 0.9) * 0.4, Math.sin(a) * 3.2 - 1); vr.rotation.y = -a + Math.PI / 2; vr.rotation.z = Math.sin(t) * 0.15;
    // sol et ambiance
    scan.scale.setScalar(1 + ((t * 0.9) % 1) * 9); scan.material.opacity = 0.6 * (1 - ((t * 0.9) % 1));
    padL.material.opacity = 0.5 + 0.3 * Math.sin(t * 2); padR.material.opacity = 0.5 + 0.3 * Math.sin(t * 2 + 1);
    stars.rotation.y = t * 0.01;
    // caméra : parallaxe à la souris et léger travelling
    camera.position.x += ((camBase.x + focusX + mouse.x * 2.2 + Math.sin(t * 0.15) * 1.2) - camera.position.x) * 0.04;
    camera.position.y += ((camBase.y - mouse.y * 1.2) - camera.position.y) * 0.04;
    camera.lookAt(focusX, focusY, 0);
    renderer.render(scene, camera);
  };
  frame();
  host.classList.add("ready");
} else if (host) {
  host.classList.add("fallback");
}
