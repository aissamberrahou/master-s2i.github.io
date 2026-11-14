# Master S2I — Systèmes Industriels Intelligents (ENSIAS)

Site de présentation et plateforme de gestion du **Master S2I** de l'ENSIAS, Université Mohammed V de Rabat.
Le site est statique (HTML, CSS, JavaScript) et hébergé gratuitement par GitHub Pages.

## Contenu

| Page | Rôle |
|---|---|
| `index.html` | Présentation de la formation et programme S1 à S4 (offre de formation 2026-2027) |
| `connexion.html` | Connexion aux trois espaces (identifiant et mot de passe) |
| `prof.html` | **Espace Professeur** : absences TN/TAM, contenus pédagogiques, messagerie, emploi du temps, examens |
| `etudiant.html` | **Espace Étudiant** : contenus publiés, mes absences, emploi du temps, notifications, examens et soutenances |
| `admin.html` | **Espace Administrateur** : accès complet (étudiants, enseignants, modules, emploi du temps, examens, soutenances, sauvegarde) |

### Saisie des absences (inspirée de Canvas UM6P Attendance)
1. Choisir le module.
2. Dans **Feuille de présence**, choisir la section (TN-1A, TAM-1A, TN-2A, TAM-2A), la date, l'horaire, le type de séance et la nature, puis cliquer sur **Créer la feuille**.
3. Faire l'appel : P (présent), A (absent), R (retard), J (absence justifiée), avec une remarque si besoin.
4. Les onglets Aujourd'hui, À venir, Passées, Toutes, Calendrier et Récapitulatif donnent le suivi. Le récapitulatif affiche le taux d'absence par étudiant et l'export CSV fournit la feuille complète.

### Étudiants par formation et promotion (Administration > Étudiants)
- Tableau **Promotions** : effectif par formation (TN / TAM) et par promotion (ex. 2026-2028), avec les actions Afficher, Passer en 2e année, Désactiver ou Réactiver, Importer et Supprimer.
- Filtres par formation, promotion, année et statut, recherche, et export Excel de la liste filtrée.
- **Import Excel** (.xlsx, .xls, .csv) : la ligne d'en-tête est détectée automatiquement (même sous un titre). Les colonnes reconnues sont Code (CNE, Massar, Apogée…), Nom, Prénom, E-mail, Formation, Promotion, Année et Mot de passe. Un aperçu indique les étudiants nouveaux, ceux à mettre à jour et les erreurs avant l'import.
  Les mots de passe peuvent être générés automatiquement : un fichier Excel des identifiants est alors téléchargé, à distribuer aux étudiants.
- Les étudiants importés apparaissent aussitôt dans la feuille de présence de leur section (formation + année).

### Emploi du temps par semaine (Administration > Emploi du temps)
- Navigation semaine par semaine (‹ ›), avec la date de chaque jour. Le même affichage est utilisé dans les espaces Prof et Étudiant.
- Chaque séance est **récurrente** (toutes les semaines) ou **ponctuelle** (une semaine donnée). Une séance récurrente peut être **annulée pour une semaine** précise.
- **Dupliquer la semaine** vers une autre semaine : les séances récurrentes copiées remplacent l'original pour la semaine cible.
- **Mode d'enseignement** : 🏫 Présentiel (salle) ou 💻 À distance (lien Teams, Meet, Zoom… avec un bouton « Rejoindre » pour les étudiants). Le mode est aussi enregistré sur chaque feuille de présence.

### Notifications des étudiants — Planning (Administration > Notifications)
- Ciblage par **formation** (TN, TAM ou les deux), **promotion(s)** et **année**. Le nombre de destinataires s'affiche avant l'envoi.
- Diffusion **immédiate** ou **programmée** (date et heure). Catégories : Information, Planning, Examen, Soutenance, Urgent.
- Les étudiants voient leurs notifications dans l'onglet « Notifications » (badge non lu) et sur leur page d'accueil.
- Bouton « E-mails » : copie les adresses des destinataires, à coller en Cci dans votre messagerie.

