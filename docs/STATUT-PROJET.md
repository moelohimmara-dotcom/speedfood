# Statut du projet — pour reprise par un autre développeur

**Dernière mise à jour : 28 septembre 2026 (centre de commandement `/system`, après le bloc 8d).** Ce document existe pour qu'une
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
| 8a | CMS système — rôles, permissions, shell `/system` | Fait | Testé dans le navigateur : anonyme → 404 sans fuite ; compte `super_admin` réel accepté (autre session) ; compte de test avec rôle `support` (créé puis nettoyé) voit uniquement les sections autorisées à son rôle, `/system/roles` (hors permission) renvoie 404 |
| 8b | Restaurants & comptes (modération, équipe) | Fait | Testé dans le navigateur avec un compte `operations` réel et un restaurant/deux comptes de test (créés puis nettoyés en base) : approuver, demander une correction (visible ensuite sur la console du restaurateur), suspendre (retiré du catalogue public, vérifié), réactiver, inviter un équipier existant, refus propre pour un email sans compte, retrait d'équipier |
| 8c | CMS éditorial et taxonomie | Fait | Testé dans le navigateur avec un compte `content_editor` et un compte `operations` réels (créés, non nettoyables — voir plus bas) : page créée en brouillon puis publiée (aperçu mobile reflète la frappe en direct avant sauvegarde), bannière créée et publiée, catégorie de taxonomie ajoutée puis supprimée, mise en avant ajoutée/désactivée par `operations` ; séparation croisée confirmée (`content_editor` → 404 sur `/system/mises-en-avant`, `operations` → 404 sur `/system/contenus`) |
| 8d | Support commandes, indicateurs et audit | Fait — **CMS système (bloc 8) entièrement livré** | Testé dans le navigateur avec un compte `support` réel sur une vraie commande de test du bloc 7 : recherche/filtre par statut, coordonnées masquées par défaut (`+2246******54`), révélation refusée sans motif puis acceptée et journalisée, transition de statut de support distincte de celle du restaurant (`support:<id>` dans l'historique, visible du restaurant), indicateurs corrects, journal filtrable par action/période (confirmé par navigation directe après un faux négatif de timing) |
| post-8d | Historique des propositions + annuaire des comptes | Fait | Testé dans le navigateur : panneau « Propositions révisées » sur l'écran commande (versions successives, montants avant/après, statut, échéance, réponse — lecture seule, immuabilité respectée) ; annuaire `/system/comptes` (11 comptes affichés avec rôles, affiliations restaurant cliquables, recherche et filtres) réservé à `compte.consulter` : le rôle `support` reçoit une 404 sans fuite, mais voit bien l'historique des propositions sur une commande ; coordonnées clients toujours masquées |
| 9 | PWA installable | Pas commencé | — |
| 10 | Notifications pilote | Bloqué par design (ADR-007) tant que le canal n'est pas choisi avec de vrais restaurateurs | — |
| 11 | Préproduction / lancement | Pas commencé | — |
| post-8d (refonte admin) | Navigation `/system` regroupée par domaine (Catalogue / Contenu / Commandes / Accès / Paramètres / Audit) + écran Rôles système réel | Fait | `npm run typecheck`/`lint` propres après le déplacement complet des fichiers (`git mv`, tous les imports/`href`/`revalidatePath` corrigés, grep exhaustif sans résidu `/system/restaurants`, `/system/comptes`, `/system/roles`, `/system/mises-en-avant`, `/system/contenus`) ; testé dans le navigateur avec un compte de test `operations` (créé puis entièrement supprimé en base, aucune trace en `audit_events`) : nav groupée montre exactement Catalogue (Restaurants + Mises en avant, Taxonomie masquée) / Accès (Comptes, Rôles masqué) / Audit ; `/system/acces/roles` et `/system/catalogue/taxonomie` renvoient 404 sans fuite ; `/system/contenu/pages` (hors permission) renvoie aussi 404. Écran Rôles (`src/lib/system-admin/roles.ts`) ensuite testé avec le compte `super_admin` réel (`admin.speedfood.dev@gmail.com`) : attribution d'un rôle `content_editor` à un compte de test réussie (« Rôle attribué », visible immédiatement dans la liste, journalisée en `systeme.attribution_role`), refus propre pour un email sans compte ; retrait testé par lecture directe en base (guard du dernier `super_admin` : 1 seul actuellement, `retirerRoleAction` le refuserait) — le clic réel sur *Retirer* n'a pas pu être exercé, le `confirm()` JS étant auto-annulé par l'automatisation du navigateur (limitation connue de l'outil, pas un bug ; le chemin de code est identique à `retirerMiseEnAvantAction`, déjà validé au bloc 8c). Compte de test entièrement supprimé après vérification. `get_advisors(security)` : aucune nouvelle alerte (les trois déjà connues et acceptées). `PlaceholderSection.tsx` supprimé (dernier usage remplacé). |
| post-8d (refonte admin) | Paramètres globaux (`/system/parametres`, délai de proposition + plafond de prix des plats) | Fait | Testé dans le navigateur avec le compte `super_admin` réel : valeurs affichées (30 min / 5 000 000 GNF), modifiées (45 / 6 000 000), persistance confirmée après rechargement, entrée `parametres.modification` journalisée avec le motif exact, puis valeurs restaurées à leur état d'origine. `COMMANDE_JETON_SECRET` absent de l'écran par design (rappel affiché). |
| post-8d (refonte admin) | Médias — photo de restaurant, photo de plat, image de bannière, bibliothèque `/system/contenu/medias` | Fait, avec une réserve de test notée ci-dessous | Champs d'upload ajoutés dans `/restaurant/profil` (photo restaurant), `/restaurant/menu` (photo plat, création et édition), `/system/contenu/bannieres` (image bannière) ; suppression best-effort de l'ancienne image au remplacement (`supprimerImage`). Testé dans le navigateur avec un compte restaurateur de test et le compte `super_admin` réel : les trois formulaires fonctionnent sans fichier joint (aucune régression sur les champs existants — photo réellement facultative) ; l'affichage a été vérifié en écrivant une URL de test directement en base (catalogue public, fiche restaurant, menu, `/system/contenu/bannieres`, `/system/contenu/medias`) : chaque `<img>` est correctement câblée sur la colonne `photo_url`/`image_url`, tailles et mises en page correctes. **Réserve** : l'envoi réel d'un fichier via le champ `<input type="file">` n'a pas pu être testé par clic — le navigateur intégré utilisé pour ces vérifications ne peut pas piloter la sélection d'un fichier natif (limitation de l'outil, pas un choix de conception). Le code d'upload (`src/lib/storage/images.ts`) reste néanmoins le même déjà utilisé pour créer et vérifier le bucket `medias`. **À faire par Malika (ou un agent avec navigateur pouvant joindre un fichier) avant de considérer ce lot définitivement clos** : essayer un envoi réel de photo depuis `/restaurant/profil`, `/restaurant/menu` et `/system/contenu/bannieres`, confirmer que l'image apparaît ensuite publiquement. Comptes et données de test entièrement supprimés après vérification. |

