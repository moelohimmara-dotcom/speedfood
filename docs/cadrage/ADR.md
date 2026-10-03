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

- **Statut :** ACCEPTÉ — implémenté (Next.js 16, App Router, TypeScript) dans ce dépôt
- **Contexte :** le portail a des pages publiques découvrables et des interactions de commande, ainsi que des zones authentifiées. Une pile TypeScript partagée réduit les contrats dupliqués.
- **Décision :** utiliser Next.js avec App Router et TypeScript; conserver les composants serveur pour les pages publiques quand adaptés, et les composants client seulement pour l’interactivité. Utiliser routes serveur dédiées pour les écritures et règles métier.
- **Alternatives considérées :** SPA seule (plus simple, moins adaptée aux pages catalogue partageables); backend séparé (plus de déploiement et contrats à maintenir pour ce stade).
- **Conséquences :** agents doivent éviter de dupliquer une logique métier sensible dans le navigateur; les appels et autorisations serveur sont la source d’autorité. La documentation officielle décrit l’App Router comme le routeur actuel fondé sur le système de fichiers et React Server Components : https://nextjs.org/docs/app
- **Déploiement (état réel) :** en production sur Cloudflare Workers via `@opennextjs/cloudflare` (voir `docs/DEPLOIEMENT-CLOUDFLARE.md`). Cloudflare recommande vinext pour une nouvelle application; OpenNext a été retenu car l'application existait déjà et fonctionne. À réexaminer si OpenNext pose problème.
- **Réexamen :** si les coûts ou les contraintes d’hébergement de Conakry imposent une architecture différente.

## ADR-003 — PostgreSQL managé sur Supabase

- **Statut :** ACCEPTÉ — projet `ggldjdizqrtpetdiohxy` créé (PostgreSQL 17, région `eu-west-1`), 25 migrations appliquées
- **Contexte :** menus, commandes, rôles et historique ont des relations fortes et nécessitent des transactions ainsi qu’une isolation fiable.
- **Décision :** modéliser en PostgreSQL et utiliser Supabase managé (Postgres + Auth). Les migrations sont versionnées dans `supabase/migrations/` et la logique doit rester portable.
- **Alternatives considérées :** base locale JSON (seulement prototype); base NoSQL (plus de travail pour cohérence commande/menu); hébergement PostgreSQL auto-opéré (charge d’exploitation prématurée).
- **Conséquences :** la région est `eu-west-1` (Irlande), faute de région africaine Supabase. La latence depuis Conakry reste à mesurer et la résidence des données à confirmer avant pilote. La liste officielle des régions est évolutive : https://supabase.com/docs/guides/platform/regions
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
- **États stockés de la commande (`orders.statut`) :** `en_attente`, `acceptee`, `refusee`, `prete`, `terminee`, `annulee`. **`attente_confirmation_client` est un état dérivé** (commande `en_attente` + proposition révisée active en attente de réponse), pas une valeur stockée : le schéma `orders` est gelé. **`expiree` est un statut de la proposition** (`order_proposals.statut` : `en_attente`, `acceptee`, `refusee`, `expiree`), pas de la commande. Si le restaurant change le montant ou une condition de livraison, il crée une proposition versionnée. Le client doit l’accepter explicitement via son suivi protégé avant tout passage à `acceptee`; un refus clôt la commande en `annulee`; à l’échéance, la proposition passe à `expiree` et la commande à `annulee` (acteur `systeme:proposition_expiree`). Aucun début de préparation n’est autorisé avant l’accord.
- **Conséquences :** schéma avec propositions immuables, échéances et événements d’état; une nouvelle proposition invalide l’accord sur la précédente. L’action du client est idempotente et auditée.

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

