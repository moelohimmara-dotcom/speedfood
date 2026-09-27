# Statut du projet — pour reprise par un autre développeur

**Dernière mise à jour : 27 septembre 2026 (bloc 6).** Ce document existe pour qu'une
personne qui n'a jamais touché ce projet puisse comprendre en 5 minutes où ça en
est, ce qui est vérifié contre ce qui est juste supposé, et par où continuer.

## Projet Supabase

- ID : `ggldjdizqrtpetdiohxy`, région `eu-west-1` (Irlande — pas `eu-west-3`/Paris
  qui aurait été légèrement plus proche de Conakry ; le projet a été créé
  manuellement par Malika et ce choix a été accepté tel quel plutôt que de
  recréer un projet, voir historique Git du bloc 1)
- Compte : `mistermarcket@gmail.com`
- **Deux réglages d'Auth ont été changés à la main dans le dashboard Supabase,
  aucun outil ne permet de les gérer par migration ou API MCP :**
  - "Confirm email" est **désactivé** (compte actif immédiatement après
    inscription, sans clic sur un lien reçu par email). À reconsidérer avant un
    vrai pilote public — voir plus bas.
  - "Leaked password protection" (HaveIBeenPwned) est encore **désactivée** au
    27/09/2026, signalé par l'audit de sécurité Supabase. Recommandé de
    l'activer avant le pilote.

## Ce qui est fait, bloc par bloc (voir `docs/cadrage/PLAN-EXECUTION.md`)

| Bloc | Contenu | Statut | Vérifié comment |
|---|---|---|---|
| 0 | Audit du dépôt de départ | Fait | `docs/cadrage/AUDIT-BLOC-0.md` |
| 1 | Socle Next.js, contrats TypeScript, tokens de design | Fait | `npm run typecheck`/`lint`, rendu visuel dans le navigateur |
| 2 | Schéma Supabase (14 tables), RLS, isolation tenant | Fait | Requêtes REST réelles avec la clé anon (restaurant non publié invisible, `orders` vide, RPC interne refusé) |
| 3 | Composants UI partagés (bouton, champ, carte, badge, alerte) | Fait, sous-ensemble volontaire | Rendu visuel dans le navigateur |
| 4 | Authentification, onboarding restaurateur | Fait | **Deux comptes réels créés**, isolation confirmée à l'écran (le compte B ne voit jamais le restaurant du compte A) |
| 5 | Catalogue public connecté | Fait | Testé dans le navigateur : seuls les restaurants publiés apparaissent (les deux comptes du bloc 4, non validés, sont invisibles) ; accès direct par URL à un restaurant non publié renvoie une vraie 404, pas de fuite d'information ; filtres et recherche fonctionnels |
| 6 | Console restaurant (menu, commandes, horaires) | Fait | Testé dans le navigateur avec un compte réel (créé puis nettoyé en base après test) : ajout/modification/bascule disponibilité d'un plat, fermeture/réouverture du restaurant, horaires/consignes enregistrés, tout revérifié après rechargement de page |
| 7 | Panier, commande, suivi client | Fait | Testé dans le navigateur : panier mono-restaurant, checkout invité (recalcul serveur des prix, consentement), commande créée avec référence publique et jeton de suivi (aucune donnée personnelle visible sur `/suivi/[jeton]`), actions restaurant accepter/refuser/prête/terminée avec historisation, proposition révisée versionnée avec échéance puis acceptation client appliquant le nouveau total (35 000 GNF au lieu de 25 000) et retour en attente de confirmation |
| 8 | CMS système | Pas commencé (tables prêtes avec RLS restrictive, aucun écran) | — |
| 9 | PWA installable | Pas commencé | — |
| 10 | Notifications pilote | Bloqué par design (ADR-007) tant que le canal n'est pas choisi avec de vrais restaurateurs | — |
| 11 | Préproduction / lancement | Pas commencé | — |

## Décisions prises en cours de route (pas dans les documents de cadrage d'origine)

