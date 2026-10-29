# Lot L4 — Support client par commande

## Décision
Le fil reste dans `/system`, rattaché à une commande. WhatsApp est un lien externe avec texte prérempli, sans envoi automatique. Les coordonnées restent masquées ; le numéro masqué est le seul contexte utilisé pour le lien. Répondre, résoudre et rouvrir demandent une confirmation navigateur et laissent une trace d'audit.

## Fichiers
- `src/lib/system-admin/support-regles.ts` : statuts, modèles, validation, lien WhatsApp.
- `src/lib/system-admin/support-service.ts` : lecture bornée à 100 messages.
- `src/lib/system-admin/support-actions.ts` : réponse, résolution/réouverture, permission `commande.support`, motifs et audit.
- `src/app/system/commandes/[id]/FilSupport.tsx` : fil, modèles, confirmations et lien WhatsApp.
- `src/app/system/commandes/[id]/page.tsx` : intégration du fil dans la fiche commande.
- `supabase/migrations/20261024170000_support_commandes.sql` : tables `support_threads` / `support_messages`, CHECK, RLS, grants.
- `scripts/faux-serveur-equipe-support.mjs` : données factices et routes mémoire.
- `scripts/tests/support.test.mts` : 6 tests purs.

## Vérifications
- `npm.cmd run typecheck` : OK.
- `npm.cmd run lint -- --quiet` : OK.
- `node --experimental-strip-types scripts/tests/support.test.mts` : 6/6 OK.
- `npm.cmd run test:unit` : les tests existants passent, puis le garde-fou des lectures signale 70 lectures déclarées ; le registre réservé n'a pas été modifié.
- `npm.cmd run test:cloisonnement` : non exécuté, PGlite absent (`supabase/rejeu` demande une installation de dépendances).
- Audit navigateur : non exécuté, aucune session navigateur disponible.
- Migration/RLS : écrites mais non appliquées à une base ; advisors non exécutés.

## Intégration réservée à l'orchestrateur
Dans `scripts/tests/lancer.mjs`, ajouter avec les autres tests de règles :
```js
copier("src/lib/system-admin/support-regles.ts");
copier("scripts/tests/support.test.mts");
```

Dans `src/lib/system-admin/actionsAuditConnues.ts`, ajouter au tableau `ACTIONS_AUDIT_CONNUES` :
```ts
"support.message",
"support.resolution",
"support.reouverture",
```
Puis dans `LIBELLES_ACTIONS_AUDIT` :
```ts
"support.message": "Réponse ajoutée au fil de support",
"support.resolution": "Fil de support marqué comme résolu",
"support.reouverture": "Fil de support rouvert",
```

Après fusion : appliquer la migration via le mécanisme versionné Supabase, vérifier les advisors de sécurité et exercer le parcours complet navigateur avec données factices.
