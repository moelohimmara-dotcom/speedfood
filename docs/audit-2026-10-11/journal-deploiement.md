# Journal de Déploiement — Speedfood (11 octobre 2026)

Ce journal consigne de manière transparente et immuable toutes les actions critiques sollicitées, autorisées ou exécutées.

---

## Règles de gouvernance des actions critiques

Conformément à `CLAUDE.md` et `docs/cadrage/PROCEDURE-SECURITE.md` :
- **Tout déploiement Cloudflare en production**, modification de schéma SQL, changement de variables secrètes ou modification de données requiert une **autorisation préalable explicite** de Mo elohim.
- Aucun déploiement n'est exécuté sans présentation de :
  1. L'action exacte et la commande associée.
  2. L'effet attendu.
  3. La procédure de retour arrière (rollback).
  4. L'évaluation du risque.

---

## Historique des demandes et interventions

| Date & Heure | Action sollicitée | Statut | Résultat & Notes |
|---|---|:---:|---|
| **11/10/2026 - 02:50 UTC** | Vérification de connectivité HTTP (Production et Supabase) | **Autonome (Lecture)** | Production 200 OK, Supabase 401 Unauthorized (conforme). |
| **11/10/2026 - 02:52 UTC** | Contrôles qualité (`test:unit`, `tsc`, `lint`) | **Autonome (Lecture/Build)** | 100% succès (74 tests unitaires passés, 0 erreur TypeScript). |
| **11/10/2026 - 02:55 UTC** | Compilation Worker Cloudflare (`npm run cf:build`) | **Autonome (Build local)** | Build réussi. Bundle sauvegardé dans `.open-next\worker.js`. 33 tables vérifiées. |
| **11/10/2026 - 03:19 UTC** | Déploiement Cloudflare Worker (`npm run cf:deploy`) | **Autorisé par Mo elohim** | Version `c1d57245-d615-42fc-9480-6e4374e6a5ec` déployée. **Incident détecté : Erreur 1101 Cloudflare (Worker exception) lors du test HTTP post-déploiement**. |
| **11/10/2026 - 03:25 UTC** | Retour arrière d'urgence (`wrangler rollback 2379561d-...`) | **Exécuté d'urgence selon garde-fous** | **SUCCÈS**. Rétablissement immédiat de la version stable `2379561d-326b-499d-97e3-c4e5064a17ed`. Test `curl -I` vérifié en **HTTP 200 OK**. Production rétablie. |
| **11/10/2026 - 13:04 UTC** | Déploiement Cloudflare Worker corrigé (fenêtres de modération, erreurs visibles, chargement console) | **Autorisé par Mo elohim** | **SUCCÈS TOTAL**. Version **`137079a9-2fb2-4da0-a76b-6ad700925df0`** déployée depuis le commit `c0648d0`. Build Next.js réussi, 51 routes générées, assets uploadés. Test réel connecté de la fiche restaurant effectué ensuite : erreur de motif vide correctement conservée dans la fenêtre, aucune donnée métier modifiée. |

---

## Analyse post-incident et Diagnostic technique

- **Symptôme de l'incident (03:19 UTC) :** Le saut vers Next.js `16.4.0` sous Windows provoquait une exception non gérée sur `workerd` (code 1101), OpenNext 1.20.6 n'étant pas encore aligné sur les internes du serveur Next 16.4.
- **Résolution pérenne (03:35 UTC) :** Verrouillage strict de Next.js en version certifiée `16.3.6` et intégration ciblée des correctifs UI/UX :
  1. `.pub-pilule a` à `min-height: 44px` (WCAG 2.1).
  2. `<StampFraicheur>` sur tous les plats mis en avant dans `/restaurants`.
- **Statut final :** La production est en ligne, saine, rapide (démarrage Worker 30 ms), et conforme au design system.
