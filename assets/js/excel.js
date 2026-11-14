/* ==========================================================================
   Import / export Excel (SheetJS, chargé à la demande depuis assets/js/vendor)
   Formats acceptés : .xlsx, .xls, .csv, .ods
   ========================================================================== */
const Excel = {
  async lib() { if (!window.XLSX) await loadScript("assets/js/vendor/xlsx.full.min.js"); return window.XLSX; },
  norm: (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""),

  /* Renvoie la première feuille sous forme de tableau de lignes (tableaux de cellules) */
  async rows(file) {
    const X = await this.lib();
    const wb = X.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return X.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false });
  },

  /* Détecte la ligne d'en-tête (parmi les 15 premières) et associe les colonnes aux champs.
     aliases : { champ: [noms possibles normalisés] } */
  mapColumns(rows, aliases) {
    let best = { idx: -1, map: {}, score: 0 };
    rows.slice(0, 15).forEach((r, idx) => {
      const map = {};
      r.forEach((cell, ci) => {
        const n = this.norm(cell); if (!n) return;
        for (const [field, names] of Object.entries(aliases)) if (map[field] === undefined && names.includes(n)) { map[field] = ci; break; }
      });
      const score = Object.keys(map).length;
      if (score > best.score) best = { idx, map, score };
    });
    return best;
  },

  /* Heure Excel (fraction de jour) ou texte « 8h30 », « 08:30 », « 8.30 » → « 08:30 » */
  time(v) {
    if (v === "" || v == null) return "";
    if (typeof v === "number") { const mins = Math.round((v % 1) * 24 * 60); return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; }
    const m = String(v).trim().match(/^(\d{1,2})\s*[:hH.]\s*(\d{0,2})/);
    return m ? `${pad(+m[1])}:${pad(+(m[2] || 0))}` : "";
  },
  /* Date Excel (numéro de série) ou texte jj/mm/aaaa → aaaa-mm-jj */
  date(v) {
    if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    const s = String(v).trim(); let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : "";
  },

  /* sheets : [{ name, rows: [[...], ...], widths: [..] }] */
  async download(filename, sheets) {
    const X = await this.lib(); const wb = X.utils.book_new();
    sheets.forEach((s) => {
      const ws = X.utils.aoa_to_sheet(s.rows);
      if (s.widths) ws["!cols"] = s.widths.map((w) => ({ wch: w }));
      X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    });
    X.writeFile(wb, filename);
  }
};

/* ---------- Correspondances communes ---------- */
const Match = {
  formation(v, def) { const n = Excel.norm(v); if (!n) return def; return n.includes("tam") || n.includes("amenag") ? "TAM" : n.includes("tn") || n.includes("initial") || n.includes("normal") ? "TN" : def; },
  annee(v, def) { const n = Excel.norm(v).replace("s2i", ""); if (!n) return def; if (n.includes("2") || /deux|second/.test(n)) return 2; if (n.includes("1") || n.includes("prem")) return 1; return def; },
  section(v, def) {
    const n = Excel.norm(v).replace("s2i", ""); if (!n) return def;
    const f = n.includes("tam") ? "TAM" : n.includes("tn") ? "TN" : null; const y = /2/.test(n) ? 2 : /1/.test(n) ? 1 : null;
    return f && y ? `${f}-${y}A` : def;
  },
  jour(v) {
    if (typeof v === "number" && v >= 1 && v <= 6) return v;
    const n = Excel.norm(v); const i = ["lun", "mar", "mer", "jeu", "ven", "sam"].findIndex((d) => n.startsWith(d));
    return i >= 0 ? i + 1 : 0;
  },
  module(v) {
    const raw = String(v ?? ""); const n = Excel.norm(raw); if (!n) return "";
    const mods = Store.all("modules");
    const code = raw.match(/\bM\s*\d\s*[.,]\s*\d\b|\bPFE\b/i);
    if (code) { const c = Excel.norm(code[0]); const m = mods.find((x) => Excel.norm(x.code) === c); if (m) return m.code; }
    const exact = mods.find((x) => Excel.norm(x.code) === n); if (exact) return exact.code;
    const byTitle = mods.find((x) => n.includes(Excel.norm(x.titre)) || (n.length > 8 && Excel.norm(x.titre).includes(n)));
    return byTitle ? byTitle.code : "";
  },
  prof(v) {
    const n = Excel.norm(v); if (!n) return "";
    const p = Store.all("profs").find((x) => Excel.norm(x.login) === n || n.includes(Excel.norm(x.nom)));
    return p ? p.id : "";
  },
  mode(text, def) { const n = Excel.norm(text); if (/distan|enligne|online|teams|zoom|meet|visio|remote/.test(n)) return "distance"; if (/presentiel|sursite|surplace/.test(n)) return "presentiel"; return def; },
  lien(text) { const m = String(text ?? "").match(/https?:\/\/\S+/); return m ? m[0] : ""; },
  salle(text) { const m = String(text).match(/\b(salle|amphi(?:th[ée][aâ]tre)?|labo(?:ratoire)?|atelier)\s*[\w-]*/i); return m ? m[0].trim() : ""; }
};

