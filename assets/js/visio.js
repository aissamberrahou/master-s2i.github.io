/* ==========================================================================
   Séances à distance sur Microsoft Teams
   - le prof planifie une séance (module, sections, date, horaire) ;
   - « Créer la réunion dans Teams » ouvre le formulaire de réunion Teams
     prérempli (titre, horaire, description, étudiants invités) ;
   - le prof colle le lien de la réunion : la séance apparaît dans l'emploi
     du temps et dans l'Espace Étudiant avec un bouton « Rejoindre ».
   Collection : visios { id, profId, module, sections[], nature, date, debut,
   fin, titre, description, lien, statut: "planifiee" | "annulee", createdAt }
   ========================================================================== */
const Visio = {
  start: (v) => new Date(`${v.date}T${v.debut}`),
  end: (v) => new Date(`${v.date}T${v.fin}`),
  isPast: (v) => Visio.end(v) < new Date(),
  isLive: (v) => { const n = new Date(); return v.statut !== "annulee" && Visio.start(v) - 15 * 60000 <= n && n <= Visio.end(v); },
  isTeams: (u) => /^https:\/\/teams\.(microsoft|live)\.com\//i.test(u || ""),
  sort: (a, b) => (a.date + a.debut).localeCompare(b.date + b.debut),
  forSection: (sec) => Store.all("visios").filter((v) => (v.sections || []).includes(sec)).sort(Visio.sort),
  emails: (sections) => Store.all("students").filter((s) => !s.inactif && sections.includes(sectionOf(s))).map((s) => s.email).filter(Boolean),
  /* Lien profond officiel : ouvre le formulaire « Nouvelle réunion » de Teams prérempli */
  teamsUrl(v, invite) {
    const p = new URLSearchParams();
    p.set("subject", v.titre || `${v.module} — séance à distance`);
    if (v.date && v.debut) p.set("startTime", Visio.start(v).toISOString());
    if (v.date && v.fin) p.set("endTime", Visio.end(v).toISOString());
    p.set("content", `${UI.moduleLabel(v.module)} — ${v.nature || "Cours"} · Master S2I (${(v.sections || []).join(", ")})${v.description ? "\n\n" + v.description : ""}`);
    if (invite) { const m = Visio.emails(v.sections || []); if (m.length) p.set("attendees", m.join(",")); }
    return "https://teams.microsoft.com/l/meeting/new?" + p.toString().replace(/\+/g, "%20");
  },
  /* Créneaux au format de l'emploi du temps (séances ponctuelles) */
  slots() {
    return Store.all("visios").filter((v) => v.statut !== "annulee" && v.date).flatMap((v) => {
      const jour = ((new Date(v.date + "T12:00:00").getDay() + 6) % 7) + 1;
      return (v.sections || []).map((section) => ({ id: "visio-" + v.id + "-" + section, visio: true, module: v.module, section, jour, debut: v.debut, fin: v.fin,
        mode: "distance", lien: v.lien, salle: "Microsoft Teams", profId: v.profId, nature: v.nature, semaine: mondayOf(v.date) }));
    });
  },
  ics(v) {
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const e = (t) => String(t || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Master S2I//ENSIAS//FR", "BEGIN:VEVENT", `UID:${v.id}@master-s2i`, `DTSTAMP:${f(new Date())}`,
      `DTSTART:${f(Visio.start(v))}`, `DTEND:${f(Visio.end(v))}`, `SUMMARY:${e(v.titre)}`, `LOCATION:${e(v.lien ? "Microsoft Teams" : "")}`,
      `DESCRIPTION:${e(`${UI.moduleLabel(v.module)} — ${v.nature || ""}\n${v.lien || ""}\n${v.description || ""}`)}`, v.lien ? `URL:${v.lien}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
  },
  when: (v) => `${S2I.jours[((new Date(v.date + "T12:00:00").getDay() + 6) % 7)] || "Dimanche"} ${fmtDate(v.date)}, ${v.debut} – ${v.fin}`,
  statusPill(v) {
    if (v.statut === "annulee") return '<span class="pill off">Annulée</span>';
    if (Visio.isLive(v)) return '<span class="pill live">● En cours</span>';
    if (Visio.isPast(v)) return '<span class="pill draft">Terminée</span>';
    return v.lien ? '<span class="pill pub">Planifiée</span>' : '<span class="pill cat-urgent">Lien à ajouter</span>';
  },
  joinBtn(v, label = "Rejoindre sur Teams") {
    if (v.statut === "annulee") return "";
    return v.lien ? `<a class="btn sm teams" href="${esc(v.lien)}" target="_blank" rel="noopener">${TEAMS_ICON} ${label}</a>` : '<span class="muted">Lien bientôt disponible</span>';
  }
};
const TEAMS_ICON = `<svg class="teams-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="13" height="14" rx="2" fill="currentColor" opacity=".25"/><path d="M5 9h7v1.6H9.4V16H7.6v-5.4H5z" fill="currentColor"/><circle cx="18.5" cy="7.5" r="2.5" fill="currentColor"/><path d="M16 11h5a1 1 0 0 1 1 1v3.5a3.5 3.5 0 0 1-6 2.4z" fill="currentColor"/></svg>`;

/* Annonce dans la messagerie du module (canal de chaque section) */
function visioAnnounce(v, ctx, kind) {
  const head = { create: "🎥 Séance à distance sur Microsoft Teams", update: "🎥 Séance à distance modifiée", cancel: "❌ Séance à distance annulée" }[kind];
  (v.sections || []).forEach((sec) => Store.put("messages", {
    module: v.module, section: sec, authorRole: "prof", authorId: ctx.user.id, authorName: UI.profName(ctx.profId), system: true, date: new Date().toISOString(),
    text: `${head} : ${v.titre} — ${Visio.when(v)}${kind !== "cancel" && v.lien ? `\nRejoindre : ${v.lien}` : ""}${kind !== "cancel" && !v.lien ? "\nLe lien sera communiqué ici." : ""}`
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
    el.innerHTML = `<div class="page-head"><h1>Séances à distance — Microsoft Teams</h1><div class="toolbar"><button class="btn" id="v-add">+ Nouvelle séance Teams</button></div></div>
      <div class="alert info" style="margin-bottom:16px"><b>Comment ça marche :</b> remplissez la séance, cliquez sur <b>« Créer la réunion dans Teams »</b> (Teams s'ouvre avec le titre, l'horaire et les étudiants déjà renseignés), enregistrez la réunion dans Teams, puis <b>copiez son lien</b> et collez-le ici. Les étudiants la retrouvent dans leur emploi du temps avec un bouton « Rejoindre ».</div>
      <div class="tabs"><button data-t="avenir">À venir (${g.avenir.length})</button><button data-t="passees">Passées et annulées (${g.passees.length})</button></div>
      ${list.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Date et horaire</th><th>Séance</th><th>Sections</th><th>Statut</th><th></th></tr></thead><tbody>
      ${list.map((v) => `<tr><td><b>${esc(Visio.when(v))}</b></td>
        <td><b>${esc(v.titre)}</b><div class="muted">${esc(UI.moduleLabel(v.module))} · ${esc(v.nature || "")}</div></td>
        <td>${(v.sections || []).map((s) => `<span class="pill sec">${s}</span>`).join(" ")}</td><td>${Visio.statusPill(v)}</td>
        <td class="actions">${v.statut !== "annulee" && v.lien ? `${Visio.joinBtn(v, Visio.isLive(v) ? "Démarrer" : "Ouvrir")} <button class="btn outline sm" data-copy="${v.id}">Copier le lien</button>` : ""}
          ${v.statut !== "annulee" && !v.lien ? `<a class="btn outline sm teams-o" href="${esc(Visio.teamsUrl(v, true))}" target="_blank" rel="noopener">Créer dans Teams</a>` : ""}
          <button class="btn outline sm" data-ics="${v.id}" title="Ajouter à mon agenda (Outlook…)">.ics</button>
          ${v.statut !== "annulee" && !Visio.isPast(v) ? `<button class="btn outline sm" data-edit="${v.id}">Modifier</button> <button class="btn outline sm" data-cancel="${v.id}">Annuler</button>` : ""}
          <button class="btn danger sm" data-del="${v.id}">Supprimer</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="alert info">${VisioState.tab === "avenir" ? "Aucune séance à distance prévue. Cliquez sur « Nouvelle séance Teams »." : "Aucune séance passée."}</div>`}`;
    $$("[data-t]", el).forEach((b) => { b.classList.toggle("active", b.dataset.t === VisioState.tab); b.onclick = () => { VisioState.tab = b.dataset.t; draw(); }; });
    $("#v-add", el).onclick = () => form(null);
    $$("[data-edit]", el).forEach((b) => b.onclick = () => form(Store.get("visios", b.dataset.edit)));
    $$("[data-copy]", el).forEach((b) => b.onclick = async () => { const v = Store.get("visios", b.dataset.copy); try { await navigator.clipboard.writeText(v.lien); UI.toast("Lien copié."); } catch { UI.modal({ title: "Lien de la réunion", body: `<input value="${esc(v.lien)}" readonly>` }); } });
    $$("[data-ics]", el).forEach((b) => b.onclick = () => { const v = Store.get("visios", b.dataset.ics); downloadFile(`seance-${v.module}-${v.date}.ics`, Visio.ics(v), "text/calendar"); });
    $$("[data-cancel]", el).forEach((b) => b.onclick = () => {
      const v = Store.get("visios", b.dataset.cancel);
      if (!UI.confirm("Annuler cette séance ? Les étudiants seront prévenus dans la messagerie. Pensez aussi à annuler la réunion dans Teams.")) return;
      v.statut = "annulee"; v.updatedAt = new Date().toISOString(); Store.put("visios", v); visioAnnounce(v, ctx, "cancel"); UI.toast("Séance annulée, étudiants prévenus."); draw();
    });
    $$("[data-del]", el).forEach((b) => b.onclick = () => { if (UI.confirm("Supprimer définitivement cette séance du site ? (La réunion Teams n'est pas supprimée.)")) { Store.del("visios", b.dataset.del); draw(); } });
  };

  const form = (v) => {
    const isNew = !v; const mod0 = ctx.modules[0];
    v = v ? { ...v } : { module: mod0, sections: sectionsOfYear(yearOfModule(mod0)), nature: "Cours", date: todayISO(), debut: "09:00", fin: "10:30", statut: "planifiee" };
    const m = UI.modal({
      title: isNew ? "Nouvelle séance à distance (Microsoft Teams)" : "Modifier la séance à distance", wide: true,
      body: `<div class="form-grid">
        <div><label>Module</label><select name="module" required>${UI.moduleOptions(ctx.modules, v.module)}</select></div>
        <div><label>Nature</label><select name="nature">${S2I.natures.map((n) => `<option ${n === v.nature ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="full"><label>Sections concernées</label><div class="checks" id="v-secs"></div><div class="hint" id="v-nb"></div></div>
        <div><label>Date</label><input name="date" type="date" required value="${esc(v.date)}"></div>
        <div style="display:flex;gap:10px"><div style="flex:1"><label>Début</label><input name="debut" type="time" required value="${esc(v.debut)}"></div><div style="flex:1"><label>Fin</label><input name="fin" type="time" required value="${esc(v.fin)}"></div></div>
        <div class="full"><label>Titre de la séance</label><input name="titre" required value="${esc(v.titre)}" placeholder="Ex. : M2.2 — Réseaux de neurones convolutifs (TD 3)"></div>
        <div class="full"><label>Description / consignes (facultatif)</label><textarea name="description" style="min-height:70px">${esc(v.description)}</textarea></div>
        <div class="full teams-step"><div class="step-n">1</div><div><b>Créer la réunion dans Microsoft Teams</b><div class="hint">Ouvre Teams (application ou navigateur) avec le titre, l'horaire et la description préremplis. Connectez-vous avec votre compte institutionnel, puis cliquez sur « Enregistrer » dans Teams : les invitations partent dans le calendrier Outlook des étudiants.</div>
          <label class="inline-check"><input type="checkbox" name="invite" checked> Inviter les étudiants des sections choisies (adresses e-mail)</label>
          <a class="btn sm teams" id="v-teams" href="#" target="_blank" rel="noopener">${TEAMS_ICON} Créer la réunion dans Teams</a></div></div>
        <div class="full teams-step"><div class="step-n">2</div><div style="flex:1"><b>Coller le lien de la réunion</b><div class="hint">Dans Teams, ouvrez la réunion créée › « Copier le lien » (ou « Partager l'invitation »), puis collez-le ci-dessous.</div>
          <input name="lien" type="url" placeholder="https://teams.microsoft.com/l/meetup-join/…" value="${esc(v.lien)}"><div class="hint" id="v-warn"></div></div></div>
        <div class="full checks"><label><input type="checkbox" name="annonce" checked> ${isNew ? "Annoncer la séance aux étudiants dans la messagerie du module" : "Prévenir les étudiants de la modification dans la messagerie"}</label></div></div>`,
      onSubmit: (f) => {
        const old = { ...v };
        Object.assign(v, { module: f.module.value, nature: f.nature.value, date: f.date.value, debut: f.debut.value, fin: f.fin.value, titre: f.titre.value.trim(),
          description: f.description.value.trim(), lien: f.lien.value.trim(), sections: $$('input[name="vsec"]:checked', f).map((i) => i.value) });
        if (!v.sections.length) { UI.toast("Choisissez au moins une section."); return false; }
        if (v.fin <= v.debut) { UI.toast("L'heure de fin doit être après l'heure de début."); return false; }
        if (v.lien && !Visio.isTeams(v.lien) && !UI.confirm("Ce lien ne ressemble pas à un lien Microsoft Teams. L'enregistrer quand même ?")) return false;
        if (isNew) { v.profId = ctx.profId; v.createdAt = new Date().toISOString(); }
        v.updatedAt = new Date().toISOString();
        Store.put("visios", v);
        const changed = isNew || ["date", "debut", "fin", "lien", "titre"].some((k) => old[k] !== v[k]);
        if (f.annonce.checked && changed) visioAnnounce(v, ctx, isNew ? "create" : "update");
        UI.toast(v.lien ? "Séance enregistrée : visible par les étudiants." : "Séance enregistrée. Ajoutez le lien Teams dès qu'il est prêt."); draw();
      }
    });
    const f = m.querySelector("form");
    const cur = () => ({ ...v, module: f.module.value, nature: f.nature.value, date: f.date.value, debut: f.debut.value, fin: f.fin.value,
      titre: f.titre.value.trim() || `${f.module.value} — ${f.nature.value} à distance`, description: f.description.value.trim(), sections: $$('input[name="vsec"]:checked', f).map((i) => i.value) });
    const upd = () => {
      const c = cur(); const nbS = Store.all("students").filter((s) => !s.inactif && c.sections.includes(sectionOf(s))).length; const nbM = Visio.emails(c.sections).length;
      $("#v-nb", m).textContent = `${nbS} étudiant(s) concerné(s), dont ${nbM} avec une adresse e-mail.`;
      $("#v-teams", m).href = Visio.teamsUrl(c, f.invite.checked);
      const l = f.lien.value.trim(); $("#v-warn", m).textContent = l && !Visio.isTeams(l) ? "⚠ Ce lien ne semble pas provenir de Microsoft Teams." : "";
    };
    const fillSecs = () => { const y = yearOfModule(f.module.value); $("#v-secs", m).innerHTML = sectionsOfYear(y).map((s) => `<label><input type="checkbox" name="vsec" value="${s}" ${(v.sections || []).includes(s) ? "checked" : ""}> ${s}</label>`).join(""); $$('input[name="vsec"]', m).forEach((i) => (i.onchange = upd)); };
    f.module.onchange = () => { v.sections = sectionsOfYear(yearOfModule(f.module.value)); fillSecs(); upd(); };
    ["nature", "date", "debut", "fin", "titre", "description", "invite", "lien"].forEach((k) => { f[k].addEventListener("input", upd); f[k].addEventListener("change", upd); });
    $("#v-teams", m).addEventListener("click", upd);
    fillSecs(); upd();
  };
  draw();
}

/* ---------- Espace Étudiant ---------- */
function visioCard(v) {
  return `<div class="visio-card ${v.statut === "annulee" ? "off" : ""} ${Visio.isLive(v) ? "live" : ""}"><div class="vc-date"><b>${fmtDate(v.date).slice(0, 5)}</b><span>${v.debut}</span></div>
    <div class="vc-body"><div>${Visio.statusPill(v)} <span class="pill sec">${esc(v.module)}</span> <span class="muted">${esc(v.nature || "")}</span></div>
      <h4>${esc(v.titre)}</h4><div class="muted">${esc(Visio.when(v))} · ${esc(UI.profName(v.profId))}</div>
      ${v.description ? `<div style="white-space:pre-wrap;margin-top:4px">${esc(v.description)}</div>` : ""}</div>
    <div class="vc-act">${Visio.isPast(v) ? "" : Visio.joinBtn(v)}</div></div>`;
}
function StudentVisioView(el, sec) {
  const all = Visio.forSection(sec);
  const next = all.filter((v) => !Visio.isPast(v)); const past = all.filter((v) => Visio.isPast(v)).reverse().slice(0, 20);
  el.innerHTML = `<div class="page-head"><h1>Séances à distance</h1><span class="muted">Réunions Microsoft Teams de vos enseignants</span></div>
    <div class="panel"><div class="panel-h">À venir</div><div class="panel-b">${next.length ? next.map(visioCard).join("") : "<p class='muted'>Aucune séance à distance prévue.</p>"}
      <p class="hint">Le bouton « Rejoindre » ouvre la réunion dans l'application Teams ou dans le navigateur. Connectez-vous avec votre compte institutionnel.</p></div></div>
    ${past.length ? `<div class="panel"><div class="panel-h">Séances passées</div><div class="panel-b">${past.map(visioCard).join("")}</div></div>` : ""}`;
}
