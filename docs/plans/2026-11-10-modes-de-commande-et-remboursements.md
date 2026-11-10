# Modes de commande (livraison, à emporter, sur place avec réservation) et remboursements — plan du 10 novembre 2026

> **Plan seulement.** Rien n'est codé ni appliqué en base par ce document. Branche de travail : `etape-modes-commande-remboursement` (partie de `master` à 7b6c054). Les migrations seront écrites en fichiers et testées localement ; **leur application sur la base de production et tout déploiement exigent un oui distinct de Malika** (règle du dépôt).

## 1. Ce que Malika a demandé (10 novembre 2026)

- **D1 — le schéma logique du client.** Le client choisit : (a) **se faire livrer** ; ou (b) **aller au restaurant**, et alors soit (b1) il **réserve une table** et mange sur place, soit (b2) il **commande pour emporter** (il vient récupérer sa commande et repart juste après). Le système doit refléter ce schéma, sur le site et dans l'appli.
- **D2 — remboursement.** C'est l'objet d'une analyse approfondie ; **un conseil juridique tranchera** entre les deux parties. Le système doit prévoir **le cas Chap Chap Pay et le cas sans Chap Chap Pay**.
- **Implémenter** tout le code et les fonctions dans l'appli et la plateforme, **fonctionnel comme les autres systèmes**.

## 2. Constat du code (lu le 10 novembre)

| Sujet | Existe déjà | Manque |
|---|---|---|
| Modes de commande | `orders.mode` ∈ `retrait`, `livraison`, `sur_place` (`20261005185054_commande_a_table.sql`) ; `sur_place` = commande à table par QR, numéro de table, ardoise ou comptoir (`docs/COMMANDE-SUR-PLACE.md`) ; présent dans le site, l'API Hono, le contrat partagé et l'appli (`commande-reelle.ts`, `client.ts`) | Le **libellé et le parcours** ne suivent pas le schéma de Malika (à emporter / sur place) ; l'appli n'a pas de choix clair entre « sur place » et « à emporter » |
| Réservation de table | **Rien** (aucune table SQL, aucun écran, aucune API) | Tout : réservation avant l'arrivée, date et heure, nombre de personnes, état, console du restaurant, rappel |
| Règlement à table | `MODES_REGLEMENT = especes, orange_money, mtn_momo` (`apps/web/src/lib/table/regles.ts`) | **Contraire à la règle produit du 3 novembre** (pas de cash, tout par Chap Chap Pay) : inventaire B3 |
| Litiges de paiement | `litiges_paiement` : situations, décision automatique, états `ouvert/decide_auto/a_humain/clos` ; remboursement manuel `remboursements_manuels` (Orange Money, MTN MoMo, **espèces en dernier recours**) | Pas de dossier d'analyse pour le conseil juridique ; pas de trace de **l'avis juridique** ; pas de distinction « avec / sans Chap Chap Pay » dans la décision |
| Chap Chap Pay | Encaissement, webhook, PUSH décrits (`docs/CHAPCHAP-NOTES-API.md`) ; **aucun endpoint de remboursement** ; compte Speedfood, KYC 0 % | Tout remboursement part vers un humain tant que ce point n'est pas éclairci avec Chap Chap |

## 3. Décisions de conception retenues par défaut (à corriger par Malika si elles ne conviennent pas)

