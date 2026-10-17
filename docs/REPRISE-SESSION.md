# Reprise de projet : continuer Speedfood sans l'auteur

Document de référence pour reprendre le projet à froid. Rédigé le 10 octobre 2026, mis à jour le **16 octobre 2026**.
**Il ne contient aucune valeur secrète**, seulement des noms. Sources de vérité complémentaires :
`CLAUDE.md` (règles), `docs/cadrage/` (mandat, architecture, sécurité), `docs/STATUT-PROJET.md` (journal chronologique).

> Ce document remplace celui du 4 octobre. En cas de divergence, c'est lui qui fait foi pour l'état actuel ;
> le journal `docs/STATUT-PROJET.md` reste la mémoire détaillée de ce qui a été fait, lot par lot.

---

## 1. Où en est le projet en 10 minutes

| | |
|---|---|
| Dépôt | **`C:\Users\moelo\dev\speedfood`** — branche `master`, distant `moelohimmara-dotcom/speedfood`. C'est le seul dépôt (l'ancienne copie du Bureau OneDrive a été supprimée le 15 octobre 2026 : voir § 8, point 9) |
| Production | https://speedfood-app.moelohimmara.workers.dev (Worker Cloudflare `speedfood-app`) |
| Version en ligne | `7a7abebd` (identifiant court ; `npx wrangler deployments list` donne le complet) (16 octobre 2026, commit `51e9d5a` ; les commits de documentation qui suivent ne changent pas le code déployé) |
| Base | Supabase `ggldjdizqrtpetdiohxy` — schéma vérifié au déploiement |
| État Git | `master` à jour avec `origin/master` au commit `51e9d5a` (code), arbre propre. Dépôt de travail : `C:\Users\moelo\dev\speedfood` |

**Ordre de lecture recommandé**

