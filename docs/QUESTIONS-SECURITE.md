# Questions de sécurité (facultatives)

**Version :** 0.1, 17 octobre 2026. **Statut : migration appliquée en production le 17 octobre 2026 (alertes de sécurité relues : rien d'inattendu) ; **code déployé le 17 octobre 2026 (version `ff565497`) ; porte de secours, blocage, désactivation et retrait administrateur non joués.**

## Ce que c'est, et ce que ce n'est pas

Une **barrière d'application** en plus du mot de passe, **facultative**, pour tout compte (restaurateur ou administrateur) : deux questions personnelles posées une fois par session avant d'entrer dans `/restaurant` ou `/system`.

**Ce n'est pas une double authentification au sens de Supabase.** Elle ne produit pas de session renforcée (aal2) : quelqu'un qui connaît le mot de passe et appelle **directement l'API de données** ne la rencontre pas. Seule l'application d'authentification (TOTP, `docs` du 3 octobre) protège ce cas, car elle est vérifiée dans la base. Les deux sont facultatives ; si le compte a activé l'application d'authentification, une session renforcée entre sans répondre aux questions.

Décision de la propriétaire le 17 octobre 2026 : les deux voies existent, facultatives, avec porte de secours. L'obligation pour les rôles système (recommandée par la revue indépendante) n'est **pas** retenue à ce jour.

## Fonctionnement

- **Questions** : deux choisies dans une liste fermée de 10 (`src/lib/auth/questions.ts`). Les clés sont stockées, pas les libellés.
- **Réponses** : jamais stockées en clair. Une seule empreinte PBKDF2-SHA256 (100 000 itérations, plafond de Cloudflare Workers) calculée sur les deux réponses normalisées (casse, accents, ponctuation et espaces ignorés), avec un sel propre au compte. Les messages d'erreur ne disent pas quelle réponse est fausse.
- **Essais** : 5 erreurs de suite bloquent 15 minutes (compteur remis à zéro au blocage), inscrit dans l'audit (`securite.questions_blocage`).
- **Session** : après une bonne réponse, la session (identifiant `session_id` du jeton) est marquée valide 12 heures dans `securite_questions_sessions`. Une nouvelle connexion redemande les réponses.
- **Porte** : `src/proxy.ts` redirige vers `/connexion/questions` ; chaque page restaurant (`obtenirContexteRestaurant`) et chaque action système (`chargerContexteSysteme`) le revérifient. Si la base ne répond pas correctement, l'accès est refusé (sauf si la fonction n'existe pas encore : migration non appliquée, personne n'est enfermé dehors).
- **Où** : tables `securite_questions`, `securite_codes_secours`, `securite_questions_sessions` (RLS sans policy, droits retirés : seul le serveur à clé de service y accède) et fonction `fn_questions_etat()` (migration `20261017150000_questions_securite.sql`). Écrans : `/compte/securite` (activer, modifier, nouveaux codes, désactiver) et `/connexion/questions`.

## Porte de secours (oubli des réponses)

1. **Codes de secours** : 8 codes à usage unique `XXXXX-XXXXX`, affichés **une seule fois** à l'activation ; seule leur empreinte est stockée. Un code remplace les réponses pour la session ; la page de sécurité invite ensuite à redéfinir les questions ou à régénérer des codes.
2. **Un administrateur système (super_admin)** peut retirer les questions d'un **autre** compte : `/system/acces/comptes`, bouton « Questions oubliées », avec la manière dont l'identité a été vérifiée (obligatoire, inscrite dans l'audit). Cela ne touche ni au mot de passe ni à l'application d'authentification.
3. **Le seul super administrateur lui-même**, s'il perd réponses **et** codes : retrait direct en base, par une personne qui a accès à Supabase (voir `PLAN-INCIDENT.md`). Vérifier l'identité avant de le faire, noter l'heure et le motif dans le journal d'incident.

```sql
-- À exécuter dans l'éditeur SQL de Supabase, en remplaçant l'identifiant du compte concerné.
delete from public.securite_questions_sessions where utilisateur_id = '<identifiant>';
delete from public.securite_codes_secours where utilisateur_id = '<identifiant>';
delete from public.securite_questions where utilisateur_id = '<identifiant>';
```

## Tests

- `npm run test:unit` : normalisation, empreintes, codes, essais et blocage (`scripts/tests/questions.test.mts`).
- `npm run test:cloisonnement` : les trois tables sont illisibles et non modifiables par l'API pour tout le monde sauf le serveur ; l'état d'un compte ne montre ni sel ni empreinte ; la validation d'une session ne profite pas à un autre compte ; expiration ; aal2.
- **Joué à la main le 17 octobre 2026** (compte de test `+test1`, serveur local, base de production) : inscription (mot de passe de 12 caractères exigé), confirmation, activation des questions (8 codes, 1 empreinte, 1 trace d'audit en base), arrêt par la porte sur `/restaurant`, mauvaises réponses refusées, bonnes réponses acceptées malgré majuscules, accents et espaces.
- **Pas encore joué** : code de secours (usage unique, refus du second usage), blocage après 5 erreurs, régénération des codes, désactivation, retrait par un super administrateur (`/system/acces/comptes`). Tant que ce n'est pas fait, ne pas présenter la porte de secours comme éprouvée. Le compte de test `moelohimmara+test1@gmail.com` existe encore : à supprimer depuis `/system/acces/comptes` après ces essais.

## Limites assumées

Questions personnelles : leurs réponses peuvent se deviner ou se retrouver (réseaux sociaux, proches). C'est pourquoi la liste est fermée, que les essais sont limités et que la page le dit clairement. Le coût de calcul (PBKDF2, environ 50 ms) ne s'applique qu'à l'activation et à la saisie des réponses, pas à chaque requête.
