# Statut du projet — pour reprise par un autre développeur

**Dernière mise à jour : 3 octobre 2026 (réconciliation de la documentation du pilote).** Ce document existe pour qu'une
personne qui n'a jamais touché ce projet puisse comprendre en 5 minutes où ça en
est, ce qui est vérifié contre ce qui est juste supposé, et par où continuer.

## Projet Supabase

- ID : `ggldjdizqrtpetdiohxy`, région `eu-west-1` (Irlande — pas `eu-west-3`/Paris
  qui aurait été légèrement plus proche de Conakry ; le projet a été créé
  manuellement par Malika et ce choix a été accepté tel quel plutôt que de
  recréer un projet, voir historique Git du bloc 1)
- Compte : `mistermarcket@gmail.com`
- **État vérifié le 3 octobre 2026 par l'API de gestion Supabase**
  (`GET /v1/projects/ggldjdizqrtpetdiohxy`) : projet `ACTIVE_HEALTHY`, région
  `eu-west-1`, organisation `celytzqqoodmsbuucbqk`.
- **Réglages d'Auth — état vérifié le 3 octobre 2026.** L'ancienne note affirmait
  qu'« aucun outil ne permet de les gérer par migration ou API » : **c'est faux**,
  l'API de gestion Supabase les lit et les écrit ; c'est l'accès qui manquait, pas
  l'outil. État réel :
  - "Confirm email" est **activé depuis le 3 octobre 2026** (`mailer_autoconfirm =
    false`) : le compte n'est actif qu'après avoir suivi le lien reçu par e-mail. Il
    était désactivé jusque-là parce que le service d'envoi par défaut de Supabase
    **ne délivre qu'aux adresses membres de l'équipe du projet**
    (`rate_limit_email_sent = 2`) : un restaurateur n'aurait jamais pu activer son
    compte, et la fonction « mot de passe oublié » était de fait **inutilisable pour
    un vrai client**. Un SMTP dédié a levé cette restriction, puis l'application a
    été adaptée avant la bascule (voir la décision correspondante plus bas).
  - "Leaked password protection" est **impossible sur l'offre actuelle**, ce n'est
    pas un réglage oublié : tentative d'activation par l'API le 3 octobre 2026,
    refus explicite `HTTP 402 — "Configuring leaked password protection via
    HaveIBeenPwned.org is available on Pro Plans and up."`
    **Décision de Malika, 3 octobre 2026 : rester sur l'offre gratuite.** Cette
    protection reste donc indisponible, et c'est un choix assumé, pas un reste à
    faire. Mesures compensatoires en place à ce jour : plancher de longueur porté à
    8 (voir ci-dessous), double authentification TOTP disponible pour tous les
    comptes, limitation de débit à la commande, anti-robot Turnstile. À réévaluer
    si le pilote ouvre des comptes au-delà des restaurants de test.
  - `password_min_length` est passé de **6 à 8** le 3 octobre 2026. Motif :
    l'application impose déjà 8 caractères côté serveur
    (`src/lib/auth/actions.ts`, `src/lib/auth/recuperation.ts`), mais le plancher
    Supabase en acceptait 6 — un appel direct à l'API d'inscription pouvait donc
    créer un compte plus faible que ce que l'application autorise. Tout compte créé
    via l'application a ≥ 8 caractères (règle serveur appliquée à l'inscription et
    au changement de mot de passe), ce durcissement ne peut donc pas verrouiller un
    compte créé normalement. **Retour arrière** en une requête si une connexion
    échoue de façon inattendue en invoquant un mot de passe faible.
  - Vérifiés également : `uri_allow_list` contient bien
    `…/auth/confirmation` ; MFA TOTP activée (enrôlement et vérification) ;
    aucune CAPTCHA Supabase (`security_captcha_enabled = false`) — l'anti-robot
    Turnstile agit à l'étape commande, pas à l'authentification.

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
| post-8d (refonte admin) | Lien de bascule entre les deux consoles (`/restaurant` ↔ `/system`) pour un compte qui cumule les deux accès | Fait | Constat en test manuel : `admin.speedfood.dev@gmail.com` est à la fois propriétaire de « barbie » et `super_admin`, mais rien ne permettait de passer d'une console à l'autre sans taper l'URL à la main. Ajout de `src/lib/auth/doubleAcces.ts` (`aUnRoleSysteme`, `aUnMembershipRestaurant`, lecture de sa propre ligne dans l'autre table — déjà autorisée par les policies RLS existantes, aucune migration nécessaire) : un lien « Console admin → » apparaît dans `/restaurant` uniquement si le compte a aussi un rôle système, et un lien « Mon restaurant » apparaît dans l'en-tête `/system` uniquement si le compte a aussi un membership restaurant. Par défaut (restaurateur ou rôle système ordinaire), rien ne change — conforme à ADR-010 et à l'exigence TDR "sans naviguer dans le CMS système" pour un restaurateur classique. Testé dans le navigateur : `admin.speedfood.dev@gmail.com` voit les deux liens et l'aller-retour fonctionne dans les deux sens ; un compte restaurateur de test sans rôle système (créé puis supprimé) ne voit aucun lien vers `/system`. |
| post-8d (catalogue démo) | Catalogue « bien fourni » — 12 restaurants fictifs + 60 plats (24 avec photo), refonte visuelle `/restaurants` et `/restaurants/[id]` | Fait | Migration `restaurants_donnees_demo` (colonne `donnees_demo boolean`, `get_advisors(security)` : aucune nouvelle alerte) — `delete from restaurants where donnees_demo = true` supprimera tout ce lot plus tard, cascade vers `menu_items`. 12 restaurants (3 par quartier × 4 catégories), noms/textes à consonance conakryenne, `publie = true` dès l'insertion. Photos Unsplash hotlinkées (licence libre, aucun compte/coût engagé) : sourcées via recherche par mot-clé sur unsplash.com puis **vérifiées visuellement une par une** (screenshot réel de chaque image) — une première passe basée sur des identifiants de mémoire s'est révélée non fiable (~40 % d'erreurs : pancakes pour un restaurant de riz, intérieur de restaurant pour une boulangerie, burger pour un grill, salade pour un riz gras) et a été entièrement corrigée avant validation. Correctif au passage : token CSS mort `var(--rayon-2)` (jamais défini) remplacé par `var(--radius-md)` dans 4 fichiers (`restaurants/[id]/page.tsx`, `BanniereItem.tsx`, `PlatItem.tsx`, `FormulaireProfil.tsx`) — les images concernées n'avaient jusqu'ici aucun arrondi. Nouveau `src/app/catalogue.css` (importé dans `layout.tsx`) : carte restaurant avec ratio photo 4:3, élévation au survol, pastille de couleur par catégorie (tokens `--couleur-riz/grill/fast/cafe` existants, aucun dégradé — respect de DESIGN-SYSTEM.md) ; fiche restaurant avec héro 16:7 et lignes de menu unifiées. Aucune fausse note/avis ajoutée (hors périmètre MVP, TDR). Vérifié dans le navigateur (desktop et mobile 375px) : grille, filtres catégorie/quartier, fiche détaillée, aucune régression sur les restaurants `[DEV]...` existants (laissés tels quels, décision explicite). `npm run typecheck`/`lint` propres. |
| post-8d (marque restaurant) | Couleur d'accent personnalisable par restaurant (identité de marque) | Fait | Migration `restaurants_couleur_accent` (colonne `couleur_accent text`, nullable, `get_advisors(security)` : aucune nouvelle alerte). Palette fermée de 16 teintes (`src/lib/design/paletteMarque.ts`), chacune vérifiée ≥4.5:1 de contraste sur blanc par script (formule de luminance relative WCAG) avant d'être retenue — pas de champ hex libre, zéro risque d'accessibilité. `SelecteurCouleur.tsx` (pastilles cliquables, `aria-pressed`, focus visible global) ajouté à `/restaurant/profil` ; `modifierProfilAction` valide contre la palette (défense en profondeur). Affichage : liseré en haut de carte catalogue (`RestaurantCard.tsx`) et cadre autour de la photo héro + accent sous le titre sur la fiche (`restaurants/[id]/page.tsx`) — jamais sur un bouton d'action ni un badge de statut (règle DESIGN-SYSTEM.md respectée). Les 12 restaurants de démo ont chacun reçu une couleur distincte. Testé dans le navigateur avec un compte restaurateur de test (créé puis supprimé) : sélection, sauvegarde et persistance après rechargement vérifiées en base (`#1A5276`), remise à zéro (`✕`) vérifiée (`null` en base) ; aucune régression sur les restaurants sans couleur choisie. `npm run typecheck`/`lint` propres. |
| post-8d (offre marchande) | Repositionnement de la landing sur les vrais différenciateurs (commit `9b97b5d`) | Fait | Une étude concurrentielle externe (hors dépôt) a montré que catalogue/menu/commande web sont déjà proposés par plusieurs concurrents guinéens — pas un différenciateur. Le vrai point fort, déjà construit et testé (bloc 7, `order_proposals`), était invisible sur la landing. Hero et « Comment ça marche » réécrits pour mettre en avant : aucun compte ni application à installer, le restaurant garde la main, et tout changement de montant est soumis au client avant préparation. Aucun nouveau token CSS (réutilise `.check-list`). |
| sécurité (3 octobre 2026) | Rejeu des migrations sur une base jetable (`supabase/rejeu/`) | Fait | Outil autonome (PGlite, PostgreSQL en mémoire, sans Docker ni compte ni coût) qui rejoue les 26 fichiers et calcule une signature du schéma `public`. **Résultat : 26/26 sans erreur et schéma identique à la production** (tables, colonnes, contraintes, index, policies RLS, triggers, fonctions : sept hachages égaux). Deux différences cosmétiques trouvées en chemin, sans effet : deux fonctions de production n'ont pas deux lignes de commentaire ou ont des fins de ligne Windows. **Limites** : PostgreSQL 18 contre 17, bouchons pour les éléments Supabase, droits, données et stockage non comparés. À rejouer après chaque migration. |
| sécurité (3 octobre 2026) | Revue de sécurité indépendante et premières corrections | Verdict **« Revue bloquante »** ; 3 points corrigés et **déployés en production le 3 octobre 2026** (version Worker `f62ee7bb`) | Détail dans `docs/REVUE-SECURITE-2026-10-03.md`. Corrigé et vérifié : (1, bloquant) un restaurateur pouvait faire supprimer l'image d'un autre restaurant en écrivant son URL dans sa propre ligne : trigger `fn_valider_url_media` côté base (testé avec session simulée) + `supprimerImage` qui valide le chemin et ne supprime pas un fichier encore référencé ; (2) redirection ouverte à la connexion ; (4) audit falsifiable (`acteur_id = auth.uid()`). Migration `securite_revue_independante_1` appliquée en base et versionnée (26 fichiers). **Ouverts avant pilote** : accès direct du support aux coordonnées clients, verrou « dernier super_admin », idempotence par UUID, concurrence des propositions, contournements par l'API directe. `get_advisors(security)` : aucun nouvel avis. |
| sécurité (3 octobre 2026) | Portes avant pilote : conservation des données, sauvegarde, plan d'incident | Documents écrits, **rien de validé ni testé** | `docs/CONSERVATION-ET-CONFIDENTIALITE.md` (inventaire réel des données personnelles, durées proposées, texte de confidentialité à publier, procédure de demande d'effacement) ; `docs/SAUVEGARDE-ET-RESTAURATION.md` (**offre Supabase gratuite : aucune sauvegarde**, fichiers du stockage non couverts, risque de pause, procédure d'export et de test de restauration, décision Pro à prendre) ; `docs/PLAN-INCIDENT.md` (gestes d'urgence réels, contacts à compléter, journaux du Worker non activés). Le test de rejeu des migrations a d'abord échoué (Docker Desktop ne démarre pas sur cette machine) puis a été **fait avec PGlite**, voir la ligne suivante. |
| sécurité (3 octobre 2026) | Limitation de débit des actions publiques | Fait et **déployé en production** (3 octobre 2026, version Worker `0c7b3ec1`) | Migration `limitation_debit` (table `rate_limits`, RLS sans policy, fonction `fn_limiter_debit` dont l'exécution est retirée à `anon` et `authenticated`) ; module `src/lib/securite/limitation-debit.ts` branché sur `creerCommandeAction` (par IP 10 / 10 min, par téléphone 5 / h, par restaurant 60 / 10 min) et `repondrePropositionAction` (par IP 30 / 10 min). Nouveau code d'erreur `TROP_DE_REQUETES`, message affiché par le formulaire existant. Testé : fonction en base (3 autorisés puis refus ; `anon` sans droit d'exécution), puis parcours réel sur le serveur de développement : 1re commande acceptée avec 3 compteurs créés (clés hachées), compteur IP poussé à la limite, 2e commande refusée avec le message prévu et **aucune commande créée** ; commandes et compteurs de test supprimés. `get_advisors(security)` : seul avis ajouté, l'INFO attendue « RLS sans policy » sur `rate_limits`. `npm run typecheck`/`lint` propres. **Vérifié en production** : deux commandes de test (supprimées ensuite) dont une avec un en-tête `X-Forwarded-For` falsifié ont incrémenté le même compteur IP : l'adresse est lue dans `cf-connecting-ip`, pas dans un en-tête que le visiteur contrôle. |
| produit (3 octobre 2026) | Disponibilité horodatée et recherche par plat (lot 1 ; alternatives en rupture = lot 2, pas commencé) | Fait et **déployé en production le 3 octobre 2026** (version Worker `1d1af282`, commit `1e032e0`; `/restaurants` et la recherche répondent 200 avec la nouvelle page) | Migration `disponibilite_horodatee` : `restaurants.accepte_commandes`, `restaurants.statut_mis_a_jour_le`, `menu_items.disponibilite_confirmee_le`, `parametres_application.disponibilite_fraicheur_heures` (6 h par défaut, modifiable dans `/system/parametres`, 1 à 72). Deux triggers imposent `now()` côté base pour tout appelant non service-role : un restaurateur ne peut pas falsifier l'horodatage. Trois états distincts : ouvert / accepte les commandes / plat disponible (« à confirmer » si jamais confirmé ou plus vieux que le seuil). `/restaurants` : recherche par plat insensible aux accents, groupes exact confirmé / exact à confirmer / restaurant / épuisé, filtres, score explicable (`src/lib/decouverte/classement.ts`). Console : deux bascules (réponse serveur attendue, pas d'optimiste), « Confirmer disponible », « Tout reconfirmer disponible ». Une pause retire le bouton Ajouter et bloque la création de commande côté serveur. Testé : 52 tests unitaires (`npm run test:unit`), navigateur sur un restaurant de test (groupes, « boeuf » trouve « Bœuf », badges, pause = 0 bouton Ajouter), données de test supprimées ; `get_advisors(security)` sans nouvel avis ; rejeu 27/27, schéma identique à la production. **Non cliqué dans cette session** : l'écran `/system/parametres` et les bascules de la console (vérifiés par le code et par SQL seulement). |
| sécurité (3 octobre 2026) | Revue indépendante, point 3 : accès direct du support aux commandes | Corrigé en base et **déployé en production le 3 octobre 2026** (version Worker `7d272103`) | Migration `securite_support_commandes` (28e fichier). Le rôle `support` n'a plus aucun accès direct à `orders` : quatre fonctions SECURITY DEFINER (liste masquée, compteurs, révélation avec motif et audit dans la même transaction, changement de statut avec historique et audit) ; trigger qui interdit à tout utilisateur connecté de modifier autre chose que le statut d'une commande. Testé en base (session simulée, tout est rejeté comme prévu) et dans l'interface avec un compte support de test (liste masquée, révélation, transition, audit et acteur écrits ; compte et commande de test supprimés). `get_advisors(security)` : 4 avis WARN attendus « fonction SECURITY DEFINER exécutable par authenticated », comme `fn_lister_audit` (les fonctions vérifient le rôle elles-mêmes). Rejeu 28/28, schéma identique à la production. Déployé ensemble avec la migration : l écran support de production utilise les nouvelles fonctions. |
| sécurité (3 octobre 2026) | Revue indépendante, point 5 : verrou « dernier super_admin » | Corrigé en base (actif en production) ; **ajustement du code déployé (version `c398ccab`)** | Migration `securite_dernier_super_admin` (29e fichier) : trigger `fn_garder_dernier_super_admin` avant suppression ou mise à jour, verrou consultatif contre la concurrence. Testé en base avec rollback ; `get_advisors(security)` sans nouvel avis ; rejeu 29/29, schéma identique à la production. Côté code, `retirerRoleAction` relit le rôle en base et traduit le refus de la base. Le clic réel sur Retirer n'est pas testable par l'automatisation (`confirm()`), seule la base est vérifiée. |
| sécurité (3 octobre 2026) | Revue indépendante, point 10 : clé d'idempotence | Corrigé et **déployé** (version `c398ccab`) | `validerCreationCommande` exige un UUID v4 ; `FormulaireCommande` génère un UUID (repli `getRandomValues`) ; `creerCommande` refuse un rejeu dont le restaurant diffère. Vérifié : cas de clés valides et invalides, commande réelle de bout en bout en local avec la nouvelle clé (supprimée ensuite). Aucune migration. |
| sécurité (3 octobre 2026) | Revue indépendante, point 7 : concurrence des réponses aux propositions | Corrigé en base et **déployé** (version `c398ccab`) | Migration `securite_reponse_proposition_atomique` (30e fichier) : `fn_repondre_proposition` (une transaction, ligne de commande verrouillée, service-role seulement) et trigger qui bloque l'acceptation d'une commande tant qu'une proposition active attend le client. `repondreProposition` appelle la fonction et traduit ses refus. Testé en base (7 cas) et dans l'application locale (acceptation réelle depuis `/suivi`, montant mis à jour, commande de test supprimée). Rejeu 30/30 identique à la production ; aucun nouvel avis de sécurité. **Non éprouvé** : deux connexions vraiment simultanées. |
| sécurité (3 octobre 2026) | Revue indépendante, fin du point 6 et point 13 | Corrigé en base (actif en production, aucun changement de code) | Migration `securite_contournements_api_et_droits` (31e fichier) : historique de commande (acteur et transition contrôlés), section d'un plat limitée à son restaurant, policies d'administration en `to authenticated`, privilèges de table retirés à `anon` (écriture) et aux deux rôles (TRUNCATE, REFERENCES, TRIGGER), `rls_auto_enable` non appelable. Testé en base et dans l'application locale (compte restaurateur de test supprimé). Rejeu 31/31 identique à la production ; avis de sécurité : 2 de moins. **Reste ouvert dans la revue** : 8, 9, 11, 12, 14. |
| sécurité (3 octobre 2026) | Revue indépendante, points 8, 9 (partiel), 11, 12, 14 | Corrigé et **déployé** (version `d0411596`) | Prix confirmé par le client (refus et nouveau total si un prix a changé), IPv6 regroupées par /64, liste blanche des tables de taxonomie, ordre des contrôles d'appartenance, message d'erreur d'inscription générique, lien de bannière sûr (code et contrainte en base, migration `securite_lien_banniere`, 32e fichier), signature réelle des images. Tests : 78 tests unitaires (`npm run test:unit`), contrainte testée en base, parcours réel du changement de prix en local. Rejeu 32/32 identique à la production. **Risque résiduel du point 9** : un attaquant avec des commandes valides peut saturer le plafond d'un numéro ou d'un restaurant ; seule une vérification humaine ou par code y répond, à décider avec les notifications. |
| produit (3 octobre 2026) | Alternatives en cas de rupture (lot 2 de la découverte) | Fait et **déployé en production le 3 octobre 2026** (version Worker `d0411596`) | Sur la fiche d'un restaurant, un plat épuisé porte un lien « Trouver ailleurs » vers `/restaurants/[id]/alternatives?plat=…`. Trois groupes étiquetés, jamais de substitution au panier : le même plat ailleurs disponible et confirmé, le même plat à confirmer, puis des suggestions d'un plat DIFFÉRENT de la même catégorie de cuisine (confirmées seulement). Seuls les restaurants ouverts qui acceptent des commandes sont proposés ; un plat épuisé n'est jamais proposé ; un seul plat par restaurant et par groupe, 6 au plus par groupe, aucune distance (pas de localisation). Logique pure `src/lib/decouverte/alternatives.ts` (12 tests, `npm run test:unit`) ; lecture du catalogue factorisée (`lireCatalogue`). Vérifié dans le navigateur local avec trois restaurants de test (supprimés) : le même plat confirmé chez l'autre restaurant est proposé, le restaurant fermé est écarté. **Limites** : « équivalent déclaré par le restaurateur » (SPEC 3.3) n'existe pas, il faudrait une colonne ; paramètres invalides ou plat inconnu affichent la page introuvable avec un statut HTTP 200, en développement comme en production (vérifié le 3 octobre ; aucune fuite, mais pas une vraie 404) ; le lien n'apparaît que pour un plat épuisé, pas pour un restaurant fermé ou en pause. |
| sécurité (3 octobre 2026) | Point 9 : vérification anti-robot Cloudflare Turnstile à la commande | Déployé en production (version `7dafe86b`), clés posées ; **chemin positif vérifié par Malika** (commande réelle acceptée en production, supprimée ensuite) | `src/lib/securite/turnstile.ts` (validation serveur, jeton à usage unique, échec fermé si Cloudflare ne répond pas), widget `src/components/Turnstile.tsx`, branché dans `FormulaireCommande` et `creerCommandeAction` (avant les plafonds, pour qu'un jeton invalide n'en consomme aucun). Actif seulement si `TURNSTILE_SECRET_KEY` (secret du Worker) est défini ; la clé de site `TURNSTILE_SITE_KEY` est lue à l'exécution par `/commande`. Testé en local avec les clés de test publiées par Cloudflare : widget chargé, commande acceptée avec le jeton de test, refus avec message clair et aucune commande créée avec la clé « toujours refusé » (clés de test retirées de `.env.local` ensuite). Le widget Cloudflare `speedfood` a été créé le 3 octobre 2026 et sa clé de site (publique) est dans `wrangler.jsonc`. **À faire par Malika** : faire pivoter puis poser la clé secrète (`npx wrangler secret put TURNSTILE_SECRET_KEY`), voir `docs/ANTI-ROBOT-TURNSTILE.md` ; la clé secrète d'origine est à remplacer car elle est apparue par erreur dans la session de travail. **Limites** : une première soumission après un démarrage à froid du serveur local est restée bloquée côté navigateur (la commande était pourtant créée) et a réussi à la seconde tentative, non reproduit ; Turnstile réduit l'abus automatisé mais n'empêche pas une personne qui passe de vraies commandes. |
| sécurité (3 octobre 2026) | Exports réguliers des données et preuve de restauration | Outil fait et **restauration vérifiée** ; planification automatique en attente de décision | `npm run export:donnees` (tables, comptes sans mots de passe, fichiers du stockage, manifeste, rotation à 4 exports, hors du dépôt) et `npm run export:verifier` (recharge l'export dans une base jetable reconstruite par les migrations, compare les empreintes, les nombres de lignes et l'intégrité). Premier export réel : 19 tables, 12 comptes, 1 fichier, restauration vérifiée sans écart. Décision de Malika : exports réguliers plutôt qu'offre Pro à ce stade. **Planifié le 3 octobre 2026** : tâche Windows « Speedfood - export hebdomadaire », chaque dimanche à 20 h (rattrapage si PC éteint), testée par une exécution réelle (code 0, journal `speedfood-exports\journal-export.log`). Guide autonome : `docs/RUNBOOK-EXPORT.md`. **Reste** : disque chiffré (BitLocker) à confirmer, copie hors machine. |
| sécurité (3 octobre 2026) | Compte super_admin réel du propriétaire | Fait | Le rôle super_admin est passé du compte provisoire `admin.speedfood.dev@gmail.com` au compte réel de Malika (`moelohimmara@gmail.com`, créé par elle-même, nouveau mot de passe fort choisi par elle) ; attribution et retrait faits en base à sa demande et journalisés dans `audit_events`, connexion vérifiée par Malika sur `/system`. Le compte provisoire n'a plus aucun rôle système (il possède toujours le restaurant de démonstration « barbie »). **Reste** : double authentification (à construire, non disponible sur l'offre gratuite sans code applicatif), protection contre les mots de passe fuités (offre Pro seulement), suppression des 11 comptes de test avant le pilote. |
| sécurité (3 octobre 2026) | Conservation des données : anonymisation automatique réglable | Fait en base (actif) et écran de réglage **déployé** (version Worker `aeb3fc76`) | Migration `conservation_donnees` (33e fichier) : trois durées dans `parametres_application` (90 jours après clôture, 30 jours pour une commande jamais clôturée, 12 mois d'audit ; bornes imposées par la base, minimum 7 jours), colonne `orders.anonymise_le`, fonction `fn_anonymiser_donnees()` (réservée à la planification interne, refusée à l'API) et job `pg_cron` quotidien à 3 h 15 UTC (extension activée). Testé avec des commandes de dates variées en transaction annulée : seules les commandes échues sont anonymisées, rien n'est retraité, l'audit ancien est purgé, la borne basse refuse 3 jours, l'appel par l'API est refusé. Écran `/system/parametres` : trois champs et un encart d'avertissement sur l'irréversibilité. Mode d'emploi complet pour un humain ou un agent : `CONSERVATION-ET-CONFIDENTIALITE.md` §6. **Reste** : page `/confidentialite` (identité du responsable, contact, date à fournir par Malika), validation juridique. |
| sécurité (3 octobre 2026) | Double authentification facultative (TOTP) avec rappel d'importance | Fait et **déployé en production** (version Worker `aeb3fc76`, 3 octobre 2026) | Page `/compte/securite` (activer avec QR code et clé de secours à noter, désactiver), page `/connexion/verification` (code après le mot de passe), rappel visible dans les consoles restaurant et administration (plus explicite et rouge pour les comptes système), contrôle dans `src/proxy.ts` et, en base (migration `double_authentification_aal2`, 34e fichier), `fn_est_admin_systeme` et `fn_est_membre_restaurant` n'accordent leurs droits à un compte protégé qu'avec une session renforcée : un appel direct à l'API avec le seul mot de passe ne lit plus rien de protégé. Testé en base avec sessions simulées et dans l'application avec un compte de test (activation avec un vrai code, reconnexion exigeant le code, mauvais code refusé, désactivation ; compte supprimé). Rejeu 34/34 identique à la production ; aucun nouvel avis de sécurité attendu (fonction non exposée). **Limites** : pas de code de secours (récupération par un administrateur de base, procédure dans `DOUBLE-AUTHENTIFICATION.md`) ; ne protège pas Supabase, Cloudflare ni GitHub (à activer séparément par Malika). |
| produit (3 octobre 2026) | Partage WhatsApp, lien à copier, QR code et aperçu de lien (lot 6b, partie diffusion) | Fait et **déployé en production** (version Worker `afb86b93`, 3 octobre 2026) | Sur la fiche d'un restaurant : « Partager sur WhatsApp » (lien `wa.me` sans numéro, texte prérempli qui cite Speedfood et ne promet ni disponibilité ni commande ; la personne choisit le destinataire et envoie elle-même) et « Copier le lien », au niveau du restaurant et de chaque plat (ancre `#plat-…`). Aperçu de lien (Open Graph : nom, catégorie, quartier, photo). Route publique `/restaurants/[id]/qr` : QR code SVG de la page, **restaurants publiés seulement** (404 sinon, et pour un identifiant invalide), téléchargeable avec `?telecharger=1`. Console restaurateur : carte « Votre lien et votre QR code » (QR, téléchargement, partage), remplacée par un message tant que le restaurant n'est pas publié. Nouvelle dépendance **`qrcode-generator` 2.0.4** (MIT, aucune dépendance propre, maintenue, utilisée côté serveur seulement donc absente du code envoyé au navigateur). Aucune télémétrie, aucun clic mesuré. Vérifié : 10 tests unitaires des liens, page et QR dans le navigateur local, **QR décodé par un décodeur indépendant : il redonne exactement l'adresse de la page**, restaurant non publié 404, carte console avec un compte de test (supprimé). **Non fait** : « Contacter le restaurant sur WhatsApp » (aucun numéro de restaurant n'existe en base), visuels de menu du jour, télémétrie des clics (lot 11a). |
| administration (3 octobre 2026) | Suppression d'un compte par le super_admin (comptes de test, comptes à fermer) | Fait en base (actif) ; écran **pas encore déployé** | Bouton « Supprimer ce compte » dans `/system/acces/comptes`, nouvelle permission `compte.supprimer` (super_admin seulement, matrice v1.2.0). Garde-fous : e-mail à retaper (casse ignorée), motif obligatoire, jamais son propre compte, jamais un autre super_admin (retirer d'abord son rôle), restaurants supprimés seulement sur case cochée, si le compte en est le seul membre **et** s'ils n'ont aucune commande (sinon conservés sans membre) ; trace d'audit écrite avant la suppression. Migration `suppression_comptes` (35e fichier) : fonction `fn_preparer_suppression_compte` (réservée au super_admin, avec double authentification si activée) et auteurs d'actions (audit, contenus, paramètres) en `ON DELETE SET NULL` : l'historique reste, sans lien vers le compte. La suppression du compte lui-même passe par l'API d'administration de l'authentification, côté serveur. Testé en base (sans droit, propre compte, introuvable, motif vide, cible super_admin, restaurant vide supprimé, restaurant avec commande conservé, restaurant partagé conservé, historique conservé) puis dans l'application avec trois comptes de test (mauvais e-mail refusé, suppression avec et sans restaurant, résumé affiché) ; données de test supprimées. Rejeu 35/35 identique à la production. |
| légal (3 octobre 2026) | Page de confidentialité `/confidentialite` | Faite en local, **pas encore déployée** | Texte du brouillon de `CONSERVATION-ET-CONFIDENTIALITE.md` §5, responsable **Mo elohim**, contact **moelohimmara@gmail.com**, date de mise à jour 3 octobre 2026, durée de conservation **lue en direct dans le réglage** (la page ne peut pas annoncer une durée différente de celle appliquée), mention du contrôle anti-robot Cloudflare. Liée depuis le pied de page de l'accueil et depuis la case de consentement du formulaire de commande. Vérifiée dans le navigateur local. **Reste** : validation juridique des durées et obligations en Guinée. |
| design (3 octobre 2026) | Audit visuel et premières corrections de mise en page | Fait en local, **pas encore déployé** | Audit consigné dans `AUDIT-VISUEL-2026-10-03.md` (parcours mobile, mesures de contraste et de cibles tactiles). Corrigés et vérifiés en mobile : chevauchement du prix dans les lignes de menu, rappel de double authentification (cause : alertes en colonnes, corrigée pour toutes), partage allégé (un lien par plat), console (commandes avant le QR code), page Menu (liste avant les formulaires), liens de connexion lisibles, bouton de fichier stylé. **Reste** : en-tête d'administration étroit, onglets de console coupés, « mot de passe oublié », cases du paiement, cibles tactiles restantes ; puis choix d'une direction de design avec Malika. |
| design (3 octobre 2026) | Proposition documentée de refonte de l'interface | Proposée, **en attente de décision de Malika** | `PROPOSITION-REFONTE-UI.md` (cahier des charges, calibrage du ton, trois directions A « Carnet de table », B « Marché en photos », C « Pass de cuisine », quatrième piste D non recommandée, plan en sept lots R1 à R7, décisions à prendre) et page de maquettes `design/directions-refonte.html` (six écrans mobiles avec les vrais textes). Méthode inspirée du dépôt `oil-oil/oil-ui` **lue comme référence, rien installé**. Constat clé : les concurrents ouvrent sur un écran d'application, Speedfood sur une page de lancement. **Limites écrites** : pas d'étude visuelle des autres concurrents, pas de revue indépendante, pas de test sur appareils réels ni avec des restaurateurs. Recommandation : A comme base, C en premier, B seulement avec de vraies photos. **Décision de Malika : B + A.** |
| design (3 octobre 2026) | Refonte « Marché du jour » du parcours client (B + A) | Faite en local, **pas encore déployée** | Navigation basse (Découvrir, Panier avec pastille, Espace pro) et barre de panier flottante avec miniatures des plats et total ; accueil de découverte avec carrousel « Plats du moment » (un plat confirmé récemment par restaurant, photo en premier) ; fiche restaurant en photo de couverture, tampon de fraîcheur (« confirmé il y a… » en vert, « à confirmer » jamais présenté comme disponible), grille de vignettes ; **tuile typographique** quand un plat n'a pas de photo (couleur de la catégorie, jamais de dégradé) ; panier avec miniatures. Les photos du panier (`photoUrl`) ne sont acceptées qu'en https, 500 caractères au plus ; le prix reste recalculé côté serveur. Vérifié à 375 px et 1280 px, cibles tactiles ≥ 44 px, texte blanc de la barre de panier sur la zone rouge (contraste AA), mouvement réduit respecté ; 13 tests unitaires (`tuile`), tsc et eslint propres. **Limites** : outils Adobe indisponibles (connecteur non autorisé) donc non utilisés ; pas de test avec de vrais utilisateurs ni appareils réels ; l'effet des photos dépend de vraies photos de plats. **Reste** : rien de décidé en attente sur la page `/` (voir ligne suivante). |
| console restaurateur (4 octobre 2026) | **Lot A1 : alertes de nouvelle commande, console ouverte** | Fait en local, **pas encore déployé** | `ALERTES-COMMANDES.md`. Vérification toutes les 15 s (route `/restaurant/alertes`, aucune donnée client), carillon et relance toutes les 2 min, titre d'onglet clignotant, notification du navigateur sur autorisation, liste et pastille rafraîchies, bandeau de retard à 10 min, annonce pour lecteur d'écran, état « alertes en pause » si la connexion est perdue. 19 tests purs ; essai réel avec compte de test (commande reçue en direct, onglet caché simulé, retard, coupure réseau). **Non vérifié** : son réellement entendu, notifications du navigateur, téléphone réel. **Limite majeure** : la page doit rester ouverte ; A2 (push) demande des clés VAPID (secret), une table d'abonnements et le lot B (installation), décisions dans le §5 du document. |
| console restaurateur (4 octobre 2026) | **Lot A2 : notification push web, page fermée** | Fait en local, **pas encore déployé** ; **secret `VAPID_PRIVATE_KEY` à poser sur Cloudflare avant usage** | `ALERTES-COMMANDES.md` §5. Push vide signé VAPID (aucune donnée client chez Google/Apple), table `push_subscriptions` (migration appliquée), routes abonnement/essai protégées, envoi via `after()`. Essais réels avec compte de test OK. **Non vérifié** : réception sur téléphone, commande invitée réelle, iPhone (exige le lot B). |
| console restaurateur (4 octobre 2026) | **Lot B : application installable (Android et iPhone)** | Fait en local, **pas encore déployé** | `ALERTES-COMMANDES.md` §6. Manifeste, icônes tirées du logo officiel, invite d'installation et conseil batterie dans la console, icône et badge des notifications. Non vérifié sur téléphone réel. |
| public (4 octobre 2026) | **Lot F : référencement et partage** | Fait en local, **pas encore déployé** | `robots.txt` (consoles, comptes, panier, commande et suivi exclus), `sitemap.xml` (pages publiques + restaurants publiés, via la RLS), données structurées Restaurant sur les fiches (faits connus seulement : pas de note ni de prix), aperçu de partage et lien canonique sur le catalogue. Vérifié en local. Les 5 restaurants `[DEV]` ont été dépubliés en base le 4 octobre (pas supprimés). Pages `/aide` et `/devenir-partenaire` : dépendent du lot D (contenu à décider). |
| public (4 octobre 2026) | **Lot C : promesse et preuve en direct sur l'accueil** | Fait en local, **pas encore déployé** | Phrase de promesse par défaut (« Commandez en 30 secondes, sans application, sans compte »), bande « En ce moment » calculée dans la base (restaurants ouverts aux commandes, plats confirmés depuis moins d'une heure ; restaurants de démonstration exclus ; aucun chiffre si zéro), trois étapes. Affichée seulement sans recherche ni filtre. **À valider** : le « 30 secondes » n'est pas chronométré. |
| public (4 octobre 2026) | **Lot D : aide, moyens de paiement, conditions** | Fait en local, **pas encore déployé** | Page `/aide` (9 questions, FAQPage), page `/devenir-partenaire` (conditions du pilote en réserve, aucun chiffre), moyens de paiement déclarés (migration `moyens_paiement` appliquée et rejouée : 7 signatures identiques à la production ; case à cocher dans « Mon restaurant », ligne sur la fiche), liens en pied de page et plan du site. **Non vérifié visuellement** : affichage d'un restaurant publié avec des moyens cochés (publication d'un restaurant de test en production refusée). |
| console restaurateur (4 octobre 2026) | **Lot E : démarrage guidé** | Fait en local, **pas encore déployé** | Liste « Préparez votre page » sur le tableau de bord (photo, logo, plat, horaires, paiement, validation) avec avancement, déduite de l'état réel ; lien « Voir les étapes » sur l'inscription. **Non fait** : assistance WhatsApp (aucun numéro fourni), position sur carte, délai de validation annoncé (aucune durée décidée). |
| console admin (4 octobre 2026) | **Réglages pilotes : assistance WhatsApp, délai de validation, position sur carte** | Fait en local, **pas encore déployé** ; migration `assistance_validation_carte` appliquée (7 signatures identiques) | Dans `/system/parametres` (super_admin) : numéro WhatsApp d'assistance (vide = aucun bouton), délai habituel de validation en heures (vide = aucune durée annoncée), case « Activer la position sur carte ». Tout est désactivé par défaut. Boutons WhatsApp sur l'aide, la page partenaire, l'inscription et le tableau de bord ; délai affiché « réponse en général sous X » ; carte : champs latitude/longitude et bouton « Utiliser ma position » dans « Mon restaurant », liens « Voir sur la carte » (OpenStreetMap) et « Itinéraire » sur la fiche, aucune carte chargée dans la page (CSP inchangée), `Permissions-Policy` géolocalisation limitée au site. 18 tests purs. **Non vérifié en conditions réelles** : l'enregistrement depuis l'écran admin (aucun compte admin de test), l'affichage avec numéro, délai et carte renseignés. |
| public (4 octobre 2026) | **Lot G : textes de promesse** | Fait en local, **pas encore déployé** ; migration `textes_accueil` appliquée (colonnes et contraintes identiques à la production) | Textes rédigés selon Ogilvy (bénéfice précis, faits) et Bencivenga (promesse crédible, preuve visible) : signature « Confirmé, l'heure à l'appui » au-dessus de l'accroche, sous-titre « Une commande se fait depuis le navigateur de votre téléphone : aucun compte à créer, aucune application à installer. », description de partage « Speedfood, Conakry. Chaque plat affiche l'heure à laquelle son restaurant l'a confirmé… ». Le « 30 secondes » non prouvé est retiré. Modifiables dans `/system/parametres` (« Textes d'accueil », vide = défaut) pour l'accueil et les aperçus du catalogue ; la description par défaut du site (autres pages) reste fixe. Identité visuelle (mascotte, motif) : non traitée. |
| public (4 octobre 2026) | **Comptes clients : connexion Facebook, bienvenue amusante, Mon compte** | Code prêt en local, **pas encore déployé** ; migration `profils_clients` appliquée (7 signatures identiques à la production) ; **inactif tant que Facebook n'est pas configuré** | Pages `/entrer`, `/bienvenue` (avatar parmi 10, pseudo tiré au hasard, barre d'avancement, animations coupées si mouvements réduits), `/compte` (modifier, déconnexion, suppression par le client), route `/auth/client`, table `client_profils` (RLS : visible du seul client), interrupteur « Comptes clients » dans `/system/parametres`, lien « Mon compte » dans l'en-tête seulement si activé, confidentialité mise à jour. Guide : `docs/CONNEXION-FACEBOOK.md`. 35 tests purs. **Vérifié en local** avec un compte jetable : redirection vers la bienvenue, profil enregistré en base, suppression du compte et du profil. **Non vérifié** : la connexion Facebook réelle (application Meta à créer par Malika), le rendu avec le bouton actif. **Pas encore fait** : commandes liées au compte, préremplissage, historique, favoris, compte obligatoire à la commande, téléphone avec code. |
| stratégie (4 octobre 2026) | Analyse du concurrent Madifood (parcours, pile technique, critique de design) | **Fait, analyse seulement, rien décidé** | `ANALYSE-CONCURRENT-MADIFOOD-2026-10-04.md`. Madifood : place de marché à trois faces (client, restaurant, coursier), **commande uniquement par application** (131,9 Mo, en anglais, 3,9/5 sur 18 avis contre « 4,8 » annoncé sur le site), site vitrine en Next.js sur Vercel, très peu de sécurité HTTP, référencement faible, identité jaune et turquoise très forte. **Atouts de Speedfood** : commande web sans installation ni compte, disponibilité prouvée, données minimales, accessibilité. **Retards de Speedfood** : aucune alerte de nouvelle commande pour le restaurateur, pas d'application installable (ni manifeste ni service worker), pas de FAQ, pas de sitemap. Sept lots proposés (A à G) ; **5 décisions à prendre par Malika**. Limites : l'application et le tableau de bord des restaurants n'ont pas été vus, les chiffres de Madifood ne sont pas vérifiés. |
| design (4 octobre 2026) | Constat m1 et vérifications manuelles de l'audit | Fait en local, **pas encore déployé** | Sauts de niveaux de titres corrigés (0 saut mesuré sur 14 écrans). Zoom 200 % et 400 % **simulés** (fenêtres de 640 et 320 px, texte à 200 %), lecteur d'écran **simulé** par l'arbre d'accessibilité, téléphone réel **non testé** (liste de 5 minutes dans l'audit, §9). Trois défauts trouvés et corrigés : barres fixes trop hautes en fenêtre basse, champ du logo qui dépassait, formulaire de sections et de suppléments du menu qui débordait à 320 px. |
| design (4 octobre 2026) | Corrections de l'audit, lots 1 à 4 (accessibilité, parcours client, architecture des consoles) | Fait en local, **pas encore déployé** ; **lot 3 fait (option A : dégradé assombri, texte blanc de 4,56 à 6,19 : 1)** | Voir le §8 de `AUDIT-VISUEL-2026-10-04.md`. **Architecture** : cadre commun (en-tête, lien d'évitement, `<main>`, pied de page) pour toutes les pages publiques et de compte ; consoles restaurateur et administration à barre latérale avec `<main>` ; titres de page uniques ; « Mon restaurant » réorganisée (identité visuelle, horaires, aperçu, barre d'enregistrement) ; ouverture et fermeture gérées à un seul endroit (accueil) ; commande en deux colonnes. Détails et preuves dans l'audit. |
| design (4 octobre 2026) | Audit visuel et d'accessibilité du frontend (demande de Malika) | **Fait, constats seulement, rien corrigé** | `AUDIT-VISUEL-2026-10-04.md` : mesures instrumentées (11 écrans publics, 5 de console, 375 et 1280 px), vrai test clavier, passage visuel. **8 majeurs** (dont : anneau de focus à 1,4 : 1, aucun lien d'évitement, console sans `<main>`, 12 écrans au même titre, 404 nue avec un message faux pour toute adresse, flash de panier vide avant hydratation, texte blanc sur dégradé orange à 2,6 : 1 — jeton verrouillé, décision de Malika), 6 moyens, 4 mineurs. Solide : langue, un h1 par page, alt, étiquettes, aucun débordement, contraste conforme à plus de 99 %. Non audité : administration, lecteurs d'écran, zoom 200 %, appareils réels. |
| design (4 octobre 2026) | Correction de la carte de plat (vide à gauche, retour de Malika) | Fait en local, **pas encore déployé** | Ma carte horizontale laissait un grand vide sous la photo (photo de 160 px, colonne de droite beaucoup plus haute) et écrasait le bloc « Dans votre panier » en trois lignes. **Nouvelle structure** : photo carrée de 136 px et infos (nom, description, fraîcheur, prix) côte à côte en haut ; **tout le bas (supplément, Ajouter, panier, partage) sur toute la largeur de la carte** (grille, corps de carte en `display: contents` à partir de 900 px). « Dans votre panier » tient sur une ligne, le pas à pas et la croix sont sur la même rangée. Vérifié à 1000 px et 375 px (aucun débordement, aucune cible sous 44 px). Leçon : la première version n'avait été validée que sur mesures de largeur, sans regarder l'équilibre visuel d'une carte à contenu variable. |
| design (4 octobre 2026) | Fiche restaurant sur grand écran d'après les captures de Malika (plats, quantités, résumé du panier) | Fait en local, **pas encore déployé** | **Défauts corrigés** : (1) à 1000 px les vignettes ne faisaient que 183 px et les commandes de quantité (131 px) débordaient de leur boîte ; (2) le résumé du panier affichait le **prix unitaire** à côté de « 2 × », alors que le sous-total comptait la quantité (montant de ligne faux, corrigé : prix réel de la ligne, suppléments et quantité compris). **Améliorations** : carte de plat horizontale à partir de 900 px (photo carrée arrondie de 160 px, texte et actions à droite) et vignettes d'au moins 240 px dès 640 px ; commandes de quantité qui passent à la ligne au lieu de déborder ; suppléments en lignes cliquables de 44 px (case 22 px, prix aligné à droite) ; résumé du panier avec miniature, nom, suppléments, prix de ligne et **− / + directement modifiables** (retrait quand la quantité tombe à zéro), compteur d'articles. Vérifié à 1000 px et 375 px (aucun débordement, aucune cible sous 44 px). **Coordination** : une autre session a modifié la fiche en parallèle (bannière d'identité, correctifs mobile, commits `bd67173` à `0cbfe5f`) ; ces changements-ci sont additifs (fin de `cadre.css`) et n'y touchent pas. **Non retouché** : la bannière sans photo (bande rose et pastille), conçue par l'autre session. |
| design (3 octobre 2026) | Console restaurateur modernisée d'après les captures de Malika (accueil, menu, barre latérale) | Fait en local, **pas encore déployé** | **Barre latérale** pleine hauteur : marque avec nom du restaurant, navigation, puis en bas « Voir ma page publique » (si publié), sécurité du compte, console admin, **Se déconnecter** (déplacé depuis le bas de l'accueil). **Accueil = tableau de bord** : trois tuiles (à traiter, en cours, plats au menu) cliquables, état du restaurant et lien/QR code côte à côte (QR de 150 px avec actions). **Menu** : bandeau de disponibilité compact, liste de plats avec vignette (ou initiale), prix, **interrupteur disponible / épuisé** de 44 px, actions compactes ; état vide illustré ; à partir de 1180 px formulaires « Ajouter un plat » et sections dans une colonne collante à droite (en dessous sinon) ; prix et promo côte à côte, dépôt de photo en zone pointillée. Aucune règle métier touchée (mêmes actions serveur). Vérifié dans le navigateur à 1000 px et 375 px avec un compte de test, un restaurant, deux commandes et trois plats (supprimés ensuite). **Non vérifié** : rendu à 1280 px et plus (largeur non rendable dans le volet intégré), page Commandes et Mon restaurant après le nouveau cadre. |
| design (3 octobre 2026) | Pages de compte retravaillées d'après les captures de Malika (test réel de « Mot de passe oublié ») | Fait en local, **pas encore déployé** | **Test en production réussi** : demande depuis `/connexion/oubli`, e-mail Supabase reçu en quelques secondes, lien ouvrant `/connexion/nouveau-mot-de-passe` (adresse de redirection bien enregistrée). **Défauts corrigés** : le champ « Afficher / Masquer » ne remplissait pas sa largeur (le bouton chevauchait la bordure) ; en-tête allégé sur les pages de compte (marque et « Retour au site », sans recherche ni panier) ; composant `PageCompte` : sur ordinateur, panneau de réassurance à gauche (connexion restaurateur, inscription) et carte à droite ; confirmation d'envoi plus claire (icône, adresse saisie, aides, « Utiliser une autre adresse ») ; nouveau mot de passe avec conditions qui se cochent en direct. Vérifié en local : inscription et connexion à 1000 px et 375 px, alignement du champ. **Non vérifié à l'œil** : état de confirmation d'envoi (un envoi réel consomme la limite de 3 par heure) et conditions du nouveau mot de passe (exigent une session de récupération). **Reste** : e-mail de récupération en anglais (modèle Supabase à traduire par Malika, Authentication puis Email Templates). |
| design (3 octobre 2026) | Cadre du site étendu aux pages de compte et à l'administration | Fait en local, **pas encore déployé** | Connexion, inscription, mot de passe oublié, vérification, sécurité du compte, création d'établissement et `/a-propos` reçoivent le même en-tête et le même pied de page (sans navigation basse) ; `/a-propos` perd son en-tête et son pied de page propres (doublons). **Administration** : même structure que la console restaurateur, avec barre latérale (marque, rôle, sections en liste, sécurité, déconnexion) ; sur téléphone les sections gardent la pilule défilante. Vérifié dans le navigateur : connexion et `/a-propos` à 1000 px et 375 px (un seul en-tête, un seul pied de page, aucun débordement). **Non vérifié** : administration (exige le compte super_admin de Malika), inscription et sécurité du compte à l'œil. |
| design (3 octobre 2026) | Mise en page « application » pour grand écran (retour de Malika : l'ordinateur ressemblait à un téléphone étiré) | Fait en local, **pas encore déployé** | **Cadre du site** (`CadreSite`) sur découverte, fiche, panier, commande, suivi et confidentialité : en-tête collant à partir de 900 px (marque, recherche, Découvrir, Espace restaurateur, panier avec total et pastille) et **pied de page** à quatre colonnes (visible aussi sur téléphone, au-dessus de la navigation basse). **Découverte** : bandeau avec surtitre, titre, recherche et bouton, puces de disponibilité, collage de trois plats ; filtres (cuisine, quartier) dans un panneau collant à gauche, résultats à droite ; « Plats du moment » en une seule rangée défilante. **Fiche restaurant** : deux colonnes, menu à gauche et **résumé du panier collant à droite** (bouton Commander ; panier d'un autre restaurant signalé, jamais mélangé). **Console restaurateur** : barre latérale gauche (marque, navigation, pastille des commandes à traiter, sécurité). Aucune règle métier touchée. Vérifié dans le navigateur à 1000 px (découverte, fiche, console avec compte de test supprimé ensuite) et à 375 px (aucun débordement, aucune cible sous 44 px). **Limites** : le volet du navigateur intégré ne rend pas 1280 px lisiblement, donc pas de capture à cette largeur ; pages de connexion, d'inscription, `/a-propos` et administration pas encore dans le cadre ; inspiration par collectui.com non consultée (site non lu). |
| design (3 octobre 2026) | Bouton Afficher / Masquer le mot de passe (audit M2) | Fait en local, **pas encore déployé** | Composant `ChampMotDePasse` (masqué par défaut, bouton de 96 × 47 px, `aria-pressed`, libellé lu « Afficher le mot de passe ») sur la connexion, l'inscription et le nouveau mot de passe. Vérifié à 375 px : le champ passe en clair puis se remasque. |
| design (3 octobre 2026) | Audit visuel, défauts moyens restants (M4 à M7) | Fait en local, **pas encore déployé** | Boutons « Copier le lien » à 44 px et lien « Retour » des alternatives à 44 px ; badges de 11,5 à 12 px (`components.css`, écart mineur avec le design system verrouillé, pour la lisibilité) ; fiche restaurant : quand aucun plat n'est confirmé récemment, un seul message au niveau du restaurant remplace « À confirmer » répété sur chaque plat (le plat n'est jamais présenté comme disponible) ; page d'alternatives : plat introuvable renvoie à la fiche du restaurant au lieu d'un message sur le restaurant ; exemple de commande de `/a-propos` avec un nom fictif. Vérifié en local (HTML rendu et redirection). |
| design (3 octobre 2026) | Accueil = découverte (lot R3, décision de Malika « point 1 ») | Fait en local, **pas encore déployé** | `/` redirige vers `/restaurants` (écran de découverte) ; l’ancienne page de présentation (bandeau « pas encore lancé », inscription restaurateur, liste d’attente) est conservée telle quelle à `/a-propos`, liée depuis le pied de la découverte avec la confidentialité. La page de confidentialité renvoie à `/restaurants`. Les liens existants `/restaurants/...` (QR, partages WhatsApp) sont inchangés. **Points à surveiller** : le bandeau « projet en phase pilote » n’apparaît plus sur l’écran d’arrivée ; l’inscription restaurateur se trouve via « Espace pro » (navigation basse) et `/a-propos`. |
| design (3 octobre 2026) | En-tête d’administration compact (audit H6) | Fait en local, **pas encore déployé, non vérifié visuellement** | Titre et rôle sur une ligne, liens (Sécurité du compte, Mon restaurant, Se déconnecter) en texte de 44 px au lieu de trois boutons pleine largeur, note de séparation des surfaces repliée. Vérifié seulement par tsc et eslint : la console d’administration exige le compte super_admin de Malika, aucun compte de test n’a ce rôle. **À contrôler en réel à 375 px après déploiement.** |
| design (3 octobre 2026) | Formulaire de commande (lot R5) | Fait en local, **pas encore déployé** | Mode de réception en deux cartes de 56 px (retrait, livraison) avec sélection marquée, case et boutons radio aux couleurs du design (24 px), bloc de règlement réduit à une phrase clé en gras (« Vous payez le restaurant directement, pas Speedfood ») suivie du détail, case de consentement lisible avec lien de confidentialité de 44 px, retour au panier de 44 px. Textes juridiques et champs inchangés ; validation et envoi inchangés. Vérifié à 375 px avec un panier réel (aucune commande envoyée). |
| design (3 octobre 2026) | Console restaurateur : navigation basse et commandes par urgence (lots R1 et R2) | Fait en local, **pas encore déployé** | Navigation basse à quatre destinations (Accueil, Commandes avec pastille rouge du nombre à traiter, Menu, Mon restaurant) à la place des onglets coupés. Page Commandes en trois groupes : « À traiter » en tête (cartes à bordure rouge, âge « il y a 12 min »), « En cours », historique replié ; action principale de 56 px pleine largeur (Accepter, Marquer prête, Marquer remise ou livrée), actions secondaires dessous (≥ 44 px) ; numéro de téléphone en cible d'appel de 44 px. **Aucune règle de la machine à états modifiée** (mêmes actions serveur). Vérifié à 375 px avec un compte de test et trois commandes de test (supprimés ensuite) : regroupement, pastille, passage de « À traiter » à « En cours » après « Accepter ». **Non fait** : sélecteur d'état d'ouverture fixé en tête d'écran, en-tête d'administration compact (H6), test avec de vrais restaurateurs. |
| authentification (3 octobre 2026) | « Mot de passe oublié » (lot R6) | Fait en local, **pas encore déployé ; bout en bout non testé** | Lien « Mot de passe oublié ? » sous la connexion ; `/connexion/oubli` (même réponse que le compte existe ou non, limite 3 demandes par adresse et 5 par IP et par heure) ; `/auth/confirmation` échange le code à usage unique puis redirige vers un chemin interne seulement ; `/connexion/nouveau-mot-de-passe` (8 caractères, confirmation, refus sans session). Vérifié en local : validation, redirection sans session, faux code, tentative de redirection externe. **Non vérifié** : réception réelle de l'e-mail. **À faire par Malika** dans Supabase (Authentication > URL Configuration) : ajouter `https://speedfood-app.moelohimmara.workers.dev/auth/confirmation` aux « Redirect URLs » ; l'envoi par défaut de Supabase est très limité (quelques e-mails par heure) et peut aboutir en courrier indésirable, d'où un service d'envoi dédié avant le pilote. |
| doc (3 octobre 2026) | Réconciliation de la documentation de cadrage et versionnage des migrations manquantes | Fait | Les 17 documents mis à jour hors dépôt le 3 octobre (spécification pilote découverte, parcours cible, procédure de sécurité, architecture, notifications, étude concurrentielle…) ont été portés dans `docs/cadrage/` **après correction des écarts avec le code** : voir la décision dédiée plus bas. 8 migrations qui existaient en base sans fichier (`bucket_medias`, `revoquer_execution_anon`, `restaurants_logo_url`, `menu_items_prix_promo`, `menu_item_options`, `menu_item_options_rls_roles_fix`, `order_item_options_lecture_membres_et_support`, `menu_sections`) ont été reconstituées depuis les définitions réelles : le dépôt comptait alors 24 fichiers pour 24 migrations en base (25 avec la limitation de débit). `CLAUDE.md` mis à jour. |
| post-8d (offre marchande) | Sections de menu libres par restaurant (commit `c0d7bc0`) | Fait | Chaque restaurant peut organiser ses plats en sections librement nommées et ordonnées (ex. « Entrées froides », « Plats — Riz », « Desserts »), décision explicite contre une taxonomie fixe qui ne conviendrait pas à un fast-food ou un café déjà au catalogue. Un seul niveau, pas de sous-catégories. Migration `menu_sections` (table + `menu_items.section_id`, `on delete set null` — supprimer une section ne supprime jamais ses plats, ils redeviennent non classés, même philosophie que `archive_le`). RLS mirroir de `menu_items`, avec la leçon du correctif précédent appliquée dès le départ (policies membres explicitement `to authenticated`). Console `/restaurant/menu` : bloc « Sections du menu » (ajouter/renommer/réordonner/supprimer), sélecteur de section dans le formulaire de plat, liste groupée. Fiche publique : mêmes groupes, plats non classés sous « Autres plats » ; un restaurant sans section garde un affichage identique à avant (zéro changement de comportement). Testé dans le navigateur avec un compte et un restaurant de test (créés puis supprimés) : création/renommage/réordonnancement de sections, groupement correct en console et sur la fiche publique (chemin `anon`, le point exact qui avait cassé sur le lot précédent), suppression d'une section vérifiée en base (`section_id` repasse à `null`, plat conservé). `get_advisors(security)` propre. |
| post-8d (offre marchande) | Logo restaurant, prix promo par plat, suppléments au choix du client (commit `9400bf2`) | Fait | Trois migrations : `restaurants_logo_url` (colonne `logo_url`), `menu_items_prix_promo` (colonne `prix_promo`, contrainte `0 ≤ prix_promo ≤ prix`), `menu_item_options` (nouvelle table + table `order_item_options` en miroir d'`order_items`, RLS fermée par défaut). **Logo** : deuxième champ d'upload dans `/restaurant/profil` (même mécanique que la photo, dossier `logos`), badge circulaire superposé sur la carte catalogue et la fiche restaurant. **Prix promo** : second prix optionnel par plat, jamais un code coupon (TDR §5 exclut les coupons du MVP) ; `recalculerLignes()` (`src/lib/commande/calculs.ts`) utilise `prix_promo ?? prix` comme prix effectif — aucun autre point de calcul. **Suppléments** : extras optionnels cumulables (pas de choix unique obligatoire), gérés sous chaque plat dans `/restaurant/menu` (`OptionsPlat.tsx`), choisis par cases à cocher côté client ; le panier fusionne désormais par plat + combinaison d'options triée (`LignePanier.cle`), deux mêmes plats avec des extras différents restent deux lignes distinctes. Vérifié dans un vrai navigateur avec un compte et un restaurant de test (créés puis entièrement supprimés en base après coup) : ajout au panier avec/sans extras (deux lignes distinctes confirmées), commande créée avec montants corrects (`order_items.prix` = prix promo + somme des suppléments, vérifié en base), `order_item_options` corrects, affichage dans la console restaurant et sur `/suivi/[jeton]`. **Vérification adversariale explicitement demandée par le plan** : panier falsifié en `localStorage` avec un `optionId` appartenant à un autre plat, tentative de commande via le vrai formulaire — rejetée côté serveur (« Supplément indisponible pour : … »), aucune commande créée. **Deux trous RLS trouvés et corrigés pendant cette vérification** (migrations `menu_item_options_rls_roles_fix` et `order_item_options_lecture_membres_et_support`) : voir la décision dédiée plus bas. `get_advisors(security)` propre après chaque migration (seules les alertes déjà connues et acceptées). `npm run typecheck`/`lint` propres. |

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
- **Redéployé le 28/09/2026** après la refonte de la console d'administration
  (nav regroupée, Rôles système, Paramètres globaux, Médias — commit
  `54035e7`) : `npm run cf:deploy`, succès (26 fichiers statiques mis à jour),
  toutes les nouvelles routes présentes dans le build (`/system/parametres`,
  `/system/acces/roles`, `/system/contenu/medias`, etc.). Vérifié en ligne :
  `/restaurants` affiche le catalogue sans régression, `/system/parametres`
  renvoie 404 sans session (aucune fuite).
- **Redéployé le 28/09/2026** après le lien de bascule entre consoles
  (`968c07d`), la refonte de la landing (badge « Aperçu — restaurants
  d'exemple » sur le visuel hero, cohérent avec le bandeau « (exemples, à
  confirmer) » plus bas — commit `c357dbb`) et un correctif de token CSS
  (`--radius` inexistant → `--radius-md`, commit `f9642cf`) : `npm run
  cf:deploy`, succès. Vérifié en ligne : le badge « APERÇU — RESTAURANTS
  D'EXEMPLE » est bien présent sur `/`, `admin.speedfood.dev@gmail.com` voit
  le lien « Console admin → » sur `/restaurant`. Restaurants `[DEV]...`
  toujours publiés volontairement (décision explicite de Malika, non
  nettoyés) — reste un signal visuel un peu confus pour un vrai visiteur,
  à traiter plus tard si besoin.

