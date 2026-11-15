/* ==========================================================================
   Espace administrateur : journal détaillé des activités
   (connexions, consultations, contenus, appels, messages, séances Teams…)
   ========================================================================== */
const JState = { periode: "7", role: "users", action: "", user: "", q: "", tab: "journal", shown: 200, data: [], loadedFor: null };
const ROLE_LBL = { student: "Étudiant", prof: "Enseignant", admin: "Administrateur" };
const ACTION_CLS = (a) => /Suppression/.test(a) ? "off" : /Connexion|Déconnexion/.test(a) ? "sec" : /Consultation/.test(a) ? "draft" : /Publication|Création|créée|Message|Annonce|Appel/.test(a) ? "pub" : "t-cours";

const JournalData = {
  since(p) { if (p === "all") return ""; const d = new Date(); if (p === "0") d.setHours(0, 0, 0, 0); else d.setDate(d.getDate() - +p); return d.toISOString(); },
  async load(periode) {
    const since = this.since(periode);
    if (Store.mode !== "firebase") return (Store.data.logs || []).filter((e) => !since || e.date >= since).sort((a, b) => b.date.localeCompare(a.date));
    let q = Store.fs.collection("logs").orderBy("date", "desc");
    if (since) q = q.where("date", ">=", since);
    const snap = await q.limit(5000).get();
    return snap.docs.map((d) => d.data());
  },
  name(e) {
    if (e.nom) return e.nom;
    const col = e.role === "prof" ? "profs" : e.role === "student" ? "students" : "";
    const u = col && Store.get(col, e.userId);
    return u ? `${u.prenom} ${u.nom}` : e.role === "admin" ? "Administrateur" : e.email || e.userId || "—";
  },
  key: (e) => `${e.role}|${e.userId || e.uid}`,
  section(e) { if (e.role !== "student") return ""; const s = Store.get("students", e.userId); return s ? sectionOf(s) : ""; }
};

