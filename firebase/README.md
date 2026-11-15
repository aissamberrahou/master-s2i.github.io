# Base de données Firestore — Master S2I

Projet Firebase : **ensias-master-s2i**

Ce dossier contient tout ce qu'il faut pour créer la base de données de la plateforme :

| Fichier | Rôle |
|---|---|
| `donnees-initiales.json` | Données de départ : paramètres, 22 modules de l'offre 2026-2027, promotions, 6 enseignants, 39 créneaux des emplois du temps TN-1A et TAM-1A (S1) |
| `firestore.rules` | Règles de sécurité par rôle (administrateur, enseignant, étudiant) |
| `import-firestore.mjs` | Script d'import vers Firestore, qui crée aussi le compte administrateur |
| `package.json` | Dépendance `firebase-admin` |

## Modèle de données

Chaque collection Firestore correspond à une fonction du site. L'identifiant du document est le champ `id`.

| Collection | Contenu | Champs principaux |
|---|---|---|
| `config/settings` | Paramètres généraux | `titre`, `annee`, `formations`, `sections`, `typesContenu`, `natures`, `siteUrl`, `mailTemplates` |
| `users/{uid}` | Profil de connexion, une entrée par compte Firebase Authentication | `role` (`admin`, `prof`, `student`), `refId` (id dans `profs` ou `students`), `section` (étudiant), `email` |
| `modules` | Modules de la formation (S1 à S4) | `code`, `titre`, `sem` (1 à 4), `cat` (`tech`, `lang`, `soft`, `pfe`) |
| `promotions` | Promotions par formation | `formation` (`TN`, `TAM`), `promotion` (ex. `2026-2028`), `annee` (1 ou 2) |
| `profs` | Enseignants | `login`, `nom`, `prenom`, `email`, `modules[]`, `inactif`, `uid`, `credsSentAt` |
| `students` | Étudiants | `login` (code CNE/Massar), `nom`, `prenom`, `email`, `formation`, `promotion`, `annee`, `inactif`, `uid`, `credsSentAt` |
| `timetable` | Créneaux de l'emploi du temps | `section`, `jour` (1 = lundi … 6 = samedi), `debut`, `fin`, `module`, `salle`, `profId` / `profNom`, `mode` (`presentiel`, `distance`), `lien`, `semaine` (vide = récurrent, sinon le lundi `AAAA-MM-JJ`), `exceptions[]` (semaines annulées) |
| `sessions` | Feuilles de présence | `module`, `section`, `date`, `debut`, `fin`, `type`, `nature`, `mode`, `profId`, `records` {idÉtudiant: `P`, `A`, `R` ou `J`}, `comments` |
| `contents` | Cours, TD, TP et devoirs | `module`, `type`, `titre`, `description`, `lien`, `sections[]`, `statut` (`publie`, `brouillon`, `desactive`), `dateLimite`, `profId` |
| `messages` | Messagerie par module et section | `module` (`ALL` = annonces), `section`, `authorRole`, `authorId`, `authorUid`, `authorName`, `text`, `date` |
| `notifications` | Notifications ciblées (Planning) | `titre`, `categorie`, `message`, `lien`, `formation`, `promotions[]`, `annee`, `publishAt` |
| `exams` | Calendrier des examens | `section`, `module`, `type`, `date`, `debut`, `fin`, `salle` |
| `soutenances` | Soutenances des PFE | `date`, `heure`, `etudiant`, `sujet`, `encadrant`, `jury`, `salle` |

Une section correspond à la formation et à l'année : `TN-1A`, `TAM-1A`, `TN-2A`, `TAM-2A`.

## Créer la base (une seule fois, environ 15 minutes)

1. **Console Firebase** : ouvrez https://console.firebase.google.com puis le projet **ensias-master-s2i**.
2. **Firestore Database** : cliquez sur *Créer une base de données*, choisissez une région en Europe (ex. `europe-west1`), puis le *mode production*.
3. **Authentication** : cliquez sur *Commencer*, puis dans *Sign-in method*, activez *Adresse e-mail/Mot de passe*. Dans *Paramètres* › *Domaines autorisés*, ajoutez `aissamberrahou.github.io`.
4. **Règles** : dans Firestore Database › onglet *Règles*, remplacez tout le contenu par celui de `firestore.rules`, puis cliquez sur *Publier*.
5. **Clé du compte de service** : allez dans ⚙ *Paramètres du projet* › *Comptes de service* et cliquez sur *Générer une nouvelle clé privée*. Un fichier `.json` est téléchargé.
   ⚠️ Cette clé donne un accès complet au projet. Ne la publiez jamais sur GitHub et ne l'envoyez à personne.
6. **Import** : il faut [Node.js](https://nodejs.org) version 18 ou plus. Copiez le dossier `firebase/` sur votre ordinateur, ouvrez un terminal dans ce dossier, puis lancez :

   ```bash
   npm install
   npm run verifier                       # contrôle du fichier, sans rien écrire
   node import-firestore.mjs chemin/vers/la-cle.json votre.email@exemple.ma
   ```

   Le script écrit les données, crée le compte administrateur et affiche un lien pour définir son mot de passe.
   Si vous le relancez, il ne remplace pas les documents déjà présents. Pour forcer le remplacement, ajoutez `--ecraser`.
7. **Vérification** : dans Firestore Database › onglet *Données*, vous devez voir les collections `modules`, `profs`, `timetable`, etc.

## Et ensuite ?

Le site fonctionne encore en mode local, avec les données dans le navigateur. L'étape suivante est de le brancher sur ce projet :
- connexion par Firebase Authentication (e-mail et mot de passe) ;
- lecture et écriture dans Firestore selon le rôle ;
- e-mail d'activation automatique à la création d'un compte.

Il faudra pour cela la configuration Web du projet : ⚙ *Paramètres du projet* › *Vos applications* › *Application Web* › objet `firebaseConfig`.

En attendant, ce même fichier `donnees-initiales.json` peut être chargé dans le site en mode local : Administration › Paramètres › *Restaurer depuis un fichier*. Le mot de passe administrateur est conservé.