## Compte administrateur système

**Premier `super_admin` créé le 27/09/2026** : `admin.speedfood.dev@gmail.com` (id `95da37c3-b274-4a43-9720-63cf2ba39f17`), inséré dans `system_admin_memberships` via la `service_role` — jamais depuis le navigateur. Vérifié : le compte voit son rôle et accède aux restaurants non publiés (policies `admins_*`). Le mot de passe provisoire a été transmis hors dépôt ; **le changer immédiatement dans le dashboard Supabase** (Authentication → Users → Reset password).

**Récupération d'accès** (si le super_admin perd son mot de passe ou son compte) :

1. Se connecter au dashboard Supabase avec le compte propriétaire du projet (`mistermarcket@gmail.com`).
2. Authentication → Users → réinitialiser le mot de passe du compte admin, ou créer un nouveau compte.
3. Si c'est le rôle qui manque : SQL Editor (ou API avec la `service_role`), puis
   `insert into system_admin_memberships (utilisateur_id, role) values ('<uuid-utilisateur>', 'super_admin');`
4. Ne jamais donner le rôle `super_admin` à un compte de test ni à un propriétaire de restaurant (règle de sécurité du TDR).

## Décisions prises en cours de route (pas dans les documents de cadrage d'origine)

- **Séparation des deux consoles (post-8d)** : l'entrée était confuse — une seule page de connexion titrée « restaurateur », et tout compte partait vers `/restaurant` (un admin système pur atterrissait sur l'onboarding « Créez votre établissement »). Corrigé : `/connexion` et `/connexion?suite=/system` affichent deux portes d'entrée identifiées avec bascule mutuelle, `connexionAction` route selon le type de compte réel (admin système pur → `/system`, restaurateur → `/restaurant`, compte mixte → lien de bascule dans les deux consoles), et `/restaurant` + `/restaurant/nouveau` renvoient un admin système pur vers `/system`. Vérifié en navigateur pour les trois types de comptes.
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