## Déploiement

Voir `docs/DEPLOIEMENT-CLOUDFLARE.md` pour le détail complet. En résumé :

- **Le vrai système est en ligne** : https://speedfood-app.moelohimmara.workers.dev
  (Cloudflare Workers via `@opennextjs/cloudflare`). Redéployer après tout
  changement de code avec `npm run cf:build && npx wrangler deploy`.
- **`/`** est la landing marketing (fusionnée depuis `Jarvis/speedfood/landing`,
  27/09/2026) ; **`/restaurants`** est le vrai catalogue connecté à Supabase
  (anciennement à `/`, avant la fusion — tout lien externe vers l'ancienne racine
  comme catalogue est désormais invalide).
- **Un projet Cloudflare Pages statique distinct existe déjà**,
  `speedfood.pages.dev` (landing + prototype cliquable de démonstration, sans
  aucun backend, sources désormais dans `demo/` de ce dépôt). Décision explicite
  de Malika : les deux déploiements coexistent pour l'instant, ne pas supprimer
  l'un ou l'autre sans consigne.
- **Redéployé le 28/09/2026** après l'état des lieux d'unification (centre de
  commandement, annuaire des comptes, correctifs RLS) : `npm run cf:build &&
  npx wrangler deploy`, succès, `/system/comptes` confirmé en place (404 sans
  session, comme attendu).

