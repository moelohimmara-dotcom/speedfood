# Volumes : lectures bornées, pagination, garde-fou

Version 0.1 — 18 octobre 2026.

## 1. Le piège

L'API de la base plafonne chaque réponse à **1 000 lignes, sans erreur**. Une lecture « toute la table » rend donc, un jour, une liste **amputée en silence** : des plats qui disparaissent du catalogue, une couverture fausse, un export incomplet. Les volumes du pilote sont très loin de ce plafond (au 18 octobre 2026 : 20 restaurants, 71 plats, 471 quartiers, 348 communes), mais le jour où l'on s'en approche, rien ne prévient.

## 2. La règle

**Toute lecture de base est soit bornée, soit paginée jusqu'au bout, soit déclarée avec sa raison.**

| Cas | Outil |
|---|---|
| Liste qui doit être complète (catalogue, couverture, exports, agrégats, listes d'administration) | `lireTout((de, a) => requete.order(...).order("id").range(de, a), plafond)` (`src/lib/db/lecture-complete.ts`) : enchaîne les pages de 1 000 jusqu'à la dernière ; si le plafond de sécurité est atteint, **le dit** (`tronque`, journal `lecture_tronquee`) |
| Liste d'écran qui n'a pas à tout montrer | `.limit(n)` + comptage (`count: "exact", head: true`) pour « voir plus » |
| Lecture d'UNE ligne | `.maybeSingle()` / `.single()` |
| Table de référence minuscule, ou lecture bornée par construction | Déclarée dans `scripts/requetes-non-bornees.json` avec sa raison |

Le constructeur donné à `lireTout` doit trier de façon **stable et unique** (`.order("id")` en dernier), sinon deux pages peuvent se chevaucher ou omettre une ligne.

## 3. Le garde-fou

`scripts/verifier-requetes.mjs`, lancé par `npm run test:unit`, parcourt tout `src/` et **échoue** si une lecture `.from("table").select(...)` n'est ni bornée ni déclarée. Une entrée devenue inutile, ou sans raison de 15 caractères au moins, fait aussi échouer le contrôle : la liste reste honnête. Vérifié : l'ajout d'une lecture non bornée fait bien échouer le contrôle. `npm run test:unit` : lecteur par pages testé (`pagination.test.mts`).

## 4. Ce qui a été corrigé le 18 octobre 2026

| Endroit | Avant | Après |
|---|---|---|
| Commandes du restaurant (`chargerApercusCommandes`) | **Toutes** les commandes du restaurant, avec leurs lignes, à chaque rafraîchissement (alertes toutes les 15 s), filtrées en mémoire | Deux lectures bornées : les commandes à traiter (plafond 500) et un historique limité (20 par défaut, jusqu'à 500 par pas) ; tableau de bord : seulement les deux dernières périodes ; total de l'historique par simple comptage |
| Catalogue public | 500 restaurants et 2 000 plats puis coupure silencieuse | Pages de 1 000 jusqu'à la fin (plafonds de sécurité 5 000 / 30 000, signalés) ; mémorisé par requête |
| Signaux de classement | `.in(id, …)` avec **tous** les identifiants (adresse trop longue au-delà de quelques centaines) | Lecture paginée puis filtre local |
| Couverture, géographie, liste d'attente, export CSV, illustrations, listes de restaurants et de livreurs, alertes de notation, zones publiques | Plafonnées en silence à 1 000 | Paginées (l'export de la liste d'attente refuse explicitement un volume trop gros plutôt que de s'amputer) |
| Salle du restaurateur | Deux requêtes par table | Deux requêtes au total |

## 5. Limites connues

- `fn_frequentation_restaurants` (fonction SQL appelée par le classement) renvoie une ligne par restaurant ayant des commandes : plafonnée à 1 000 par l'API. À reprendre (agrégat côté base ou appel paginé) avant 1 000 restaurants actifs.
- Le catalogue public se filtre encore **en mémoire** après lecture complète : au-delà de quelques milliers de restaurants, il faudra filtrer par zone côté base.
- Les mises à jour avec `.select()` renvoient au plus 1 000 lignes : un compte « N supprimés » d'une opération de masse peut être sous-évalué (l'opération, elle, porte sur toutes les lignes).
- Cloudflare limite le nombre de sous-requêtes par appel (50 en offre gratuite d'après la documentation consultée, offre non vérifiée). Les pages de 1 000 lignes les ménagent ; la Salle est à deux requêtes.
