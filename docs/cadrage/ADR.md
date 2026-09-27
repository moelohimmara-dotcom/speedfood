# Registre des décisions d’architecture — Speedfood

**Statuts :** `PROPOSÉ` signifie recommandation de travail, pas ressource provisionnée ni validation du propriétaire produit.  
**Date :** 27 septembre 2026

## ADR-001 — Application web mobile-first

- **Statut :** PROPOSÉ
- **Contexte :** le produit doit être accessible sans installation, via un lien partagé, et couvrir le catalogue public ainsi que des espaces authentifiés.
- **Décision :** construire une application web responsive avec routes publiques et espaces dédiés au restaurant et à l’administration. Le parcours de commande client reste accessible sans compte.
- **Conséquences :** un seul produit couvre découverte et opérations restaurant; les sessions, les routes protégées et le rendu mobile deviennent essentiels. Une application native reste hors MVP.
- **Réexamen :** si les observations montrent que les clients/restaurants ne peuvent pas utiliser le web mobile de façon fiable.

## ADR-002 — Next.js App Router et TypeScript

- **Statut :** PROPOSÉ, vérifier la version exacte au démarrage
- **Contexte :** le portail a des pages publiques découvrables et des interactions de commande, ainsi que des zones authentifiées. Une pile TypeScript partagée réduit les contrats dupliqués.
- **Décision :** utiliser Next.js avec App Router et TypeScript; conserver les composants serveur pour les pages publiques quand adaptés, et les composants client seulement pour l’interactivité. Utiliser routes serveur dédiées pour les écritures et règles métier.
- **Alternatives considérées :** SPA seule (plus simple, moins adaptée aux pages catalogue partageables); backend séparé (plus de déploiement et contrats à maintenir pour ce stade).
- **Conséquences :** agents doivent éviter de dupliquer une logique métier sensible dans le navigateur; les appels et autorisations serveur sont la source d’autorité. La documentation officielle décrit l’App Router comme le routeur actuel fondé sur le système de fichiers et React Server Components : https://nextjs.org/docs/app
- **Déploiement sur Cloudflare (27 septembre 2026) :** la landing et le prototype sont déjà hébergés sur Cloudflare Pages (`speedfood.pages.dev`). Pour le futur MVP Next.js, Cloudflare recommande **vinext** (https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) plutôt qu’OpenNext pour toute nouvelle application : vinext réimplémente la surface d’API Next.js sous forme de plugin Vite et se déploie sur Workers. À vérifier au bloc 1 (maturité, compatibilité des fonctionnalités requises); OpenNext reste la voie de repli pour maintenir une application existante (https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/).
- **Réexamen :** si les coûts ou les contraintes d’hébergement de Conakry imposent une architecture différente.

## ADR-003 — PostgreSQL managé sur Supabase

- **Statut :** ACCEPTÉ — projet `ggldjdizqrtpetdiohxy` créé (PostgreSQL 17, région `eu-west-1`)
- **Contexte :** menus, commandes, rôles et historique ont des relations fortes et nécessitent des transactions ainsi qu’une isolation fiable.
- **Décision :** modéliser en PostgreSQL et utiliser Supabase managé (Postgres + Auth). Le projet est provisionné; les migrations restent versionnées dans le dépôt et la logique doit rester portable.
- **Alternatives considérées :** base locale JSON (seulement prototype); base NoSQL (plus de travail pour cohérence commande/menu); hébergement PostgreSQL auto-opéré (charge d’exploitation prématurée).
- **Conséquences :** la région retenue est `eu-west-1` (Irlande); la latence depuis Conakry reste à mesurer et la résidence des données à confirmer avant pilote, faute de région africaine Supabase. La liste officielle des régions est évolutive : https://supabase.com/docs/guides/platform/regions
- **Sécurité :** activer RLS sur toute table exposée et combiner RLS, privilèges minimaux et validations côté serveur; l’absence de politique ne doit jamais exposer une table. Documentation : https://supabase.com/docs/guides/database/postgres/row-level-security

## ADR-004 — Un restaurant est le tenant de sécurité

- **Statut :** PROPOSÉ
- **Décision :** `restaurants.id` identifie le tenant métier; table `restaurant_memberships` relie des comptes à un établissement avec un rôle (`owner`, `manager` si nécessaire). Toute table contenant des données restaurant porte un `restaurant_id` et applique une vérification d’accès serveur et une politique RLS.
- **Conséquences :** ne pas faire confiance à un `restaurant_id` fourni par le navigateur. Une session ne gagne pas d’accès par modification d’URL ou d’identifiant. Les tests d’isolation inter-tenant sont un bloc de sécurité obligatoire avant pilote.
- **Réexamen :** si le produit adopte des groupes multi-marques possédant plusieurs restaurants; dans ce cas introduire explicitement `organizations` comme niveau supérieur.