- **Policy RLS "publique" cassée par une policy voisine non scopée à `authenticated`
  (28/09/2026)** : en ajoutant `menu_item_options`, les policies de gestion par les
  membres du restaurant (`membres_lecture/gestion/maj/suppression_leurs_options`)
  avaient été créées sans `TO authenticated`, contrairement au modèle déjà en place
  sur `menu_items`. Conséquence concrète : Postgres évalue **toutes** les policies
  applicables à un rôle sur un `SELECT` (combinées en `OR`), donc même la policy de
  lecture publique (`lecture_publique_options_restaurants_publies`, elle correctement
  ouverte à tous) échouait pour `anon` — l'appel à `fn_est_membre_restaurant()` dans
  une policy voisine renvoyait `permission denied for function` faute de droit
  d'exécution pour `anon`, et bloquait toute la requête. Repéré en testant la fiche
  publique d'un restaurant avec des suppléments : les cases à cocher n'apparaissaient
  jamais, sans erreur visible côté client (l'échec RLS renvoyait juste un tableau
  vide). Corrigé par la migration `menu_item_options_rls_roles_fix` (les quatre
  policies de gestion recréées avec `TO authenticated`). **Leçon pour toute future
  table avec une policy de lecture publique + des policies réservées aux membres :
  toujours vérifier que les policies réservées portent bien `TO authenticated` (ou le
  rôle concerné), jamais aucune restriction — sinon elles peuvent silencieusement
  casser la policy publique voisine pour `anon`.**
