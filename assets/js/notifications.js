/* ==========================================================================
   Notifications ciblées (Planning) : par formation, promotion et année,
   envoi immédiat ou programmé à une date et une heure.
   ========================================================================== */
const NOTIF_CATS = ["Information", "Planning", "Examen", "Soutenance", "Urgent"];
const catClass = (c) => ({ Information: "cat-info", Planning: "cat-planning", Examen: "cat-examen", Soutenance: "cat-soutenance", Urgent: "cat-urgent" }[c] || "cat-info");

const Notif = {
  matches(n, s) {
    return !s.inactif && (!n.formation || n.formation === s.formation) && (!(n.promotions || []).length || n.promotions.includes(s.promotion || ""))
      && (!n.annee || String(n.annee) === String(s.annee));
  },
  recipients(n) { return Store.all("students").filter((s) => this.matches(n, s)); },
  isSent(n) { return new Date(n.publishAt) <= new Date(); },
  forStudent(s) { return Store.all("notifications").filter((n) => this.isSent(n) && this.matches(n, s)).sort((a, b) => b.publishAt.localeCompare(a.publishAt)); },
  key: (s) => `s2i_notif_read_${s.id}`,
  readSet(s) { try { return new Set(JSON.parse(localStorage.getItem(this.key(s))) || []); } catch { return new Set(); } },
  markRead(s, ids) { const r = this.readSet(s); ids.forEach((i) => r.add(i)); localStorage.setItem(this.key(s), JSON.stringify([...r])); },
  unread(s) { const r = this.readSet(s); return this.forStudent(s).filter((n) => !r.has(n.id)).length; },
  targetLabel(n) {
    const parts = [n.formation ? n.formation : "TN et TAM", (n.promotions || []).length ? "promotion " + n.promotions.map((p) => p || "non renseignée").join(", ") : "toutes promotions", n.annee ? `${n.annee}${n.annee == 1 ? "re" : "e"} année` : ""];
    return parts.filter(Boolean).join(" · ");
  }
};

function notifCard(n, unread) {
  return `<div class="notif ${unread ? "unread" : ""}"><div>${unread ? '<span class="badge">nouveau</span> ' : ""}<span class="pill ${catClass(n.categorie)}">${esc(n.categorie)}</span>
    <span class="muted"> ${fmtDateTime(n.publishAt)}</span></div><h4>${esc(n.titre)}</h4>
    <div style="white-space:pre-wrap">${esc(n.message)}</div>${n.lien ? `<div style="margin-top:6px"><a class="btn outline sm" href="${esc(n.lien)}" target="_blank" rel="noopener">Ouvrir le lien</a></div>` : ""}
    <div class="muted" style="margin-top:4px">Coordination du Master S2I</div></div>`;
}

