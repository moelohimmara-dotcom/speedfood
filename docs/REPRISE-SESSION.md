# Reprise de session : passer le relais à une autre session ou à une autre personne

Document rédigé le 4 octobre 2026, à l'issue du lot G. Il permet de continuer le travail sans l'historique de la conversation.
**Il ne contient aucune valeur secrète** : seulement les noms. Les sources de vérité restent `CLAUDE.md`, `docs/cadrage/` et `docs/STATUT-PROJET.md`.

## 1. Où en est le projet

- Production : https://speedfood-app.moelohimmara.workers.dev (Cloudflare Worker `speedfood-app`).
- Base : projet Supabase `ggldjdizqrtpetdiohxy`. Dernière migration : `20261004094847_textes_accueil`.
- Dernier commit déployé : `85d9ae9` (lot G), version Worker `d37e9e84-eb4c-4eb4-9f0f-90ec5bc91592`.
- Tout ce qui est commité est déployé au moment de la rédaction. Vérifier avec `git status` et `git log --oneline`.
- Détail lot par lot : `docs/STATUT-PROJET.md` (une ligne par lot, avec ce qui est **vérifié** et ce qui est **juste supposé**).

## 2. Commandes utiles (depuis la racine du dépôt)

| Besoin | Commande |
|---|---|
| Types | `npx tsc --noEmit` (si erreurs dans `.next/dev/types`, supprimer ce dossier et relancer) |
| Lint | `npm run lint` |
| Tests purs | `npm run test:unit` (tous doivent passer ; les sources sont copiées avec suffixe `.ts`, voir `scripts/tests/lancer.mjs`) |
| Serveur local | `npm run dev` (ou l'outil de prévisualisation, configuration `dev`) |
| Construire pour Cloudflare | `npm run cf:build` |
| Déployer | `npx wrangler deploy` (après `cf:build`). **Seulement avec le feu vert explicite de Malika.** |
| Rejouer les migrations | `cd supabase/rejeu && npm run rejeu`, puis comparer les 7 signatures avec la production (requête `supabase/rejeu/signature.sql` exécutée sur la base de production) |
| Icônes de l'application | `node scripts/generer-icones.mjs` (source : `public/logo-speedfood.webp`) |

Si `wrangler` répond « Not logged in » : `npx wrangler login`, puis cliquer sur « Allow » dans le navigateur (Malika le fait elle-même).

## 3. Secrets et variables (noms uniquement)

- `wrangler.jsonc`, section `vars` (publics) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `COMMANDE_PROPOSITION_DELAI_MINUTES`, `TURNSTILE_SITE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- Secrets Cloudflare (jamais dans le dépôt, posés avec `npx wrangler secret put NOM`) : `SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`, `TURNSTILE_SECRET_KEY`, `VAPID_PRIVATE_KEY`.
- `.env.local` (ignoré par Git) contient les mêmes valeurs pour le développement. Ne jamais afficher, copier dans un message ni commiter ces valeurs.
- Changer `COMMANDE_JETON_SECRET` invaliderait tous les liens de suivi déjà envoyés aux clients : ne pas le modifier.
- Changer `VAPID_PRIVATE_KEY` oblige chaque restaurateur à réactiver l'alerte « page fermée ».

## 4. Règles à respecter (résumé de `CLAUDE.md`)

- Pas de déploiement en production sans feu vert explicite de Malika dans la conversation.
- Pas de service externe, de compte ni de coût sans consigne explicite.
- Toute migration appliquée en base a son fichier dans `supabase/migrations/` **dans le même commit**, avec le **même numéro de version** que celui enregistré en base (le vérifier avec la liste des migrations Supabase). Après une migration touchant RLS ou une fonction `SECURITY DEFINER` : `get_advisors(type: "security")`.
- Policies réservées aux membres : `to authenticated`, jamais sans restriction de rôle.
- Montants en GNF entiers. Tokens de design verrouillés (`docs/cadrage/DESIGN-SYSTEM.md`). Next.js 16 : `proxy.ts`, pas `middleware.ts`.
- Aucune donnée client dans les notifications push, les journaux ou les commits.
- Malika ne manipule pas de terminal : lui donner des instructions pas à pas, ou exécuter soi-même ce qui est autorisé.

## 5. Pièges déjà rencontrés

- **Shell** : de longs scripts avec apostrophes, accents et gabarits `${...}` collés dans une commande Bash échouent (« unexpected EOF »). Écrire le fichier avec l'outil d'écriture, puis l'exécuter.
- **Barre oblique inverse** : dans un script Python écrit via Bash, `"\\u003c"` perd une barre. Vérifier le résultat avec `od -c`.
- **Cache d'en-têtes** : juste après un déploiement, une page peut encore servir l'ancien `Permissions-Policy` (copie en cache). Retester avec une URL différente avant de conclure à un échec.
- **CAPTCHA** : Google bloque le navigateur intégré. Ne pas tenter de le passer ; utiliser GitHub ou DuckDuckGo pour la recherche.
- **Formulaires React dans le navigateur intégré** : le premier clic est souvent ignoré ; utiliser `requestSubmit()` ou taper dans les champs avec les vraies actions.
- **Comptes de test** : l'inscription exige une confirmation par e-mail. En test, confirmer via SQL (`email_confirmed_at`), puis **supprimer** le compte et le restaurant de test à la fin. Publier un restaurant de test en production est refusé par le garde-fou : ne pas contourner.
- **Restaurants `[DEV]`** : dépubliés le 4 octobre. Les 13 restaurants `donnees_demo` restent publiés (ils sont exclus des chiffres « en direct »).
- **Colonnes protégées** : `publie`, `suspendu_le`, `suspendu_motif`, `motif_correction` ne sont modifiables que par un administrateur système (déclencheur `fn_proteger_colonnes_restaurant`).

## 6. Reste à faire (par ordre d'utilité)

1. **Essai sur téléphone réel** (jamais fait) : installer l'application (Android Chrome, ou iPhone depuis l'écran d'accueil, iOS 16.4 ou plus), activer l'alerte page fermée, « Envoyer un essai », puis passer une commande invitée. Aucune réception réelle n'a été vérifiée.
2. **Renseigner `/system/parametres`** (Malika) : numéro WhatsApp d'assistance, délai de validation (seulement s'il est tenable), activation de la position sur carte, textes d'accueil. L'enregistrement depuis l'écran admin n'a pas été testé faute de compte admin de test.
3. **Identité visuelle** (lot G, partie graphique) : mascotte ou motif propre, traitement uniforme des photos de plats. Demande un travail graphique.
4. **Actions de Malika** listées dans `docs/AUDIT-VISUEL-2026-10-04.md` §9 : traduire l'e-mail de récupération Supabase en français, activer la double authentification sur ses comptes, supprimer ses comptes de test, vérifier visuellement la console admin, test de 5 minutes sur téléphone réel.
5. **Portes avant pilote** : `docs/cadrage/PROCEDURE-SECURITE.md` §9 (certaines sont bloquantes).
6. Décision en suspens : publier ou non les 13 restaurants de démonstration sur Google (plan du site) avant le pilote ; dépublier ou non « barbie » (restaurant de test avec une commande).

## 7. Carte du dépôt (ce qui a été ajouté depuis le 3 octobre)

- Alertes de commande et push : `src/components/AlerteCommandes.tsx`, `src/lib/alertes/`, `src/lib/push/`, `src/app/restaurant/alertes/`, `public/sw.js`, `docs/ALERTES-COMMANDES.md`.
- Application installable : `src/app/manifest.ts`, `public/icons/`, `src/components/InstallationApp.tsx`.
- Référencement : `src/app/robots.ts`, `src/app/sitemap.ts`, données structurées sur la fiche restaurant.
- Pages publiques : `src/app/aide/`, `src/app/devenir-partenaire/`, preuve en direct (`src/lib/decouverte/chiffres.ts`).
- Réglages pilotes : `src/lib/parametres/` (assistance, promesse), `src/lib/system-admin/parametres.ts`, `src/app/system/parametres/`.
- Moyens de paiement et position : `src/lib/restaurant/paiement.ts`, `src/lib/restaurant/position.ts`.
- Démarrage guidé : `src/components/ListeDemarrage.tsx`.
- Analyse du concurrent et lots A à G : `docs/ANALYSE-CONCURRENT-MADIFOOD-2026-10-04.md`.

## 8. Outils tiers : décision prise

OmniRoute (passerelle IA multi-fournisseurs) a été examiné le 4 octobre 2026 et **n'a pas été installé** : il enverrait du code et des schémas à des fournisseurs gratuits non audités, et l'assistant ne peut pas rediriger son propre modèle. Si une panne de quota survient, reprendre avec ce document dans une nouvelle session plutôt que de brancher une passerelle sur le projet.