- **`order_item_options` : policy de lecture manquante pour la console restaurant
  (28/09/2026)** : cette table avait été créée fermée par défaut (aucune policy,
  calquée sur `order_items` pour le `service_role`), mais `order_items` a en plus une
  policy `membres_lecture_lignes_commandes` (`TO authenticated`) qui laisse un membre
  du restaurant lire les lignes de ses propres commandes via sa propre session — sans
  l'équivalent sur `order_item_options`, la console restaurant (`/restaurant/commandes`,
  lue avec la session du membre, pas le `service_role`) affichait les commandes sans
  jamais montrer les suppléments choisis. Corrigé par la migration
  `order_item_options_lecture_membres_et_support`, qui ajoute les deux policies
  manquantes en miroir exact d'`order_items` (`membres_lecture_options_commandes` et
  `support_lecture_options_commandes`). La page `/suivi/[jeton]` (lue avec le
  `service_role` via `creerClientAdmin()`) n'était pas affectée par ce trou.

- **Réconciliation de la documentation du pilote (3 octobre 2026)** : les documents rédigés hors dépôt partaient du point de vue du **prototype** (démo HTML, `localStorage`) et ignoraient l'application réelle. Corrections apportées avant de les adopter : (1) l'**ADR-011 d'origine** (commande invitée par routes serveur, RLS fermée à `anon`), supprimée et dont le numéro avait été réutilisé, est rétablie ; les quatre nouvelles décisions sont **ADR-015 à ADR-018** ; (2) **ADR-003 (Supabase)** rétablie « ACCEPTÉ » et bloc 2 marqué « FAIT » ; (3) **états de commande** alignés sur le code : `attente_confirmation_client` est un état *dérivé* et `expiree` un statut de *proposition* (la commande devient `annulee`) ; (4) **design system** : `--secondaire` reste `#75695F` (la version hors dépôt revenait à `#80736C`, 4,29:1, sous AA), règle du dégradé unique et section accessibilité rétablies, section 0 « règles verrouillées » ajoutée ; (5) règle « pas de changement de schéma sans fichier de migration » rétablie dans `AGENT-INSTRUCTIONS.md` ; (6) encarts de réconciliation sur les documents qui parlent « de la démo ». Les ajouts du 3 octobre eux-mêmes (recherche locale, disponibilité horodatée, alternatives, Google/téléphone, partage WhatsApp, notifications, procédure de sécurité) sont conservés tels quels comme **cibles produit**.
- **Écart entre la direction du 3 octobre et le code (feuille de route)** : *absents* — recherche par plat, disponibilité horodatée avec statut « à confirmer » et distinction ouvert / accepte les commandes / plat disponible (le code a deux booléens `ouvert` et `disponible`), alternatives en cas de rupture, connexion Google/téléphone (le code utilise email + mot de passe), partage WhatsApp et QR code, localisation facultative, PWA (ni manifest ni service worker), notifications. *Déjà en place* — prix recalculés côté serveur, isolation par restaurant, proposition révisée avec accord explicite du client, consoles séparées, audit et masquage des coordonnées pour le support, sections de menu, suppléments, prix promo, logo. **Porte de sécurité traitée et déployée** : limitation de débit sur la commande invitée (voir la ligne « sécurité (3 octobre 2026) » du tableau ; état porte par porte en `PROCEDURE-SECURITE.md` §9). Restent bloquants avant tout pilote : préproduction (décision à prendre), sauvegarde restaurée, revue indépendante, plan d'incident, durée de conservation des données personnelles.