1. Ce document (état, commandes, pièges).
2. `CLAUDE.md` § « Règles non négociables » — court, à respecter strictement.
3. `docs/cadrage/TDR.md` puis `docs/cadrage/ADR.md` (mandat, décisions d'architecture).
4. La note du chantier en cours (par exemple `docs/ZONES-ET-COMMANDES-DE-TEST.md`, `docs/INSCRIPTION-CLIENT.md`, `docs/CHEF-IA.md`,
   `docs/PANIER-INTELLIGENT.md`) — chacun suit le même plan : ce que ça fait, ce qui a été vérifié,
   ce qui ne l'a pas été.

---

## 2. Commandes

Depuis la racine du dépôt. Sous PowerShell, passer par `cmd /c` pour `npm`/`npx`
(l'exécution de scripts `.ps1` est bloquée) ; `&&` n'est pas un séparateur valide, enchaîner les commandes.

| Besoin | Commande |
|---|---|
| Serveur local | `npm run dev` |
| Types | `cmd /c "npx tsc --noEmit"` |
| Lint | `npm run lint` |
| Tests purs | `cmd /c "npm run test:unit"` |
| Construction + déploiement | `cmd /c "npm run cf:deploy"` (~4 à 5 min ; à lancer en tâche de fond) |
| Construction seule | `npm run cf:build` |
| Export de sauvegarde | `npm run export:donnees` / `npm run export:verifier` (voir `docs/RUNBOOK-EXPORT.md`) |
| Icônes de l'application | `node scripts/generer-icones.mjs` |

`cf:deploy` exécute d'abord `scripts/verifier-base.mjs`, qui **échoue si une table manque en production** :
c'est une protection, pas un bug. Elle peut aussi s'arrêter sur « Vérification de la base impossible… délai dépassé » : c'est un
problème de réseau, relancer `cf:deploy` une fois (le code n'est pas en cause).

Un nouveau fichier de test pur doit être déclaré dans `scripts/tests/lancer.mjs` (liste `copier(...)`
puis liste des fichiers à exécuter), sinon il n'est jamais lancé.

---

## 3. Ce qui a été livré recently (7 → 15 octobre)

| Lot | Contenu | Note |
|---|---|---|
| Chef IA | Extraction d'un menu depuis une photo (Workers AI, `llama-4-scout-17b-16e-instruct`), analyse pure testable, relecture humaine, quotas par restaurant | `docs/CHEF-IA.md` — 35 tests |
| Panier intelligent | Suggestions d'accompagnement **explicables** (« Pour accompagner votre plat », « À partager avant le plat »), règles déterministes, jamais de hasard | `docs/PANIER-INTELLIGENT.md` — 19 tests |
| Inscription client | `/entrer` : formulaire complet (nom, téléphone, email, double mot de passe, adresse, Guinée par défaut) **ou** connexion Facebook, au choix | `docs/INSCRIPTION-CLIENT.md` — 17 tests |
| Zones de toute la Guinée | Régions, préfectures, communes, quartiers ; « Utiliser ma position » (OpenStreetMap, côté serveur) ; liste d'attente ; zones de livraison par restaurant ; page `/quartiers` avec recherche | `docs/ZONES-ET-COMMANDES-DE-TEST.md` §1 |
| Aperçu de fiche et commandes de test | Aperçu propriétaire / administrateur (`?vue=visiteur`, `?vue=test`) ; commandes marquées `est_test` par le serveur, exclues de tous les chiffres | `docs/ZONES-ET-COMMANDES-DE-TEST.md` §2 et §3 |
| Console Géographie | Qualité des données, lot, fusion de quartiers, export / import CSV, statut de lancement, carte de couverture, historique | `docs/ZONES-ET-COMMANDES-DE-TEST.md` §4 |
| Correctifs du 10 octobre | Mise en page de `/entrer` (collision de classe), profil et coordonnées réellement enregistrés, redirections client | `docs/AUDIT-VISUEL-2026-10-10.md` |

| Refonte des consoles, phases 0 à 3 (15 et 16 octobre) | Correctifs de fiabilité ; fondations communes (confirmation à 3 niveaux, notifications, tiroir, fil d'Ariane, styles `sx-`) ; plus aucun `confirm()` natif ; recherche rapide Ctrl+K ; « À traiter » en tête des accueils ; mode service du restaurateur ; historique des commandes par fenêtres ; Géographie allégée et corrigée | `docs/CONSOLE-FONDATIONS.md`, `docs/audit-2026-10-15-consoles/README.md` § 6 ter |

Le journal complet, avec ce qui est **vérifié** et ce qui est **supposé**, est dans `docs/STATUT-PROJET.md`.

---

## 4. Règles non négociables (résumé — voir `CLAUDE.md` pour les originales)

- **Aucun déploiement en production sans feu vert explicite de la propriétaire dans la conversation.**
- Aucun service externe, compte, projet cloud ni coût sans consigne explicite.
- Secrets : jamais dans le code, les commits, les journaux, les captures. `.env.local` est ignoré par Git.
- Toute migration appliquée en base a son fichier dans `supabase/migrations/` **dans le même commit**,
  avec le même numéro de version qu'en base. Après une migration touchant RLS ou `SECURITY DEFINER` :
  `get_advisors(type: "security")`.
- Policies réservées aux membres : `to authenticated`, jamais sans restriction de rôle.
- Montants en GNF entiers. Tokens de design verrouillés (`docs/cadrage/DESIGN-SYSTEM.md`).
- Next.js 16 : le garde de requêtes s'appelle `proxy.ts`, pas `middleware.ts`.
- Le propriétaire ne manipule pas de terminal : lui donner des instructions pas à pas, ou faire soi-même.

---

## 5. Pièges techniques déjà payés (à connaître avant de coder)

Ce sont les pièges qui ont coûté du temps ; ils reviendront sinon.

1. **Le CSS est global, pas de CSS Modules.** Un nom de classe déjà défini ailleurs s'applique aussi et casse
   la mise en page *sans erreur ni avertissement*. Cas vécu : `.choix-carte` (cartes radio de la commande,
   `src/app/marche.css`, en `display:flex` horizontal) réutilisé sur `/entrer` → formulaire écrasé en pilules.
   **Avant d'écrire `className="…"`, chercher le nom dans `src/app/*.css`.** Un nom nouveau est préfixé par
   le contexte de la page (`inscription-…`). La mise en page va dans la feuille CSS, pas dans `style={{ … }}`.
2. **Les contraintes `CHECK` de PostgreSQL sont strictes et silencieuses.** `client_profils` exige
   `pseudo` (3 à 24 caractères, caractères autorisés) et `avatar` (liste fermée de 10 valeurs). Une valeur
   fausse fait échouer **toute** l'insertion, dans un `console.error` que personne ne voit.
   **Vérifier le schéma avant d'écrire dans une table** (`supabase/migrations/`).
3. **Une inscription n'a pas de session tant que l'e-mail n'est pas confirmé** → la RLS interdit toute
   écriture. Les coordonnées sont donc déposées dans les métadonnées du compte, et le profil est créé à la
   première visite authentifiée (`assurerProfilClient`, `src/lib/client/profil-serveur.ts`).
4. **Ne jamais éditer un fichier texte avec un pipeline PowerShell.** `Get-Content -Raw | … | Set-Content`
   sur un fichier UTF-8 sans BOM réencode les accents en `Ã©` et ajoute un BOM. Utiliser les outils
   d'édition dedicated. En revanche, un affichage mojibake dans la console **ne signifie pas** que le
   fichier est corrompu : relire avec `Get-Content -Encoding UTF8` avant de conclure.
5. **Contrôler une fonctionnalité de bout en bout avant de la dire livrée** : création → e-mail → connexion →
   page cible → lecture en base. L'inscription client « fonctionnait » (types, lint, tests, revue visuelle)
   et le test réel a trouvé quatre défauts.
6. **Ne pas commiter un script de vérification temporaire** ; le retirer avec une suppression récupérable
   (`rm -- <chemin>`) avant de commiter.
7. Après un déploiement, une page peut encore servir l'ancien contenu (cache) : recharger en ignorant le cache. Dans le navigateur
   intégré, une URL déjà visitée peut être servie depuis son cache : ajouter un paramètre (`?v=2`) avant de conclure qu'un déploiement n'a rien changé.
8. **Erreur Cloudflare 1102 (« Worker exceeded resource limits »), 15 octobre 2026.** Des pages dynamiques ont répondu 503/500 pendant
   quelques minutes, y compris l'accueil public, après l'ouverture de la page Géographie (606 Ko, 158 formulaires). Cause **non confirmée** ; la page
   a été allégée (20 lignes à la fois, 261 Ko). À vérifier côté Cloudflare : plan utilisé (gratuit = 10 ms de calcul par requête ; les pages
   consomment 12 à 880 ms) et « Metrics > Errors > Invocation Statuses ». Les journaux se lisent avec `npx wrangler tail speedfood-app --format json`.
   Si la panne revient : retour à la version précédente avec l'accord de la propriétaire.
9. **Tester une console dans le navigateur intégré** : pages d'essai temporaires (jamais commitées, supprimées ensuite) dans la coque `.ad-app` avec des
   données fictives ; un `<details>` replié donne `innerText` vide (utiliser `textContent` ou l'ouvrir) ; la liste de choix (`ListeChoix`) réagit à
   `mousedown`, pas à `click` ; le panneau du navigateur peut se refermer et la connexion de la propriétaire est alors perdue (elle se reconnecte, jamais
   d'identifiants saisis par l'agent). Le contrôle anti-robot (Turnstile) empêche de passer une commande publique dans ce navigateur : une commande de
   test se crée en base (`est_test = true`) puis se supprime par son identifiant exact.
10. **Fournisseur de retour d'information à la racine.** `ConsoleProviders` est monté dans `src/app/layout.tsx` : `useConfirmation()` et `useNotification()`
    marchent partout (consoles et site public). Ne pas le remonter ailleurs (deux zones de notifications = deux annonces).

---

## 6. Carte du dépôt (les zones utiles)

| Domaine | Fichiers | Note |
|---|---|---|
| Inscription / compte client | `src/app/entrer/`, `src/app/compte/`, `src/lib/client/`, `src/lib/auth/actions.ts` | `docs/INSCRIPTION-CLIENT.md`, `docs/CONNEXION-FACEBOOK.md` |
| Chef IA (photo → menu) | `src/lib/menu/chefMenu.ts`, `src/app/restaurant/menu/chef/` | `docs/CHEF-IA.md` |
| Panier intelligent | `src/lib/panier/complements.ts`, `src/components/panier/`, `src/app/api/panier/complements/` | `docs/PANIER-INTELLIGENT.md` |
| Commandes (invitées) | `src/app/commande/`, `src/lib/commande/` | `docs/cadrage/ADR.md` |
| Console restaurateur | `src/app/restaurant/` | |
| Console système (super admin) | `src/app/system/`, `src/lib/system-admin/` | `docs/STUDIO-SUPERADMIN.md`, `docs/MATRICE-PERMISSIONS.md` |
| Studio (blocs) | `src/lib/studio/`, `src/components/studio/` | `docs/STUDIO-SUPERADMIN.md` |
| Alertes et push | `src/lib/alertes/`, `src/lib/push/`, `public/sw.js` | `docs/ALERTES-COMMANDES.md` |
| Styles du site public | `src/app/public.css`, `cadre.css`, `fantaisie.css`, `public/` | `docs/cadrage/DESIGN-SYSTEM.md` |

---

## 7. Secrets et variables (noms uniquement)

- `wrangler.jsonc` → `vars` (publics) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `COMMANDE_PROPOSITION_DELAI_MINUTES`, `TURNSTILE_SITE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- Secrets Cloudflare (hors dépôt, posés par `npx wrangler secret put NOM`) : `SUPABASE_SERVICE_ROLE_KEY`,
  `COMMANDE_JETON_SECRET`, `TURNSTILE_SECRET_KEY`, `VAPID_PRIVATE_KEY`.
- `.env.local` (ignoré par Git) reprend ces valeurs pour le développement. **Ne jamais afficher, copier dans
  un message ni commiter ces valeurs.**
- Le dossier `C:\Users\moelo\Desktop\mes-secrets` est hors OneDrive : voir son `LISEZ-MOI.md` pour les règles.
- Changer `COMMANDE_JETON_SECRET` invalide tous les liens de suivi déjà envoyés ; changer `VAPID_PRIVATE_KEY`
  oblige chaque restaurateur à réactiver l'alerte « page fermée ».

---

## 8. Reste à faire

### Actions manuelles du propriétaire (aucun agent ne peut les faire)

1. **Révoquer les jetons Supabase** : deux jetons d'accès personnel ont été exposés en clair.
   Supabase → Account → Access Tokens → révoquer. C'est la porte la plus importante.
   **Déclaré fait par la propriétaire le 16 octobre 2026** (non vérifiable par un agent : aucun outil ne liste les jetons d'une autre personne). Après cela, le déploiement (`wrangler`, connexion OAuth) et l'accès à la base de l'agent fonctionnent toujours.
2. **Restreindre puis tourner le token Cloudflare** : il est sur-scopé. Cloudflare → My Profile → API Tokens. **À confirmer** : la propriétaire a indiqué que « le point 1 » (jetons exposés) est corrigé ; le jeton Cloudflare n'a pas été mentionné séparément.
3. Double authentification sur les comptes d'administration : **écartée par décision explicite** le
   9 octobre 2026 (risque connu et assumé : un mot de passe seul donne accès aux coordonnées des clients).
4. Test de 5 minutes sur un téléphone réel (jamais fait).

### Chantiers produit

5. Choisir la suite des propositions IA : « Conquistadorio » reste à définir ; le panier intelligent est livré.
6. Renseigner `/system/parametres` (numéro WhatsApp d'assistance, textes d'accueil, activation de la
   position sur carte).
7. Portes avant pilote : `docs/cadrage/PROCEDURE-SECURITE.md` §9 (certaines sont bloquantes).
8. ~~Décider du sort des restaurants de démonstration~~ **Fait le 17 octobre 2026 (option 1) : les 12 restaurants `donnees_demo` sont dépubliés** (`publie = false`, par une requête SQL limitée à `donnees_demo = true`, 12 lignes). Ils ne sont plus visibles du public ; rien n'est supprimé. Pour les remontrer lors d'une démonstration : même requête avec `publie = true`, toujours limitée à `donnees_demo = true`. Le chiffre « 13 » des anciens documents était faux (12 démonstration ; « barbie » et « barbie food » sont à part). Publiés aujourd'hui : « barbie » (sans responsable, à trancher) et « barbie food ». **Aucune trace d'audit** : la modification a été faite en base, pas par la console (qui n'a pas d'action « dépublier »).

### À vérifier avec une session réelle

Vérifié en production le 16 octobre 2026, avec la session de la propriétaire et retour à l'état d'origine à chaque fois : Géographie (enregistrer une ligne, noms
alternatifs, point central valide et invalide, interrupteur « Visible », lot, import CSV en deux étapes avec confirmation, historique d'audit).

Reste à faire :
- Fusion de deux quartiers (`fn_fusionner_quartiers`) : jamais essayée sur données réelles (elle déplace restaurants et clients).
- Suggestion de point (OpenStreetMap) depuis l'interface.
- Mode service sur un vrai téléphone ou une tablette (garde d'écran réelle, retour d'un onglet en arrière-plan).
- Refus d'une proposition dans le suivi de commande (nouvelle boîte de confirmation) et bouton « Afficher 20 de plus » de l'historique des commandes, sur du volume réel.
- Commande de test passée par un vrai parcours (le contrôle anti-robot l'empêche dans le navigateur intégré).
- Annonce « Bientôt / Pilote » sur une commune réelle (aucune n'a ce statut).
- Compléter les points centraux des quartiers de Conakry (46 sans point) : par export / import CSV.
- Plan Cloudflare et métriques d'erreurs (voir § 5, point 8).

### En suspens

9. **Ancienne copie OneDrive supprimée (15 octobre 2026), essai Next 16.4 abandonné.** La copie du Bureau OneDrive (en retard de 40 commits) a été supprimée après
   sauvegarde de ses deux documents de cadrage (`docs/cadrage/CONTENU-LANDING-NATIONALE.md`, `docs/cadrage/RESTRUCTURATION-LANDING-NATIONALE.md`, ajoutés ici) et de ses
   variables locales `VAPID_*` (copiées dans le `.env.local` de ce dépôt, ignoré par git). Le dossier lui-même a été
   supprimé à la main le 15 octobre 2026 (il était tenu par des processus Codex dont le répertoire de travail était ce dossier : `Stop-Process` puis `Remove-Item`).
   Il n'existe donc plus qu'un seul dépôt. Piège : un dossier verrouillé « utilisé par un autre processus » peut l'être par un programme dont la ligne de commande ne cite pas
   le chemin, seul son répertoire de travail y pointe.
   **Next 16.4 : abandonné.** Next 16.4.0 avec OpenNext 1.20.10 déclenche en production une erreur `loadManifest(preview-props.json)`. Ne pas retenter sans nouvelle version
   d'OpenNext qui la corrige. Le projet passe à Next.js 16.3.8 (correctif de la série 16.3 sans faille d'audit : `npm audit --omit=dev` = 0). Validé avant déploiement : 1620 tests, build, `cf:build` (OpenNext) et Worker local qui sert les pages sans erreur `loadManifest`. Les failles restantes de `npm audit` sont dans les outils de développement (`braces` via ESLint) : leur « correctif » rétrograderait eslint-config-next en 14, à ne pas appliquer. Ne pas lancer `npm audit fix` à l'aveugle : il modifie plus de 1000 lignes du lockfile (chaîne wrangler/workerd).

---

## 9. Documentation canonique des audits récents

L'audit du 11 octobre 2026 est regroupé dans `docs/audit-2026-10-11/README.md`, qui sert d'index unique pour les constats visuels, sécurité/performance, feuille de route, journal de déploiement et captures. Les rapports ne doivent pas être recréés à la racine du dépôt.

L'audit des deux consoles (super admin et restaurateur) du 15 octobre 2026, préalable à une refonte « type Wix », est dans `docs/audit-2026-10-15-consoles/README.md` (synthèse, défauts vérifiés V1 à V7, architecture proposée, plan en phases, décisions à prendre) avec les quatre rapports détaillés. La phase 0 (fiabilité) et les phases 1 à 3 (fondations, recherche rapide, accueils, mode service) sont **faites et déployées** : voir `docs/audit-2026-10-15-consoles/README.md` § 6 bis et 6 ter, et `docs/CONSOLE-FONDATIONS.md` pour les briques communes.

## 10. En cas de problème

| Symptôme | Piste |
|---|---|
| Page qui s'affiche mal sans erreur console | Collision de nom de classe (§5.1) : inspecter les styles calculés dans le navigateur |
| Une donnée ne s'écrit pas en base | Contraintes `CHECK` (§5.2), puis RLS : y a-t-il bien une session ? |
| Un client atterrit du mauvais côté | `connexionAction` route par type de compte : admin / restaurateur / client |
| Échec de déploiement | `scripts/verifier-base.mjs` : une table manque en production |
| Accents affichés en `Ã©` | Affichage console uniquement ; relire en UTF-8 (§5.4) |
| Incident en production | `docs/PLAN-INCIDENT.md` |

Rappels utiles : le premier clic dans un formulaire du navigateur intégré est souvent ignoré ;
l'inscription exige une confirmation par e-mail (pour tester, confirmer le compte puis **le supprimer**) ;
publier un restaurant de test en production est refusé par un garde-fou — ne pas le contourner.