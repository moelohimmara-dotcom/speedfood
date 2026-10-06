# Studio Speedfood : points mineurs différés (6 octobre 2026)

Constats Minor relevés par les revues indépendantes des tâches 1 à 4 et **volontairement non traités** dans le lot livré (la revue finale a jugé qu'aucun ne doit
bloquer le déploiement). Détail complet : revues `revue-*.md` du dossier de travail `.sdd/studio/` (hors dépôt). À reprendre au fil des prochaines tâches.

## Conditions d'usage (à traiter AVANT l'usage correspondant)
- **Avant de poser un premier accès partiel réel** : l'erreur de lecture des rôles est ignorée dans l'écran des habilitations (elle inviterait à retirer un plafond à tort).
- **Avant le palier 3** : relèvements 3-4 et double authentification obligatoire (décision Malika du 6 octobre : obligatoire dès le palier 3, elle remplace « facultative » pour ces paliers).
- **Avant le premier usage réel du bandeau d'annonces en public** : le test de bout en bout publie une bannière de test visible jusqu'à 60 s ; saisir un ordre très élevé.

## Liste du registre (extraits tels que consignés)
- Task 1: minor (deferred): M1 double lecture generateMetadata+page (cache react) ; M2 canonical/noindex sur ?apercu=1 d'une page publiée ; M3 ## sous h1 saute un niveau ; M4 liens externes sans mention « nouvel onglet » ; M5 troncature silencieuse 20 000 car./200 blocs ; M6 erreurs base sans console.error ; M7 span inutile par segment, publie_le inutilisé
- Task 1: minor (deferred): M8 ligne vide dans le commentaire de tête de lecture.ts ; M9 20 000 car. de liens refusés [a](x) ≈ 200 ms (new URL lève une exception par lien refusé), linéaire, non couvert par les tests hostiles
- Task 2: minor (deferred): M1 course d'invalidation (valeur périmée ≤ TTL après invalidation) à documenter ; M2 garde-fou d'import partiel (transitif/require ; sens inverse apercu→cache non vérifié) ; M3 doc : pas de coalescence des requêtes, tiered cache ; M4 SPEEDFOOD_RACINE passé à tous les tests, repli import.meta.dirname Node ≥ 20.11 ; M5 doublon de commentaire sur la limite « centre local »
- Task 2: minor (deferred): M6 test d'enveloppe répliqué + regex de comptage ; M7 procédure de contrôle workers.dev sans commande exacte, pas pour non-technique
- Task 3: minor (deferred): M10 écritures partielles sans invalidation (retours d'erreur) ; M11 écriture avant audit (commentaire inexact) ; M12 listerSurcharges avale l'erreur de lecture ; M13 comparaison au défaut littérale (U+00A0) + NUL non filtré ; M14 a11y boutons « Rétablir » au nom identique, variable proche→depasse ; M15 tests statiques regex, lireTextes non testé fonctionnellement ; M16 CACHE-STUDIO.md ne cite pas la clé `textes` ; M17 metadata.title accueil non éditable
- Task 4: minor (deferred): 12 mineurs détaillés dans revue-4.md (double lecture 500 au lieu de 404, aperçu/compteurs hors palier, annulation/retrait peu vérifiés, erreur de lecture des rôles ignorée, relèvements sans effet qui reviendront, a11y des boutons désactivés, détails de migration, doc et sauvegarde, ordre des contrôles)

## Autres points connus
- Textes visibles hors accueil non encore éditables (composants `SelecteurEnvie`, `TicketVoyage`, `CartePub`, cadre du site, titre de la page) : prochaine extension du palier 1.
- Procédure de contrôle du cache en production (workers.dev) : voir `docs/CACHE-STUDIO.md` ; vérifiée le 6 octobre, le cache agit bien sur `workers.dev`.
- Sur 15 « éléments » proposés dans le formulaire des habilitations, seuls `*`, `contenu` et `contenu:*` ont un effet aujourd'hui.
