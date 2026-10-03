# Revue de sécurité indépendante — 3 octobre 2026

**Relecteur :** un agent distinct de l'auteur du code, en lecture seule (code et requêtes `SELECT` sur la base), avec les consignes de `PROMPTS-AGENTS-SECURITE.md`.  
**Verdict du relecteur :** **« Revue bloquante »** (un point bloquant). Ce n'est pas une certification, et le périmètre couvert est limité (voir §4).  
**Suivi :** l'auteur du code a vérifié lui-même les points marqués « vérifié » ; les autres sont **rapportés par le relecteur et non revérifiés**. Une relecture de la correction par une troisième partie reste souhaitable pour les points bloquants.

## 1. Point bloquant

| # | Constat | État |
|---|---|---|
| 1 | **Un restaurateur pouvait faire supprimer l'image d'un autre restaurant.** Un membre pouvait écrire n'importe quelle URL dans `photo_url`/`logo_url` de sa propre ligne (la RLS autorise la modification, aucune contrainte sur l'URL), puis, en remplaçant son image, `supprimerImage` effaçait avec la clé serveur le fichier désigné. La même faille permettait d'afficher une URL externe sur les pages publiques (pixel espion). | **Corrigé le 3 octobre 2026**, vérifié : (a) la base refuse désormais à un membre toute URL qui n'est pas une image du bucket `medias` de forme exacte (trigger `fn_valider_url_media`, testé avec session simulée : URL externe et `javascript:` refusées, modifications légitimes acceptées) ; (b) `supprimerImage` valide le chemin strictement et **ne supprime pas un fichier encore référencé par une autre ligne**. **Déployé en production le 3 octobre 2026** (version Worker `f62ee7bb`). |

## 2. À corriger avant tout pilote