## Compte administrateur système

**Premier `super_admin` créé le 27/09/2026** : `admin.speedfood.dev@gmail.com` (id `95da37c3-b274-4a43-9720-63cf2ba39f17`), inséré dans `system_admin_memberships` via la `service_role` — jamais depuis le navigateur. Vérifié : le compte voit son rôle et accède aux restaurants non publiés (policies `admins_*`). Le mot de passe provisoire a été transmis hors dépôt ; **le changer immédiatement dans le dashboard Supabase** (Authentication → Users → Reset password).

**Récupération d'accès** (si le super_admin perd son mot de passe ou son compte) :

1. Se connecter au dashboard Supabase avec le compte propriétaire du projet (`mistermarcket@gmail.com`).
2. Authentication → Users → réinitialiser le mot de passe du compte admin, ou créer un nouveau compte.
3. Si c'est le rôle qui manque : SQL Editor (ou API avec la `service_role`), puis
   `insert into system_admin_memberships (utilisateur_id, role) values ('<uuid-utilisateur>', 'super_admin');`
4. Ne jamais donner le rôle `super_admin` à un compte de test ni à un propriétaire de restaurant (règle de sécurité du TDR).

## Décisions prises en cours de route (pas dans les documents de cadrage d'origine)

- **Bug proxy corrigé (bloc 7)** : la protection `/restaurant/*` du proxy utilisait `startsWith("/restaurant")`, ce qui capturait aussi `/restaurants/[id]` — les fiches publiques du catalogue redirigeaient vers la connexion sans raison. Corrigé dans `src/proxy.ts` (chemin exact `/restaurant` ou préfixe `/restaurant/`). **Si une page publique redirige vers `/connexion`, vérifier ce matcher en premier.**
- **Durcissement RLS (bloc 7)** : migration `20260927200000_durcissement_colonnes_protegees.sql` qui ferme les élévations de privilèges de l'audit (`AUDIT-SUPABASE.md` §6.2–6.3) : un membre de restaurant ne peut plus s'auto-publier, effacer une suspension, ni modifier montants/coordonnées/référence d'une commande (trigger `BEFORE UPDATE`, seuls `statut` et champs de fiche restent modifiables ; le `service_role` n'a pas de JWT utilisateur et n'est pas affecté). Vérifié en base : tentatives d'élévation refusées, transition normale de statut toujours possible.
- **Écart de suivi des migrations (repéré lors d'un état des lieux post-bloc-7, corrigé le 27/09/2026)** :
  cette même migration (`20260927200000`) a été appliquée via `execute_sql` et non
  `apply_migration` — elle était donc **absente** de
  `supabase_migrations.schema_migrations` alors que les 8 migrations précédentes y
  figuraient. L'entrée a depuis été créée manuellement dans l'historique (version,
  nom et contenu SQL complet) : les 9 migrations y figurent désormais. **Vigilance
  pour la suite :** toujours utiliser `apply_migration` (jamais `execute_sql`)
  pour toute migration DDL, sous peine de désynchroniser l'historique visible par
  `list_migrations`/`supabase migration list` de ce qui tourne réellement en base.

- **Trou RLS comblé (bloc 8d)** : `orders`/`order_items`/`order_status_events`
  n'avaient aucune policy pour un rôle système (seuls les membres du
  restaurant concerné pouvaient les lire/modifier), malgré les permissions
  `commande.consulter`/`commande.support` déjà définies au bloc 8a — même trou
  que la taxonomie au bloc 8c. Comblé, réservé à `support`/`super_admin`
  uniquement (pas `operations`, qui n'a pas ces permissions). Le trigger
  `fn_proteger_colonnes_commande` (bloc 7) continue de protéger
  référence/montants/coordonnées même pour ces rôles : seul `statut` reste
  modifiable, y compris par le support.
- **Action de support distincte de l'action restaurant (bloc 8d)** : une
  transition de statut appliquée par le support utilise l'acteur
  `support:<utilisateur_id>` dans `order_status_events` (visible du
  restaurant ET du client via `/suivi/[jeton]`), jamais `restaurant:<id>` —
  et exige systématiquement un motif journalisé séparément dans
  `audit_events`, contrairement à l'action normale du restaurant qui n'en
  demande pas.
- **Trou RLS comblé (bloc 8c)** : `menu_categories` et `neighborhoods`
  n'avaient **aucune policy d'écriture** depuis le bloc 2 — gérables uniquement
  en SQL direct jusqu'ici, pas un oubli mineur. Comblé avec la permission
  `taxonomie.editer` (content_editor, super_admin — matrice v1.0.0 inchangée).
  `content_banners` a aussi reçu `auteur_id`/`mis_a_jour_le` (`content_pages`
  les avait déjà) pour respecter l'exigence d'acceptation du bloc 8c ("chaque
  contenu porte auteur, date et état").
- **Tags non implémentés (bloc 8c)** : `PLAN-EXECUTION.md` mentionne des tags
  pour la taxonomie, mais aucune table ni aucune UI de filtrage par tag
  n'existe dans le schéma ou le catalogue public — pas dans le périmètre
  d'acceptation du bloc, volontairement pas construit par anticipation.
- **Mises en avant : permission différente des contenus éditoriaux (bloc 8c)** :
  `contenu.mettre_en_avant` appartient à `operations`/`super_admin`, **pas**
  `content_editor` (matrice v1.0.0) — décision opérationnelle/commerciale, pas
  éditoriale. D'où une page séparée `/system/mises-en-avant`, distincte de
  `/system/contenus`, déjà anticipée par le commentaire du placeholder du
  bloc 8a. Vérifié : chaque rôle est bien bloqué (404) sur la section de l'autre.
- **Invitation d'équipier sans email (bloc 8b)** : « inviter » un équipier ne
  crée ni compte ni email — aucun canal de notification n'est choisi (ADR-007,
  bloc 10 bloqué). La personne doit déjà avoir un compte Speedfood (créé via
  `/inscription`) ; l'admin la retrouve par email (`fn_trouver_utilisateur_par_email`,
  `SECURITY DEFINER`, vérifie elle-même la permission) et l'ajoute directement
  au restaurant. Email inconnu → message clair, pas de fausse promesse d'envoi.
  Toute évolution vers un vrai flux d'invitation par email dépend du bloc 10.