### Import Excel de l'emploi du temps
- Import dans une semaine précise ou en récurrent. Le mode « à distance » est détecté (mots « distance », « en ligne », « Teams », « Zoom »… et lien).
- Deux présentations sont reconnues :
  - *liste* : une ligne par créneau (Section, Jour, Début, Fin, Module, Salle, Enseignant) ;
  - *grille* : jours en colonnes, créneaux « 08:30-10:30 » en lignes, chaque case contenant le code du module (ex. M2.1), la salle et l'enseignant.
- Le module est reconnu par son code ou son intitulé, l'enseignant par son identifiant ou son nom. Un aperçu signale les lignes en erreur.
- Mode « remplacer » (les créneaux existants des sections importées sont remplacés) ou « ajouter ». Modèles Excel et export disponibles.

### Contenus pédagogiques
Cours, TD, TP et devoirs : ajouter, modifier, supprimer, **publier** (visible par les étudiants des sections choisies), **dépublier** ou **désactiver**.
À la publication, un message est envoyé automatiquement dans la messagerie du module et de la section concernés.

## Comptes de démonstration

| Espace | Identifiant | Mot de passe |
|---|---|---|
| Professeur | `aberrahou` | `prof2026` |
| Étudiant | `S2I-TN1-01` | `etud2026` |
| Administrateur | — | `admin2026` |

⚠️ **À faire tout de suite** : changez le mot de passe administrateur (Administration > Paramètres). Remplacez ensuite les étudiants et enseignants fictifs, puis cochez « Masquer les comptes de démonstration ».

## Images à ajouter

Placez ces fichiers dans `assets/img/`. Tant qu'ils sont absents, le site affiche un texte de remplacement.

| Fichier | Contenu |
|---|---|
| `logo-ensias.png` | Logo officiel de l'ENSIAS (fond transparent de préférence) |
| `logo-um5.png` | Logo officiel de l'Université Mohammed V de Rabat |
| `ensias.jpg` | Photo de l'ENSIAS pour la page d'accueil (environ 1920×800 px) |

Le logo du master (`logo-s2i.svg`, `logo-s2i-icon.svg`) est fourni.

## Important : où sont stockées les données ?

**Mode démonstration (par défaut)** : les données sont enregistrées dans le navigateur (localStorage). Chaque ordinateur a donc ses propres données : un contenu publié par un professeur sur son poste **n'apparaît pas** chez les étudiants.
Ce mode sert à tester la plateforme. L'export et l'import JSON (Paramètres) permettent de sauvegarder ou de transférer les données.

**Mode partagé (Firebase, gratuit)** : pour que tout le monde voie les mêmes données :
1. Créer un projet sur https://console.firebase.google.com, puis ajouter une application Web.
2. Activer **Firestore Database**.
3. Copier la configuration dans `assets/js/firebase-config.js` (`window.FIREBASE_CONFIG = {...}`).
4. Au premier chargement, le jeu de démonstration est créé dans Firestore.

### Sécurité
Les mots de passe sont hachés (SHA-256), mais la vérification se fait dans le navigateur. Cela suffit pour un usage interne. En mode Firebase, les règles Firestore doivent être restreintes avant une mise en production, idéalement avec Firebase Authentication. Le site ne doit pas contenir de données sensibles (notes officielles, données personnelles détaillées) tant que ce durcissement n'est pas fait.

## Publication sur GitHub Pages
Settings → Pages → Source : *Deploy from a branch* → branche `main`, dossier `/ (root)`.
Le site sera disponible à l'adresse `https://aissamberrahou.github.io/master-s2i/`.

## Structure
```
assets/css/style.css         Styles (palette ENSIAS : bleu marine, grenat)
assets/js/data.js            Offre de formation (modules S1–S4) et comptes de démonstration
assets/js/core.js            Stockage, authentification, utilitaires d'interface
assets/js/components.js      Absences, contenus, messagerie, emploi du temps, examens
assets/js/excel.js           Import / export Excel (étudiants, emploi du temps)
assets/js/admin-students.js  Gestion des étudiants par formation et promotion
assets/js/vendor/            SheetJS 0.18.5 (lecture/écriture Excel, licence Apache 2.0)
assets/js/firebase-config.js Configuration Firebase (optionnelle)
```

Coordination : [Pr. Aissam Berrahou](https://aissamberrahou.github.io/)