| # | Constat | État |
|---|---|---|
| 2 | **Redirection ouverte à la connexion** : `/connexion?suite=//site-pirate` renvoyait la victime sur un autre site après connexion. | **Corrigé**, vérifié sur cas d'attaque (`//x`, `/\x`, `https://x`, caractères de contrôle, chemins trop longs) et cas légitimes. |
| 3 | **Masquage et audit des coordonnées clients contournables** : un compte `support` peut lire par l'API directe tous les téléphones et adresses de `orders` sans motif ni trace, et modifier des montants. Le masquage n'existe que dans l'interface. *(Existence des policies `support_lecture_commandes` et `support_maj_commandes` vérifiée.)* | **Corrigé et déployé en production le 3 octobre 2026 (version Worker `7d272103`).** Migration `securite_support_commandes` : les policies `support_lecture_commandes`, `support_maj_commandes` et `support_ecriture_historique_commandes` sont supprimées ; le support passe par quatre fonctions (`fn_support_lister_commandes` qui rend des coordonnées déjà masquées, `fn_support_compter_commandes`, `fn_support_reveler_coordonnees` qui exige un motif et écrit l'audit avant de rendre la donnée, `fn_support_changer_statut` qui change le statut, l'historique et l'audit en une transaction). Un trigger interdit en outre à tout utilisateur connecté (restaurateur compris) de modifier autre chose que le statut d'une commande (soulage aussi une partie du point 6). Testé avec session simulée (rôle absent refusé, lecture directe 0 ligne, modification directe 0 ligne, motif vide refusé, transition invalide refusée, audit et acteur `support:` écrits, restaurateur refusé sur prix et téléphone, service-role intact) puis dans l'interface avec un compte support de test supprimé ensuite. |
| 4 | **Journal d'audit falsifiable** : n'importe quel rôle système pouvait insérer des lignes d'audit au nom d'un autre. | **Corrigé**, vérifié (insertion au nom d'un autre refusée, à son propre nom acceptée). |
| 5 | **Verrou « dernier super_admin » contournable** : le garde-fou se base sur un paramètre `role` fourni par le client ; un appel direct peut retirer ou rétrograder le dernier super_admin. | **Corrigé en base le 3 octobre 2026** (migration `securite_dernier_super_admin`) : un trigger refuse toute suppression ou rétrogradation qui laisserait zéro super_admin, par l'application comme par l'API directe, avec un verrou consultatif contre les demandes simultanées ; le code relit le rôle en base au lieu de croire le paramètre du navigateur. Testé en base (suppression et rétrogradation du dernier refusées, rétrogradation permise s'il y en a un second, le nouveau dernier est protégé à son tour). Le trigger agit déjà en production ; la modification du code (message d'erreur, rôle relu) attend le prochain déploiement. |

## 3. À planifier

| # | Constat (rapporté par le relecteur, non revérifié sauf mention) |
|---|---|
| 6 | Un membre peut, par l'API directe, accepter/terminer une commande alors qu'une proposition attend la réponse du client, insérer des événements d'historique arbitraires, ou référencer la section d'un autre restaurant. |
| 7 | Concurrence dans la réponse à une proposition : deux réponses simultanées (accepter et refuser) peuvent appliquer leurs effets toutes les deux ; mise à jour des montants non conditionnée à l'état de la commande. |
| 8 | Prix non confirmé par le client : le serveur recalcule au prix courant sans comparer au total affiché ; un changement de prix entre l'affichage et l'envoi serait facturé sans avertissement. |
| 9 | Limitation de débit : un attaquant peut épuiser le plafond par téléphone (5/heure) d'un numéro cible ou le plafond du restaurant (60/10 min) depuis quelques adresses ; IPv6 non regroupées par /64 ; secret de hachage de repli = clé service-role (définir un secret dédié ; en production `COMMANDE_JETON_SECRET` est déjà défini). |
| 10 | Clé d'idempotence acceptée à 8-100 caractères quelconques : un appel direct avec une clé connue rejoue la commande d'un tiers et renvoie son jeton de suivi. Exiger un UUID. **Corrigé le 3 octobre 2026, pas encore déployé** : la validation exige un UUID v4 (préfixe `panier-` toléré pour les pages déjà ouvertes), le formulaire génère un UUID (jamais `Math.random`), et un rejeu est refusé si la commande existante appartient à un autre restaurant. Vérifié : regex (clés courtes ou devinables refusées), commande réelle de bout en bout en local (suivi atteint, commande de test supprimée). |
| 11 | `taxonomie.ts` : le nom de table n'est contraint que par TypeScript ; liste blanche d'exécution à ajouter. |
| 12 | `traiterPropositionEchue` (clé serveur) est appelée avant le contrôle d'appartenance. |
| 13 | Policies sur rôle public qui appellent `fn_est_admin_systeme` (échec fermé pour `anon`, mais à passer en `to authenticated`) ; `anon` et `authenticated` ont tous les privilèges de table (seule la RLS protège) ; `rls_auto_enable` (SECURITY DEFINER) exécutable par `anon`. |
| 14 | `creerEtablissementAction` renvoie `error.message` brut ; inscription sans limitation de débit propre ni validation de longueur ; champ `lien` des bannières non validé (`javascript:`) avant tout affichage public ; images validées par type MIME déclaré seulement. |

## 4. Ce qui tient (constaté par le relecteur)

Prix, options et plats recalculés côté serveur avec contrôle d'appartenance ; jeton de suivi non énumérable et page de suivi sans téléphone ni adresse ; aucune policy `anon` sur les tables de commande ; `rate_limits` et `fn_limiter_debit` réservées au service-role ; actions restaurant filtrées par `membership.restaurant_id` avec la RLS en second rideau ; chaque fonction du CMS vérifie la permission avant d'accéder aux données ; triggers de protection de colonnes ; aucun `dangerouslySetInnerHTML`.

## 5. Non vérifié par la revue

Configuration de Supabase Auth (confirmation d'email, limites) ; secrets et variables réellement déployés ; en-têtes HTTP et cache Cloudflare de `/suivi/[jeton]` (pas de CSP ni de `Cache-Control` explicite) ; rendu des pages et bannières CMS ; comportement des policies avec un JWT authentifié autrement que par simulation (seul `anon` avait été testé réellement par le relecteur) ; tests automatisés (aucun n'existe) ; `src/app/system/**` et `src/app/restaurant/**` lus seulement par recoupement.

## 6. Ordre de correction proposé

1. **Déjà fait :** 1, 2, 4.
2. **Avant tout pilote, en priorité :** 3 (coordonnées clients), 5 (verrou super_admin), 10 (UUID d'idempotence), 7 (concurrence des propositions), 6 (contournements par l'API directe).
3. **Ensuite :** 8, 9, 11, 12, 13, 14.
4. **Après les corrections :** nouvelle revue indépendante limitée aux points corrigés, avec tests de refus d'accès (JWT réels de test pour public, restaurant A, restaurant B, chaque rôle système).