- **Colonne `restaurants.motif_correction`** (bloc 8b) : protégée par le même
  trigger `fn_proteger_colonnes_restaurant` que `publie`/`suspendu_*` (bloc 7) —
  un restaurateur ne peut jamais l'écrire ni l'effacer lui-même. Affichée sur sa
  console (`/restaurant`, bloc 6) quand un admin en a saisi une.
- **Comptes de test orphelins acceptables** : `bloc8b-ops-test@gmail.com`,
  `bloc8b-recheck-admin@gmail.com`, `bloc8c-editor-test@gmail.com`,
  `bloc8c-ops-test@gmail.com` et `bloc8d-support-test@gmail.com` (comptes auth
  existent encore, sans aucun rôle système) n'ont pas pu être supprimés — leurs `id` sont référencés par des
  lignes `audit_events` produites pendant les tests, et `audit_events` est
  append-only par design (ADR-010, aucune policy de suppression). Tous sont
  inertes (aucun rôle, aucun restaurant) : laissés tels quels plutôt que de
  compromettre l'intégrité du journal d'audit. **Ce sera systématique pour
  tout futur test impliquant une action journalisée** — ne pas essayer de
  forcer leur suppression, c'est le comportement voulu.
- **Masquage des coordonnées clients par défaut (bloc 8a)** : dans le CMS
  système, téléphone et adresse d'une commande sont toujours masqués
  (`src/lib/system-admin/coordonnees.ts`) ; seule la permission `coordonees.voir`
  (support, super_admin) permet de les révéler, et uniquement après un motif
  obligatoire et une trace écrite dans `audit_events` **avant** l'affichage
  (`revelerCoordonneesCommande`, refuse l'action si la trace échoue).
- **Fusion de la landing page (27/09/2026)** : le contenu marketing de
  `Jarvis/speedfood/landing` a été porté dans ce dépôt comme vraie page Next.js
  à `/`. Le catalogue réel (bloc 5) a été déplacé de `/` vers `/restaurants` —
  tout lien ou favori pointant vers l'ancienne racine comme catalogue est
  désormais faux. Le faux formulaire d'inscription de la landing (localStorage
  uniquement) a été remplacé par de vraies actions (`/restaurants`,
  `/inscription`). Voir `docs/DEPLOIEMENT-CLOUDFLARE.md`.
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