## ADR-005 — Commande invitée sans paiement au MVP

- **Statut :** PROPOSÉ
- **Décision :** le client commande sans créer de compte; le restaurant confirme. Speedfood n’encaisse rien et n’opère pas la livraison au premier pilote. Le client obtient une référence et un jeton de suivi opaque; aucun secret de suivi n’apparaît dans les journaux.
- **Conséquences :** réduire la friction d’adoption et les dépendances financières; définir la durée de conservation et un moyen de limiter abus/spam. Ajouter ultérieurement un paiement seulement après validation terrain et recherche spécifique du prestataire.
- **États :** `en_attente`, `acceptee`, `refusee`, `prete`, `terminee`, `annulee`; les transitions sont validées côté serveur et auditables.

## ADR-006 — Prix en entier GNF et instantané des lignes de commande

- **Statut :** PROPOSÉ
- **Décision :** stocker les montants GNF en entiers; ne pas utiliser de virgule flottante pour la monnaie. À l’envoi, le serveur recalcule le montant et copie nom/prix/options dans les lignes de commande.
- **Conséquences :** le reçu reste stable malgré les modifications du menu; l’interface doit afficher que total, disponibilité, frais de livraison et acceptation sont à confirmer lorsque pertinent.
- **Réexamen :** si plusieurs monnaies ou taxes sont introduites, ajouter un code monnaie explicite par commande et revoir calculs/formatage.

## ADR-007 — Notifications séparées du mécanisme de commande

- **Statut :** PROPOSÉ
- **Décision :** l’état de commande en base est la source de vérité. Le tableau restaurant fonctionne même sans fournisseur de notification; notifier par un adaptateur séparé quand le canal pilote est choisi. Prévoir échec, réessai borné et journal minimal.
- **Conséquences :** un message WhatsApp ou SMS n’est jamais considéré comme preuve de confirmation ou de paiement. Aucune intégration ne doit être maquettée comme réelle si les identifiants fournisseur sont absents.
- **Réexamen :** après entretiens sur les canaux réellement utilisés et vérification des coûts, conditions et règles fournisseur.

## ADR-008 — Pas de facturation SaaS dans le MVP

- **Statut :** PROPOSÉ
- **Décision :** ne pas construire facturation, abonnements, commissions ni encaissement tant que le canal d’acquisition, la valeur apportée et l’intention de payer ne sont pas observés.
- **Conséquences :** l’administration peut activer un établissement pilote manuellement; suivre l’origine d’une commande sans facturer.
- **Réexamen :** après la première cohorte pilote et tests de prix distincts.

## ADR-009 — PWA installable, sans mutations hors ligne

- **Statut :** PROPOSÉ, inclus au MVP
- **Contexte :** clients et restaurateurs doivent accéder rapidement au portail sur téléphone sans application native séparée.
- **Décision :** livrer une PWA installable (manifest, icônes, expérience autonome, shell et page hors connexion). Au MVP, mettre en cache seulement le shell et les ressources statiques versionnées; ne pas mettre en cache menus dynamiques, commandes, sessions, pages de gestion, données personnelles ou suivi. Hors connexion, afficher une page explicative. Les mutations exigent le réseau et l’accusé du serveur; pas de synchronisation hors ligne.
- **Conséquences :** l’application reste utilisable dans le navigateur si l’installation n’est pas prise en charge. L’installation en production nécessite HTTPS. Les notifications push ne sont pas incluses par défaut; compatibilité, consentement, coût et besoin doivent être évalués sur appareils ciblés.
- **Références :** guide PWA Next.js et manifeste officiel : https://nextjs.org/docs/app/guides/progressive-web-apps ; https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- **Réexamen :** si les essais montrent qu’une synchronisation de commandes hors ligne est indispensable; ce changement impose d’analyser conflits, doublons, confidentialité et sécurité.

## ADR-010 — Deux consoles distinctes : restaurant et CMS système

