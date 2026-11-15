/* ==========================================================================
   Administration : étudiants par formation et promotion
   ========================================================================== */
const StudentsFilter = { formation: "", promotion: "", annee: "", statut: "actifs", q: "" };

function StudentsAdmin(el, { actifField, withPassword, afterSave, credsColumn, credsRowAction, bindCredsButtons }) {
  const F = StudentsFilter;
  const promos = () => [...new Set(Store.all("students").map((s) => s.promotion || ""))].sort().reverse();
  const match = (s) => (!F.formation || s.formation === F.formation) && (!F.promotion || (s.promotion || "") === (F.promotion === "—" ? "" : F.promotion))
    && (!F.annee || String(s.annee) === F.annee) && (F.statut === "tous" || (F.statut === "actifs" ? !s.inactif : s.inactif))
    && (!F.q || Excel.norm(`${s.login} ${s.nom} ${s.prenom} ${s.email || ""}`).includes(Excel.norm(F.q)));

  el.innerHTML = `<div class="page-head"><h1>Étudiants par formation et promotion</h1><div class="toolbar">
      <button class="btn" id="st-imp">⬆ Importer Excel</button><button class="btn outline" id="st-exp">⬇ Exporter la liste (Excel)</button></div></div>
    <div class="panel"><div class="panel-h">Promotions</div><div id="st-groups"></div></div>
    <div class="panel"><div class="panel-h light">Filtres</div><div class="panel-b"><div class="toolbar">
      <div class="f"><label>Formation</label><select id="ff"><option value="">Toutes</option>${Object.entries(S2I.formations).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="f"><label>Promotion</label><select id="fp"></select></div>
      <div class="f" style="min-width:130px"><label>Année</label><select id="fa"><option value="">Toutes</option><option value="1">1re année</option><option value="2">2e année</option></select></div>
      <div class="f" style="min-width:130px"><label>Statut</label><select id="fs"><option value="actifs">Actifs</option><option value="inactifs">Désactivés</option><option value="tous">Tous</option></select></div>
      <div class="f" style="flex:1"><label>Recherche</label><input id="fq" placeholder="Code, nom, prénom, e-mail…"></div>
      <button class="btn outline" id="freset">Réinitialiser</button></div></div></div>
    <div id="st-list"></div>`;

  const fillPromoSelect = () => {
    $("#fp", el).innerHTML = `<option value="">Toutes</option>${promos().map((p) => `<option value="${esc(p || "—")}">${esc(p || "Non renseignée")}</option>`).join("")}`;
    $("#fp", el).value = F.promotion;
  };
  const syncInputs = () => { $("#ff", el).value = F.formation; fillPromoSelect(); $("#fa", el).value = F.annee; $("#fs", el).value = F.statut; $("#fq", el).value = F.q; };

  const drawGroups = () => {
    const groups = {};
    Store.all("students").forEach((s) => {
      const k = `${s.formation}|${s.promotion || ""}`;
      const g = groups[k] || (groups[k] = { formation: s.formation, promotion: s.promotion || "", annees: new Set(), actifs: 0, total: 0 });
      g.total++; if (!s.inactif) { g.actifs++; g.annees.add(s.annee); }
    });
    const list = Object.values(groups).sort((a, b) => b.promotion.localeCompare(a.promotion) || a.formation.localeCompare(b.formation));
    $("#st-groups", el).innerHTML = list.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Formation</th><th>Promotion</th><th>Année en cours</th><th>Effectif actif</th><th></th></tr></thead><tbody>
      ${list.map((g) => { const k = esc(`${g.formation}|${g.promotion}`); const ann = [...g.annees].sort();
        return `<tr><td><b>${g.formation}</b> <span class="muted">${esc(S2I.formations[g.formation])}</span></td><td>${esc(g.promotion || "Non renseignée")}</td>
        <td>${ann.map((a) => `<span class="pill sec">${g.formation}-${a}A</span>`).join(" ") || "—"}</td><td><b>${g.actifs}</b> / ${g.total}</td>
        <td class="actions"><button class="btn outline sm" data-g="show" data-k="${k}">Afficher</button>
          ${ann.length === 1 && ann[0] === 1 ? `<button class="btn outline sm" data-g="up" data-k="${k}">Passer en 2e année</button>` : ""}
          ${g.actifs ? `<button class="btn outline sm" data-g="off" data-k="${k}">Désactiver</button>` : `<button class="btn outline sm" data-g="on" data-k="${k}">Réactiver</button>`}
          <button class="btn outline sm" data-g="imp" data-k="${k}">Importer</button>
          ${g.actifs ? `<button class="btn outline sm" data-g="mail" data-k="${k}" title="Nouveaux mots de passe provisoires envoyés par e-mail">Identifiants</button>` : ""}
          <button class="btn danger sm" data-g="del" data-k="${k}">Supprimer</button></td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="empty">Aucun étudiant. Importez une liste Excel pour commencer.</div>`;
    $$("[data-g]", el).forEach((b) => b.onclick = () => groupAction(b.dataset.g, ...b.dataset.k.split("|")));
  };

  const groupAction = async (action, formation, promotion) => {
    const members = Store.all("students").filter((s) => s.formation === formation && (s.promotion || "") === promotion);
    const label = `${formation} — promotion ${promotion || "non renseignée"}`;
    if (action === "show") { Object.assign(F, { formation, promotion: promotion || "—", annee: "", statut: "tous", q: "" }); syncInputs(); drawList(); $("#st-list", el).scrollIntoView({ behavior: "smooth" }); return; }
    if (action === "imp") { importStudentsDialog(refresh, { formation, promotion, annee: members[0] ? members[0].annee : 1 }); return; }
    if (action === "mail") {
      const act = members.filter((s) => !s.inactif); const noSent = act.filter((s) => !s.credsSentAt);
      const target = noSent.length && noSent.length < act.length && UI.confirm(`${noSent.length} étudiant(s) de ${label} n'ont jamais reçu leurs identifiants.\nOK = ne traiter que ceux-là · Annuler = tous les ${act.length} étudiants actifs`) ? noSent : act;
      if (Store.mode === "firebase") {
        if (!UI.confirm(`Envoyer l'e-mail d'activation (création de l'accès si besoin) à ${target.length} étudiant(s) de ${label} ?`)) return;
        activateAccountsDialog(target.map((s) => ({ kind: "student", account: s })), { title: `Accès — ${label}`, onClose: refresh }); return;
      }
      if (!UI.confirm(`Générer de nouveaux mots de passe provisoires pour ${target.length} étudiant(s) et les envoyer par e-mail ?\nLeurs anciens mots de passe ne fonctionneront plus.`)) return;
      const items = []; for (const s of target) items.push(await resetCredentials("student", s));
      sendCredentialsDialog(items, { title: `Identifiants — ${label}`, onClose: refresh }); refresh(); return;
    }
    if (action === "up") { if (!UI.confirm(`Passer les ${members.filter((s) => !s.inactif).length} étudiant(s) actif(s) de ${label} en 2e année ?\nIls apparaîtront dans la section ${formation}-2A pour les absences et l'emploi du temps.`)) return;
      members.filter((s) => !s.inactif).forEach((s) => Store.put("students", { ...s, annee: 2 })); UI.toast("Promotion passée en 2e année."); }
    if (action === "off" || action === "on") { const off = action === "off"; if (!UI.confirm(`${off ? "Désactiver" : "Réactiver"} tous les comptes de ${label} ?${off ? "\n(Les étudiants ne pourront plus se connecter ; l'historique des absences est conservé.)" : ""}`)) return;
      members.forEach((s) => Store.put("students", { ...s, inactif: off })); UI.toast(off ? "Comptes désactivés." : "Comptes réactivés."); }
    if (action === "del") { if (!UI.confirm(`Supprimer définitivement les ${members.length} étudiant(s) de ${label} ?\nPréférez « Désactiver » pour garder l'historique.`)) return;
      members.forEach((s) => Store.del("students", s.id)); UI.toast(`${members.length} étudiant(s) supprimé(s).`); }
    refresh();
  };

  const drawList = () => renderCrud($("#st-list", el), {
    col: "students", title: `Liste des étudiants (${Store.all("students").filter(match).length})`, filter: match,
    sort: (a, b) => (b.promotion || "").localeCompare(a.promotion || "") || sectionOf(a).localeCompare(sectionOf(b)) || a.nom.localeCompare(b.nom),
    columns: [["Code", (r) => esc(r.login)], ["Nom", (r) => esc(r.nom.toUpperCase())], ["Prénom", (r) => esc(r.prenom)], ["Formation", (r) => r.formation], ["Promotion", (r) => esc(r.promotion || "—")],
      ["Section", (r) => `<span class="pill sec">${sectionOf(r)}</span>`], ["E-mail", (r) => esc(r.email || "")], credsColumn, ["Compte", (r) => r.inactif ? '<span class="pill off">Désactivé</span>' : '<span class="pill pub">Actif</span>']],
    fields: [
      { key: "login", label: "Code étudiant (identifiant)", required: true },
      { key: "nom", label: "Nom", required: true }, { key: "prenom", label: "Prénom", required: true },
      { key: "email", label: "E-mail", type: "email" },
      { key: "formation", label: "Formation", type: "select", options: () => Object.entries(S2I.formations) },
      { key: "promotion", label: "Promotion", placeholder: "ex. 2026-2028", datalist: () => promos().filter(Boolean) },
      { key: "annee", label: "Année", type: "select", options: () => [["1", "1re année"], ["2", "2e année"]] },
      { key: "password", label: "Mot de passe", type: "password", placeholder: "Vide : généré (nouveau compte) / inchangé" }, actifField],
    defaults: () => ({ formation: F.formation || "TN", promotion: F.promotion && F.promotion !== "—" ? F.promotion : "", annee: Number(F.annee) || 1 }),
    beforeSave: withPassword("students"), afterSave, rowActions: credsRowAction,
    afterDraw: (box, redraw) => { bindCredsButtons(box, "student", redraw); drawGroups(); fillPromoSelect(); const h = $("h1", box); if (h) h.textContent = `Liste des étudiants (${Store.all("students").filter(match).length})`; }
  });

  const refresh = () => drawList();
  $("#ff", el).onchange = (e) => { F.formation = e.target.value; drawList(); };
  $("#fp", el).onchange = (e) => { F.promotion = e.target.value; drawList(); };
  $("#fa", el).onchange = (e) => { F.annee = e.target.value; drawList(); };
  $("#fs", el).onchange = (e) => { F.statut = e.target.value; drawList(); };
  let t; $("#fq", el).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value; drawList(); }, 200); };
  $("#freset", el).onclick = () => { Object.assign(F, { formation: "", promotion: "", annee: "", statut: "actifs", q: "" }); syncInputs(); drawList(); };
  $("#st-imp", el).onclick = () => importStudentsDialog(refresh, { formation: F.formation, promotion: F.promotion !== "—" ? F.promotion : "", annee: Number(F.annee) || 1 });
  $("#st-exp", el).onclick = () => {
    const rows = Store.all("students").filter(match).sort((a, b) => sectionOf(a).localeCompare(sectionOf(b)) || a.nom.localeCompare(b.nom));
    Excel.download(`etudiants_S2I${F.formation ? "_" + F.formation : ""}${F.promotion && F.promotion !== "—" ? "_" + F.promotion : ""}.xlsx`, [{ name: "Etudiants", widths: [16, 18, 18, 28, 10, 12, 8, 10, 10],
      rows: [["Code", "Nom", "Prénom", "E-mail", "Formation", "Promotion", "Année", "Section", "Statut"], ...rows.map((s) => [s.login, s.nom, s.prenom, s.email || "", s.formation, s.promotion || "", s.annee, sectionOf(s), s.inactif ? "Désactivé" : "Actif"])] }]);
  };
  syncInputs(); drawList();
}