/* ---------- Espace administrateur ---------- */
const NotifState = { tab: "all" };
function NotificationsAdmin(el) {
  const promos = () => [...new Set(Store.all("students").map((s) => s.promotion || ""))].sort().reverse();
  const draw = () => {
    const all = Store.all("notifications").slice().sort((a, b) => b.publishAt.localeCompare(a.publishAt));
    const g = { all, planned: all.filter((n) => !Notif.isSent(n)), sent: all.filter((n) => Notif.isSent(n)) };
    const list = g[NotifState.tab];
    el.innerHTML = `<div class="page-head"><h1>Notifications des étudiants — Planning</h1><div class="toolbar"><button class="btn" id="nw">+ Nouvelle notification</button></div></div>
      <div class="alert info" style="margin-bottom:16px">Ciblez les étudiants par <b>formation</b>, <b>promotion</b> et <b>année</b>. Une notification programmée devient visible dans l'Espace Étudiant à la date et à l'heure choisies.</div>
      <div class="tabs"><button data-t="all">Toutes (${g.all.length})</button><button data-t="planned">Programmées (${g.planned.length})</button><button data-t="sent">Envoyées (${g.sent.length})</button></div>
      ${list.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Diffusion</th><th>Titre</th><th>Catégorie</th><th>Destinataires</th><th>Statut</th><th></th></tr></thead><tbody>
        ${list.map((n) => { const nb = Notif.recipients(n).length; return `<tr><td>${fmtDateTime(n.publishAt)}</td><td><b>${esc(n.titre)}</b><div class="muted">${esc(n.message.slice(0, 90))}${n.message.length > 90 ? "…" : ""}</div></td>
          <td><span class="pill ${catClass(n.categorie)}">${esc(n.categorie)}</span></td><td>${esc(Notif.targetLabel(n))}<div class="muted">${nb} étudiant(s)</div></td>
          <td>${Notif.isSent(n) ? '<span class="pill pub">Envoyée</span>' : '<span class="pill cat-planning">Programmée</span>'}</td>
          <td class="actions"><button class="btn outline sm" data-mail="${n.id}" title="Copier les adresses e-mail des destinataires">E-mails</button> <button class="btn outline sm" data-dup="${n.id}">Dupliquer</button> <button class="btn outline sm" data-ed="${n.id}">Modifier</button> <button class="btn danger sm" data-del="${n.id}">Supprimer</button></td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="empty">Aucune notification.</div>`}`;
    $$("[data-t]", el).forEach((b) => { b.classList.toggle("active", b.dataset.t === NotifState.tab); b.onclick = () => { NotifState.tab = b.dataset.t; draw(); }; });
    $("#nw", el).onclick = () => form(null);
    $$("[data-ed]", el).forEach((b) => b.onclick = () => form(Store.get("notifications", b.dataset.ed)));
    $$("[data-dup]", el).forEach((b) => b.onclick = () => { const { id, ...n } = Store.get("notifications", b.dataset.dup); form({ ...n, titre: n.titre + " (copie)", publishAt: "" }, true); });
    $$("[data-del]", el).forEach((b) => b.onclick = () => { if (UI.confirm("Supprimer cette notification ?")) { Store.del("notifications", b.dataset.del); draw(); } });
    $$("[data-mail]", el).forEach((b) => b.onclick = async () => {
      const mails = Notif.recipients(Store.get("notifications", b.dataset.mail)).map((s) => s.email).filter(Boolean);
      if (!mails.length) return UI.toast("Aucune adresse e-mail renseignée pour ces étudiants.");
      try { await navigator.clipboard.writeText(mails.join("; ")); UI.toast(`${mails.length} adresse(s) copiée(s) : collez-les en Cci dans votre messagerie.`); }
      catch { UI.modal({ title: "Adresses des destinataires", body: `<textarea style="min-height:160px">${esc(mails.join("; "))}</textarea>` }); }
    });
  };

  const form = (n, isCopy) => {
    const isNew = !n || isCopy; n = n ? { ...n } : { categorie: "Planning", formation: "", promotions: [], annee: "" };
    const pub = n.publishAt ? new Date(n.publishAt) : null; const planned = pub && pub > new Date();
    const m = UI.modal({
      title: isNew ? "Nouvelle notification" : "Modifier la notification", submitLabel: "Enregistrer",
      body: `<div class="form-grid">
        <div class="full"><label>Titre</label><input name="titre" required value="${esc(n.titre)}"></div>
        <div><label>Catégorie</label><select name="categorie">${NOTIF_CATS.map((c) => `<option ${c === n.categorie ? "selected" : ""}>${c}</option>`).join("")}</select></div>
        <div><label>Lien (facultatif)</label><input name="lien" type="url" placeholder="https://" value="${esc(n.lien)}"></div>
        <div class="full"><label>Message</label><textarea name="message" required style="min-height:120px">${esc(n.message)}</textarea></div>
        <div><label>Formation</label><select name="formation"><option value="">TN et TAM</option>${Object.entries(S2I.formations).map(([k, v]) => `<option value="${k}" ${n.formation === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label>Année</label><select name="annee"><option value="">Toutes</option><option value="1" ${n.annee == 1 ? "selected" : ""}>1re année</option><option value="2" ${n.annee == 2 ? "selected" : ""}>2e année</option></select></div>
        <div class="full"><label>Promotion(s) — aucune case cochée = toutes les promotions</label><div class="checks">${promos().map((p) => `<label><input type="checkbox" name="promo" value="${esc(p)}" ${(n.promotions || []).includes(p) ? "checked" : ""}> ${esc(p || "Non renseignée")}</label>`).join("") || '<span class="muted">Aucune promotion enregistrée.</span>'}</div></div>
        <div><label>Diffusion</label><select name="when"><option value="now">Immédiate</option><option value="later" ${planned ? "selected" : ""}>Programmée</option></select></div>
        <div id="when-dt" ${planned ? "" : "hidden"}><label>Date et heure de diffusion</label><input name="dt" type="datetime-local" value="${planned ? `${isoDate(pub)}T${pad(pub.getHours())}:${pad(pub.getMinutes())}` : ""}"></div>
        <div class="full"><div class="alert info" id="recip"></div></div></div>`,
      onSubmit: (f) => {
        Object.assign(n, { titre: f.titre.value.trim(), categorie: f.categorie.value, lien: f.lien.value.trim(), message: f.message.value.trim(), formation: f.formation.value,
          annee: f.annee.value, promotions: $$('input[name="promo"]:checked', f).map((i) => i.value) });
        if (f.when.value === "later") {
          if (!f.dt.value) { UI.toast("Choisissez la date et l'heure de diffusion."); return false; }
          n.publishAt = new Date(f.dt.value).toISOString();
        } else if (isNew || planned) n.publishAt = new Date().toISOString();
        if (isNew) { delete n.id; n.createdAt = new Date().toISOString(); }
        const nb = Notif.recipients(n).length;
        if (!nb && !UI.confirm("Aucun étudiant ne correspond à ce ciblage. Enregistrer quand même ?")) return false;
        Store.put("notifications", n);
        UI.toast(Notif.isSent(n) ? `Notification envoyée à ${nb} étudiant(s).` : `Notification programmée le ${fmtDateTime(n.publishAt)} (${nb} étudiant(s)).`); draw();
      }
    });
    const f = $("form", m) || m.querySelector("form");
    const upd = () => {
      const t = { formation: f.formation.value, annee: f.annee.value, promotions: $$('input[name="promo"]:checked', f).map((i) => i.value) };
      const r = Notif.recipients(t); const by = {}; r.forEach((s) => { const k = `${sectionOf(s)} · ${s.promotion || "promotion ?"}`; by[k] = (by[k] || 0) + 1; });
      $("#recip", m).innerHTML = `<b>${r.length}</b> destinataire(s) — ${esc(Notif.targetLabel(t))}${r.length ? `<br><span class="muted">${Object.entries(by).map(([k, v]) => `${esc(k)} : ${v}`).join(" · ")}</span>` : ""}`;
    };
    f.when.onchange = () => { $("#when-dt", m).hidden = f.when.value !== "later"; };
    ["formation", "annee"].forEach((k) => (f[k].onchange = upd)); $$('input[name="promo"]', f).forEach((i) => (i.onchange = upd));
    upd();
  };
  draw();
}

/* ---------- Espace étudiant ---------- */
function StudentNotificationsView(el, user, onRead) {
  const list = Notif.forStudent(user); const read = Notif.readSet(user);
  el.innerHTML = `<div class="page-head"><h1>Notifications</h1><span class="muted">Annonces de la coordination pour votre formation et votre promotion</span></div>
    ${list.length ? list.map((n) => notifCard(n, !read.has(n.id))).join("") : `<div class="alert info">Aucune notification pour le moment.</div>`}`;
  Notif.markRead(user, list.map((n) => n.id));
  if (onRead) onRead();
}
