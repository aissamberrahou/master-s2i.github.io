/* ==========================================================================
   Suivi de la saisie des absences et rappels aux enseignants
   - repère les séances passées de l'emploi du temps (et les séances à distance)
     sans feuille de présence ;
   - l'administrateur rappelle l'enseignant (sur la plateforme et par e-mail) ;
   - l'enseignant voit le rappel sur son tableau de bord, avec « Saisir maintenant ».
   Collection : rappels { id, profId, items: [{ module, section, date, debut, fin, mode }], createdAt, email }
   ========================================================================== */
const minutes = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return a * 60 + (b || 0); };
const Suivi = {
  key: (x) => `${x.module}|${x.section}|${x.date}|${x.debut}`,
  hasSheet(x) {
    return Store.all("sessions").some((s) => s.module === x.module && s.section === x.section && s.date === x.date
      && (!s.debut || !x.debut || Math.abs(minutes(s.debut) - minutes(x.debut)) <= 60));
  },
  /* Séances terminées entre `from` et maintenant (dates ISO), avec ou sans feuille */
  slots(from, profId) {
    const now = new Date(); const out = []; const seen = new Set();
    const start = mondayOf(from < edtStart() ? edtStart() : from);
    const all = [...Store.all("timetable"), ...(typeof Visio !== "undefined" ? Visio.slots() : [])].filter((t) => t.module && t.module !== "PFE" && (!profId || t.profId === profId));
    for (let mon = start; mon <= todayISO(); mon = shiftISO(mon, 7)) {
      all.filter((t) => slotInWeek(t, mon)).forEach((t) => {
        const date = shiftISO(mon, (+t.jour || 1) - 1);
        if (date < from || date < edtStart() || new Date(`${date}T${t.fin || t.debut || "23:59"}`) > now) return;
        const x = { module: t.module, section: t.section, date, debut: t.debut, fin: t.fin, mode: t.mode || "presentiel", profId: t.profId || "", visio: !!t.visio };
        const k = Suivi.key(x); if (seen.has(k)) return; seen.add(k);
        x.ok = Suivi.hasSheet(x); out.push(x);
      });
    }
    return out.sort((a, b) => (b.date + b.debut).localeCompare(a.date + a.debut));
  },
  remindersOf(x) { const k = Suivi.key(x); return Store.all("rappels").filter((r) => r.profId === x.profId && (r.items || []).some((i) => Suivi.key(i) === k)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  label: (x) => `${UI.moduleLabel(x.module)} · ${x.section} · ${(S2I.jours[(new Date(x.date + "T12:00:00").getDay() + 6) % 7] || "").toLowerCase()} ${fmtDate(x.date)}, ${x.debut}–${x.fin}`,
  mail(prof, items) {
    const lien = siteBase() + "connexion.html?role=prof";
    return { to: prof.email || "", toName: `Pr. ${prof.prenom} ${prof.nom}`, subject: `Master S2I – Rappel : saisie des absences (${items.length} séance${items.length > 1 ? "s" : ""})`,
      body: `Bonjour Pr. ${prof.prenom} ${prof.nom},

Sauf erreur de notre part, les absences des séances suivantes n'ont pas encore été saisies sur la plateforme du Master S2I :

${items.map((i) => "• " + Suivi.label(i)).join("\n")}

Merci de bien vouloir les saisir dès que possible depuis votre Espace Professeur (rubrique Absences) :
${lien}

Si une séance n'a pas eu lieu, merci de nous le signaler en répondant à ce message.

Cordialement,
La coordination du Master S2I – ENSIAS` };
  }
};

/* Envoi d'un rappel : sur la plateforme (+ e-mail si possible) */
function remindDialog(groups, onDone) {
  // groups : [{ prof, items }]
  groups = groups.filter((g) => g.prof && g.items.length);
  if (!groups.length) { UI.toast("Aucune séance à rappeler."); return; }
  const auto = Mailer.configured(); const one = groups.length === 1 ? groups[0] : null;
  const m0 = one ? Suivi.mail(one.prof, one.items) : null;
  const md = UI.modal({
    title: one ? `Rappeler Pr. ${one.prof.prenom} ${one.prof.nom}` : `Rappeler ${groups.length} enseignant(s)`, wide: true, submitLabel: "Envoyer le rappel",
    body: `<p>Le rappel s'affichera sur le tableau de bord ${one ? "de l'enseignant" : "de chaque enseignant"}, avec un bouton pour saisir directement l'absence.</p>
      <div class="table-scroll" style="max-height:220px;overflow-y:auto"><table class="data"><thead><tr><th>Enseignant</th><th>Séance(s) sans feuille de présence</th></tr></thead><tbody>
      ${groups.map((g) => `<tr><td><b>Pr. ${esc(g.prof.prenom)} ${esc(g.prof.nom)}</b><div class="muted">${esc(g.prof.email || "pas d'e-mail")}</div></td><td>${g.items.map((i) => esc(Suivi.label(i))).join("<br>")}</td></tr>`).join("")}</tbody></table></div>
      <div class="checks" style="margin:12px 0"><label><input type="checkbox" name="mail" ${groups.some((g) => g.prof.email) ? "checked" : "disabled"}> Envoyer aussi un e-mail
        ${auto ? "(envoi automatique via EmailJS)" : one ? "(le message s'ouvrira prérempli dans votre messagerie)" : "(envoi automatique non configuré : un e-mail prérempli s'ouvrira pour chaque enseignant)"}</label></div>
      ${one ? `<label>Message</label><textarea name="body" style="min-height:190px">${esc(m0.body)}</textarea>` : ""}`,
    onSubmit: async (f) => {
      const btn = $(".modal-f .btn:not(.outline)", md); btn.disabled = true;
      let mails = 0, ko = 0;
      for (const g of groups) {
        const m = Suivi.mail(g.prof, g.items); if (one) m.body = f.body.value;
        const sendMail = f.mail.checked && g.prof.email;
        Store.put("rappels", { profId: g.prof.id, items: g.items.map(({ module, section, date, debut, fin, mode }) => ({ module, section, date, debut, fin, mode })),
          createdAt: new Date().toISOString(), email: !!sendMail, message: one ? m.body : "" });
        if (!sendMail) continue;
        if (auto) { try { await Mailer.sendOne(m); mails++; } catch (e) { ko++; } await new Promise((r) => setTimeout(r, 1100)); }
        else { window.open(Mailer.mailto(m), "_blank"); mails++; }
      }
      UI.toast(`Rappel envoyé à ${groups.length} enseignant(s)${mails ? `, ${mails} e-mail(s)${auto ? " envoyé(s)" : " préparé(s)"}` : ""}${ko ? `, ${ko} échec(s) d'e-mail` : ""}.`);
      if (onDone) onDone();
    }
  });
}

/* ---------- Espace Administrateur ---------- */
const SuiviState = { periode: "14", prof: "", vue: "manquantes" };
function SuiviAbsencesAdmin(el) {
  const draw = () => {
    const from = SuiviState.periode === "week" ? mondayOf() : shiftISO(todayISO(), -+SuiviState.periode);
    const all = Suivi.slots(from, SuiviState.prof || null);
    const miss = all.filter((x) => !x.ok);
    const profs = Store.all("profs").slice().sort((a, b) => a.nom.localeCompare(b.nom));
    const byProf = {}; all.forEach((x) => { const k = x.profId || "?"; (byProf[k] = byProf[k] || { all: 0, miss: [] }).all++; if (!x.ok) byProf[k].miss.push(x); });
    const taux = all.length ? Math.round(((all.length - miss.length) / all.length) * 100) : 100;
    const list = SuiviState.vue === "manquantes" ? miss : all;
    el.innerHTML = `<div class="page-head"><h1>Suivi de la saisie des absences</h1><div class="toolbar">
        <button class="btn" id="s-all" ${miss.some((x) => x.profId) ? "" : "disabled"}>⏰ Rappeler tous les enseignants concernés</button></div></div>
      <div class="alert info" style="margin-bottom:16px">Les séances terminées de l'emploi du temps (y compris les séances à distance) sont comparées aux feuilles de présence créées par les enseignants. Une séance est « non saisie » s'il n'existe aucune feuille pour le même module, la même section et le même jour.</div>
      <div class="grid grid-4" style="margin-bottom:18px">
        <div class="stat"><b>${all.length}</b><span>Séance(s) terminée(s)</span></div>
        <div class="stat" style="border-left-color:var(--ok)"><b>${all.length - miss.length}</b><span>Absences saisies</span></div>
        <div class="stat" style="border-left-color:var(--danger)"><b>${miss.length}</b><span>Séance(s) non saisie(s)</span></div>
        <div class="stat" style="border-left-color:var(--blue)"><b>${taux} %</b><span>Taux de saisie</span></div></div>
      <div class="filters">
        <div class="f"><label>Période</label><select id="s-per">${[["week", "Cette semaine"], ["14", "2 dernières semaines"], ["30", "30 derniers jours"], ["90", "3 derniers mois"]].map(([v, l]) => `<option value="${v}" ${v === SuiviState.periode ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="f"><label>Enseignant</label><select id="s-prof"><option value="">Tous</option>${profs.map((p) => `<option value="${p.id}" ${p.id === SuiviState.prof ? "selected" : ""}>${esc(p.prenom)} ${esc(p.nom)}</option>`).join("")}</select></div></div>
      <div class="tabs"><button data-v="manquantes">Séances non saisies (${miss.length})</button><button data-v="toutes">Toutes les séances (${all.length})</button><button data-v="profs">Par enseignant</button></div>
      <div id="s-body"></div>`;
    const body = $("#s-body", el);
    if (SuiviState.vue === "profs") {
      const rows = Object.entries(byProf).sort((a, b) => b[1].miss.length - a[1].miss.length);
      body.innerHTML = rows.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Enseignant</th><th>Séances terminées</th><th>Non saisies</th><th>Taux de saisie</th><th>Dernier rappel</th><th></th></tr></thead><tbody>
        ${rows.map(([pid, r]) => { const p = Store.get("profs", pid); const last = Store.all("rappels").filter((x) => x.profId === pid).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; const t = Math.round(((r.all - r.miss.length) / r.all) * 100);
          return `<tr><td><b>${p ? `Pr. ${esc(p.prenom)} ${esc(p.nom)}` : "<span class='muted'>Enseignant non renseigné dans l'emploi du temps</span>"}</b></td><td>${r.all}</td><td>${r.miss.length ? `<span class="pill off">${r.miss.length}</span>` : '<span class="pill pub">0</span>'}</td>
            <td><div class="jbar" style="max-width:160px;display:inline-block;width:120px;vertical-align:middle"><span style="width:${t}%;background:${t >= 80 ? "var(--ok)" : t >= 50 ? "var(--warn)" : "var(--danger)"}"></span></div> ${t} %</td>
            <td>${last ? fmtDateTime(last.createdAt) : "—"}</td><td>${p && r.miss.length ? `<button class="btn sm" data-rp="${pid}">⏰ Rappeler (${r.miss.length})</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
        : `<div class="alert info">Aucune séance terminée sur la période.</div>`;
    } else {
      body.innerHTML = list.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Séance</th><th>Enseignant</th><th>Mode</th><th>État</th><th>Rappels</th><th></th></tr></thead><tbody>
        ${list.map((x, i) => { const p = Store.get("profs", x.profId); const rs = Suivi.remindersOf(x);
          return `<tr><td><b>${(S2I.jours[(new Date(x.date + "T12:00:00").getDay() + 6) % 7] || "")} ${fmtDate(x.date)}</b>, ${x.debut}–${x.fin}<div class="muted">${esc(UI.moduleLabel(x.module))} · <span class="pill sec">${x.section}</span></div></td>
            <td>${p ? `Pr. ${esc(p.prenom)} ${esc(p.nom)}` : `<span class="muted">${esc(UI.teacherOf(x) || "Non renseigné")}</span>`}</td><td>${modePill(x.mode)}${x.visio ? ' <span class="pill t-cours">Visio</span>' : ""}</td>
            <td>${x.ok ? '<span class="pill pub">Saisie</span>' : '<span class="pill off">Non saisie</span>'}</td>
            <td>${rs.length ? `<span class="muted">${rs.length} rappel(s), dernier le ${fmtDateTime(rs[0].createdAt)}</span>` : "—"}</td>
            <td>${!x.ok && p ? `<button class="btn outline sm" data-r1="${i}">⏰ Rappeler</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
        : `<div class="alert ok" style="background:#e9f6ee;border-color:#bfe3cb;color:#17663a">✅ ${SuiviState.vue === "manquantes" ? "Toutes les absences ont été saisies sur la période." : "Aucune séance terminée sur la période."}</div>`;
    }
    const group = (pid) => ({ prof: Store.get("profs", pid), items: miss.filter((x) => x.profId === pid) });
    $$("[data-v]", el).forEach((b) => { b.classList.toggle("active", b.dataset.v === SuiviState.vue); b.onclick = () => { SuiviState.vue = b.dataset.v; draw(); }; });
    $("#s-per", el).onchange = (e) => { SuiviState.periode = e.target.value; draw(); };
    $("#s-prof", el).onchange = (e) => { SuiviState.prof = e.target.value; draw(); };
    $$("[data-r1]", el).forEach((b) => b.onclick = () => { const x = list[+b.dataset.r1]; remindDialog([{ prof: Store.get("profs", x.profId), items: [x] }], draw); });
    $$("[data-rp]", el).forEach((b) => b.onclick = () => remindDialog([group(b.dataset.rp)], draw));
    $("#s-all", el).onclick = () => remindDialog([...new Set(miss.map((x) => x.profId).filter(Boolean))].map(group), draw);
  };
  draw();
}

/* ---------- Espace Professeur : rappels reçus et séances à saisir ---------- */
function profPending(profId) {
  const miss = Suivi.slots(shiftISO(todayISO(), -30), profId).filter((x) => !x.ok);
  const reminded = new Set(Store.all("rappels").filter((r) => r.profId === profId).flatMap((r) => (r.items || []).map(Suivi.key)));
  return miss.map((x) => ({ ...x, reminded: reminded.has(Suivi.key(x)) })).sort((a, b) => (b.reminded - a.reminded) || (b.date + b.debut).localeCompare(a.date + a.debut));
}
function profRemindersPanel(profId) {
  const p = profPending(profId); if (!p.length) return "";
  const r = p.filter((x) => x.reminded);
  return `<div class="panel rappel-panel"><div class="panel-h">⏰ ${r.length ? `La coordination vous rappelle de saisir ${r.length} feuille(s) de présence` : `${p.length} séance(s) sans feuille de présence`}</div><div class="panel-b">
    <ul class="list-plain">${p.slice(0, 8).map((x, i) => `<li style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>${x.reminded ? '<span class="pill off">Rappel</span> ' : ""}${esc(Suivi.label(x))}</span>
      <button class="btn sm" data-saisir="${i}">Saisir maintenant</button></li>`).join("")}</ul>
    ${p.length > 8 ? `<p class="muted">… et ${p.length - 8} autre(s), dans la rubrique Absences.</p>` : ""}</div></div>`;
}
function bindProfReminders(el, profId) {
  const p = profPending(profId);
  $$("[data-saisir]", el).forEach((b) => b.onclick = () => { const x = p[+b.dataset.saisir]; AttendanceView.prefill = x; if (location.hash === "#absences") window.dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "absences"; });
}
