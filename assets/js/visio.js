/* ==========================================================================
   Séances à distance : Microsoft Teams, Google Meet ou Jitsi Meet (gratuit)
   + tableau blanc interactif partagé (Excalidraw, gratuit, sans compte)
   - le prof planifie une séance (plateforme, module, sections, date, horaire) ;
   - Teams / Meet : formulaire de réunion prérempli, puis le prof colle le lien ;
     Jitsi : le lien est créé automatiquement, sans compte ;
   - la séance apparaît dans l'emploi du temps et l'Espace Étudiant (« Rejoindre »).
   Collection : visios { id, profId, plateforme, module, sections[], nature, date, debut,
   fin, titre, description, lien, tableau, statut: "planifiee" | "annulee", createdAt }
   ========================================================================== */
const PLATFORMS = {
  teams: { nom: "Microsoft Teams", court: "Teams", color: "#5b5fc7", test: /^https:\/\/teams\.(microsoft|live)\.com\//i, placeholder: "https://teams.microsoft.com/l/meetup-join/…",
    desc: "Avec votre compte institutionnel Microsoft 365. Invitations envoyées dans le calendrier Outlook des étudiants." },
  meet: { nom: "Google Meet", court: "Meet", color: "#188038", test: /^https:\/\/meet\.google\.com\//i, placeholder: "https://meet.google.com/abc-defg-hij",
    desc: "Gratuit avec un compte Google (jusqu'à 100 participants, 60 min en groupe avec un compte gratuit)." },
  jitsi: { nom: "Jitsi Meet", court: "Jitsi", color: "#1d76ba", test: /^https:\/\/meet\.jit\.si\//i, placeholder: "https://meet.jit.si/…",
    desc: "100 % gratuit et open source, sans limite de durée. Les étudiants n'ont besoin d'aucun compte ; l'enseignant ouvre la salle avec un compte Google, GitHub ou Facebook. Partage d'écran, chat, lever la main, tableau blanc." }
};
const rnd = (n, abc = "abcdefghijklmnopqrstuvwxyz0123456789") => { const a = crypto.getRandomValues(new Uint8Array(n)); return [...a].map((x) => abc[x % abc.length]).join(""); };
const Visio = {
  pf: (v) => PLATFORMS[v.plateforme] || PLATFORMS.teams,
  start: (v) => new Date(`${v.date}T${v.debut}`),
  end: (v) => new Date(`${v.date}T${v.fin}`),
  isPast: (v) => Visio.end(v) < new Date(),
  isLive: (v) => { const n = new Date(); return v.statut !== "annulee" && Visio.start(v) - 15 * 60000 <= n && n <= Visio.end(v); },
  isTeams: (u) => PLATFORMS.teams.test.test(u || ""),
  linkOk: (v) => !v.lien || Visio.pf(v).test.test(v.lien),
  sort: (a, b) => (a.date + a.debut).localeCompare(b.date + b.debut),
  forSection: (sec) => Store.all("visios").filter((v) => (v.sections || []).includes(sec)).sort(Visio.sort),
  emails: (sections) => Store.all("students").filter((s) => !s.inactif && sections.includes(sectionOf(s))).map((s) => s.email).filter(Boolean),
  content: (v) => `${UI.moduleLabel(v.module)} — ${v.nature || "Cours"} · Master S2I (${(v.sections || []).join(", ")})${v.tableau ? `\nTableau blanc partagé : ${v.tableau}` : ""}${v.description ? "\n\n" + v.description : ""}`,
  /* Teams : formulaire « Nouvelle réunion » prérempli */
  teamsUrl(v, invite) {
    const p = new URLSearchParams();
    p.set("subject", v.titre || `${v.module} — séance à distance`);
    if (v.date && v.debut) p.set("startTime", Visio.start(v).toISOString());
    if (v.date && v.fin) p.set("endTime", Visio.end(v).toISOString());
    p.set("content", Visio.content(v));
    if (invite) { const m = Visio.emails(v.sections || []); if (m.length) p.set("attendees", m.join(",")); }
    return "https://teams.microsoft.com/l/meeting/new?" + p.toString().replace(/\+/g, "%20");
  },
  /* Google Agenda : événement prérempli (ajoutez la visioconférence Meet dans l'événement) */
  gcalUrl(v, invite) {
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const p = new URLSearchParams({ action: "TEMPLATE", text: v.titre || `${v.module} — séance à distance`, details: Visio.content(v) });
    if (v.date && v.debut && v.fin) p.set("dates", `${f(Visio.start(v))}/${f(Visio.end(v))}`);
    if (invite) { const m = Visio.emails(v.sections || []); if (m.length) p.set("add", m.join(",")); }
    return "https://calendar.google.com/calendar/render?" + p.toString();
  },
  jitsiUrl: (v) => `https://meet.jit.si/MasterS2I-${String(v.module || "").replace(/[^A-Za-z0-9]/g, "")}-${rnd(10)}`,
  /* Salle Excalidraw chiffrée de bout en bout : #room=<id 20 hex>,<clé 22 car.> */
  boardUrl: () => `https://excalidraw.com/#room=${rnd(20, "0123456789abcdef")},${rnd(22, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")}`,
  slots() {
    return Store.all("visios").filter((v) => v.statut !== "annulee" && v.date).flatMap((v) => {
      const jour = ((new Date(v.date + "T12:00:00").getDay() + 6) % 7) + 1;
      return (v.sections || []).map((section) => ({ id: "visio-" + v.id + "-" + section, visio: true, module: v.module, section, jour, debut: v.debut, fin: v.fin,
        mode: "distance", lien: v.lien, salle: Visio.pf(v).nom, profId: v.profId, nature: v.nature, semaine: mondayOf(v.date), plateforme: v.plateforme || "teams" }));
    });
  },
  ics(v) {
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const e = (t) => String(t || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Master S2I//ENSIAS//FR", "BEGIN:VEVENT", `UID:${v.id}@master-s2i`, `DTSTAMP:${f(new Date())}`,
      `DTSTART:${f(Visio.start(v))}`, `DTEND:${f(Visio.end(v))}`, `SUMMARY:${e(v.titre)}`, `LOCATION:${e(v.lien ? Visio.pf(v).nom : "")}`,
      `DESCRIPTION:${e(`${Visio.content(v)}\n${v.lien || ""}`)}`, v.lien ? `URL:${v.lien}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
  },
  when: (v) => `${S2I.jours[((new Date(v.date + "T12:00:00").getDay() + 6) % 7)] || "Dimanche"} ${fmtDate(v.date)}, ${v.debut} – ${v.fin}`,
  statusPill(v) {
    if (v.statut === "annulee") return '<span class="pill off">Annulée</span>';
    if (Visio.isLive(v)) return '<span class="pill live">● En cours</span>';
    if (Visio.isPast(v)) return '<span class="pill draft">Terminée</span>';
    return v.lien ? '<span class="pill pub">Planifiée</span>' : '<span class="pill cat-urgent">Lien à ajouter</span>';
  },
  pfPill: (v) => `<span class="pill pf" style="background:${Visio.pf(v).color}1a;color:${Visio.pf(v).color}">${VISIO_ICON} ${Visio.pf(v).court}</span>`,
  joinBtn(v, label) {
    if (v.statut === "annulee") return "";
    const pf = Visio.pf(v);
    return (v.lien ? `<a class="btn sm visio-btn" style="background:${pf.color};border-color:${pf.color}" href="${esc(v.lien)}" target="_blank" rel="noopener">${VISIO_ICON} ${label || "Rejoindre sur " + pf.court}</a>` : '<span class="muted">Lien bientôt disponible</span>')
      + (v.tableau ? ` <a class="btn outline sm" href="${esc(v.tableau)}" target="_blank" rel="noopener" title="Tableau blanc interactif partagé">✏️ Tableau</a>` : "");
  }
};
const VISIO_ICON = `<svg class="teams-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2.5" fill="currentColor"/><path d="M17 10.5l5-3v9l-5-3z" fill="currentColor"/></svg>`;
const TEAMS_ICON = VISIO_ICON;

/* Annonce dans la messagerie du module (canal de chaque section) */
function visioAnnounce(v, ctx, kind) {
  const pf = Visio.pf(v).nom;
  const head = { create: `🎥 Séance à distance (${pf})`, update: `🎥 Séance à distance modifiée (${pf})`, cancel: "❌ Séance à distance annulée" }[kind];
  (v.sections || []).forEach((sec) => Store.put("messages", {
    module: v.module, section: sec, authorRole: "prof", authorId: ctx.user.id, authorName: UI.profName(ctx.profId), system: true, date: new Date().toISOString(),
    text: `${head} : ${v.titre} — ${Visio.when(v)}${kind !== "cancel" && v.lien ? `\nRejoindre : ${v.lien}` : ""}${kind !== "cancel" && v.tableau ? `\nTableau blanc : ${v.tableau}` : ""}${kind !== "cancel" && !v.lien ? "\nLe lien sera communiqué ici." : ""}`
  }));
}

/* ---------- Espace Professeur ---------- */
const VisioState = { tab: "avenir" };
function ProfVisioView(el, ctx) {
  const mine = () => Store.all("visios").filter((v) => v.profId === ctx.profId).sort(Visio.sort);
  const draw = () => {
    const all = mine();
    const g = { avenir: all.filter((v) => !Visio.isPast(v) && v.statut !== "annulee"), passees: all.filter((v) => Visio.isPast(v) || v.statut === "annulee").reverse() };
    const list = g[VisioState.tab];
    el.innerHTML = `<div class="page-head"><h1>Séances à distance</h1><div class="toolbar"><button class="btn" id="v-add">+ Nouvelle séance à distance</button></div></div>
      <div class="grid grid-3 pf-cards" style="margin-bottom:16px">${Object.entries(PLATFORMS).map(([k, p]) => `<div class="card pf-card" style="border-top:4px solid ${p.color}"><h3 style="color:${p.color}">${VISIO_ICON} ${p.nom}</h3><p class="muted">${p.desc}</p></div>`).join("")}</div>
      <div class="alert info" style="margin-bottom:16px">Pour chaque séance, vous pouvez ajouter un <b>tableau blanc interactif partagé</b> (Excalidraw : gratuit, sans compte, dessin à plusieurs en temps réel, chiffré). Les étudiants l'ouvrent avec le bouton « ✏️ Tableau ».</div>
      <div class="tabs"><button data-t="avenir">À venir (${g.avenir.length})</button><button data-t="passees">Passées et annulées (${g.passees.length})</button></div>
      ${list.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Date et horaire</th><th>Séance</th><th>Sections</th><th>Plateforme</th><th>Statut</th><th></th></tr></thead><tbody>
      ${list.map((v) => `<tr><td><b>${esc(Visio.when(v))}</b></td>
        <td><b>${esc(v.titre)}</b><div class="muted">${esc(UI.moduleLabel(v.module))} · ${esc(v.nature || "")}</div></td>
        <td>${(v.sections || []).map((s) => `<span class="pill sec">${s}</span>`).join(" ")}</td><td>${Visio.pfPill(v)}</td><td>${Visio.statusPill(v)}</td>
        <td class="actions">${v.statut !== "annulee" && (v.lien || v.tableau) ? `${Visio.joinBtn(v, Visio.isLive(v) ? "Démarrer" : "Ouvrir")} ${v.lien ? `<button class="btn outline sm" data-copy="${v.id}">Copier le lien</button>` : ""}` : ""}
          ${v.statut !== "annulee" && !v.lien && (v.plateforme || "teams") === "teams" ? `<a class="btn outline sm" href="${esc(Visio.teamsUrl(v, true))}" target="_blank" rel="noopener">Créer dans Teams</a>` : ""}
          <button class="btn outline sm" data-ics="${v.id}" title="Ajouter à mon agenda (Outlook, Google…)">.ics</button>
          ${v.statut !== "annulee" && !Visio.isPast(v) ? `<button class="btn outline sm" data-edit="${v.id}">Modifier</button> <button class="btn outline sm" data-cancel="${v.id}">Annuler</button>` : ""}
          <button class="btn danger sm" data-del="${v.id}">Supprimer</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="alert info">${VisioState.tab === "avenir" ? "Aucune séance à distance prévue. Cliquez sur « Nouvelle séance à distance »." : "Aucune séance passée."}</div>`}`;
    $$("[data-t]", el).forEach((b) => { b.classList.toggle("active", b.dataset.t === VisioState.tab); b.onclick = () => { VisioState.tab = b.dataset.t; draw(); }; });
    $("#v-add", el).onclick = () => form(null);
    $$("[data-edit]", el).forEach((b) => b.onclick = () => form(Store.get("visios", b.dataset.edit)));
    $$("[data-copy]", el).forEach((b) => b.onclick = async () => { const v = Store.get("visios", b.dataset.copy); try { await navigator.clipboard.writeText(v.lien); UI.toast("Lien copié."); } catch { UI.modal({ title: "Lien de la réunion", body: `<input value="${esc(v.lien)}" readonly>` }); } });
    $$("[data-ics]", el).forEach((b) => b.onclick = () => { const v = Store.get("visios", b.dataset.ics); downloadFile(`seance-${v.module}-${v.date}.ics`, Visio.ics(v), "text/calendar"); });
    $$("[data-cancel]", el).forEach((b) => b.onclick = () => {
      const v = Store.get("visios", b.dataset.cancel);
      if (!UI.confirm("Annuler cette séance ? Les étudiants seront prévenus dans la messagerie. Pensez aussi à annuler la réunion sur la plateforme.")) return;
      v.statut = "annulee"; v.updatedAt = new Date().toISOString(); Store.put("visios", v); visioAnnounce(v, ctx, "cancel"); UI.toast("Séance annulée, étudiants prévenus."); draw();
    });
    $$("[data-del]", el).forEach((b) => b.onclick = () => { if (UI.confirm("Supprimer définitivement cette séance du site ? (La réunion n'est pas supprimée sur la plateforme.)")) { Store.del("visios", b.dataset.del); draw(); } });
  };

  const form = (v) => {
    const isNew = !v; const mod0 = ctx.modules[0];
    v = v ? { plateforme: "teams", ...v } : { plateforme: Store.settings().visioDefaut || "jitsi", module: mod0, sections: sectionsOfYear(yearOfModule(mod0)), nature: "Cours", date: todayISO(), debut: "09:00", fin: "10:30", statut: "planifiee" };
    const m = UI.modal({
      title: isNew ? "Nouvelle séance à distance" : "Modifier la séance à distance", wide: true,
      body: `<div class="form-grid">
        <div class="full"><label>Plateforme</label><div class="pf-choice">${Object.entries(PLATFORMS).map(([k, p]) => `<label class="pf-opt" style="--c:${p.color}"><input type="radio" name="plateforme" value="${k}" ${k === v.plateforme ? "checked" : ""}><span>${VISIO_ICON} <b>${p.nom}</b><small>${k === "jitsi" ? "Gratuit · sans compte étudiant" : k === "meet" ? "Gratuit · compte Google" : "Compte Microsoft 365"}</small></span></label>`).join("")}</div></div>
        <div><label>Module</label><select name="module" required>${UI.moduleOptions(ctx.modules, v.module)}</select></div>
        <div><label>Nature</label><select name="nature">${S2I.natures.map((n) => `<option ${n === v.nature ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="full"><label>Sections concernées</label><div class="checks" id="v-secs"></div><div class="hint" id="v-nb"></div></div>
        <div><label>Date</label><input name="date" type="date" required value="${esc(v.date)}"></div>
        <div style="display:flex;gap:10px"><div style="flex:1"><label>Début</label><input name="debut" type="time" required value="${esc(v.debut)}"></div><div style="flex:1"><label>Fin</label><input name="fin" type="time" required value="${esc(v.fin)}"></div></div>
        <div class="full"><label>Titre de la séance</label><input name="titre" required value="${esc(v.titre)}" placeholder="Ex. : M2.2 — Réseaux de neurones convolutifs (TD 3)"></div>
        <div class="full"><label>Description / consignes (facultatif)</label><textarea name="description" style="min-height:60px">${esc(v.description)}</textarea></div>
        <div class="full teams-step" id="v-step1"></div>
        <div class="full teams-step"><div class="step-n">2</div><div style="flex:1"><b>Lien de la réunion</b><div class="hint" id="v-hint2"></div>
          <div style="display:flex;gap:8px"><input name="lien" type="url" value="${esc(v.lien)}" style="flex:1"><button type="button" class="btn outline sm" id="v-gen" hidden>↻ Nouveau lien</button></div><div class="hint" id="v-warn"></div></div></div>
        <div class="full teams-step board-step"><div class="step-n">✏️</div><div style="flex:1"><b>Tableau blanc interactif partagé</b> <span class="muted">(facultatif)</span>
          <div class="hint">Excalidraw : gratuit, sans compte, dessin à plusieurs en temps réel et chiffré de bout en bout. Le lien est communiqué aux étudiants avec la séance.</div>
          <label class="inline-check"><input type="checkbox" name="board" ${v.tableau ? "checked" : ""}> Ajouter un tableau blanc à cette séance</label>
          <div style="display:flex;gap:8px" id="v-boardrow" ${v.tableau ? "" : "hidden"}><input name="tableau" readonly value="${esc(v.tableau || "")}" style="flex:1"><a class="btn outline sm" id="v-boardopen" target="_blank" rel="noopener">Ouvrir</a></div></div></div>
        <div class="full checks"><label><input type="checkbox" name="annonce" checked> ${isNew ? "Annoncer la séance aux étudiants dans la messagerie du module" : "Prévenir les étudiants de la modification dans la messagerie"}</label></div></div>`,
      onSubmit: (f) => {
        const old = { ...v };
        Object.assign(v, { plateforme: f.plateforme.value, module: f.module.value, nature: f.nature.value, date: f.date.value, debut: f.debut.value, fin: f.fin.value, titre: f.titre.value.trim(),
          description: f.description.value.trim(), lien: f.lien.value.trim(), tableau: f.board.checked ? f.tableau.value : "", sections: $$('input[name="vsec"]:checked', f).map((i) => i.value) });
        if (!v.sections.length) { UI.toast("Choisissez au moins une section."); return false; }
        if (v.fin <= v.debut) { UI.toast("L'heure de fin doit être après l'heure de début."); return false; }
        if (!Visio.linkOk(v) && !UI.confirm(`Ce lien ne ressemble pas à un lien ${Visio.pf(v).nom}. L'enregistrer quand même ?`)) return false;
        if (isNew) { v.profId = ctx.profId; v.createdAt = new Date().toISOString(); }
        v.updatedAt = new Date().toISOString();
        Store.put("visios", v);
        const changed = isNew || ["date", "debut", "fin", "lien", "titre", "tableau", "plateforme"].some((k) => old[k] !== v[k]);
        if (f.annonce.checked && changed) visioAnnounce(v, ctx, isNew ? "create" : "update");
        UI.toast(v.lien ? "Séance enregistrée : visible par les étudiants." : "Séance enregistrée. Ajoutez le lien dès qu'il est prêt."); draw();
      }
    });
    const f = m.querySelector("form");
    const pfv = () => f.plateforme.value;
    const cur = () => ({ ...v, plateforme: pfv(), module: f.module.value, nature: f.nature.value, date: f.date.value, debut: f.debut.value, fin: f.fin.value, tableau: f.board.checked ? f.tableau.value : "",
      titre: f.titre.value.trim() || `${f.module.value} — ${f.nature.value} à distance`, description: f.description.value.trim(), sections: $$('input[name="vsec"]:checked', f).map((i) => i.value) });
    let lastPf = v.plateforme;
    const step1 = () => {
      const k = pfv(); const p = PLATFORMS[k];
      $("#v-step1", m).innerHTML = k === "jitsi"
        ? `<div class="step-n">1</div><div><b>Salle Jitsi Meet créée automatiquement</b><div class="hint">Les étudiants n'ont besoin d'aucun compte. Connectez-vous quelques minutes avant la séance pour ouvrir la salle : Jitsi vous demandera de vous identifier une fois (compte Google, GitHub ou Facebook) pour devenir modérateur ; vous pouvez ensuite activer une salle d'attente ou un mot de passe. Partage d'écran et tableau blanc intégrés.</div>
            <a class="btn sm visio-btn" style="background:${p.color};border-color:${p.color}" id="v-open" target="_blank" rel="noopener">${VISIO_ICON} Tester la salle maintenant</a></div>`
        : k === "meet"
        ? `<div class="step-n">1</div><div><b>Créer la réunion Google Meet</b><div class="hint">Recommandé : « Planifier dans Google Agenda » ouvre un événement prérempli (titre, horaire, étudiants invités) ; cliquez sur « Ajouter une visioconférence Google Meet », enregistrez, puis copiez le lien Meet. Pour une séance immédiate, « Réunion instantanée » crée directement un lien.</div>
            <label class="inline-check"><input type="checkbox" name="invite" checked> Inviter les étudiants des sections choisies (adresses e-mail)</label>
            <a class="btn sm visio-btn" style="background:${p.color};border-color:${p.color}" id="v-open" target="_blank" rel="noopener">${VISIO_ICON} Planifier dans Google Agenda</a>
            <a class="btn outline sm" href="https://meet.google.com/new" target="_blank" rel="noopener">Réunion instantanée</a></div>`
        : `<div class="step-n">1</div><div><b>Créer la réunion dans Microsoft Teams</b><div class="hint">Ouvre Teams avec le titre, l'horaire et la description préremplis. Connectez-vous avec votre compte institutionnel, puis cliquez sur « Enregistrer » dans Teams : les invitations partent dans le calendrier Outlook des étudiants.</div>
            <label class="inline-check"><input type="checkbox" name="invite" checked> Inviter les étudiants des sections choisies (adresses e-mail)</label>
            <a class="btn sm visio-btn" style="background:${p.color};border-color:${p.color}" id="v-open" target="_blank" rel="noopener">${VISIO_ICON} Créer la réunion dans Teams</a></div>`;
      f.lien.placeholder = p.placeholder;
      $("#v-hint2", m).textContent = k === "jitsi" ? "Lien généré automatiquement (vous pouvez le remplacer)." : `Dans ${p.court}, copiez le lien de la réunion puis collez-le ici.`;
      $("#v-gen", m).hidden = k !== "jitsi";
      if (k === "jitsi" && (!f.lien.value || !PLATFORMS.jitsi.test.test(f.lien.value))) f.lien.value = Visio.jitsiUrl(cur());
      if (k !== "jitsi" && lastPf === "jitsi" && PLATFORMS.jitsi.test.test(f.lien.value)) f.lien.value = "";
      lastPf = k;
      const inv = f.invite; if (inv) inv.onchange = upd;
      upd();
    };
    const upd = () => {
      const c = cur(); const k = pfv(); const nbS = Store.all("students").filter((s) => !s.inactif && c.sections.includes(sectionOf(s))).length; const nbM = Visio.emails(c.sections).length;
      $("#v-nb", m).textContent = `${nbS} étudiant(s) concerné(s), dont ${nbM} avec une adresse e-mail.`;
      const o = $("#v-open", m); const inv = f.invite ? f.invite.checked : false;
      if (o) o.href = k === "jitsi" ? (f.lien.value || "#") : k === "meet" ? Visio.gcalUrl(c, inv) : Visio.teamsUrl(c, inv);
      const l = f.lien.value.trim(); $("#v-warn", m).textContent = l && !PLATFORMS[k].test.test(l) ? `⚠ Ce lien ne semble pas provenir de ${PLATFORMS[k].nom}.` : "";
      $("#v-boardopen", m).href = f.tableau.value || "#";
    };
    const fillSecs = () => { const y = yearOfModule(f.module.value); $("#v-secs", m).innerHTML = sectionsOfYear(y).map((s) => `<label><input type="checkbox" name="vsec" value="${s}" ${(v.sections || []).includes(s) ? "checked" : ""}> ${s}</label>`).join(""); $$('input[name="vsec"]', m).forEach((i) => (i.onchange = upd)); };
    f.module.onchange = () => { v.sections = sectionsOfYear(yearOfModule(f.module.value)); fillSecs(); upd(); };
    $$('input[name="plateforme"]', m).forEach((r) => (r.onchange = step1));
    ["nature", "date", "debut", "fin", "titre", "description", "lien"].forEach((k) => { f[k].addEventListener("input", upd); f[k].addEventListener("change", upd); });
    f.board.onchange = () => { $("#v-boardrow", m).hidden = !f.board.checked; if (f.board.checked && !f.tableau.value) f.tableau.value = Visio.boardUrl(); upd(); };
    $("#v-gen", m).onclick = () => { f.lien.value = Visio.jitsiUrl(cur()); upd(); };
    m.addEventListener("click", (e) => { if (e.target.closest("#v-open")) upd(); });
    fillSecs(); step1();
  };
  draw();
}

/* ---------- Espace Étudiant ---------- */
function visioCard(v) {
  return `<div class="visio-card ${v.statut === "annulee" ? "off" : ""} ${Visio.isLive(v) ? "live" : ""}" style="border-left-color:${Visio.isLive(v) ? "var(--ok)" : Visio.pf(v).color}"><div class="vc-date"><b>${fmtDate(v.date).slice(0, 5)}</b><span>${v.debut}</span></div>
    <div class="vc-body"><div>${Visio.statusPill(v)} ${Visio.pfPill(v)} <span class="pill sec">${esc(v.module)}</span> <span class="muted">${esc(v.nature || "")}</span></div>
      <h4>${esc(v.titre)}</h4><div class="muted">${esc(Visio.when(v))} · ${esc(UI.profName(v.profId))}</div>
      ${v.description ? `<div style="white-space:pre-wrap;margin-top:4px">${esc(v.description)}</div>` : ""}</div>
    <div class="vc-act">${Visio.isPast(v) ? "" : Visio.joinBtn(v)}</div></div>`;
}
function StudentVisioView(el, sec) {
  const all = Visio.forSection(sec);
  const next = all.filter((v) => !Visio.isPast(v)); const past = all.filter((v) => Visio.isPast(v)).reverse().slice(0, 20);
  el.innerHTML = `<div class="page-head"><h1>Séances à distance</h1><span class="muted">Microsoft Teams, Google Meet ou Jitsi Meet</span></div>
    <div class="panel"><div class="panel-h">À venir</div><div class="panel-b">${next.length ? next.map(visioCard).join("") : "<p class='muted'>Aucune séance à distance prévue.</p>"}
      <p class="hint">« Rejoindre » ouvre la réunion dans l'application ou le navigateur (Teams : compte institutionnel ; Meet : compte Google conseillé ; Jitsi : aucun compte). « ✏️ Tableau » ouvre le tableau blanc partagé de la séance.</p></div></div>
    ${past.length ? `<div class="panel"><div class="panel-h">Séances passées</div><div class="panel-b">${past.map(visioCard).join("")}</div></div>` : ""}`;
}