- **Bug proxy corrigé (bloc 7)** : la protection `/restaurant/*` du proxy utilisait `startsWith("/restaurant")`, ce qui capturait aussi `/restaurants/[id]` — les fiches publiques du catalogue redirigeaient vers la connexion sans raison. Corrigé dans `src/proxy.ts` (chemin exact `/restaurant` ou préfixe `/restaurant/`). **Si une page publique redirige vers `/connexion`, vérifier ce matcher en premier.**
- **Durcissement RLS (bloc 7)** : migration `20260927200000_durcissement_colonnes_protegees.sql` qui ferme les élévations de privilèges de l'audit (`AUDIT-SUPABASE.md` §6.2–6.3) : un membre de restaurant ne peut plus s'auto-publier, effacer une suspension, ni modifier montants/coordonnées/référence d'une commande (trigger `BEFORE UPDATE`, seuls `statut` et champs de fiche restent modifiables ; le `service_role` n'a pas de JWT utilisateur et n'est pas affecté). Vérifié en base : tentatives d'élévation refusées, transition normale de statut toujours possible.
- **Écart de suivi des migrations (repéré lors d'un état des lieux post-bloc-7)** :
  cette même migration (`20260927200000`) a été appliquée via `execute_sql` et non
  `apply_migration` — elle est donc **absente** de
  `supabase_migrations.schema_migrations` alors que les 8 migrations précédentes y
  figurent. Vérifié que les triggers `trg_restaurants_proteger_colonnes` et
  `trg_orders_proteger_colonnes` sont bien actifs en base (`pg_trigger.tgenabled =
  'O'`) : la protection est réellement en place, ce n'est qu'un écart de
  traçabilité. **Vigilance pour la suite :** toujours utiliser `apply_migration`
  (jamais `execute_sql`) pour toute migration DDL, sous peine de désynchroniser
  l'historique visible par `list_migrations`/`supabase migration list` de ce qui
  tourne réellement en base.

- **Inscription restaurateur** : auto-inscription libre (email + mot de passe),
  restaurant créé non publié par défaut, validation manuelle par un admin en
  attendant le vrai CMS d'invitation. Confirmé par Malika (répondait à la
  question ouverte #2 de `ADR.md`). Il n'existe **aucun écran admin** pour
  publier un restaurant pour l'instant — ça se fait à la main en SQL
  (`update restaurants set publie = true where id = '...'`) jusqu'au bloc 8.
- **Next.js 16** utilise `proxy.ts`, pas `middleware.ts` (renommage de la
  plateforme elle-même, sans rapport avec ce projet). Voir
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Fonctions `SECURITY DEFINER`** (`fn_est_membre_restaurant`,
  `fn_est_admin_systeme`, `fn_creer_restaurant_et_owner`) : Supabase accorde par
  défaut l'exécution au rôle `anon` à la création d'une fonction, même après un
  `REVOKE ... FROM PUBLIC`. Il faut un `REVOKE ... FROM anon` explicite en plus.
  Repéré deux fois par `get_advisors(type: "security")` (blocs 2 et 4) — **lancer
  systématiquement cette vérification après toute migration touchant une
  fonction ou une policy RLS.**
- **Types Supabase générés** (`src/lib/db/database.types.ts`, bloc 5) : sans ce
  fichier, une jointure comme `restaurants.select("menu_categories(nom)")` est
  typée `any[]` par défaut (TypeScript ne peut pas déduire qu'une seule ligne est
  attendue), ce qui masque de vraies erreurs. **Régénérer ce fichier après toute
  migration qui change le schéma** (`generate_typescript_types` côté MCP, ou
  `supabase gen types typescript --project-id ggldjdizqrtpetdiohxy` en CLI).
- **Données de seed** : `supabase/seed.sql` contient des lignes préfixées
  `[DEV]`, déjà appliquées au projet Supabase actuel (pas seulement au fichier
  local). Volontairement différentes des données du prototype de démonstration.
- **Suppression logique du menu** (bloc 6) : un plat n'est jamais supprimé
  physiquement, seulement marqué `archive_le` (timestamp), pour respecter la
  contrainte "ne jamais supprimer un plat référencé par une commande passée".
  Les pages de la console filtrent systématiquement `archive_le is null`.
- **Bug de débordement horizontal global (bloc 6, corrigé)** : `body` a
  `display: flex; flex-direction: column` (`globals.css`). Un enfant direct de
  `body` contenant du texte non coupable (`white-space: nowrap`, comme les
  onglets de la nav console) peut se retrouver rendu plus large que `body`
  lui-même — l'alignement `stretch` par défaut n'empêchait pas ce débordement,
  contrairement à l'intuition CSS habituelle. Repéré en testant le bloc 6 sur
  un viewport mobile (375px), avec des outils de mesure (`getBoundingClientRect`,
  `scrollWidth`), pas seulement à l'œil. Corrigé une fois pour toutes avec une
  règle globale `body > * { min-width: 0; width: 100%; }` dans `globals.css` —
  potentiellement, ce bug touchait silencieusement toutes les pages existantes
  avant ce correctif, pas seulement la console. **Si un futur écran affiche à
  nouveau un débordement horizontal mobile, vérifier en premier que cette règle
  n'a pas été supprimée par erreur.**

## Ce qui n'est pas testé / connu comme incomplet

- Aucun test automatisé (unitaire, intégration, e2e) n'existe encore. Toute la
  vérification jusqu'ici s'est faite manuellement (navigateur + requêtes REST
  directes), documentée dans les messages de commit Git.
- Aucun écran admin/CMS (bloc 8) : impossible de publier un restaurant ou gérer
  un rôle système autrement qu'en SQL direct.
- Aucune route serveur de commande (bloc 7) : `orders` et tables liées existent
  en base avec RLS, mais rien ne les écrit encore. La page `/restaurant/commandes`
  du bloc 6 affiche déjà la liste (lecture seule) pour quand ça existera.
- Pas de CI/CD.

## Comment vérifier soi-même que tout est toujours cohérent

```bash
npm run typecheck
npm run lint
npm run dev   # puis tester manuellement /connexion, /inscription, /restaurant
```

Pour vérifier la RLS indépendamment du code applicatif (utile après toute
modification de policy) :

```bash
# Doit renvoyer uniquement les restaurants publiés
curl -s "https://ggldjdizqrtpetdiohxy.supabase.co/rest/v1/restaurants?select=nom,publie" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"

# Doit renvoyer un tableau vide (aucune policy anon sur les commandes)
curl -s "https://ggldjdizqrtpetdiohxy.supabase.co/rest/v1/orders?select=*" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
```