function randomPassword() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; const a = new Uint32Array(10); crypto.getRandomValues(a);
  return [...a].map((x) => c[x % c.length]).join("");
}

/* ==========================================================================
   Import des étudiants
   ========================================================================== */
const STUDENT_ALIASES = {
  login: ["code", "cne", "codeetudiant", "matricule", "apogee", "codeapogee", "massar", "codemassar", "identifiant", "login", "numero", "num"],
  nom: ["nom", "nomdefamille", "lastname", "nometprenom", "nomprenom", "nomcomplet"],
  prenom: ["prenom", "firstname"],
  email: ["email", "mail", "courriel", "adressemail", "emailinstitutionnel"],
  formation: ["formation", "filiere", "regime", "typeformation"],
  promotion: ["promotion", "promo", "cohorte", "anneedentree"],
  annee: ["annee", "niveau", "anneedetude", "anneeetude"],
  password: ["motdepasse", "password", "mdp"]
};

function importStudentsDialog(onDone, defaults = {}) {
  const promos = [...new Set(Store.all("students").map((s) => s.promotion).filter(Boolean))].sort().reverse();
  let parsed = null;
  const m = UI.modal({
    title: "Importer une liste d'étudiants (Excel)", wide: true, submitLabel: "Analyser le fichier",
    body: `<p class="muted">Fichier .xlsx, .xls ou .csv avec une ligne d'en-tête. Colonnes reconnues : <b>Code</b> (CNE, Massar, Apogée…), <b>Nom</b>, <b>Prénom</b>, E-mail, Formation, Promotion, Année, Mot de passe.
      Les colonnes absentes sont complétées par les valeurs ci-dessous. <a href="javascript:void 0" id="tplS">Télécharger le modèle Excel</a></p>
      <div class="form-grid">
        <div class="full"><label>Fichier</label><input type="file" name="file" accept=".xlsx,.xls,.csv,.ods" required></div>
        <div><label>Formation (si absente du fichier)</label><select name="formation">${Object.entries(S2I.formations).map(([k, v]) => `<option value="${k}" ${defaults.formation === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label>Promotion (si absente)</label><input name="promotion" list="dl-promos" value="${esc(defaults.promotion || "")}" placeholder="ex. 2026-2028"><datalist id="dl-promos">${promos.map((p) => `<option value="${esc(p)}">`).join("")}</datalist></div>
        <div><label>Année (si absente)</label><select name="annee"><option value="1" ${defaults.annee == 2 ? "" : "selected"}>1re année</option><option value="2" ${defaults.annee == 2 ? "selected" : ""}>2e année</option></select></div>
        <div><label>Mots de passe</label><select name="pwmode"><option value="random">Générer automatiquement (liste téléchargée)</option><option value="file">Colonne « Mot de passe » du fichier</option></select></div>
        <div class="full checks"><label><input type="checkbox" name="update" checked> Mettre à jour les étudiants déjà inscrits (même code)</label></div>
      </div><div id="preview" style="margin-top:16px"></div>`,
    onSubmit: async (f) => {
      if (!parsed) { await analyze(f); return false; }
      await commit(f); onDone && onDone();
    }
  });
  $("#tplS", m).onclick = () => Excel.download("modele_etudiants_S2I.xlsx", [{ name: "Etudiants", widths: [16, 18, 18, 28, 12, 14, 8],
    rows: [["Code", "Nom", "Prénom", "E-mail", "Formation", "Promotion", "Année"], ["S2I-TN1-10", "Amrani", "Sara", "sara.amrani@um5r.ac.ma", "TN", "2026-2028", 1], ["S2I-TAM1-10", "Bakkali", "Hamza", "", "TAM", "2026-2028", 1]] }]);
  $('[name="file"]', m).onchange = () => { parsed = null; $("#preview", m).innerHTML = ""; $(".modal-f .btn:not(.outline)", m).textContent = "Analyser le fichier"; };

  async function analyze(f) {
    const file = f.file.files[0]; if (!file) return;
    let rows;
    try { rows = await Excel.rows(file); } catch (e) { UI.toast("Lecture impossible : " + e.message); return; }
    const { idx, map } = Excel.mapColumns(rows, STUDENT_ALIASES);
    if (idx < 0 || map.login === undefined || map.nom === undefined) {
      $("#preview", m).innerHTML = `<div class="alert warn">Colonnes « Code » et « Nom » introuvables dans les 15 premières lignes. Utilisez le modèle Excel.</div>`; return;
    }
    const def = { formation: f.formation.value, promotion: f.promotion.value.trim(), annee: Number(f.annee.value) };
    const seen = new Set(); const existing = Object.fromEntries(Store.all("students").map((s) => [s.login.toLowerCase(), s]));
    parsed = rows.slice(idx + 1).map((r, i) => {
      const get = (k) => (map[k] === undefined ? "" : String(r[map[k]] ?? "").trim());
      const o = { line: idx + i + 2, login: get("login"), nom: get("nom"), prenom: get("prenom"), email: get("email"),
        formation: Match.formation(get("formation"), def.formation), promotion: get("promotion") || def.promotion,
        annee: Match.annee(get("annee"), def.annee), password: get("password") };
      if (map.prenom === undefined && o.nom.includes(" ")) { const p = o.nom.split(/\s+/); o.nom = p[0]; o.prenom = p.slice(1).join(" "); }
      const key = o.login.toLowerCase();
      if (!o.login && !o.nom) o.skip = true;
      else if (!o.login || !o.nom) o.error = "Code ou nom manquant";
      else if (seen.has(key)) o.error = "Code en double dans le fichier";
      else if (f.pwmode.value === "file" && !o.password && !existing[key]) o.error = "Mot de passe manquant";
      else o.status = existing[key] ? (f.update.checked ? "maj" : "ignore") : "nouveau";
      seen.add(key); return o;
    }).filter((o) => !o.skip);
    const n = (s) => parsed.filter((o) => o.status === s).length; const ne = parsed.filter((o) => o.error).length;
    const badge = (o) => o.error ? `<span class="pill off">${esc(o.error)}</span>` : { nouveau: '<span class="pill pub">Nouveau</span>', maj: '<span class="pill t-cours">Mise à jour</span>', ignore: '<span class="pill draft">Déjà inscrit (ignoré)</span>' }[o.status];
    $("#preview", m).innerHTML = `<div class="alert info"><b>${parsed.length}</b> ligne(s) lues — ${n("nouveau")} nouveau(x), ${n("maj")} mise(s) à jour, ${n("ignore")} ignoré(s), ${ne} erreur(s).
        Colonnes détectées : ${Object.keys(map).map((k) => `<code>${k}</code>`).join(", ")}.</div>
      <div class="table-scroll" style="max-height:320px;overflow-y:auto;margin-top:10px"><table class="data"><thead><tr><th>Ligne</th><th>Code</th><th>Nom</th><th>Prénom</th><th>Formation</th><th>Promotion</th><th>Année</th><th>État</th></tr></thead><tbody>
      ${parsed.map((o) => `<tr><td>${o.line}</td><td>${esc(o.login)}</td><td>${esc(o.nom)}</td><td>${esc(o.prenom)}</td><td>${o.formation}</td><td>${esc(o.promotion || "—")}</td><td>${o.annee}</td><td>${badge(o)}</td></tr>`).join("")}</tbody></table></div>`;
    const ok = n("nouveau") + n("maj");
    const btn = $(".modal-f .btn:not(.outline)", m); btn.textContent = `Importer ${ok} étudiant(s)`; btn.disabled = !ok; if (!ok) parsed = null;
  }

  async function commit(f) {
    const creds = []; const byLogin = Object.fromEntries(Store.all("students").map((s) => [s.login.toLowerCase(), s]));
    for (const o of parsed.filter((x) => x.status === "nouveau" || x.status === "maj")) {
      const cur = byLogin[o.login.toLowerCase()];
      const s = cur ? { ...cur } : { inactif: false };
      Object.assign(s, { login: o.login, nom: o.nom, prenom: o.prenom, formation: o.formation, promotion: o.promotion, annee: o.annee });
      if (o.email) s.email = o.email; else if (!cur) s.email = "";
      let pw = f.pwmode.value === "file" ? o.password : "";
      if (!pw && !cur) pw = randomPassword();
      if (pw) { s.passHash = await hashPwd(pw); creds.push([o.login, o.nom, o.prenom, `${o.formation}-${o.annee}A`, o.promotion, pw]); }
      Store.put("students", s);
    }
    const nb = parsed.filter((x) => x.status === "nouveau" || x.status === "maj").length;
    if (creds.length && f.pwmode.value === "random") {
      await Excel.download(`identifiants_etudiants_${todayISO()}.xlsx`, [{ name: "Identifiants", widths: [16, 18, 18, 10, 12, 14],
        rows: [["Code (identifiant)", "Nom", "Prénom", "Section", "Promotion", "Mot de passe"], ...creds] }]);
      UI.toast(`${nb} étudiant(s) importé(s). Liste des identifiants téléchargée.`);
    } else UI.toast(`${nb} étudiant(s) importé(s).`);
  }
}

/* ==========================================================================
   Import de l'emploi du temps
   Deux formats :  1) liste (une ligne par créneau)  2) grille (jours en colonnes, créneaux en lignes)
   ========================================================================== */
const TT_ALIASES = {
  section: ["section", "groupe", "classe", "promotion", "filiere"],
  jour: ["jour", "day"],
  debut: ["debut", "heuredebut", "de", "start", "hdebut"],
  fin: ["fin", "heurefin", "a", "end", "hfin"],
  horaire: ["horaire", "creneau", "heure", "heures"],
  module: ["module", "matiere", "cours", "element", "intitule"],
  salle: ["salle", "local", "lieu"],
  prof: ["enseignant", "professeur", "prof", "intervenant"],
  mode: ["mode", "modalite", "modeenseignement", "modedenseignement", "typeseance"],
  lien: ["lien", "url", "lienvisio", "lienseance"],
  semaine: ["semaine", "week", "debutsemaine", "date"]
};

function importTimetableDialog(onDone) {
  let parsed = null;
  const m = UI.modal({
    title: "Importer l'emploi du temps (Excel)", wide: true, submitLabel: "Analyser le fichier",
    body: `<p class="muted">Deux présentations sont reconnues :
      <b>liste</b> (colonnes Section, Jour, Début, Fin, Module, Salle, Enseignant, et en option Mode, Lien, Semaine) ou <b>grille</b> (jours en colonnes, créneaux « 08:30-10:30 » en lignes, chaque case contenant le code du module, la salle, l'enseignant, et « à distance » + lien le cas échéant).
      Modèles : <a href="javascript:void 0" id="tplL">liste</a> · <a href="javascript:void 0" id="tplG">grille</a></p>
      <div class="form-grid">
        <div class="full"><label>Fichier</label><input type="file" name="file" accept=".xlsx,.xls,.csv,.ods" required></div>
        <div><label>Section (si absente du fichier / grille)</label><select name="section">${S2I.sections.map((s) => `<option>${s}</option>`).join("")}</select></div>
        <div><label>Semaine</label><select name="semaine">${weekOptions(TTWeek.monday).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        <div><label>Mode d'enseignement par défaut</label><select name="defmode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div><label>Import</label><select name="mode"><option value="replace">Remplacer les créneaux de la même semaine</option><option value="append">Ajouter aux créneaux existants</option></select></div>
      </div><div id="preview" style="margin-top:16px"></div>`,
    onSubmit: async (f) => { if (!parsed) { await analyze(f); return false; } commit(f); onDone && onDone(); }
  });
  $("#tplL", m).onclick = () => Excel.download("modele_emploi_du_temps_liste.xlsx", [{ name: "EDT", widths: [10, 12, 8, 8, 12, 14, 20, 12, 30],
    rows: [["Section", "Jour", "Début", "Fin", "Module", "Salle", "Enseignant", "Mode", "Lien"], ["TN-1A", "Lundi", "08:30", "10:30", "M2.1", "Salle B12", "aberrahou", "Présentiel", ""], ["TN-1A", "Mardi", "10:45", "12:45", "M2.2", "", "Berrahou", "À distance", "https://teams.microsoft.com/…"], ["TAM-1A", "Samedi", "09:00", "12:00", "M2.1", "Labo SE", "aberrahou", "Présentiel", ""]] }]);
  $("#tplG", m).onclick = () => Excel.download("modele_emploi_du_temps_grille.xlsx", [{ name: "TN-1A", widths: [14, 24, 24, 24, 24, 24, 24],
    rows: [["Créneau", ...S2I.jours], ["08:30-10:30", "M2.1 Salle B12 Pr. Berrahou", "", "M2.4 Labo Robotique", "", "", ""], ["10:45-12:45", "M2.2 Amphi 2 Pr. Berrahou", "M2.5 Salle A04", "", "", "", ""], ["14:00-16:00", "", "M2.3 Salle C01", "", "M2.6 Salle A02", "M2.2 À distance https://teams.microsoft.com/…", ""], ["16:15-18:15", "", "", "", "", "", ""]] }]);
  $('[name="file"]', m).onchange = () => { parsed = null; $("#preview", m).innerHTML = ""; $(".modal-f .btn:not(.outline)", m).textContent = "Analyser le fichier"; };

  async function analyze(f) {
    const file = f.file.files[0]; if (!file) return;
    let rows; try { rows = await Excel.rows(file); } catch (e) { UI.toast("Lecture impossible : " + e.message); return; }
    const defSec = f.section.value;
    // Grille ? une ligne d'en-tête contenant au moins 3 noms de jours
    const gIdx = rows.slice(0, 15).findIndex((r) => r.filter((c) => Match.jour(c) && typeof c !== "number").length >= 3);
    parsed = [];
    if (gIdx >= 0) {
      const head = rows[gIdx]; const dayCols = head.map((c, i) => [i, typeof c === "number" ? 0 : Match.jour(c)]).filter(([, d]) => d);
      rows.slice(gIdx + 1).forEach((r, ri) => {
        const t = String(r[0] ?? "").match(/(\d{1,2}\s*[:hH.]\s*\d{0,2})\s*[-–à]+\s*(\d{1,2}\s*[:hH.]\s*\d{0,2})/);
        if (!t) return;
        dayCols.forEach(([ci, d]) => {
          const cell = String(r[ci] ?? "").trim(); if (!cell) return;
          const o = { line: gIdx + ri + 2, section: defSec, jour: d, debut: Excel.time(t[1]), fin: Excel.time(t[2]), module: Match.module(cell), salle: Match.salle(cell), profId: Match.prof(cell), src: cell,
            mode: Match.mode(cell, f.defmode.value), lien: Match.lien(cell), semaine: f.semaine.value };
          check(o); parsed.push(o);
        });
      });
    } else {
      const { idx, map } = Excel.mapColumns(rows, TT_ALIASES);
      if (idx < 0 || map.jour === undefined || map.module === undefined) {
        $("#preview", m).innerHTML = `<div class="alert warn">Format non reconnu : colonnes « Jour » et « Module » introuvables, et aucune grille de jours détectée. Utilisez un des modèles.</div>`; parsed = null; return;
      }
      rows.slice(idx + 1).forEach((r, i) => {
        const get = (k) => (map[k] === undefined ? "" : r[map[k]]);
        let debut = Excel.time(get("debut")), fin = Excel.time(get("fin"));
        if ((!debut || !fin) && map.horaire !== undefined) { const t = String(get("horaire")).split(/[-–à]/); debut = Excel.time(t[0]); fin = Excel.time(t[1]); }
        const o = { line: idx + i + 2, section: Match.section(get("section"), defSec), jour: Match.jour(get("jour")), debut, fin,
          module: Match.module(get("module")), salle: String(get("salle") || "").trim(), profId: Match.prof(get("prof")), src: String(get("module")),
          mode: Match.mode(get("mode") || get("salle"), f.defmode.value), lien: Match.lien(get("lien")), semaine: get("semaine") !== "" && Excel.date(get("semaine")) ? mondayOf(Excel.date(get("semaine"))) : f.semaine.value };
        if (!String(get("jour")).trim() && !String(get("module")).trim()) return;
        check(o); parsed.push(o);
      });
    }
    function check(o) {
      if (!o.jour) o.error = "Jour non reconnu"; else if (!o.debut || !o.fin || o.fin <= o.debut) o.error = "Horaire invalide";
      else if (!o.module) o.error = "Module non reconnu";
    }
    const ok = parsed.filter((o) => !o.error);
    const secs = [...new Set(ok.map((o) => o.section))];
    $("#preview", m).innerHTML = `<div class="alert info">Format <b>${gIdx >= 0 ? "grille" : "liste"}</b> — ${parsed.length} créneau(x) lus, <b>${ok.length}</b> valide(s), ${parsed.length - ok.length} erreur(s). Section(s) : ${secs.join(", ") || "—"}. ${f.semaine.value ? weekLabel(f.semaine.value) : "Créneaux récurrents (toutes les semaines)"}.
        ${f.mode.value === "replace" && secs.length ? `Les créneaux existants de ${secs.join(", ")} pour la même semaine seront remplacés.` : ""}</div>
      <div class="table-scroll" style="max-height:320px;overflow-y:auto;margin-top:10px"><table class="data"><thead><tr><th>Ligne</th><th>Section</th><th>Jour</th><th>Horaire</th><th>Module</th><th>Mode</th><th>Salle</th><th>Enseignant</th><th>État</th></tr></thead><tbody>
      ${parsed.map((o) => `<tr><td>${o.line}</td><td>${o.section}</td><td>${S2I.jours[o.jour - 1] || "?"}</td><td>${o.debut || "?"} – ${o.fin || "?"}</td><td>${esc(o.module || o.src)}</td><td>${modePill(o.mode, o.lien)}</td><td>${esc(o.salle)}</td><td>${o.profId ? esc(UI.profName(o.profId)) : "—"}</td>
        <td>${o.error ? `<span class="pill off">${o.error}</span>` : '<span class="pill pub">OK</span>'}</td></tr>`).join("")}</tbody></table></div>
      <p class="muted">Un enseignant non reconnu reste vide : vous pourrez l'ajouter ensuite. Les créneaux en erreur ne sont pas importés.</p>`;
    const btn = $(".modal-f .btn:not(.outline)", m); btn.textContent = `Importer ${ok.length} créneau(x)`; btn.disabled = !ok.length; if (!ok.length) parsed = null;
  }

  function commit(f) {
    const ok = parsed.filter((o) => !o.error); const secs = [...new Set(ok.map((o) => o.section))];
    const weeks = [...new Set(ok.map((o) => o.semaine || ""))];
    if (f.mode.value === "replace") Store.all("timetable").filter((t) => secs.includes(t.section) && weeks.includes(t.semaine || "")).forEach((t) => Store.del("timetable", t.id));
    ok.forEach(({ section, jour, debut, fin, module, salle, profId, mode, lien, semaine }) => Store.put("timetable", { section, jour, debut, fin, module, salle: mode === "distance" ? salle : salle || "—", profId, mode, lien, semaine: semaine || "" }));
    UI.toast(`${ok.length} créneau(x) importé(s).`);
  }
}