function JournalAdmin(el) {
  const draw = async () => {
    if (JState.loadedFor !== JState.periode) {
      el.innerHTML = `<div class="page-head"><h1>Journal d'activité</h1></div><div class="alert info">Chargement du journal…</div>`;
      try { JState.data = await JournalData.load(JState.periode); JState.loadedFor = JState.periode; }
      catch (e) { el.innerHTML = `<div class="page-head"><h1>Journal d'activité</h1></div><div class="alert">Lecture du journal impossible : ${esc(e.code === "permission-denied" ? "les règles Firestore du journal ne sont pas encore publiées." : e.message || e)}</div>`; return; }
    }
    const all = JState.data;
    const byRole = all.filter((e) => JState.role === "all" || (JState.role === "users" ? e.role !== "admin" : e.role === JState.role));
    const actions = [...new Set(all.map((e) => e.action))].sort();
    const users = [...new Map(byRole.map((e) => [JournalData.key(e), e])).values()].map((e) => ({ k: JournalData.key(e), n: JournalData.name(e), r: e.role })).sort((a, b) => a.n.localeCompare(b.n));
    const q = JState.q.toLowerCase();
    const list = byRole.filter((e) => (!JState.action || e.action === JState.action) && (!JState.user || JournalData.key(e) === JState.user)
      && (!q || `${JournalData.name(e)} ${e.action} ${e.objet} ${e.detail} ${e.email}`.toLowerCase().includes(q)));
    const actifs = new Set(list.map(JournalData.key));
    const nb = (r) => new Set(list.filter((e) => e.role === r).map(JournalData.key)).size;
    const periodes = [["0", "Aujourd'hui"], ["7", "7 derniers jours"], ["30", "30 derniers jours"], ["90", "3 derniers mois"], ["all", "Tout l'historique"]];

    el.innerHTML = `<div class="page-head"><h1>Journal d'activité</h1><div class="toolbar">
        <button class="btn outline" id="j-refresh">↻ Actualiser</button><button class="btn outline" id="j-xls">Exporter (Excel)</button><button class="btn danger" id="j-purge">Purger…</button></div></div>
      <div class="alert info" style="margin-bottom:16px">Toutes les actions des étudiants et des enseignants sont enregistrées automatiquement : connexions et déconnexions, pages consultées, contenus créés ou publiés, feuilles de présence et appels, messages, séances Teams… Le journal n'est visible que par l'administrateur et ne peut pas être modifié.</div>
      <div class="grid grid-4" style="margin-bottom:18px">
        <div class="stat"><b>${list.length}</b><span>Action(s) sur la période</span></div>
        <div class="stat"><b>${actifs.size}</b><span>Utilisateur(s) actif(s)</span></div>
        <div class="stat" style="border-left-color:#0f766e"><b>${nb("student")}</b><span>Étudiant(s) actif(s) sur ${Store.all("students").filter((s) => !s.inactif).length}</span></div>
        <div class="stat" style="border-left-color:var(--garnet)"><b>${nb("prof")}</b><span>Enseignant(s) actif(s) sur ${Store.all("profs").length}</span></div></div>
      <div class="filters">
        <div class="f"><label>Période</label><select id="j-per">${periodes.map(([v, l]) => `<option value="${v}" ${v === JState.periode ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="f"><label>Profil</label><select id="j-role">${[["users", "Étudiants et enseignants"], ["student", "Étudiants"], ["prof", "Enseignants"], ["admin", "Administrateur"], ["all", "Tous"]].map(([v, l]) => `<option value="${v}" ${v === JState.role ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="f"><label>Utilisateur</label><select id="j-user"><option value="">Tous</option>${users.map((u) => `<option value="${esc(u.k)}" ${u.k === JState.user ? "selected" : ""}>${esc(u.n)} (${ROLE_LBL[u.r] || u.r})</option>`).join("")}</select></div>
        <div class="f"><label>Action</label><select id="j-act"><option value="">Toutes</option>${actions.map((a) => `<option ${a === JState.action ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></div>
        <div class="f" style="flex:1;min-width:180px"><label>Recherche</label><input id="j-q" placeholder="Nom, module, titre…" value="${esc(JState.q)}"></div></div>
      <div class="tabs"><button data-t="journal">Journal détaillé</button><button data-t="users">Par utilisateur (${actifs.size})</button><button data-t="jours">Activité par jour</button></div>
      <div id="j-body"></div>`;

    const body = $("#j-body", el);
    if (JState.tab === "journal") {
      const rows = list.slice(0, JState.shown);
      body.innerHTML = list.length ? `<div class="table-scroll"><table class="data journal"><thead><tr><th>Date et heure</th><th>Utilisateur</th><th>Action</th><th>Détail</th><th>Page · appareil</th></tr></thead><tbody>
        ${rows.map((e) => `<tr><td style="white-space:nowrap">${fmtDateTime(e.date)}</td>
          <td><b>${esc(JournalData.name(e))}</b><div class="muted">${ROLE_LBL[e.role] || esc(e.role)}${JournalData.section(e) ? " · " + JournalData.section(e) : ""}</div></td>
          <td><span class="pill ${ACTION_CLS(e.action)}">${esc(e.action)}</span>${e.objet ? `<div class="muted">${esc(e.objet)}</div>` : ""}</td>
          <td>${esc(e.detail)}</td><td class="muted" style="white-space:nowrap">${esc(e.page)}<br>${esc(e.appareil || "")}</td></tr>`).join("")}
        </tbody></table></div>${list.length > rows.length ? `<p style="text-align:center"><button class="btn outline" id="j-more">Afficher plus (${list.length - rows.length} restante(s))</button></p>` : ""}`
        : `<div class="alert info">Aucune activité pour ces critères.</div>`;
      const more = $("#j-more", body); if (more) more.onclick = () => { JState.shown += 300; draw(); };
    } else if (JState.tab === "users") {
      const g = {}; list.forEach((e) => { const k = JournalData.key(e); const x = (g[k] = g[k] || { e, n: 0, cnx: 0, last: "", lastCnx: "", acts: {} }); x.n++; if (e.action === "Connexion") { x.cnx++; if (e.date > x.lastCnx) x.lastCnx = e.date; } if (e.date > x.last) x.last = e.date; if (e.action !== "Consultation") x.acts[e.action] = (x.acts[e.action] || 0) + 1; });
      const rows = Object.entries(g).sort((a, b) => b[1].last.localeCompare(a[1].last));
      // Comptes sans aucune activité sur la période
      const silent = JState.role === "admin" ? [] : [...(JState.role !== "prof" ? Store.all("students").filter((s) => !s.inactif).map((s) => ["student", s]) : []), ...(JState.role !== "student" ? Store.all("profs").map((p) => ["prof", p]) : [])]
        .filter(([r, u]) => !g[`${r}|${u.id}`]);
      body.innerHTML = `<div class="table-scroll"><table class="data"><thead><tr><th>Utilisateur</th><th>Profil</th><th>Dernière connexion</th><th>Dernière activité</th><th>Connexions</th><th>Actions</th><th>Principales actions</th><th></th></tr></thead><tbody>
        ${rows.map(([k, x]) => `<tr><td><b>${esc(JournalData.name(x.e))}</b><div class="muted">${esc(x.e.email || "")}</div></td><td>${ROLE_LBL[x.e.role] || ""}${JournalData.section(x.e) ? ` <span class="pill sec">${JournalData.section(x.e)}</span>` : ""}</td>
          <td>${x.lastCnx ? fmtDateTime(x.lastCnx) : "—"}</td><td>${fmtDateTime(x.last)}</td><td>${x.cnx}</td><td>${x.n}</td>
          <td class="muted">${Object.entries(x.acts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a, n]) => `${esc(a)} (${n})`).join(" · ") || "Consultations uniquement"}</td>
          <td><button class="btn outline sm" data-u="${esc(k)}">Voir le détail</button></td></tr>`).join("")}
        ${silent.map(([r, u]) => `<tr class="muted"><td>${esc(u.prenom)} ${esc(u.nom)}<div>${esc(u.email || "")}</div></td><td>${ROLE_LBL[r]}${r === "student" ? ` <span class="pill sec">${sectionOf(u)}</span>` : ""}</td><td colspan="6"><span class="pill off">Aucune activité sur la période</span></td></tr>`).join("")}
        </tbody></table></div>`;
      $$("[data-u]", body).forEach((b) => b.onclick = () => { JState.user = b.dataset.u; JState.tab = "journal"; JState.shown = 200; draw(); });
    } else {
      const days = {}; list.forEach((e) => { const d = e.date.slice(0, 10); const x = (days[d] = days[d] || { n: 0, u: new Set(), cnx: 0, s: new Set(), p: new Set() }); x.n++; x.u.add(JournalData.key(e)); if (e.action === "Connexion") x.cnx++; (e.role === "student" ? x.s : e.role === "prof" ? x.p : new Set()).add(JournalData.key(e)); });
      const ks = Object.keys(days).sort().reverse(); const max = Math.max(1, ...ks.map((d) => days[d].n));
      body.innerHTML = ks.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Jour</th><th>Connexions</th><th>Étudiants actifs</th><th>Enseignants actifs</th><th>Actions</th><th style="width:40%"></th></tr></thead><tbody>
        ${ks.map((d) => { const x = days[d]; return `<tr><td>${new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</td><td>${x.cnx}</td><td>${x.s.size}</td><td>${x.p.size}</td><td>${x.n}</td>
          <td><div class="jbar"><span style="width:${Math.round((x.n / max) * 100)}%"></span></div></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="alert info">Aucune activité.</div>`;
    }

    $$("[data-t]", el).forEach((b) => { b.classList.toggle("active", b.dataset.t === JState.tab); b.onclick = () => { JState.tab = b.dataset.t; draw(); }; });
    $("#j-per", el).onchange = (e) => { JState.periode = e.target.value; JState.shown = 200; draw(); };
    $("#j-role", el).onchange = (e) => { JState.role = e.target.value; JState.user = ""; JState.shown = 200; draw(); };
    $("#j-user", el).onchange = (e) => { JState.user = e.target.value; JState.shown = 200; draw(); };
    $("#j-act", el).onchange = (e) => { JState.action = e.target.value; JState.shown = 200; draw(); };
    let t; $("#j-q", el).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { JState.q = e.target.value; JState.shown = 200; draw().then(() => { const i = $("#j-q", el); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 350); };
    $("#j-refresh", el).onclick = () => { JState.loadedFor = null; draw(); };
    $("#j-xls", el).onclick = () => Excel.download(`journal_activite_S2I_${todayISO()}.xlsx`, [{ name: "Journal", widths: [18, 24, 14, 10, 30, 22, 26, 70, 14, 22],
      rows: [["Date et heure", "Utilisateur", "Profil", "Section", "E-mail", "Action", "Objet", "Détail", "Page", "Appareil"],
        ...list.map((e) => [fmtDateTime(e.date), JournalData.name(e), ROLE_LBL[e.role] || e.role, JournalData.section(e), e.email || "", e.action, e.objet || "", e.detail || "", e.page || "", e.appareil || ""])] }]);
    $("#j-purge", el).onclick = () => UI.modal({
      title: "Purger le journal", submitLabel: "Supprimer définitivement",
      body: `<p>Supprimer définitivement les entrées du journal plus anciennes que :</p><select name="age"><option value="180">6 mois</option><option value="365">1 an</option><option value="90">3 mois</option><option value="30">30 jours</option></select>
        <p class="muted">Pensez à exporter le journal en Excel avant de le purger.</p>`,
      onSubmit: async (f) => {
        const lim = new Date(); lim.setDate(lim.getDate() - +f.age.value); const iso = lim.toISOString();
        if (!UI.confirm(`Supprimer toutes les entrées antérieures au ${fmtDate(iso)} ? Cette opération est irréversible.`)) return false;
        let n = 0;
        if (Store.mode === "firebase") {
          for (;;) { const s = await Store.fs.collection("logs").where("date", "<", iso).limit(400).get(); if (s.empty) break; const b = Store.fs.batch(); s.docs.forEach((d) => b.delete(d.ref)); await b.commit(); n += s.size; }
        } else { const L = Store.data.logs || []; n = L.filter((e) => e.date < iso).length; Store.data.logs = L.filter((e) => e.date >= iso); Store._persist(); }
        UI.toast(`${n} entrée(s) supprimée(s).`); JState.loadedFor = null; draw();
      }
    });
  };
  draw();
}
