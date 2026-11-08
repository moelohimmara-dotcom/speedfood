# Correctif I2 — ordre d'application serveur des appareils (retrait daté par session), 8 novembre 2026

## État

**Code, migration en fichier et tests prêts, NON déployés et migration NON appliquée.** Ce lot ferme la partie « protocole » du résidu I2 du lot cycle de session (voir REGISTRE-CORRECTIONS-APPLI-EXPO.md) : le serveur n'applique plus les écritures des appareils dans le seul ordre d'arrivée réseau. La preuve complète sur serveur réel exige l'application de la migration et un nouveau déploiement de l'API et du site, sur feux verts distincts. La déconnexion réelle sur l'émulateur reste NON vérifiée (session conservée par décision de Malika).

## Le défaut corrigé

Avant ce lot : `retirerAppareil` supprime la ligne de l'appareil et `enregistrerAppareil` fait un upsert sur le jeton. Un POST d'enregistrement parti avant la déconnexion (ou retardé par le réseau) pouvait donc être appliqué APRÈS le retrait et réattacher l'appareil à un compte déconnecté — notifications reçues après déconnexion, ou vol du jeton au profit de l'ancien compte si un autre compte s'est connecté entre-temps. Les gardes du cycle de session garantissaient l'ordre d'ÉMISSION côté client, pas l'ordre d'APPLICATION côté serveur. Un `AbortController` ne peut pas rappeler un POST déjà parti.

## Le protocole

- Le jeton d'accès Supabase porte déjà l'identifiant de sa session (`session_id`). Aucun changement de contrat ni de l'application mobile : le serveur lit la session dans le jeton déjà vérifié (signature vérifiée en local, ou jeton confirmé par le service d'authentification pour le mode strict ; jamais depuis le corps).
- Au retrait, le serveur supprime l'appareil ET écrit une trace : compte, empreinte SHA-256 du jeton d'appareil (jamais le jeton lui-même), session retirée (nouvelle table `appareils_push_retraits`, réservée à la clé de service, sans policy, comme `appareils_push`).
- À l'enregistrement, décision pure partagée (`deciderRattachement`, dans `@speedfood/shared/contracts/appareils`) :
  - même session que la session retirée → **refusé** (l'écriture tardive du résidu) ;
  - autre session (vraie reconnexion) → accepté et la trace est consommée ;
  - pas de trace → accepté ;
  - session non identifiable → accepté sans consommer (comportement historique, limite assumée : la garde ne s'applique qu'aux sessions identifiables ; les clients actuels en portent toujours une).
- Panne de lecture de la trace pendant un enregistrement → échec propre (faux), jamais de réattachement douteux ; l'application réenregistrera à sa prochaine ouverture.

## Fichiers

| Fichier | Changement |
|---|---|
| `packages/shared/src/contracts/appareils.ts` | Décision pure `deciderRattachement` et son contrat documenté |
| `supabase/migrations/20261108220000_appareils_push_retraits.sql` | Table des traces (fichier seulement) |
| `apps/web/src/lib/push/appareils.ts` | Garde à l'enregistrement, trace au retrait, empreinte du jeton |
| `apps/web/src/lib/api/v1.ts` | `utilisateurDuJeton` rend aussi la session du jeton authentifié |
| `apps/web/src/app/api/v1/appareils/route.ts`, `retirer/route.ts` | Transmission de la session au service |
| `apps/api/src/identite/jeton.ts` | Vérificateurs : la session du jeton est rendue (posée seulement si présente) |
| `apps/api/src/controles/chaine.ts`, `src/types.ts`, `src/routes/appareils.ts`, `src/appareils/cablage.ts` | La session traverse la chaîne jusqu'au service, compte toujours du Bearer |
| `apps/api/tests/appareils-protocole.test.ts` | 7 tests du protocole (décision pure + passage par les routes) |
| `apps/api/tests/appareils-routes.test.ts`, `appareils-cablage-source.test.ts` | Périmètre revu pour la nouvelle signature et la seconde table |

Classification d'interface : élargissement interne (paramètre `sessionId` requis) — tous les appelants inventoriés et migrés dans le même lot (service du site, ses deux routes, câblage et routes de l'API, routes du site) ; aucun ancien chemin ne subsiste (`typecheck` racine à 0 le prouve). Aucun changement du contrat HTTP des appareils : mêmes chemins, corps et réponses.