1. **Trois choix clairs côté client**, mêmes mots partout (site, appli, suivi, reçu) : « Livraison », « À emporter », « Sur place ». `orders.mode` ne change pas (`livraison`, `retrait`, `sur_place`) : « à emporter » est l'affichage de `retrait`. Aucune migration pour cette partie.
2. **« Sur place » a deux entrées** : (i) **je suis déjà au restaurant** (QR de table, flux existant, inchangé) ; (ii) **je réserve une table** pour plus tard (nouveau). Une réservation peut être suivie d'une commande à table le jour venu, qui s'y rattache.
3. **Réservation = demande à confirmer par le restaurant** (jamais une confirmation automatique) : restaurant, date et heure (fuseau de Conakry), nombre de personnes (1 à 12), nom et téléphone du client (ou son compte), note libre courte, état `demandee` → `confirmee` / `refusee` / `annulee_client` / `annulee_restaurant` / `honoree` / `non_honoree`. Un restaurant doit **activer** la réservation (comme `accepte_sur_place`). Le client peut annuler tant que la réservation n'est pas passée. Aucun paiement à la réservation dans ce lot (ni acompte).
4. **Pas d'espèces nulle part** (règle du 3 novembre) : « sur place » se règle par Chap Chap Pay quand il sera ouvert, en attendant par le code marchand existant (Orange Money, MTN MoMo). Les espèces disparaissent des **choix proposés** ; la lecture des anciennes lignes est conservée (zéro ligne en base).
5. **Remboursement : le système ne tranche pas le droit.** Il (i) produit **un dossier d'analyse par cas** (qui a demandé, ce qui est prouvé, ce que chaque règle automatique conclurait, avec ou sans Chap Chap Pay) pour le conseil juridique ; (ii) enregistre **la décision humaine et sa référence d'avis** ; (iii) exécute le remboursement par le **moyen disponible** : Chap Chap Pay si son remboursement existe un jour, sinon remboursement manuel par mobile money (déjà en place). Les règles automatiques existantes ne sont pas durcies ni assouplies : elles restent « à titre indicatif » tant que l'avis juridique n'est pas rendu.
6. **Le remboursement en espèces par un super administrateur n'est pas supprimé** : il reste désactivé par défaut derrière un réglage de la plateforme, et sa suppression ou son maintien dépendent de l'avis juridique (décision D2 de l'inventaire des espèces).

## 4. Lots (dans l'ordre ; chaque lot : tests d'abord, relecture indépendante, contrôles relancés, commit sur la branche de travail)

| Lot | Contenu | Migration SQL |
|---|---|---|
| **M1** | Vocabulaire et parcours « Livraison / À emporter / Sur place » (site + appli + suivi + reçu) ; retrait des espèces des choix proposés (B1, B2, B3) | Non |
| **M2** | Réservation de table, base : table `reservations_table`, réglage `accepte_reservation` du restaurant, RLS, fonctions ; fichier de migration, **non appliqué** sans feu vert | Oui (fichier) |
| **M3** | Réservation, serveur : routes site et API Hono, contrat partagé, validations (date future, créneaux, nombre de personnes, quota par créneau), annulation | Non |
| **M4** | Réservation, interfaces : écran client (site + appli Expo), console du restaurant (liste, confirmer/refuser), notification de la réponse | Non |
| **R1** | Dossier d'analyse du remboursement : document pour le conseil juridique `docs/ANALYSE-REMBOURSEMENT-POUR-CONSEIL-JURIDIQUE.md` (cas, acteurs, avec/sans Chap Chap Pay, pièces à conserver, questions posées) | Non |
| **R2** | Remboursement dans le système : champ « référence d'avis juridique » et décision humaine consignée, choix du moyen avec/sans Chap Chap Pay, écrans d'exploitation ; espèces derrière réglage | Oui (fichier) |

## 5. Critères d'acceptation

- Un client peut, sur le site et dans l'appli : se faire livrer ; commander à emporter ; commander sur place (déjà au restaurant) ; **réserver une table**, voir l'état de sa réservation, l'annuler.
- Un restaurant peut activer la réservation, voir les demandes du jour, les confirmer ou les refuser avec un motif ; le client est prévenu.
- Aucun parcours ne propose « espèces ».
- Le dossier de remboursement d'un litige se lit en un écran et se transmet tel quel au conseil juridique ; la décision humaine y est enregistrée avec sa référence.
- Tests : unitaires des règles (créneaux, annulation, états), contrats API, mutations ciblées ; `typecheck`, `test:api`, `test:cloisonnement`, `build:api`, mobile `npm test` et `tsc` à 0 (`test:unit` : l'échec connu de `design.test.mts` est hors lot).
- **Essai de bout en bout** avant de dire « livré » : création, notification, lecture en base, sur le banc local ; aucune écriture chez barbie food sans oui distinct.

## 6. Hors périmètre et garde-fous

- **Aucun déploiement, aucune migration appliquée en production, aucun relais allumé** sans feu vert distinct de Malika. Les migrations M2 et R2 sont livrées en fichiers, testées sur une base locale ou de test.
- Pas d'acompte ni de paiement à la réservation, pas de gestion du plan de salle graphique, pas de liste d'attente : lots ultérieurs si Malika les veut.
- Kotlin n'est pas touché (inventaire B6).
- L'analyse du remboursement **n'est pas un avis juridique** : elle prépare celui du conseil.

## Journal
- 10 novembre : plan écrit après lecture du code ; en attente du oui de Malika sur les décisions par défaut du §3.