- **Statut :** PROPOSÉ
- **Contexte :** les tâches quotidiennes d’un restaurateur et celles de l’équipe qui opère la plateforme sont différentes. Une interface unique augmenterait la complexité et le risque d’erreur de permission.
- **Décision :** séparer les surfaces `/restaurant` et `/system` (routes exactes à harmoniser avec le dépôt). La console restaurant ne montre que son établissement et priorise commandes, menu/disponibilité, horaires et profil avec un onboarding guidé. Le CMS système gère restaurants, comptes et rôles admin, publication/modération, catégories/quartiers/tags, mise en avant, pages/FAQ/bannières éditoriales, recherche de commandes pour support selon permissions, indicateurs d’activité et journal d’audit.
- **Modèle d’autorisations :** RBAC système distinct des memberships restaurant. Rôles MVP : `super_admin` (rôles et configuration), `operations` (onboarding/modération), `content_editor` (contenus/taxonomie), `support` (recherche d’incident avec données personnelles masquées). Les permissions de ces rôles sont définies dans le code et versionnées; seul `super_admin` peut attribuer les rôles via une action serveur. Aucun utilisateur ne s’attribue lui-même un rôle privilégié. L’accès exceptionnel aux coordonnées client exige une permission dédiée, un motif et une trace d’audit.
- **Conséquences :** plus de travail qu’un tableau admin minimal, mais séparation des responsabilités, simplicité pour les restaurants et meilleure traçabilité. « CMS complet » désigne toutes les opérations nécessaires au portail pilote ci-dessus, pas un constructeur de site généraliste.
- **Réexamen :** après pilote, selon le volume d’établissements et la taille de l’équipe opérationnelle.

## ADR-011 — Commande invitée créée et suivie par routes serveur, RLS fermée côté client

- **Statut :** ACCEPTÉ (arbitrage du 27 septembre 2026, à relire avant le bloc 7)
- **Contexte :** la base (`AUDIT-SUPABASE.md`) ne donne aujourd’hui aucun accès client aux tables de commande : pas d’INSERT pour créer une commande, pas de lecture par `jeton_suivi`, pas de réponse aux `order_proposals`. Le parcours « commande invitée sans compte » (ADR-005) n’a donc aucun chemin de données.
- **Décision :** créer, suivre et répondre à une proposition passent par des **routes serveur Next.js** (route handlers) qui utilisent la `service_role` uniquement côté serveur, avec validation stricte (recalcul des prix depuis la base, transitions autorisées, jeton opaque imprévisible, idempotence). Les politiques RLS des tables `orders`, `order_items`, `order_status_events`, `order_proposals` restent **fermées à `anon`** : aucune politique d’INSERT ou de SELECT par jeton n’est ajoutée. Les opérations des membres de restaurant continuent d’aller directement en base avec leur session authentifiée, sous RLS.
- **Alternatives considérées :** fonctions `SECURITY DEFINER` exposées à `anon` (ex. `fn_creer_commande`) — logique plus près de la base, mais étend la surface SQL exposée publiquement et double la validation déjà prévue côté serveur par l’ADR-002 et les règles métier; politiques RLS avec accès par jeton — rend le jeton équivalent d’un mot de passe stocké en clair dans la table et expose le modèle de commande au public.
- **Conséquences :** tout le parcours invité dépend du serveur Next.js disponible (cohérent avec l’ADR-002); la `service_role` ne quitte jamais le serveur; les écritures invitées sont testables en un seul point; le coût opérationnel reste celui d’une seule application. Les endpoints doivent être protégés contre les abus (limites de débit, tailles bornées) puisqu’ils sont ouverts à des visiteurs sans compte.
- **Réexamen :** si une fonction `SECURITY DEFINER` devient nécessaire pour la cohérence transactionnelle (ex. création commande + lignes + événements en un appel atomique depuis plusieurs surfaces), l’ajouter en complément des routes serveur, jamais en remplacement des validations.

## Décisions ouvertes avant préproduction

1. Région de base de données : `eu-west-1` provisionnée par défaut; confirmer après mesure de latence depuis Conakry et vérification des exigences de résidence (voir ADR-003).
2. Mode d’inscription restaurateur : ouvert, invitation ou validation manuelle; la recommandation pilote est l’invitation/validation manuelle.
3. Canal de notification et solution de secours.
4. Durée de conservation des coordonnées clients et procédure de suppression.
5. Conditions d’utilisation, politique de confidentialité et obligations locales avec un conseil compétent.
6. Modalités de livraison/retrait à afficher et responsabilité en cas de litige.
7. Modèle et prix après validation du pilote.
8. Noms définitifs des rôles système, création du premier super-admin (aucun compte système n’existe encore en base, le CMS est inutilisable en l’état) et procédure de récupération d’accès.
9. Liste exacte des pages éditoriales et indicateurs du CMS pilote.

## Références techniques officielles

- Next.js App Router : https://nextjs.org/docs/app
- Déploiement Next.js : https://nextjs.org/docs/app/getting-started/deploying
- Supabase Auth avec Next.js : https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Régions Supabase : https://supabase.com/docs/guides/platform/regions
- PWA Next.js : https://nextjs.org/docs/app/guides/progressive-web-apps
