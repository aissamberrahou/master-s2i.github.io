/* ==========================================================================
   Import des données initiales dans Firestore — projet master-s2i

   Utilisation (dans le dossier firebase/) :
     npm install
     node import-firestore.mjs <clé-compte-de-service.json> <e-mail-administrateur> [--ecraser] [--simulation]

   - Les documents déjà présents ne sont PAS remplacés, sauf avec --ecraser.
   - Crée (ou retrouve) le compte administrateur dans Firebase Authentication,
     son profil users/{uid} (rôle admin), et affiche un lien pour définir son mot de passe.
   - --simulation : vérifie le fichier sans rien écrire.
   ========================================================================== */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [keyPath, adminEmail] = args.filter((a) => !a.startsWith("--"));
const SIMULATION = flags.has("--simulation");
const ECRASER = flags.has("--ecraser");
const PROJECT = "master-s2i";

const data = JSON.parse(readFileSync(new URL("./donnees-initiales.json", import.meta.url), "utf8"));
const COLLECTIONS = ["modules", "promotions", "profs", "students", "timetable", "sessions", "contents", "messages", "notifications", "exams", "soutenances"];

console.log(`\nMaster S2I — import Firestore (${data._meta?.anneeUniversitaire || ""})`);
for (const c of COLLECTIONS) console.log(`  ${c.padEnd(14)} ${(data[c] || []).length} document(s)`);
console.log(`  config/settings  1 document`);

if (SIMULATION) {
  const ids = new Set();
  for (const c of COLLECTIONS) for (const d of data[c] || []) {
    if (!d.id) throw new Error(`Document sans id dans ${c}`);
    if (ids.has(c + "/" + d.id)) throw new Error(`id en double : ${c}/${d.id}`);
    ids.add(c + "/" + d.id);
  }
  console.log("\nSimulation : fichier valide, rien n'a été écrit.");
  process.exit(0);
}

if (!keyPath || !adminEmail) {
  console.error("\nUsage : node import-firestore.mjs <clé-compte-de-service.json> <e-mail-administrateur> [--ecraser]");
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const { getAuth } = await import("firebase-admin/auth");

const sa = JSON.parse(readFileSync(keyPath, "utf8"));
if (sa.project_id !== PROJECT) console.warn(`\n⚠ La clé appartient au projet « ${sa.project_id} » (attendu : ${PROJECT}). L'import continue dans ${sa.project_id}.`);
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

let written = 0, skipped = 0;
async function writeAll(col, docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const refs = chunk.map((d) => db.collection(col).doc(String(d.id)));
    const snaps = ECRASER ? [] : await db.getAll(...refs);
    const batch = db.batch(); let n = 0;
    chunk.forEach((d, k) => {
      if (!ECRASER && snaps[k].exists) { skipped++; return; }
      batch.set(refs[k], d); n++;
    });
    if (n) { await batch.commit(); written += n; }
  }
}

console.log(`\nÉcriture dans ${sa.project_id}${ECRASER ? " (mode --ecraser)" : ""}…`);
for (const c of COLLECTIONS) if ((data[c] || []).length) await writeAll(c, data[c]);
await writeAll("config", [{ id: "settings", ...data.settings }]);

// Compte administrateur
let user;
try { user = await auth.getUserByEmail(adminEmail); console.log(`Compte administrateur existant : ${adminEmail}`); }
catch { user = await auth.createUser({ email: adminEmail, emailVerified: false, displayName: "Administrateur Master S2I" }); console.log(`Compte administrateur créé : ${adminEmail}`); }
await db.collection("users").doc(user.uid).set({ role: "admin", refId: "admin", email: adminEmail, createdAt: new Date().toISOString() }, { merge: true });
const link = await auth.generatePasswordResetLink(adminEmail, { url: data.settings.siteUrl + "connexion.html?role=admin" });

console.log(`\n✅ Terminé : ${written} document(s) écrit(s), ${skipped} déjà présent(s) conservé(s).`);
console.log(`\nLien pour définir le mot de passe administrateur (valable environ 1 heure) :\n${link}\n`);
process.exit(0);