- **En-têtes de sécurité ajoutés (3 octobre 2026)** : la revue de sécurité classait
  les en-têtes HTTP en « non vérifié ». Vérification manuelle en production : aucune
  protection — ni `Content-Security-Policy`, ni `X-Frame-Options`, ni
  `X-Content-Type-Options`, ni `Referrer-Policy` (la démo statique
  `speedfood.pages.dev` en avait, ironiquement). Corrigé dans `next.config.ts` via
  `headers()` — API vérifiée dans la documentation Next 16 locale
  (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`,
  qui précise que ces en-têtes sont examinés **avant** le système de fichiers) —
  avec quatre en-têtes appliqués à `/:path*` : `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` (protège les consoles `/restaurant` et `/system` du
  détournement de clic), `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
  **CSP volontairement écartée de ce lot** : elle exige un essai séparé (scripts
  inline du App Router, widget Turnstile sur `challenges.cloudflare.com`, images
  Unsplash). `npm run typecheck` et `npm run lint` propres. Déployé en production le
  3 octobre 2026 (version Worker `ce8a191b`), vérifié en ligne par requêtes réelles :
  8 routes sur 9 portent les 4 en-têtes, aucune régression de statut. **Limite
  connue** : la 404 renvoyée par `src/proxy.ts` pour `/system` sans session ne porte
  pas ces en-têtes, ce code construisant sa propre réponse en dehors de la couche de
  routage Next — sans conséquence aujourd'hui (page vide, aucun contenu), à corriger
  si cette 404 devient un vrai écran.

- **Journaux du Worker activés (3 octobre 2026)** : la revue de sécurité et le
  plan d'incident signalaient des journaux non activés (`logpush: false`, aucune
  trace conservée après coup — le plan d'incident ne pouvait pas être appliqué).
  Corrigé par la configuration `observability` de `wrangler.jsonc`
  (`enabled`, `logs.invocation_logs`, `logs.persist`) — forme vérifiée dans le
  schéma local `node_modules/wrangler/config-schema.json` avant écriture.
  **Aucun coût possible** : Workers Logs est inclus dans l'offre gratuite
  (0,5 Go/jour, 7 jours de rétention), l'ingestion s'arrêtant au plafond au lieu
  d'être facturée. `redact_query_string` est activé : le retour d'authentification
  Supabase transporte un code à usage unique dans l'URL de `/auth/confirmation`,
  qui n'a rien à faire dans un journal conservé sept jours (contrepartie assumée :
  les filtres d'URL `?statut=`, `?jour=` n'apparaissent plus dans les journaux).
  Déployé en production le 3 octobre 2026 (version Worker `d4ef928b`) et vérifié
  par appel direct à l'API Cloudflare : `enabled: true`, `logs.persist: true`,
  `invocation_logs: true`, `redact_query_string: true`, échantillonnage à 1.
  Aucun changement de code applicatif, aucun en-tête de sécurité perdu
  (revérifiés : 4/4 sur les routes publiques).