- **Statut :** ACCEPTÉ et implémenté (bloc 7). Le code source cite cette décision sous le nom « ADR-011 » : ne pas renuméroter.
- **Contexte :** la base ne donne aucun accès client aux tables de commande : pas d’INSERT pour créer une commande, pas de lecture par `jeton_suivi`, pas de réponse aux `order_proposals`. Le parcours « commande invitée sans compte » (ADR-005) n’a donc aucun chemin de données direct.
- **Décision :** créer, suivre et répondre à une proposition passent par des **routes serveur Next.js** qui utilisent la `service_role` uniquement côté serveur, avec validation stricte (recalcul des prix depuis la base, transitions autorisées, jeton opaque imprévisible, idempotence). Les politiques RLS des tables `orders`, `order_items`, `order_item_options`, `order_status_events`, `order_proposals` restent **fermées à `anon`** : aucune politique d’INSERT ou de SELECT par jeton n’est ajoutée. Les opérations des membres de restaurant continuent d’aller directement en base avec leur session authentifiée, sous RLS.
- **Alternatives considérées :** fonctions `SECURITY DEFINER` exposées à `anon` (ex. `fn_creer_commande`) — logique plus près de la base, mais étend la surface SQL exposée publiquement et double la validation déjà prévue côté serveur (ADR-002); politiques RLS avec accès par jeton — rend le jeton équivalent d’un mot de passe stocké en clair dans la table et expose le modèle de commande au public.
- **Conséquences :** tout le parcours invité dépend du serveur Next.js disponible; la `service_role` ne quitte jamais le serveur; les écritures invitées sont testables en un seul point. Les endpoints sont ouverts à des visiteurs sans compte et doivent être protégés contre les abus (limites de débit, tailles bornées).
- **État réel de la protection anti-abus :** tailles et quantités bornées dans le code, **et limitation de débit implémentée le 3 octobre 2026** (`src/lib/securite/limitation-debit.ts`, table `rate_limits` + fonction `fn_limiter_debit` réservée au service-role) : compteur à fenêtre fixe dans la base existante, sans service externe, clés = empreintes HMAC (jamais d'IP ni de téléphone en clair). En cas de panne du compteur, la requête passe (journalisée) plutôt que de bloquer toutes les commandes. Limites initiales à ajuster avec l'usage réel. Déployée en production le 3 octobre 2026 ; `cf-connecting-ip` vérifié en production (un `X-Forwarded-For` falsifié ne change pas la clé). Restent à vérifier : règles Cloudflare complémentaires, limites de Supabase Auth.
- **Réexamen :** si une fonction `SECURITY DEFINER` devient nécessaire pour la cohérence transactionnelle, l’ajouter en complément des routes serveur, jamais en remplacement des validations.

## Décisions ouvertes avant préproduction

1. Région de base de données : `eu-west-1` provisionnée; confirmer après mesure de latence depuis Conakry et vérification des exigences de résidence (voir ADR-003).
2. Mode d’inscription restaurateur : ouvert, invitation ou validation manuelle; la recommandation pilote est l’invitation/validation manuelle.
3. Canal de notification et solution de secours.
4. Durée de conservation des coordonnées clients et procédure de suppression.
5. Conditions d’utilisation, politique de confidentialité et obligations locales avec un conseil compétent.
6. Modalités de livraison/retrait à afficher et responsabilité en cas de litige.
7. Modèle et prix après validation du pilote.
8. Noms définitifs des rôles système (v1.0.0 en place : `super_admin`, `operations`, `content_editor`, `support`). Premier `super_admin` créé le 27/09/2026 via la `service_role`; procédure de récupération décrite dans `docs/STATUT-PROJET.md`.
9. Liste exacte des pages éditoriales et indicateurs du CMS pilote.

## Références techniques officielles

- Next.js App Router : https://nextjs.org/docs/app
- Déploiement Next.js : https://nextjs.org/docs/app/getting-started/deploying
- Supabase Auth avec Next.js : https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Régions Supabase : https://supabase.com/docs/guides/platform/regions
- PWA Next.js : https://nextjs.org/docs/app/guides/progressive-web-apps

## Décisions complémentaires — pilote du 3 octobre 2026

> Numérotation : ces quatre décisions étaient numérotées ADR-011 à ADR-014 dans la version rédigée hors dépôt ; elles sont renumérotées ADR-015 à ADR-018 car ADR-011 désigne déjà, dans le code et les documents du dépôt, la décision sur la commande invitée par routes serveur.

### ADR-015 — Disponibilité opérationnelle et découverte par règles
- **Statut :** retenu pour cadrer le pilote, sous réserve de validation terrain des libellés et de la fraîcheur.
- **Décision :** distinguer ouvert/fermé, accepte/en pause, et disponibilité des articles. Les restaurants mettent à jour leurs états; Speedfood horodate les confirmations. Recherche locale et alternatives exactes/équivalentes explicables incluses. L’information périmée devient « à confirmer ».
- **Conséquences :** pas de promesse d’inventaire exact ni d’autodécrément fondé seulement sur les commandes Speedfood; celles-ci ne couvrent pas les ventes en personne ou WhatsApp. Le classement initial est déterministe et les contenus sponsorisés, s’ils arrivent, sont visiblement séparés.

### ADR-016 — Connexion Google et téléphone
- **Statut :** souhaitée pour le pilote; l’OTP téléphone reste bloqué jusqu’à validation du coût, de la livraison en Guinée et du fournisseur.
- **Décision :** Supabase Auth reste le fournisseur proposé unique; Google OAuth demande seulement les informations de base. Téléphone normalisé +224, confirmé par OTP. Aucun Clerk en parallèle. Les visiteurs lisent le portail sans compte.
- **Conséquences :** OAuth requiert configuration Google et secrets serveur. SMS peut coûter par tentative et peut ne pas arriver; limiter les codes, ajouter une protection anti-abus et offrir une alternative. Ne jamais fusionner deux comptes sur une simple égalité de nom/email.

### ADR-017 — WhatsApp comme distribution de liens
- **Statut :** partage sortant inclus; automatisation exclue du pilote.
- **Décision :** liens Speedfood partageables et bouton ouvrant WhatsApp avec texte prérempli; l’utilisateur confirme l’envoi. Le site reste le lieu de découverte et la conversation reste avec le restaurant.
- **Conséquences :** un clic WhatsApp n’est ni une commande confirmée ni une conversion certaine; analytics et textes doivent l’indiquer clairement.

Pour le détail fonctionnel et visuel applicable, voir `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md`.

### ADR-018 — Notifications progressives et facultatives
- **Statut :** retenu comme direction; Web Push dépend d’un essai technique et du pilote.
- **Décision :** améliorer d’abord les toasts et confirmations de la démo, puis afficher les événements métier in-app. Ajouter Web Push seulement pour changements de commande ou demandes restaurant et après opt-in contextuel. FCM est un fournisseur candidat à évaluer; il ne détient pas la source de vérité Speedfood.
- **Conséquences :** aucune permission sollicitée au premier chargement; commandes restent consultables sur Speedfood; préférences, révocation, déduplication, confidentialité et fallback nécessaires. Voir `NOTIFICATIONS-ICONES-OUTILS.md`.
