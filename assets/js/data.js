/* ==========================================================================
   Données de référence : offre de formation 2026-2027 du Master S2I
   + jeu de données de démonstration (comptes fictifs à remplacer).
   ========================================================================== */
const S2I = {
  titre: "Master Systèmes Industriels Intelligents (S2I)",
  annee: "2026-2027",
  formations: { TN: "Formation initiale (TN)", TAM: "Formation à temps aménagé (TAM)" },
  sections: ["TN-1A", "TAM-1A", "TN-2A", "TAM-2A"],
  typesContenu: { cours: "Cours", td: "TD", tp: "TP", devoir: "Devoir" },
  typesSeance: ["Normale", "Rattrapage", "Supplémentaire"],
  natures: ["Cours", "TD", "TP", "Examen", "Contrôle"],
  jours: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  // cat : tech | lang | soft | pfe
  modules: [
    { code: "M1.1", sem: 1, cat: "tech", titre: "Programmation avancée" },
    { code: "M1.2", sem: 1, cat: "tech", titre: "Modélisation, simulation et optimisation des systèmes dynamiques" },
    { code: "M1.3", sem: 1, cat: "tech", titre: "Acquisition de données et actionneurs" },
    { code: "M1.4", sem: 1, cat: "tech", titre: "Data science et analytique pour systèmes industriels intelligents" },
    { code: "M1.5", sem: 1, cat: "tech", titre: "Conception de systèmes intelligents (Design Thinking, Sprint, UML/SysML)" },
    { code: "M1.6", sem: 1, cat: "lang", titre: "Anglais académique et professionnel" },
    { code: "M1.7", sem: 1, cat: "soft", titre: "Compétences en culture et art marocains" },
    { code: "M2.1", sem: 2, cat: "tech", titre: "Programmation des systèmes embarqués et interfaces" },
    { code: "M2.2", sem: 2, cat: "tech", titre: "Intelligence artificielle et apprentissage profond" },
    { code: "M2.3", sem: 2, cat: "tech", titre: "Informatique graphique, conception et développement des jeux" },
    { code: "M2.4", sem: 2, cat: "tech", titre: "Contrôle industriel et robotique" },
    { code: "M2.5", sem: 2, cat: "tech", titre: "Réseaux et cybersécurité" },
    { code: "M2.6", sem: 2, cat: "soft", titre: "Culture entrepreneuriale et techniques de communication" },
    { code: "M2.7", sem: 2, cat: "soft", titre: "Méthodologie de la recherche scientifique" },
    { code: "M3.1", sem: 3, cat: "tech", titre: "Calcul haute performance et cloud computing" },
    { code: "M3.2", sem: 3, cat: "tech", titre: "Sujets avancés en systèmes intelligents : IA générative, systèmes agentiques et automatisation industrielle" },
    { code: "M3.3", sem: 3, cat: "tech", titre: "Vision par ordinateur et Edge AI" },
    { code: "M3.4", sem: 3, cat: "tech", titre: "IoT et Industrie 4.0" },
    { code: "M3.5", sem: 3, cat: "tech", titre: "XR et jumeaux numériques" },
    { code: "M3.6", sem: 3, cat: "tech", titre: "DevOps pour les systèmes intelligents" },
    { code: "M3.7", sem: 3, cat: "tech", titre: "Systèmes de drones autonomes : de la conception matérielle à la vision et au contrôle intelligents" },
    { code: "PFE", sem: 4, cat: "pfe", titre: "Projet de fin d'études (PFE)" }
  ]
};

/* Jeu de démonstration. Les mots de passe sont hachés au premier lancement.
   Changez-les immédiatement depuis l'Espace administrateur. */
const DEMO = {
  adminPassword: "admin2026",
  profs: [
    { id: "p1", login: "aberrahou", nom: "Berrahou", prenom: "Aissam", email: "", modules: ["M2.1", "M2.2", "M3.3"], password: "prof2026" },
    { id: "p2", login: "prof.demo", nom: "Enseignant", prenom: "Démo", email: "", modules: ["M1.1", "M1.4", "M3.4"], password: "prof2026" }
  ],
  students: [
    { id: "e1", login: "S2I-TN1-01", nom: "Alaoui", prenom: "Yassine", formation: "TN", annee: 1, promotion: "2026-2028" },
    { id: "e2", login: "S2I-TN1-02", nom: "Bennani", prenom: "Salma", formation: "TN", annee: 1, promotion: "2026-2028" },
    { id: "e3", login: "S2I-TN1-03", nom: "Chraibi", prenom: "Omar", formation: "TN", annee: 1, promotion: "2026-2028" },
    { id: "e4", login: "S2I-TAM1-01", nom: "Daoudi", prenom: "Khadija", formation: "TAM", annee: 1, promotion: "2026-2028" },
    { id: "e5", login: "S2I-TAM1-02", nom: "El Idrissi", prenom: "Mehdi", formation: "TAM", annee: 1, promotion: "2026-2028" },
    { id: "e6", login: "S2I-TN2-01", nom: "Fassi", prenom: "Imane", formation: "TN", annee: 2, promotion: "2025-2027" },
    { id: "e7", login: "S2I-TN2-02", nom: "Ghazali", prenom: "Anas", formation: "TN", annee: 2, promotion: "2025-2027" },
    { id: "e8", login: "S2I-TAM2-01", nom: "Hajji", prenom: "Nora", formation: "TAM", annee: 2, promotion: "2025-2027" }
  ],
  studentPassword: "etud2026"
};