- **Centre de commandement `/system` (post-8d, 28/09/2026)** : l'accueil `/system` est un vrai
  tableau de bord opérationnel (plus une liste de liens) : file « à traiter en priorité »
  (restaurants en attente de validation avec lien direct vers leur fiche de modération,
  propositions de commande en attente de réponse client avec échéance), indicateurs clés
  tous cliquables vers la section déjà filtrée (restaurants par état, commandes actives du
  jour / en attente / propositions en attente, pages et bannières publiés vs brouillons,
  comptes système par rôle), activité récente (`audit_events` via `fn_lister_audit`) et
  accès rapides. Chaque zone n'est ni lue ni affichée sans la permission du rôle courant
  (`roleAPermission` côté page, `verifierPermission` dans chaque helper de
  `src/lib/system-admin/tableauDeBord.ts`), les lectures sont ciblées (comptages
  `head: true`, quelques colonnes, jamais `select *`) et lancées en parallèle (aucun
  waterfall). **Ajustements légers des écrans existants** pour que chaque compteur ouvre
  la section filtrée correspondante : filtre `?jour=1` sur `/system/commandes` (commandes
  créées depuis minuit UTC), filtres `?statut=publie|brouillon` sur `/system/contenus` et
  `/system/contenus/bannieres`. La zone « Restaurants » est réservée à `restaurant.moderer`
  (et non `restaurant.consulter`) parce que ses compteurs ouvrent `/system/restaurants`, qui
  exige `restaurant.moderer` — sinon `support`/`content_editor` hériteraient de liens en
  404. Matrice de permissions inchangée (v1.0.0). Vérifié dans un vrai navigateur (Chrome
  piloté en DevTools Protocol, test automatisé hors dépôt puis supprimé) contre la base :
  compteurs identiques aux comptages REST réels, comptes `super_admin` et `content_editor`
  réels, 404 sans fuite pour un anonyme et pour les sections hors permissions, aucun
  débordement horizontal en 375 px.

- **Trou RLS sur `order_proposals` — corrigé (28/09/2026)** : cette table n'avait
  aucune policy pour un rôle système (seuls les membres du restaurant concerné
  la lisaient, policies `membres_*` du bloc 2) — même trou que
  `orders`/`order_items`/`order_status_events` comblé au bloc 8d, mais
  `order_proposals` avait été oublié dans cette migration. Corrigé le jour même
  par la migration `20260927250000_lecture_propositions_support.sql`
  (`support_lecture_propositions`, lecture seule, `support`/`super_admin`) —
  vérifiée en base le 28/09/2026 lors d'un état des lieux : la policy existe et
  est correctement scopée (`pg_policies`). Les écritures sur les propositions
  restent celles du bloc 7 (restaurant/client). **Note pour la suite :** une
  version antérieure de ce document décrivait ce trou comme "non corrigé" alors
  que le correctif avait déjà été appliqué le même jour — toujours vérifier
  l'état réel en base plutôt que de faire confiance à une note qui n'a pas été
  mise à jour après coup.

## Ce qui n'est pas testé / connu comme incomplet

- Aucun test automatisé (unitaire, intégration, e2e) n'existe encore. Toute la
  vérification jusqu'ici s'est faite manuellement (navigateur + requêtes REST
  directes), documentée dans les messages de commit Git.
- Le CMS système (blocs 8a à 8d + centre de commandement post-8d) est entièrement livré — voir le tableau ci-dessus. Seule l'attribution/le retrait d'un rôle système (`/system/roles`) reste un placeholder (bloc 8a) : gérable pour l'instant uniquement en SQL direct (`system_admin_memberships`).
- Pas de CI/CD.
- Aucun test de charge ni de bout en bout automatisé en environnement Cloudflare réel (voir `docs/DEPLOIEMENT-CLOUDFLARE.md`).

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
