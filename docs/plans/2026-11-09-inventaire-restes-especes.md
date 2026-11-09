# Inventaire des restes de paiement en espèces — 9 novembre 2026

> **Inventaire seulement : aucun code, aucune migration, aucune donnée modifiés.** Règle produit de Malika (3 novembre 2026) : Speedfood ne manipule jamais d'espèces, tout paiement passera par Chap Chap Pay. Les modes « code marchand » (Orange Money, MTN MoMo) restent provisoires jusqu'à l'ouverture de Chap Chap Pay. Recherche faite dans `apps/*/src` et `packages/*/src` (95 occurrences, 26 fichiers), `supabase/migrations/` et `mobile/` (Kotlin).

## Constat décisif : la base ne contient aucun usage des espèces

Requêtes de lecture seule sur la base (9 novembre 2026) :

| Contrôle | Résultat |
|---|---|
| Commandes avec `paiement_mode = 'especes'` | 0 |
| Commandes avec `paiement_statut = 'especes'` (dont en cours) | 0 (0) |
| Restaurants dont `moyens_paiement` contient `especes` | 0 |
| Restaurants dont les espèces sont le seul moyen | 0 |
| Remboursements manuels en espèces | 0 |

Conséquence : aucun historique à préserver côté données. La compatibilité de lecture « anciennes commandes en espèces » ne protège aujourd'hui aucune ligne réelle ; elle protège seulement d'une réintroduction. Les lignes de test et les copies ailleurs (autres bases, sauvegardes) n'ont pas été examinées.

## Classement

### A. Déjà neutralisé (ne rien faire)
Les espèces ne sont ni proposées ni acceptées dans ces chemins, avec des tests :
- `packages/shared/src/paiement/regles.ts` : les options proposées excluent les espèces (lignes 51-52).
- `apps/web/src/lib/commande/declaration-paiement.ts:29` : déclaration en espèces refusée (`VALIDATION`).
- `apps/web/src/lib/restaurant/paiement.ts:13-16` : `MOYENS_SAISISSABLES` exclut les espèces ; `:33` plus d'affichage public.
- `apps/web/src/lib/paiement/affichage-suivi.ts:10-12` : options filtrées.
- Appli Expo : `connexion/client.ts:143` (refus avant réseau), `reglement.ts:69,83,94` (filtre et refus), `restaurateur.ts:192,260-268` (aucun libellé, aucune confirmation d'espèces).

### B. Reste ACTIF : le produit peut encore créer ou accepter des espèces (à décider)
| # | Où | Ce qui reste actif | Recommandation |
|---|---|---|---|
| B1 | `apps/web/src/lib/referencement/candidature.ts:13` ; `supabase/migrations/20261026081154_candidatures_application.sql:9` | `MOYENS_PAIEMENT` d'une candidature de restaurant contient `especes` ; la contrainte SQL l'accepte. | Retirer `especes` du choix proposé aux candidats (code), garder la contrainte SQL telle quelle jusqu'à une migration validée. |
| B2 | `apps/web/src/lib/system-admin/profil-pre-remplissage.ts:18,24,26` | Option « Espèces uniquement » et « tous » incluant les espèces dans le pré-remplissage d'un profil de restaurant par l'administration. | Retirer l'option « Espèces uniquement » ; « tous » devient mobile money seulement. |
| B3 | `apps/web/src/lib/table/regles.ts:61-65` | `MODES_REGLEMENT` de la commande à table propose « Espèces » (commande sur place, ardoise). | À arbitrer : la commande sur place est-elle concernée par la règle ? (voir D1) |
| B4 | `apps/web/src/lib/paiement/en-ligne/remboursement-manuel.ts:4-50` ; `app/system/paiements/ActionsPaiement.tsx:77-85` ; `lib/system-admin/paiements.ts:73-83` | Un super administrateur peut **rembourser un client en espèces** (dernier recours, nom du receveur et motif ≥ 15 caractères). | Décision de Malika : c'est de l'argent manipulé hors Chap Chap Pay (voir D2). |
| B5 | `apps/web/src/lib/system-admin/actionsAuditConnues.ts:182` | Libellé d'audit « mobile money ou espèces ». | Suit B4. |
| B6 | Kotlin : `mobile/shared/.../data/{Aide,Candidature,Restaurateur}.kt` | L'appli Kotlin (encore en service) cite ou gère les espèces. | À traiter au moment du remplacement par Expo, pas avant (ne pas toucher Kotlin ici). |

### C. Lecture de l'historique (aucune ligne aujourd'hui, à garder tant que le SQL l'accepte)
- Types et analyseurs : `packages/shared/src/paiement/regles.ts:10-11,26,75-79`, `apps/web/src/lib/commande/requetes.ts:68,72`, `apps/web/src/lib/client/espace.ts:35`, `apps/mobile/src/connexion/restaurateur.ts:69-73`, `reglement.ts:8-10`.
- Affichages en lecture seule : `app/suivi/[jeton]/PanneauPaiement.tsx:247-251`, `app/suivi/[jeton]/recu/page.tsx:63,137`, `app/restaurant/(console)/commandes/CommandeCarte.tsx:260,291-293`.
- Illustrations « especes » : `apps/web/src/components/illustrations/sujets.tsx:8,43` et `apps/mobile/src/design/IllustrationSujet.tsx:11,48` (dessin d'une pièce, sans effet métier).
- Contraintes SQL qui acceptent encore `especes` : `20261004035410_moyens_paiement.sql:5`, `20261005171122_paiement_code_marchand.sql:54-55`, `20261018180000_commande_a_table_ardoise.sql:26`, `20261021090000_paiement_en_ligne.sql:311`, `20261025225248_remboursements_manuels.sql:9,18-19`, `20261026081154_candidatures_application.sql:9`.

## Proposition de nettoyage, en lots séparés (rien n'est exécuté)

1. **N1 — code seulement, sans migration :** retirer les espèces des choix actifs B1 et B2 (et B3 si Malika confirme que la commande sur place est concernée) ; mettre à jour les tests ; relancer les suites. Aucun risque de données : zéro ligne concernée.
2. **N2 — remboursements (B4/B5) :** selon la décision D2 (garder le « dernier recours », le réserver, ou le supprimer).
3. **N3 — migration SQL optionnelle** (retirer `especes` des contraintes), **seulement** après N1, après relecture des contraintes, avec le fichier de migration dans le même commit (règle du dépôt) et `get_advisors(type: "security")` ensuite. Reporter tant qu'une lecture d'anciennes lignes dans d'autres environnements n'est pas écartée.
4. **N4 — Kotlin (B6) :** pas avant le remplacement de l'appli.
5. **Après l'ouverture de Chap Chap Pay :** retirer aussi les modes « code marchand » (décision séparée, voir `docs/CHAPCHAP-NOTES-API.md`, `docs/STRATEGIE-PAIEMENT.md`).

## Décisions demandées à Malika

- **D1 :** la commande sur place (à table, ardoise) suit-elle aussi la règle « pas d'espèces » ? Si oui, B3 est retiré dans N1.
- **D2 :** le remboursement d'un client en espèces par le propriétaire (dernier recours) est-il supprimé, conservé, ou remplacé par « aucun remboursement hors Chap Chap Pay » ?
- **D3 :** valider N1 comme premier lot (code seulement, aucune donnée touchée).