- **Politique de sécurité du contenu (CSP) posée et testée en navigateur réel
  (3 octobre 2026)** : la CSP a été conçue puis **validée avant d'être rendue
  bloquante**, comme l'exige un lot qui peut casser le rendu. Méthode : déploiement
  d'abord en `Content-Security-Policy-Report-Only` (aucun blocage possible), puis
  vérification dans un vrai Chrome piloté en CDP (port de débogage, profil isolé)
  sur 13 pages — accueil, découverte, fiche restaurant, alternatives, panier,
  commande, connexion, inscription, mot de passe oublié, à-propos, confidentialité,
  suivi, `/system` — avec un écouteur `securitypolicyviolation` injecté avant les
  scripts de chaque page. La fiabilité du détecteur a elle-même été prouvée par un
  **test négatif** (meta CSP restrictive injectée à la volée : la violation a bien
  été capturée), sans quoi un « zéro violation » n'aurait rien prouvé. Le chemin le
  plus risqué, le widget Turnstile, a été exercé pour de vrai (panier injecté en
  `localStorage`, `/commande` rend son formulaire) : **sous CSP bloquante**,
  `challenges.cloudflare.com` charge bien `turnstile/v0/api.js`, sa seconde
  ressource et le défi, sans aucune violation. Sources autorisées : le site
  lui-même (scripts et styles inline du App Router, d'où `'unsafe-inline'`, qui
  reste nécessaire), `challenges.cloudflare.com` (Turnstile), le projet Supabase
  (données), `https:` pour les images (photos externes fournies par les
  restaurateurs). Directives fermées : `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `frame-ancestors 'none'`. Résultat en mode bloquant :
  **0 violation et 0 erreur console sur les 13 pages**, aucune requête hors liste
  blanche. Déployé le 3 octobre 2026 (version Worker `224cc2fc`). **Limite** : les
  pages authentifiées (`/restaurant` et `/system`) n'ont pas pu être parcourues
  faute d'identifiants — elles utilisent les mêmes scripts et styles que les pages
  publiques, mais restent non vérifiées et méritent un contrôle au prochain test
  avec un compte réel. **Gain réel** : la CSP ne bloque pas l'injection de script
  inline (`'unsafe-inline'` oblige), mais elle ferme le chargement de scripts
  tiers, les connexions sortantes vers des domaines non prévus, le détournement de
  cadre, les formulaires détournés, la balise `base` et les objets embarqués.

- **Secret Turnstile pivoté (3 octobre 2026)** : la clé secrète d'origine était
  apparue par erreur dans une session de travail (voir la ligne Turnstile du
  tableau). Rotation effectuée par Malika dans le dashboard Cloudflare à
  `20:47:33Z`, puis nouvelle clé relevée par l'API de gestion et posée comme secret
  du Worker `speedfood-app` (`TURNSTILE_SECRET_KEY`) à `20:49:41Z`. **Aucune
  coupure** : Cloudflare conserve l'ancienne et la nouvelle clé valides pendant
  deux heures, ce qui rend la rotation progressive. Vérification faite directement
  auprès de Cloudflare : un appel à `siteverify` avec la clé posée et un jeton
  bidon renvoie `invalid-input-response` (et non `invalid-input-secret`), ce qui
  prouve que la clé installée est valide et acceptée. Nouvelle version Worker
  `75f7c15a`. **Reste à confirmer par Malika** : une commande réelle de bout en
  bout, comme elle l'avait fait pour la mise en place initiale.

- **Envoi de courriels réparé, modèles traduits, confirmation d'e-mail activée
  (3 octobre 2026)** : la documentation Supabase indique que le service d'envoi par
  défaut **ne délivre qu'aux adresses membres de l'équipe du projet** (« Email
  address not authorized » pour toutes les autres), avec un plafond de 2 courriels
  par heure. Conséquence constatée : la fonction « mot de passe oublié », testée
  avec succès par Malika, ne fonctionnait en réalité **que pour sa propre adresse** —
  un restaurateur n'aurait jamais pu récupérer son compte. Corrigé en trois temps :
  (1) SMTP personnalisé Gmail configuré par Malika (`smtp.gmail.com`, port 465,
  expéditeur `moelohimmara@gmail.com`, nom d'expéditeur « Speedfood », mot de passe
  d'application Google) — le plafond est passé automatiquement de 2 à 30 courriels
  par heure, signe que Supabase a bien pris la configuration, et **une livraison
  réelle vers une adresse hors équipe a été constatée** ; (2) modèles de courriels
  traduits en français (`recovery`, `confirmation`, `email_change`), variables
  `{{ .ConfirmationURL }}` préservées — la réinitialisation partait en anglais ;
  (3) `mailer_autoconfirm` passé à `false`.
  **Le code a été adapté AVANT la bascule**, car il ne savait pas gérer un compte
  non confirmé : `inscriptionAction` ignorait la session renvoyée par `signUp` et
  redirigeait vers `/restaurant/nouveau`, une page protégée — l'inscrit aurait
  atterri sur la page de connexion sans la moindre explication ; et
  `traduireErreurAuth` ne connaissait pas « Email not confirmed », ce qui aurait
  affiché « Une erreur est survenue » en boucle. Désormais `signUp` reçoit un
  `emailRedirectTo` vers `/auth/confirmation?suite=/restaurant/nouveau` (même motif
  que la réinitialisation), l'absence de session affiche un écran « Vérifiez votre
  boîte de réception » dans le style de la confirmation d'envoi déjà existante, et
  l'erreur de connexion d'un compte non confirmé est traduite.
  `npm run typecheck` et `npm run lint` propres ; déployé (version Worker
  `e437c13f`) ; routes publiques revérifiées. **Vérifié de bout en bout par Malika
  le 3 octobre 2026** : inscription réelle — écran « Vérifiez votre boîte de
  réception » affiché, courriel en français reçu, lien du courriel menant à
  l'onboarding, compte actif. **Limite connue** : le lien passe par un échange de
  code PKCE, il doit donc être ouvert dans le **même navigateur** que celui utilisé
  pour l'inscription — comportement identique à celui de la réinitialisation du mot
  de passe, mais à expliquer à l'utilisateur si le cas se présente.

- **Famille d'icônes appliquée : fin des flèches unicode (3 octobre 2026)** : la
  règle de `DESIGN-SYSTEM.md` §4 (« ne pas utiliser emoji, caractères unicode ou
  icônes improvisées comme icônes de contrôle en production ») était violée par
  **dix liens de retour** écrits `← Retour …` dans neuf fichiers, plus **cinq
  affordances `→`** (trois tuiles d'indicateur de la console, « Console admin → »,
  « Voir tout le journal d'audit → »). Ces glyphes héritent de la graisse de la
  police, s'alignent sur la ligne de base au lieu du texte, et changent de dessin
  selon l'appareil du visiteur. Remplacés par deux composants partagés :
  `src/components/Chevron.tsx` (grille 24 × 24, tracé 2, terminaisons arrondies,
  `aria-hidden`) et `src/components/LienRetour.tsx` (chevron + libellé, zone tactile
  44 px, style `.lien-retour`), ce qui supprime au passage neuf styles en ligne
  dupliqués. **L'indicateur d'en-tête « Retour au site » perd sa flèche sans la
  remplacer** : dans un en-tête, elle annonçait un retour en arrière alors que
  l'action mène au site public — d'où la gêne signalée par Malika. `npm run
  typecheck` et `npm run lint` propres ; déployé (version Worker `dddb5317`) ;
  vérifié en ligne : les pages concernées servent bien le chevron SVG et plus aucune
  flèche unicode. **Trois flèches subsistent volontairement** dans
  `/system/commandes/[id]` : elles y expriment une transformation de données
  (« 35 000 GNF → 25 000 GNF »), pas une commande.

- **Fiche restaurant : en-tête retravaillé, lot 1 (3 octobre 2026)** : sur une fiche
  sans photo, `aspect-ratio: 16/10` puis `16/6` produisaient un cadre crème de ~570 px
  contenant une initiale de 96 px — l'écran le plus vide occupait le plus de place, et
  le nom du restaurant, l'information la plus importante, restait en 2 rem entre trois
  lignes grises identiques. Corrigé : (1) `height: clamp(200px, 26vw, 340px)` sur
  `.fiche-hero`, et suppression des deux dérogations `aspect-ratio` (640 px et 900 px) —
  un ratio appliqué à une largeur de 1160 px produit mécaniquement un bloc trop haut ;
  (2) **plus de héro du tout sans photo** : un en-tête d'identité prend le relais —
  initiale dans une tuile de 64 px à côté du nom, titre en `clamp(2rem, 3.4vw, 3rem)`,
  filet vertical à la couleur d'accent du restaurant (teinte déjà vérifiée AA) au lieu
  d'un trait de 48 × 4 px qui se lisait comme un soulignement parasite ; (3) la ligne
  « Statut mis à jour il y a 18 h · 0 plat confirmé récemment » est supprimée, ainsi que
  l'alerte qui la répétait : le message de fraîcheur vit désormais **une seule fois**,
  dans la colonne du menu, au moment du choix. `npm run typecheck` et `npm run lint`
  propres ; déployé (version Worker `bb7f07e7`) ; rendu vérifié dans un vrai Chrome dans
  les deux cas (fiche avec et sans photo). **Lots 2 (partage) et 3 (panier vide, grille
  de menu) non commencés.**

- **Fiche restaurant : partage remis à sa place, lot 2 (3 octobre 2026)** : sur la fiche
  publique, « Partager sur WhatsApp » et « Copier le lien » étaient deux boutons
  secondaires de pleine hauteur, placés entre le titre et le menu, au même poids visuel
  que le futur bouton de commande. Ils deviennent des **actions de texte discrètes avec
  icône** (`BoutonsPartage`, nouvelle variante `liens` : icône 16 px de la famille du
  design system, couleur secondaire, zone tactile conservée à 44 px). **Ils restent
  volontairement à leur place** : la colonne de droite (`.fiche-panier`) est masquée sous
  900 px, donc y déplacer le partage l'aurait fait disparaître sur téléphone — or c'est
  là que le partage WhatsApp sert le plus. C'est la **hiérarchie** qui les sort du
  parcours de commande, pas la position. La variante `boutons` reste le défaut : la
  console restaurateur (« Votre lien et votre QR code », où le partage *est* l'action)
  est inchangée. `npm run typecheck` et `npm run lint` propres ; déployé (version Worker
  `ffa4bae1`) ; rendu vérifié dans un vrai Chrome en 1500 px et en 390 px (le partage
  tient sur une ligne, sans débordement). **Lot 3** (panier vide, grille de menu) non
  commencé.

- **Fiche restaurant : panier vide, lot 3 (3 octobre 2026)** : sur grand écran, la colonne
  de droite réservait 340 px en permanence — une carte de ~200 px pour deux lignes de
  texte quand le panier était vide. `ResumePanierFiche` ne rend plus rien dans ce cas, et
  `grid-template-columns: minmax(0, 1fr) auto` (au lieu de `… 340px`) fait tomber la
  colonne à zéro : le menu occupe alors toute la largeur. La gouttière est portée par la
  carte (`margin-left`) et non par un `column-gap` fixe, qui aurait laissé un vide
  résiduel. Mesuré dans un vrai Chrome : panier vide → menu **1128 px**, aucune colonne ;
  panier garni → colonne revenue, menu **756 px**, sous-total et bouton « Commander »
  corrects. **À noter** : le composant ne rend rien au premier affichage (le panier vit
  dans `localStorage`), donc un visiteur qui a déjà un panier verra le menu se resserrer
  après hydratation — décalage accepté, il ne concerne que le grand écran. Le paramètre
  `restaurantNom`, devenu inutile, a été retiré du composant et de son appelant.
  `npm run typecheck` et `npm run lint` propres (0 erreur, 0 avertissement) ; déployé
  (version Worker `0b08ab84`). **Correction de l'analyse initiale** : le lot 3 annonçait
  une grille de menu affichant « des affiches » ; vérification faite, `.vignettes` est
  déjà une grille de vignettes à média `4/3` (marche.css) — aucun changement n'y a été
  apporté, faute de problème réel.

- **Bannière d'identité : photo de couverture et logo, proposition 1 (3 octobre 2026)** :
  le logo n'était affiché sur la fiche **que s'il existait une photo de couverture** — sans
  photo, il était purement ignoré, alors que la carte du catalogue savait l'afficher seul.
  Un composant unique `BanniereRestaurant` remplace l'ancien en-tête et traite
  explicitement les quatre combinaisons : photo + logo (bandeau + pastille à cheval sur le
  bord bas), photo seule (l'initiale prend la place du logo), logo seul (bande courte
  teintée de la couleur d'accent), ni l'un ni l'autre (bande courte + initiale en tuile de
  catégorie). Points de conception : **la bande sans photo mesure 120 px**, pour que le
  grand cadre vide corrigé au lot 1 ne revienne pas par la bande ; **le logo est
  prioritaire sur l'initiale** ; la pastille (88 px, 72 px sous 640 px) est alignée sur le
  bord du contenu, ce qui la met en accord avec le reste de la page. Le filet vertical du
  lot 1 disparaît : la bande porte désormais l'identité. Console `/restaurant/profil` : les
  champs deviennent « Photo de couverture » et « Logo (votre emblème) », avec les formats
  conseillés (3/2 pour la couverture, carré pour le logo) et la mention « sans logo, c'est
  votre initiale qui est affichée » — **aucun restaurant n'a de logo aujourd'hui (0 sur
  18)**, le champ doit donc dire à quoi il sert. `npm run typecheck` et `npm run lint`
  propres ; déployé (version Worker `25cd1bb1`). Vérifié dans un vrai Chrome sur les
  quatre cas, dont deux obtenus en posant **temporairement** un logo en base (retiré
  aussitôt : base revenue à 0 logo) : bandeau 300 px avec photo, bande 120 px sans photo,
  pastille image ou initiale selon le cas, et mobile à 390 px où la bande se teinte de la
  couleur d'accent du restaurant.

## Ce qui n'est pas testé / connu comme incomplet

- **Tests automatisés : partiels depuis le 3 octobre 2026.** Des tests unitaires
  purs existent (`scripts/tests/`, lancés par `npm run test:unit` : découverte,
  redirections de sécurité, IP, alternatives, partage, tuile typographique).
  Aucun test d'intégration ni de bout en bout. Tout le reste de la vérification
  s'est fait manuellement (navigateur + requêtes REST directes), documenté dans
  les messages de commit Git. Cette section a affirmé « aucun test automatisé »
  jusqu'au 3 octobre 2026 alors que la suite existait déjà — même cause que la
  ligne suivante.
- Le CMS système (blocs 8a à 8d + centre de commandement post-8d) est entièrement livré — voir le tableau ci-dessus, **y compris l'attribution et le retrait des rôles système** (`/system/acces/roles`, livré après le bloc 8a et vérifié avec le compte `super_admin` réel). Cette section l'a décrit comme un « placeholder » jusqu'au 3 octobre 2026 ; c'était faux. Seul le clic de retrait n'avait pas pu être exercé, le `confirm()` du navigateur étant auto-annulé par l'outil de test — la base, elle, a été vérifiée.
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
