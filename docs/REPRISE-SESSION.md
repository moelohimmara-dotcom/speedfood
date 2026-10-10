# Reprise de projet : continuer Speedfood sans l'auteur

Document de référence pour reprendre le projet à froid. Rédigé et mis à jour le **10 octobre 2026**.
**Il ne contient aucune valeur secrète**, seulement des noms. Sources de vérité complémentaires :
`CLAUDE.md` (règles), `docs/cadrage/` (mandat, architecture, sécurité), `docs/STATUT-PROJET.md` (journal chronologique).

> Ce document remplace celui du 4 octobre. En cas de divergence, c'est lui qui fait foi pour l'état actuel ;
> le journal `docs/STATUT-PROJET.md` reste la mémoire détaillée de ce qui a été fait, lot par lot.

---

## 1. Où en est le projet en 10 minutes

| | |
|---|---|
| Dépôt | `C:\Users\moelo\dev\speedfood` — branche `master`, distant `moelohimmara-dotcom/speedfood` |
| Production | https://speedfood-app.moelohimmara.workers.dev (Worker Cloudflare `speedfood-app`) |
| Version en ligne | `2379561d-326b-499d-97e3-c4e5064a17ed` (10 octobre 2026, déploiement `99ac44f`) |
| Base | Supabase `ggldjdizqrtpetdiohxy` — **62 migrations**, dernière `20261007221500_jetons_historique` |
| État Git | `master` à jour avec `origin/master`, arbre propre |

**Ordre de lecture recommandé**

1. Ce document (état, commandes, pièges).
2. `CLAUDE.md` § « Règles non négociables » — court, à respecter strictement.
3. `docs/cadrage/TDR.md` puis `docs/cadrage/ADR.md` (mandat, décisions d'architecture).
4. La note du chantier en cours (par exemple `docs/INSCRIPTION-CLIENT.md`, `docs/CHEF-IA.md`,
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
c'est une protection, pas un bug.

Un nouveau fichier de test pur doit être déclaré dans `scripts/tests/lancer.mjs` (liste `copier(...)`
puis liste des fichiers à exécuter), sinon il n'est jamais lancé.

---

## 3. Ce qui a été livré recently (7 → 10 octobre)

| Lot | Contenu | Note |
|---|---|---|
| Chef IA | Extraction d'un menu depuis une photo (Workers AI, `llama-4-scout-17b-16e-instruct`), analyse pure testable, relecture humaine, quotas par restaurant | `docs/CHEF-IA.md` — 35 tests |
| Panier intelligent | Suggestions d'accompagnement **explicables** (« Pour accompagner votre plat », « À partager avant le plat »), règles déterministes, jamais de hasard | `docs/PANIER-INTELLIGENT.md` — 19 tests |
| Inscription client | `/entrer` : formulaire complet (nom, téléphone, email, double mot de passe, adresse, Guinée par défaut) **ou** connexion Facebook, au choix | `docs/INSCRIPTION-CLIENT.md` — 17 tests |
| Correctifs du 10 octobre | Mise en page de `/entrer` (collision de classe), profil et coordonnées réellement enregistrés, redirections client | `docs/AUDIT-VISUEL-2026-10-10.md` |

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
7. Après un déploiement, une page peut encore servir l'ancien contenu (cache) : recharger en ignorant le cache.

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
2. **Restreindre puis tourner le token Cloudflare** : il est sur-scopé. Cloudflare → My Profile → API Tokens.
3. Double authentification sur les comptes d'administration : **écartée par décision explicite** le
   9 octobre 2026 (risque connu et assumé : un mot de passe seul donne accès aux coordonnées des clients).
4. Test de 5 minutes sur un téléphone réel (jamais fait).

### Chantiers produit

5. Choisir la suite des propositions IA : « Conquistadorio » reste à définir ; le panier intelligent est livré.
6. Renseigner `/system/parametres` (numéro WhatsApp d'assistance, textes d'accueil, activation de la
   position sur carte).
7. Portes avant pilote : `docs/cadrage/PROCEDURE-SECURITE.md` §9 (certaines sont bloquantes).
8. Décider du sort des 13 restaurants de démonstration (publier ou dépublier avant le pilote).

### En suspens

9. Déplacer le dépôt de `C:\Users\moelo\dev\speedfood` vers le Bureau : à faire **session fermée**
   (déplacement déjà échoué une fois sur un verrou de session).

---

## 9. En cas de problème

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