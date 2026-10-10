# Audit logique et sécurité — Speedfood

**Date : 10 octobre 2026.** Revue ciblée en lecture seule du checkout local, des sources de cadrage, du site public et des routes de développement. Ce document n’est ni une revue indépendante des corrections déjà livrées ni une certification de sécurité.

## Résumé exécutif

Les contrôles de commande visibles dans le code sont alignés avec les décisions principales : source de prix serveur, montants entiers, validation des suppléments, état dérivé des propositions et réponse atomique côté base. La matrice RBAC est centralisée et les routes anonymes se comportent comme prévu. Les principaux blocages au pilote restent le jeton de suivi dans les journaux Worker, l’absence de préproduction, les vulnérabilités npm à trier et les contrôles de rôles/procédures qui nécessitent des sessions de test ou un accès Cloudflare/Supabase non disponible dans cette passe.

## Risques et constats

### S1 — Jeton de suivi présent dans le chemin des journaux Worker (critique, déjà accepté)

`docs/cadrage/PROCEDURE-SECURITE.md` §9 indique que les journaux Worker sont actifs, échantillonnés à 100 % et conservés 7 jours. Le masquage documenté porte sur la chaîne de requête, alors que le jeton de suivi est dans `/suivi/<jeton>` et donne accès à la commande. Un accès aux journaux peut donc exposer des liens de suivi actifs. La propriétaire a accepté le risque par écrit le 7 octobre 2026; cette revue n’a pas interrogé l’API Cloudflare pour revalider la configuration actuelle.

**Décision attendue :** maintenir cette acceptation ou autoriser un correctif qui retire/masque le jeton du chemin journalisé, puis vérifier le comportement en production après approbation explicite. Aucun réglage Cloudflare n’a été changé.

### S2 — Pas de préproduction distincte (bloquant avant pilote)

La procédure décrit un seul Worker et un seul projet Supabase. Les essais de régression sur des parcours réels ou des données client pourraient donc toucher la production. Aucune préproduction n’a été créée ni demandée.

### S3 — Dépendances : 11 vulnérabilités élevées signalées (à trier)

`npm ci` a installé 740 paquets et signalé 11 vulnérabilités de niveau élevé. Aucun `npm audit fix` n’a été exécuté; la sortie de `npm ci` ne donne pas la ventilation par paquet/CVE, qui reste à obtenir sur la révision GitHub courante avant toute mise à jour. Quatre scripts d’installation restent non approuvés par npm : `esbuild` (deux versions), `unrs-resolver` et `workerd`. Le serveur de développement fonctionne malgré cet avertissement; aucune commande Cloudflare de build ou de déploiement n’a été lancée.

### S4 — Cache/hors connexion PWA absent du service worker courant

`public/sw.js` gère install, activation et notifications push; il n’a ni stratégie `fetch` ni stockage Cache API. Le manifeste répond 200 en local, mais cela ne prouve pas un shell utilisable hors connexion. L’absence de cache évite de mettre en cache par erreur commandes, sessions ou coordonnées; elle ne satisfait pas le parcours hors ligne documenté au TDR. Aucun changement n’a été fait.

### S5 — Autorisations par rôle non éprouvées en session dans cette passe

Le code définit `super_admin`, `operations`, `content_editor` et `support` dans [permissions.ts](src/lib/system-admin/permissions.ts). `verifierPermission`, `exigerPermissionPage` et les fonctions métier vérifient côté serveur; les rôles système restent séparés des memberships restaurant. La matrice lue attribue : modération et opérations à `operations`; contenus/taxonomie à `content_editor`; recherche de commandes et révélation motivée/auditée à `support`; toutes permissions à `super_admin`.

Sans session déjà existante pour chaque rôle, ce constat reste statique. Aucun compte n’a été créé et aucune coordonnée/commande n’a été révélée. À l’anonyme, production et local renvoient `/restaurant` vers `/connexion`, renvoient 404 sur `/system` et laissent `/restaurants` public.

### S6 — Les horaires ne calculent pas eux-mêmes l’état « ouvert »

Le champ `horaires` est descriptif; les états `ouvert` et `accepte_commandes` sont deux booléens distincts modifiables séparément. La commande côté serveur exige restaurant publié, non suspendu, ouvert et acceptant les commandes. Ce modèle est cohérent avec les statuts distincts du pilote, mais la cohérence entre horaires affichés et bascule opérationnelle repose sur la mise à jour du restaurateur; aucun calendrier horaire automatisé n’est calculé.

### S7 — Jetons, prix et propositions : protections confirmées dans le code local

- [calculs.ts](src/lib/commande/calculs.ts) lit les prix de base côté serveur, valide prix promo, restaurant, disponibilité et rattachement des options; les montants sont vérifiés comme entiers bornés.
- [creation.ts](src/lib/commande/creation.ts) compare le sous-total affiché au sous-total serveur et refuse la création si les prix ont changé; les lignes enregistrent un instantané.
- [propositions.ts](src/lib/commande/propositions.ts) délègue la réponse à `fn_repondre_proposition`; [transitions.ts](src/lib/commande/transitions.ts) garde `attente_confirmation_client` comme état dérivé, pas comme valeur stockée.
- Aucun panier réel n’a été envoyé et aucun lien de suivi client n’a été utilisé pendant l’audit. Ces vérifications reposent sur le code, les migrations versionnées et la suite de tests, pas sur une commande de production.

## Environnement et contrôles exécutés

- `.env.local` existe et est ignoré par Git (`.gitignore`). Les noms de variables de `.env.example` et `.env.local` ont été relevés uniquement; aucune valeur n’a été lue, copiée ou affichée. Le serveur local a chargé `.env.local`; aucun secret n’a été passé dans une commande, un rapport ou une capture.
- `npm ci` : réussi, 740 paquets; avertissement npm de 11 vulnérabilités élevées et 4 scripts non approuvés. Pas de correction automatique.
- TypeScript (`tsc --noEmit`) : `EXIT=0`.
- Tests unitaires (`scripts/tests/lancer.mjs`) : `EXIT=0`; aucun test en échec observé.
- ESLint : `EXIT=0`, 8 avertissements, 0 erreur; variables inutilisées dans des tests et modules Studio.
- `npm run dev` : serveur Next.js 16.3.6 prêt sur localhost; `/restaurants`, filtres/recherche, fiche publique, panier vide et `/commande` ont répondu 200. Aucune mutation n’a été soumise. En mode développement, React a signalé un mismatch d’hydratation sur des classes d’animation; non observé en production dans cette passe.
- GitHub est accessible en lecture; la branche distante `master` indique `05de7a8`, tandis que le checkout local reste sur `494398e`. Le commit GitHub consulté change `src/app/layout.tsx` pour typer explicitement `children` (`ReactNode`). Aucun fetch, merge, branche, commit ou push n’a été fait.
- Production et GitHub ont été joints par navigateur. La lecture publique du catalogue depuis l’app locale fonctionne. L’accès API au compte Cloudflare, aux journaux Worker et aux tables privées Supabase n’a pas été revalidé; aucun changement distant n’a été effectué.

## Portes non vérifiées

Sessions réelles `operations`, `content_editor` et `support`; MFA du compte super-admin; action réelle de proposition/expiration; concurrence avec deux connexions; révocation/rotation des jetons documentés comme exposés; paramètres Cloudflare actuels; contraintes RLS avec de vrais JWT; restauration sur un projet Supabase; téléphone physique; cache hors ligne; procédure d’incident et revue de sécurité indépendante. Aucune de ces portes ne peut être déclarée franchie sur la seule base du code ou des documents.
