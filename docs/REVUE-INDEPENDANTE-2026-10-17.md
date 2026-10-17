# Revue de sécurité indépendante du 17 octobre 2026

Relecteur : agent distinct de l'auteur du code. Lecture seule : code du dépôt (branche master), requêtes SELECT sur le catalogue Postgres du projet `ggldjdizqrtpetdiohxy` (politiques, droits, définitions de fonctions, `get_advisors(security)`), deux requêtes GET anonymes sur le site pour les en-têtes. Aucune donnée personnelle lue, aucun secret lu, aucun fichier modifié hormis ce rapport.

Légende : CONFIRMÉ (vérifié dans le code ou la base), PROBABLE (déduit, non démontré), NON VÉRIFIÉ.

## 1. Verdict

**Pas prêt en l'état pour un pilote avec de vraies données personnelles, mais proche** : je n'ai trouvé aucun défaut Critique ni aucune fuite entre restaurants (cloisonnement multi-tenant et accès anonyme corrects sur tout ce que j'ai lu), les 14 points du 3 octobre sont réellement corrigés dans le code et la base, mais trois points Important restent à traiter avant d'ouvrir (double authentification facultative pour les comptes système, fonction de réinitialisation totale de l'application présente en production, protection contre les mots de passe compromis désactivée) et aucun test avec de vrais JWT n'a encore été fait.

## 2. Les 14 points du 3 octobre

| # | Point | Verdict | Preuve |
|---|---|---|---|
| 1 | URL d'image arbitraire et suppression d'une image d'un autre restaurant | Corrigé et correct | Triggers `trg_valider_url_media` sur `restaurants` et `menu_items` (regex stricte : hôte du projet, bucket `medias`, dossier connu, UUID, extension) présents en base, ignorés seulement si `auth.uid()` est nul ou admin système. `supprimerImage` (`src/lib/storage/images.ts`, fin du fichier) valide le chemin via `cheminMediaDepuisUrl` (`src/lib/storage/chemins.ts`) et refuse de supprimer tant qu'une autre ligne (restaurants photo/logo, plats, bannières) référence l'URL, et conserve en cas d'erreur de lecture. Limite : un membre peut encore pointer vers l'image réelle d'un autre restaurant (forme valide), sans effet de suppression grâce au contrôle de références. |
| 2 | Redirection ouverte à la connexion | Corrigé et correct | `src/lib/auth/redirection.ts:5-13` (longueur, préfixe `/`, pas `//`, pas de `\` ni caractère de contrôle). Utilisé partout : `actions.ts:126`, `auth/confirmation/route.ts`, `auth/client/route.ts`, `mfa.ts`, `bienvenue`, `entrer`, `client/actions.ts`. Les redirections de routes utilisent `new URL(chemin, url.origin)`. |
| 3 | Support : lecture et modification directes de `orders` | Corrigé et correct | Aucune policy `support_*` sur `orders` en base (seules `membres_lecture_leurs_commandes` et `membres_maj_leurs_commandes` existent). Quatre fonctions `fn_support_*` vérifient `fn_est_admin_systeme(['support','super_admin'])`, masquent téléphone et adresse (`fn_masquer_*`), exigent un motif, écrivent l'audit avant de rendre la donnée (`fn_support_reveler_coordonnees`) et le changement de statut passe par le trigger de transition. Le trigger `fn_limiter_maj_commande` interdit à tout utilisateur connecté de modifier autre chose que le statut. |
| 4 | Journal d'audit falsifiable | Corrigé et correct pour l'usurpation | Policy `admins_ecriture_audit` : `acteur_id = auth.uid()` et admin système. Reste possible : un admin écrit des lignes d'audit sous son propre nom avec une action arbitraire (voir M5). |
| 5 | Verrou dernier super_admin | Corrigé et correct | Trigger `trg_garder_dernier_super_admin` en base (verrou consultatif, test sur les autres super_admin), actif aussi pour la clé service. `retirerRoleAction` relit le rôle en base (`src/lib/system-admin/roles.ts`). Le verrou s'applique aux cascades de suppression de `auth.users`. |
| 6 | Contournements par l'API directe (historique, section d'un autre restaurant, acceptation pendant proposition) | Corrigé et correct | Policy d'insertion `membres_ecriture_historique_commandes` (acteur = soi, transition valide, statut réel de la commande, appartenance) ; trigger `trg_bloquer_acceptation_avec_proposition` ; trigger `trg_valider_section_plat` ; trigger de transition `fn_valider_transition_commande` valable aussi pour le service-role. |
| 7 | Concurrence de la réponse à une proposition | Corrigé et correct sur le code, concurrence réelle NON VÉRIFIÉE | `fn_repondre_proposition` : verrou `FOR UPDATE` sur la commande puis sur la proposition, rejeu identique accepté, réponse contraire refusée, proposition échue refusée, commande non `en_attente` refusée, exécutable ni par `anon` ni par `authenticated` (vérifié par `has_function_privilege`). Aucun test à deux connexions réelles. |
| 8 | Prix non confirmé par le client | Corrigé et correct | `src/lib/commande/creation.ts:120` : écart entre `sousTotalAffiche` et le total recalculé serveur : rien n'est créé, nouveau total renvoyé. Le prix utilisé reste celui du serveur. |
| 9 | Limitation de débit, IPv6, secret de repli | Corrigé mais insuffisant (risque résiduel assumé par la propriétaire) | IPv6 regroupé par /64 (`src/lib/securite/ip.ts`, appliqué à `limitation-debit.ts:87`). Turnstile échec fermé dans `turnstile.ts` (clés présentes selon la documentation, NON VÉRIFIÉ ici). Restent : repli du secret HMAC sur la clé service-role si `COMMANDE_JETON_SECRET` manque (`jetons.ts:39`, `limitation-debit.ts:97`), et limiteur qui laisse passer si la base du compteur est indisponible (`limitation-debit.ts:117`, choix documenté). |
| 10 | Clé d'idempotence | Corrigé et correct | `validation.ts:35-36,122` : UUID v4 exigé (préfixe `panier-` toléré). Rejeu refusé si autre restaurant (`creation.ts:84`) ou autre compte (`creation.ts:85`). Jeton de suivi = HMAC de la clé, donc non calculable sans le secret. Voir M3 pour la course. |
| 11 | Liste blanche de `taxonomie.ts` | Corrigé et correct | `src/lib/system-admin/taxonomie.ts:37` (`TABLES_TAXONOMIE`), appelé avant tout accès. |
| 12 | `traiterPropositionEchue` avant contrôle d'appartenance | Corrigé et correct | `actions-restaurant.ts:93` et `:155` : lecture RLS de la commande et comparaison avec `membership.restaurant_id` avant l'appel à la clé serveur. Les autres appels (`requetes.ts:102,219`) partent de la lecture par jeton, sans identifiant du navigateur. |
| 13 | Policies publiques, droits de table, `rls_auto_enable` | Corrigé et correct | Aucune policy `public`/`anon` sur `fn_est_admin_systeme` (les 4 ont `authenticated`). `anon` n'a que SELECT sur les tables publiques ; aucun TRUNCATE/REFERENCES/TRIGGER pour `authenticated`. `rls_auto_enable` non exécutable par `anon` ni `authenticated`. Les avis de sécurité Supabase : 21 fonctions `authenticated_security_definer_function_executable` (traitées en §4), 5 tables RLS sans policy (volontaire, tables réservées au service-role), mots de passe compromis désactivé. |
| 14 | Message d'erreur brut, lien de bannière, signature d'image | Corrigé et correct, reste connu | `creerEtablissementAction` ne renvoie plus de message de base (`auth/actions.ts`). Contrainte `content_banners_lien_sur` présente en base (chemin interne ou https, sans espace ni contrôle) et `estLienBanniereSur` côté code. Signature JPEG/PNG/WebP vérifiée (`storage/images.ts`) ; bucket `medias` limité à 5 Mo et à ces trois types. Reste : pas de limitation de débit propre à l'inscription (voir M4). |

Fait nouveau : la revue de 2026-10-03 affirme « aucun `dangerouslySetInnerHTML` ». C'est faux aujourd'hui (4 usages). Je les ai tous lus : JSON-LD avec `<` échappé (`aide/page.tsx:89`, `restaurants/[id]/page.tsx:275`), icônes SVG statiques (`Illustration.tsx:50`), et le style des jetons de design (`layout.tsx:93`) dont la valeur est filtrée contre `; { } < >` (`src/lib/studio/jetons.ts:194`). Aucun n'est exploitable en l'état. Documentation à corriger.

## 3. Constats nouveaux, par gravité

Aucun constat Critique.

### Important

**I1. La double authentification est facultative, y compris pour les rôles système (CONFIRMÉ).**
`fn_session_mfa_suffisante` (définition lue en base) renvoie vrai si la session est `aal2` OU si l'utilisateur n'a aucun facteur vérifié. Même logique dans `src/lib/system-admin/contexte.ts:51` et `src/proxy.ts:95` (`nextLevel === "aal2"` seulement si un facteur existe). Scénario : le mot de passe d'un compte `support` ou `super_admin` sans TOTP est volé (hameçonnage, réutilisation) : l'attaquant appelle `fn_support_reveler_coordonnees` ou `fn_support_lister_commandes` et lit les coordonnées de tous les clients (la trace d'audit existe mais arrive après coup), ou, pour un super_admin, change les rôles. Seule `fn_reinitialiser_application` exige explicitement `aal2`. Correctif : exiger un facteur vérifié pour tout compte ayant une ligne dans `system_admin_memberships` (dans `fn_est_admin_systeme`, retourner faux si aucun facteur vérifié ; côté proxy, rediriger vers l'activation) ; recommander puis imposer pour les propriétaires de restaurant avant le pilote.

**I2. Fonction de remise à zéro totale de la base exposée en production (CONFIRMÉ).**
`fn_reinitialiser_application` (SECURITY DEFINER, exécutable par `authenticated`) supprime restaurants, commandes, profils clients, et tous les comptes `auth.users` hors super_admin. Garde-fous réels : super_admin, session `aal2`, jeton à usage unique de 5 minutes, motif de 10 caractères, une fois par heure. Scénario : un compte super_admin compromis (session ouverte avec TOTP) ou un super_admin mal intentionné efface toutes les données du pilote en deux appels. Correctif : avant le pilote, retirer la fonction de la base de production (la garder sous forme de script manuel), ou la conditionner à un réglage `parametres_application` désactivé par défaut ; sauvegardes testées (bucket `sauvegardes` existe, restauration NON VÉRIFIÉE).

**I3. Protection contre les mots de passe compromis désactivée (CONFIRMÉ, avis Supabase `auth_leaked_password_protection`).**
Combinée à I1, les comptes admin dépendent d'un mot de passe de 8 caractères minimum (`recuperation.ts`). Correctif : activer la protection dans Supabase Auth, relever la longueur minimale (12 pour les rôles système).

### Mineur

**M1. Waitlist sans preuve de propriété du contact (CONFIRMÉ).** `src/app/api/zone/alerte/route.ts` enregistre n'importe quel e-mail ou téléphone avec une case cochée côté navigateur (5 inscriptions par heure et par IP seulement). Un tiers peut inscrire l'adresse d'une victime, qui sera ensuite prévenue sans l'avoir demandé ; ces contacts sont exportables (`liste-attente/export`). Correctif : confirmation par lien ou code avant d'envoyer toute notification, et filtrer à l'export ceux non confirmés.

**M2. Colonnes d'une commande modifiables par le restaurant sans protection (CONFIRMÉ).** Les triggers `fn_limiter_maj_commande` et `fn_proteger_colonnes_commande` ne couvrent ni `client_user_id` ni `table_numero` ni `paiement_reference` de façon complète. Un membre peut réaffecter une commande de son restaurant à un autre compte. Impact actuel nul (aucune page ne lit `client_user_id`, seul le contrôle de rejeu `creation.ts:85` s'en sert), mais à protéger avant de construire un historique de commandes côté client.

**M3. Chemin de course sans contrôle de compte (CONFIRMÉ, risque très faible).** Dans `creation.ts:225`, le rejeu après violation d'unicité vérifie le restaurant mais pas `client_user_id` (contrairement à `:85`). L'attaquant doit déjà connaître une clé UUID v4 de la victime. Correctif : réutiliser le même contrôle.

**M4. Énumération de comptes et pas de limite applicative à la connexion et à l'inscription (CONFIRMÉ).** `src/lib/auth/actions.ts:215` : « Un compte existe déjà avec cet email ». `connexionAction` n'a pas de limiteur propre (dépend de Supabase Auth). Correctif : message neutre, limiteur par IP et par e-mail comme pour la récupération du mot de passe.

**M5. Journal d'audit : écriture libre par tout admin système, lecture par tous (CONFIRMÉ).** `admins_ecriture_audit` accepte n'importe quelle action sous son propre nom (un `content_editor` peut fabriquer une ligne `coordonnees.revelation`). `fn_lister_audit` et la policy de lecture sont ouvertes à tout rôle système, y compris `content_editor`, alors que la permission applicative `systeme.audit` est plus étroite. Même remarque pour `restaurant_identite_documents` et `restaurant_codes_marchand` lisibles par tout admin (NIF, RCCM, téléphones). Correctif : restreindre par rôle en base comme dans la matrice, ou n'écrire l'audit que par fonction.

**M6. Audit de l'import CSV et du lot trop pauvre (CONFIRMÉ).** `geographie.ts:624` : une seule ligne d'audit pour tout l'import, avec le premier identifiant seulement ; l'audit est écrit après les modifications (si l'écriture d'audit échoue, les changements restent). Impact limité (géographie publique). Correctif : écrire l'audit d'abord, ou une ligne par lot avec la liste des identifiants.

**M7. Compteur de scans et lecture de commandes (CONFIRMÉ).** `/r/[code]` n'a aucun limiteur (inflation des statistiques de scans, sans donnée personnelle). La page `commandes` du restaurateur charge toutes les commandes puis fenêtre en mémoire (`commandes/page.tsx`) : problème de volume, pas de sécurité, à surveiller avant de gros volumes.

**M8. Suppression de compte client sans nouvelle authentification (CONFIRMÉ).** `src/lib/client/actions.ts` `supprimerMonCompteAction` : une session volée supprime le compte. Correctif : redemander le mot de passe ou un code.

**M9. Documentation périmée (CONFIRMÉ).** Voir la remarque sur `dangerouslySetInnerHTML` en §2.

## 4. Les 21 fonctions SECURITY DEFINER exécutables par `authenticated`

Toutes ont `search_path=public` fixé (vérifié dans `proconfig`). Aucune n'est exécutable par `anon`. Aucune ne fait confiance à un paramètre du client pour décider d'un droit : les identifiants passés servent de cibles, jamais de preuve de rôle.

| Fonction | Contrôle d'accès trouvé | Verdict |
|---|---|---|
| fn_admin_definir_illustration | `fn_est_admin_systeme(['super_admin','operations'])`, cible en liste blanche, taille bornée | OK |
| fn_admin_dossier_restaurant | admin (4 rôles), agrégats seulement | OK |
| fn_admin_lister_plats | `super_admin`/`operations` | OK |
| fn_creer_restaurant_et_owner | `auth.uid()` requis, un seul rattachement par compte, restaurant créé non publié | OK (tout compte connecté peut créer un restaurant non publié ; publication réservée aux admins par trigger) |
| fn_emettre_document | session requise, `fn_est_membre_restaurant` du restaurant de la commande, statut et paiement contrôlés, idempotent | OK |
| fn_est_admin_systeme | ne répond que pour `auth.uid()`, MFA via `fn_session_mfa_suffisante` | OK, mais voir I1 (MFA contournée si aucun facteur) |
| fn_est_membre_restaurant | idem pour l'appartenance de l'appelant | OK, voir I1 |
| fn_fusionner_quartiers | `super_admin`/`content_editor`, verrous de ligne, même commune, quartiers génériques exclus | OK |
| fn_lister_audit | `fn_est_admin_systeme()` (tout rôle système), limite bornée | OK avec réserve M5 (rôle trop large) |
| fn_lister_membres_restaurant | `operations`/`super_admin` | OK |
| fn_preparer_suppression_compte | `super_admin`, motif obligatoire, refuse soi-même et les super_admin, audit | OK |
| fn_reinitialiser_application | `super_admin` + `aal2` + jeton + motif + limite horaire | Gardes correctes, risque d'existence (I2) |
| fn_reinitialisation_simuler | `super_admin` + `aal2`, jeton lié à `auth.uid()` | OK |
| fn_statistiques_application | admin (4 rôles), période bornée, commandes de test exclues | OK |
| fn_support_changer_statut | `support`/`super_admin`, motif, verrou de ligne, trigger de transition, audit | OK |
| fn_support_commandes_par_heure | `support`/`super_admin`, agrégats | OK |
| fn_support_compter_commandes | idem | OK |
| fn_support_lister_commandes | idem, coordonnées masquées, 100 lignes | OK |
| fn_support_reveler_coordonnees | idem, motif obligatoire, audit avant retour | OK (à protéger par MFA, I1) |
| fn_support_serie_commandes | `support`/`super_admin`, agrégats | OK |
| fn_trouver_utilisateur_par_email | `operations`/`super_admin` | OK |

Autres fonctions SECURITY DEFINER non exposées (aucune exécution pour `anon` ni `authenticated`) : `fn_repondre_proposition`, `fn_compter_scan`, `fn_anonymiser_donnees` (planifiée chaque jour à 03:15, tâche active), `fn_session_mfa_suffisante`, `fn_valider_section_plat`, triggers d'audit, `rls_auto_enable`. Fonctions SECURITY INVOKER exécutables : `fn_masquer_*` (pures), `fn_publier_blocs` (soumise à la RLS), triggers.

## 5. Ce qui tient

- Cloisonnement multi-tenant : toutes les policies de `orders`, `order_items`, `order_item_options`, `order_proposals`, `order_status_events`, `menu_items`, `menu_item_options`, `menu_sections`, `restaurants`, `documents_commande`, `restaurant_zones_desservies`, `restaurant_identite_documents`, `restaurant_codes_marchand` testent `fn_est_membre_restaurant(restaurant_id)` (directement ou via la commande/plat parent) avec `WITH CHECK` équivalent : un membre du restaurant A ne peut ni lire ni écrire une ligne du restaurant B, ni déplacer une ligne vers B. Aucun INSERT ni DELETE de membre sur `orders`, `order_items`, `documents_commande` (création par serveur et fonctions seulement). `restaurant_memberships` : un membre ne lit que sa propre ligne, l'écriture est réservée aux `operations`/`super_admin`.
- Accès anonyme : aucune policy `anon` ou `public` sur les tables de commande, de profils, de membres, d'audit. Lecture publique limitée aux restaurants publiés non suspendus, leurs plats, options, sections, et référentiels géographiques actifs ; droits de colonnes de `restaurants` et `menu_items` restreints (pas de colonnes internes). Seul écart cosmétique : `lecture_publique_zones_desservies` teste `publie` sans `suspendu_le`.
- Colonnes protégées par triggers : `publie`, `suspendu_*`, `motif_correction`, `code_court`, prix et coordonnées de commande, `est_test`, paiement.
- Toutes les actions serveur du restaurateur dérivent le restaurant de la session (`obtenirContexteRestaurant`), jamais d'un champ du navigateur : `restaurant/actions.ts`, `zones-desservies.ts`, `quartier.ts`, `documents-actions.ts`, `tables-actions.ts`, `illustrations.ts`, `actions-restaurant.ts`, route d'abonnement push (origine vérifiée, point d'accès autorisé en liste blanche).
- Actions système : tous les fichiers `"use server"` de `src/lib/system-admin/` appellent `verifierPermission` avant tout accès. Console Géographie : `geographie.ts` (lot de 200 maximum, identifiants UUID, valeurs revalidées, recalcul de l'import sur l'état réel de la base et confirmation explicite, point dans les bornes de la Guinée, URL Nominatim fixe sans paramètre libre). Exports CSV : `geographie/export` (permission `taxonomie.editer`, aucune donnée personnelle) et `liste-attente/export` (permission `attente.gerer`, audit écrit avant l'envoi, `Cache-Control: no-store`). Neutralisation d'injection de formule dans `csv.ts` (préfixe pour `= + - @` tabulation et retour chariot).
- Secrets : `SUPABASE_SERVICE_ROLE_KEY` n'apparaît que dans `src/lib/db/admin.ts` (import `server-only`) et comme repli du secret HMAC dans deux modules `server-only`. Aucun composant `"use client"` n'importe `creerClientAdmin`, `limitation-debit`, `jetons`. Aucune variable publique autre que l'URL, la clé anon et la clé de site Turnstile. Aucun fichier `.env*` suivi hormis `.env.example`, aucun jeton ni clé dans les fichiers suivis (recherche de motifs JWT, `sb_secret_`, clés privées).
- Suivi de commande : jeton transmis par fragment d'URL puis échangé contre un cookie HttpOnly, `SameSite=Lax`, chemin `/suivi`, échange limité à 20 par 10 min et par IP ; réponses dynamiques `no-store` (vérifié par GET) ; le type de suivi n'inclut ni téléphone ni adresse.
- En-têtes HTTP vérifiés en production : CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. `/system` anonyme répond 404.
- Migrations : 80 fichiers dans `supabase/migrations/`, 80 migrations en base.
- Rétention : tâche planifiée `fn_anonymiser_donnees` active.

## 6. Ce qui n'a PAS pu être vérifié

- Comportement réel avec de vrais JWT (public, restaurant A, restaurant B, chaque rôle système, sessions `aal1`/`aal2`) : j'ai lu les définitions de policies et de fonctions, je n'ai exécuté aucun appel authentifié. À faire avant le pilote avec des comptes de test (revue du 3 octobre §6, point 4, toujours valable).
- Concurrence réelle (deux connexions simultanées) sur `fn_repondre_proposition`, le verrou super_admin et la numérotation des documents.
- Secrets et variables réellement déployés sur le Worker (`COMMANDE_JETON_SECRET`, clés Turnstile, VAPID), rotation effective des jetons annoncée corrigée le 16 octobre, jeton Cloudflare mentionné « à confirmer ».
- Configuration de Supabase Auth (confirmation d'e-mail, limites d'envoi, fournisseurs OAuth), restauration des sauvegardes, journaux de production (présence éventuelle de jetons de suivi ou de numéros dans les journaux du Worker).
- Contenu des tables (volontairement non lu) : cohérence des données existantes, contraintes de longueur de chaque colonne texte (lues seulement quand citées).
- Composants d'interface (`PaletteRecherche`, boîte de confirmation, `ModeService`) : parcourus, rien d'alarmant, mais pas de test navigateur. Parcours Facebook / OAuth non éprouvé.
- Le Chef IA, les studios (CMS blocs, jetons) et `src/lib/push/*` n'ont été examinés que par recoupement.
- Aucun test automatisé de sécurité (RLS) n'existe dans le dépôt à ma connaissance ; je n'ai pas lancé la suite existante.
