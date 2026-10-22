# Feuille de route : console d'administration Speedfood (établissements tenus par l'équipe)

Contexte (22 octobre 2026) : les restaurateurs n'utilisent plus la console eux-mêmes. L'équipe Speedfood tient les établissements en mode de vente « speedfood » (ADR du 22 octobre : `mode_vente`, poste de répartition `/system/repartition`, catalogue tenu par l'équipe). Cette feuille de route liste ce qu'il reste à construire pour que l'équipe exploite au quotidien, dans l'ordre de ce qui bloque le plus.

Légende des tailles : S = une séance, M = deux à trois, L = plus. « Décision » = point qui dépend de Malika.

## État de départ (déjà en place)
Demandes de partenariat et référencement, fiche et publication d'un établissement, menu et disponibilité tenus par l'équipe (dont photos et import par photo), poste de répartition (confirmer, prête, remise, annuler), paiements et reçus, livreurs et dispatch, avis, comptes et rôles, audit, paramètres, mises à jour de l'application.

## Lots, par priorité

| # | Lot | Contenu | Taille | Dépend de | État |
|---|---|---|---|---|---|
| L1 | **Alerte équipe sur nouvelle commande** | Carillon et compteur dans l'onglet sur `/system/repartition` (bouton « Activer le son », rappel toutes les 60 s) ; notification poussée (Firebase) aux rôles `operations` et `super_admin` pour chaque commande d'un établissement tenu par l'équipe | S | Firebase (fait) | **Fait (22 oct.)**, à confirmer sur un vrai appareil |
| L2 | **Quarts et affectation** | Qui tient quel établissement : table d'affectation opérateur ↔ établissements, « je prends » / « je libère » sur une commande, file « à moi » et « non pris », indicateur de commande non reprise depuis N minutes, alerte de relance | M | L1 | à faire |
| L3 | **Relevés, commissions, versements** | Taux de commission par établissement (contrat), relevé par période (ventes, commission, frais de livraison, net à reverser), export CSV, statut « versé » avec date et référence | M à L | Décision : barème de commission et rythme de versement | à faire |
| L4 | **Support client** | Fil de conversation par commande (client ↔ équipe), modèles de réponses, statut ouvert/résolu, lien depuis la fiche commande, messages WhatsApp préremplis | M | Décision : canal (WhatsApp seul ou aussi dans l'application) | à faire |
| L5 | **Rappel de confirmation du menu** | Avant le service : liste des établissements aux plats à reconfirmer, rappel (notification interne + appel), confirmation en un geste de tout le menu du jour | S | — | à faire |

## Lots suivants (après les cinq premiers)
| # | Lot | Contenu | Taille |
|---|---|---|---|
| L6 | Fermeture et suspension d'un établissement | Motif, durée, message affiché aux clients, reprise planifiée | S |
| L7 | Journal de contacts avec l'établissement | Appels, visites, relances, prochaine action | S |
| L8 | Mises à jour de menu en masse | Prix en lot, copie d'un menu, import CSV | M |
| L9 | Paie des livreurs | Gains par course, période, versement | M |
| L10 | Incidents de livraison | Retard, colis perdu, litige, compensation | S |
| L11 | Codes promo et campagnes | Codes, plafonds, durée, notification aux clients | M |
| L12 | Remboursements | Dépend du prestataire de paiement (l'API Chap Chap Pay n'en propose pas) : procédure manuelle tracée d'abord | M |
| L13 | Supervision | Alertes d'erreurs, tenue en charge, état des services (Supabase, Firebase, paiement) | M |
| L14 | Sauvegarde et restauration | Contrôle et procédure testée | S |

## Décisions attendues de Malika
1. Barème de commission et rythme de versement aux établissements (L3).
2. Canal du support client (L4).
3. Où opère l'équipe : sur le site `/system` seulement (recommandé), ou aussi depuis l'application (il faudrait donner accès à plusieurs établissements à un compte).
4. Combien d'opérateurs et quels horaires de service (dimensionne L2).

## Règles de réalisation (rappel)
Chaque lot : migration versionnée dans `supabase/migrations/` dans le même commit, advisors de sécurité après toute migration RLS, tests purs et contrôle de cloisonnement verts, vérification de bout en bout avant de le dire livré, déploiement uniquement avec feu vert. Aucun coût ni service externe sans consigne explicite.

## Parité console web / application (décision du 22 octobre 2026)
Tout ce que fait `/system` doit exister dans l'application, avec des routes d'API propres (`/api/v1/equipe/*`, jeton porteur, rôle lu en base, mêmes barrières que le site : second facteur, questions de sécurité, plafond par compte, audit).

**Socle livré (APK 2.11.0)** : `equipeAuthentifiee` (`src/lib/api/v1-equipe.ts`), `GET /api/v1/equipe/moi` (rôle, permissions et menu identiques au site, filtrés par permission), poste de répartition natif (`GET /api/v1/equipe/repartition`, `POST .../repartition/action`, alerte sonore à chaque nouvelle commande, actions destructives confirmées), notification poussée à l'équipe (rôles `support` et `super_admin`). Le service de répartition est partagé entre le site et l'application (`repartition-service.ts`).
**Principe d'avancement** : le hub de l'application affiche TOUTES les sections du site selon les droits ; une section sans écran natif s'ouvre sur le site (« Sur le site »), une section native s'ouvre dans l'application (« Dans l'application »). On bascule section par section en ajoutant son écran et ses routes `/api/v1/equipe/<section>` et en l'ajoutant à `SECTIONS_NATIVES` (`src/app/api/v1/equipe/moi/route.ts`).

Ordre de bascule proposé : 1 répartition (fait) ; 2 support commandes et détail commande ; 3 livraisons et livreurs ; 4 paiements ; 5 restaurants, référencements, menu d'un établissement ; 6 partenariats, liste d'attente ; 7 avis ; 8 comptes ; 9 contenu, design, paramètres, mises à jour ; 10 audit. Les écrans d'édition lourde (pages et blocs, design, géographie) resteront sur le site tant qu'un écran natif n'apporte rien (décision à reprendre section par section).

**Support des commandes (APK 2.12.0)** : `GET /api/v1/equipe/commandes`, `GET .../commandes/[id]`, `POST .../commandes/[id]/statut` (motif obligatoire, `commande.support`), `POST .../commandes/[id]/coordonnees` (motif obligatoire, `coordonees.voir`, audit écrit par la base avant affichage) ; service `commandes-service.ts` (client du jeton, fonctions `fn_support_*` déjà réservées aux rôles support et super_admin). Écrans natifs : recherche (référence, statut, du jour) et détail (historique, propositions, statut, coordonnées sur motif). Section marquée native dans `SECTIONS_NATIVES`.
