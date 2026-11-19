/* Page d'accueil : mots qui défilent, apparitions au défilement, inclinaison 3D des cartes,
   et animation 2D de secours (réseau de particules) si la 3D n'est pas disponible. */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Mots du héros */
  const words = ["Robotique collaborative", "Réalité virtuelle et augmentée", "Jumeaux numériques", "IA embarquée (Edge AI)", "Vision par ordinateur", "IoT industriel", "Industrie 4.0 et 5.0"];
  const w = document.getElementById("rot-word");
  if (w && !reduce) {
    let i = 0, j = words[0].length, del = true;
    const tick = () => {
      const target = words[i];
      if (del) { j--; w.textContent = target.slice(0, j) || " "; if (j <= 0) { del = false; i = (i + 1) % words.length; } setTimeout(tick, 35); }
      else { j++; w.textContent = words[i].slice(0, j); if (j >= words[i].length) { del = true; setTimeout(tick, 1900); } else setTimeout(tick, 60); }
    };
    setTimeout(tick, 2200);
  }

  /* Apparitions au défilement */
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((el, k) => { el.style.transitionDelay = `${(k % 4) * 90}ms`; io.observe(el); });
  } else els.forEach((el) => el.classList.add("in"));

  /* Inclinaison 3D au survol */
  if (!reduce && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".tech-card, .tilt").forEach((c) => {
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
      });
      c.addEventListener("pointerleave", () => { c.style.transform = ""; });
    });
  }

  /* Secours 2D : réseau de nœuds connectés (si WebGL indisponible) */
  const cv = document.getElementById("hero2d");
  if (!cv) return;
  const ctx = cv.getContext("2d"); let W, H, P = [];
  const size = () => { const r = cv.getBoundingClientRect(); W = cv.width = r.width * devicePixelRatio; H = cv.height = r.height * devicePixelRatio;
    P = Array.from({ length: Math.round((r.width * r.height) / 14000) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 })); };
  size(); window.addEventListener("resize", size);
  const draw = () => {
    if (document.getElementById("hero3d").classList.contains("ready")) return; // la 3D a pris le relais
    ctx.clearRect(0, 0, W, H); const d = 130 * devicePixelRatio;
    P.forEach((p) => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; });
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) { const dx = P[a].x - P[b].x, dy = P[a].y - P[b].y, q = Math.hypot(dx, dy); if (q < d) { ctx.strokeStyle = `rgba(90,169,255,${(1 - q / d) * 0.45})`; ctx.lineWidth = devicePixelRatio; ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke(); } }
    P.forEach((p, k) => { ctx.fillStyle = k % 7 ? "rgba(56,217,245,.9)" : "rgba(228,81,63,.95)"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * devicePixelRatio, 0, 7); ctx.fill(); });
    if (!reduce) requestAnimationFrame(draw);
  };
  draw();
})();