## Contrôles du 8 novembre

Rouge d'abord : le nouveau fichier de tests échoue (fonction absente), 661 tests existants verts. Après le correctif :

| Contrôle | Résultat |
|---|---|
| `npm run test:api` | **668/668, code 0** (661 + 7 du protocole) |
| `npm run typecheck` (racine, tous les espaces) | code 0 |
| `npm run test:unit` | code 0 |
| `npm run test:cloisonnement` | 489 contrôles, code 0 |
| `npm run build:api` | code 0 ; 1 260 Kio |
| Rejeu des migrations (`supabase/rejeu`) | **120/120 sans erreur**, nouvelle table incluse |

Un incident de parcours, corrigé : une réécriture de fichier de test par script a corrompu son encodage (accents), restauré depuis Git puis réédité proprement (diff final du fichier : 5 lignes). Une première erreur de type (session posée à `undefined` contre une comparaison stricte existante) a été corrigée en ne posant la session que lorsqu'elle existe.

## Limites et suite

- Preuve d'interface et de décision, pas encore de preuve serveur réelle : la migration n'est pas appliquée et rien n'est déployé. Après application + déploiements (API et site, feux verts distincts), relancer `get_advisors` comme l'exige CLAUDE.md pour toute migration, puis simuler en réel : enregistrement, déconnexion, réémission tardive de la même session (refus attendu), reconnexion (acceptation attendue).
- La déconnexion réelle sur l'émulateur reste à vérifier avec l'accord de Malika (elle détruirait la session conservée) ; sur téléphone physique également.
- Les retraits sans session identifiable ne laissent pas de trace : limite acceptée pour les anciens jetons, documentée dans le contrat partagé.
- Retour arrière : redéployer les versions précédentes de l'API et du site ; la table nouvelle peut rester en place inutilisée, ou être supprimée par une migration ultérieure si le protocole est abandonné.

## Mise en service du 8 novembre 2026 (partielle : API)

Sur instruction de Malika de poursuivre la fermeture, après le commit ac386f0 :

- **Migration appliquée** : `supabase migration list` ne montrait qu'une seule migration en attente ; `supabase db push --linked` a appliqué `20261108220000_appareils_push_retraits.sql`, rien d'autre.
- **Audit de la table (équivalent catalogues de get_advisors, l'outil d'audit n'étant pas disponible dans cette session)** : RLS activée, 0 policy, aucun droit pour `anon` ni `authenticated`. Le passage par le vrai `get_advisors` du dashboard reste possible pour Malika.
- **API déployée** : version `f8ddc3bb-76d7-4aae-8514-c6f6b2bd904c` à 100 % (retour arrière : `652d227e`, celle de G1). Contrôles publics : catalogue 200, version 200, fiche livreur sans jeton 401, appareils sans jeton 401 et avec jeton invalide 401.
- **Site NON redéployé** : son script `cf:deploy` lit `.env.local` (clé de service), ce que l'agent ne fait jamais ; le déploiement du site reste l'action de Malika (`npm run cf:deploy` depuis `apps/web`). En attendant, les routes appareils du site gardent l'ancien comportement compilé ; l'application native, vrai client des appareils, passe par l'API à jour.
- **Preuve serveur réelle du protocole encore à faire** : elle suppose un retrait réel, donc la déconnexion de la session conservée de l'émulateur (accord distinct de Malika) ou un appareil de test dédié. Le scénario attendu est écrit dans le corps du document.
