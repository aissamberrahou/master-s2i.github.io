/* ==========================================================================
   Comptes Firebase (mode Firebase uniquement)
   L'administrateur crée le compte de connexion d'un étudiant ou d'un enseignant ;
   Firebase envoie alors à la personne un e-mail pour définir son mot de passe
   (modèle « Réinitialisation du mot de passe » de la console Firebase).
   ========================================================================== */
const Accounts = {
  _creator: null,
  /* Deuxième instance Firebase : crée les comptes sans déconnecter l'administrateur */
  creator() {
    if (!this._creator) {
      const app = firebase.apps.find((a) => a.name === "creator") || firebase.initializeApp(window.FIREBASE_CONFIG, "creator");
      this._creator = app.auth();
      if (this._creator.setPersistence) this._creator.setPersistence(firebase.auth.Auth.Persistence.NONE);
    }
    return this._creator;
  },
  loginUrl(kind) {
    const base = Store.settings().siteUrl || location.href.replace(/[^/]*([?#].*)?$/, "");
    return (base.endsWith("/") ? base : base + "/") + "connexion.html?role=" + (kind === "student" ? "etudiant" : "prof");
  },
  /* Crée le compte s'il n'existe pas, relie le profil (rôle) et envoie l'e-mail d'activation */
  async activate(kind, account) {
    const col = kind === "student" ? "students" : "profs";
    let acc = { ...(Store.get(col, account.id) || account) };
    const email = (acc.email || "").trim().toLowerCase();
    if (!email) throw Object.assign(new Error("Adresse e-mail manquante"), { code: "s2i/no-email" });
    let created = false;
    if (!acc.uid) {
      const tmp = randomPassword() + "#9Aa";
      const cred = await this.creator().createUserWithEmailAndPassword(email, tmp);
      acc.uid = cred.user.uid; created = true;
      await this.creator().signOut();
    }
    acc.email = email; acc.mustChange = false; delete acc.passHash;
    await Store.putAwait(col, acc); // écrit la fiche et le profil users/{uid}
    await Store.auth.sendPasswordResetEmail(email, { url: this.loginUrl(kind) });
    acc.credsSentAt = new Date().toISOString();
    await Store.putAwait(col, acc);
    return { acc, created };
  },
  errorText(e) {
    return {
      "s2i/no-email": "Pas d'adresse e-mail",
      "auth/email-already-in-use": "Un compte existe déjà pour cet e-mail (à supprimer dans la console Firebase › Authentication, puis réessayer)",
      "auth/invalid-email": "Adresse e-mail invalide",
      "auth/too-many-requests": "Trop de demandes : réessayez plus tard",
      "permission-denied": "Action non autorisée (règles Firestore)"
    }[e.code] || (e.message || "Erreur");
  }
};

/* items : [{ kind: "student" | "prof", account }] — crée les accès et envoie les e-mails */
function activateAccountsDialog(items, { title, onClose } = {}) {
  if (!items.length) return;
  const rows = items.map((it) => ({ it, status: "pending" }));
  const md = UI.modal({
    title: title || "Accès à la plateforme : envoi des e-mails d'activation", wide: true, submitLabel: "Fermer",
    body: `<div class="alert info">Pour chaque personne, la plateforme crée le compte de connexion (si besoin) et Firebase envoie un e-mail
        avec un lien pour <b>définir son mot de passe</b>. Elle se connecte ensuite avec son adresse e-mail.</div>
      <div class="table-scroll" style="max-height:360px;overflow-y:auto;margin-top:12px"><table class="data"><thead><tr><th>Nom</th><th>E-mail</th><th>État</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${esc(`${r.it.account.prenom || ""} ${r.it.account.nom || ""}`)}</td><td>${esc(r.it.account.email || "—")}</td><td data-st="${i}"></td></tr>`).join("")}</tbody></table></div>
      <p class="muted" id="act-sum"></p>`,
    onSubmit: () => { if (onClose) onClose(); }
  });
  $(".modal-f .cancel", md).style.display = "none";
  const paint = (i) => {
    const r = rows[i];
    $(`[data-st="${i}"]`, md).innerHTML = {
      pending: '<span class="pill draft">En attente</span>', running: '<span class="pill t-cours">Envoi…</span>',
      created: '<span class="pill pub">Compte créé, e-mail envoyé</span>', sent: '<span class="pill pub">E-mail envoyé</span>',
      error: `<span class="pill off">${esc(r.err)}</span>`
    }[r.status];
  };
  rows.forEach((_, i) => paint(i));
  (async () => {
    let ok = 0, ko = 0;
    for (const [i, r] of rows.entries()) {
      r.status = "running"; paint(i);
      try { const res = await Accounts.activate(r.it.kind, r.it.account); r.status = res.created ? "created" : "sent"; ok++; }
      catch (e) { console.error(e); r.status = "error"; r.err = Accounts.errorText(e); ko++; }
      paint(i);
    }
    $("#act-sum", md).textContent = `${ok} e-mail(s) envoyé(s)${ko ? `, ${ko} erreur(s)` : ""}. Les personnes doivent cliquer sur le lien reçu (vérifier aussi les courriers indésirables).`;
    UI.toast(`${ok} e-mail(s) d'activation envoyé(s)${ko ? `, ${ko} erreur(s)` : ""}.`);
  })();
}
