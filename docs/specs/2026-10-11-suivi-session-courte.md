# Suivi de commande par session courte

**Statut :** proposition technique prête pour implémentation locale
**Décision produit :** option 3 — ne plus faire transiter le secret de suivi dans le chemin des URLs nouvelles.

## Objectif

Les nouveaux liens de suivi ne doivent plus contenir le jeton d'accès dans le chemin HTTP. Le navigateur reçoit le jeton uniquement dans le fragment (`#`), que le navigateur n'envoie pas au serveur et qui n'apparaît donc pas dans l'URL de requête Cloudflare.

Le jeton est ensuite échangé une fois contre un cookie de session HttpOnly, puis l'URL est nettoyée.

## Nouveau parcours

1. Après création de commande, Speedfood compose `/suivi#<jeton>`.
2. Le navigateur lit le fragment localement ; le serveur ne le reçoit jamais.
3. Un `POST /api/suivi/session` transmet le jeton dans le corps HTTPS.
4. Le serveur valide le jeton et pose le cookie `speedfood_suivi`.
5. Le navigateur remplace l'URL par `/suivi` avec `history.replaceState`.
6. La page serveur `/suivi` lit exclusivement le cookie et charge la commande.
7. Les actions proposition/paiement et la page reçu lisent le même cookie côté serveur ; le jeton n'est plus fourni par les composants clients.

## Contrat HTTP

### `POST /api/suivi/session`

- Entrée JSON : `{ "jeton": string }`.
- Validation : chaîne de 40 caractères correspondant à `[A-Za-z0-9_-]{40}`.
- Succès : `204 No Content`, cookie `speedfood_suivi` posé.
- Cookie : `HttpOnly`, `Secure` en production, `SameSite=Lax`, `Path=/suivi`, durée maximale 24 heures.
- Erreurs : `400` si le corps ou le jeton est malformé ; `404` si le jeton ne correspond à aucune commande ; `429` si la limite d'échange est dépassée.
- Effets : aucune mutation métier ; aucune création de commande ; aucune écriture dans l'historique.
- Idempotence : répéter l'échange avec le même jeton remplace le cookie et reste sans effet métier.

### `GET /suivi`

- Entrée : cookie `speedfood_suivi` obligatoire, aucun secret dans le chemin ou la query string.
- Succès : rendu de la commande correspondant au cookie.
- Sans cookie ou cookie invalide : page 404 générique, sans distinction entre absent et inconnu.
- Effet : aucune mutation.

### `GET /suivi/recu`

- Entrée : cookie `speedfood_suivi`; query facultative `doc=facture` non secrète.
- Succès et erreurs : mêmes règles que `GET /suivi`.
- Les liens reçus/WhatsApp deviennent `/suivi/recu` ou `/suivi/recu?doc=facture` après établissement de session dans le même navigateur.

### Actions serveur

- `repondrePropositionAction(reponse)` lit le cookie côté serveur ; le jeton n'est plus un argument client.
- `declarerPaiementAction(payload)` lit le cookie côté serveur ; le jeton n'est plus un argument client.
- Toute absence ou invalidité de session renvoie `INTROUVABLE`, sans révéler si une commande existe.
- Les opérations restent idempotentes et limitées par les mêmes limiteurs existants.

## Compatibilité et migration

- Les URLs historiques `/suivi/<jeton>` restent acceptées pendant une période de transition.
- La route historique ne rend plus la commande : elle répond par une page minimale qui échange le jeton côté navigateur puis redirige vers `/suivi` nettoyé. Cette compatibilité est nécessaire pour les liens déjà envoyés.
- Aucun nouveau lien ne doit générer `/suivi/<jeton>`.
- Les URLs historiques restent une exposition résiduelle jusqu'à expiration naturelle des liens déjà envoyés ; elles doivent être retirées après la durée de conservation décidée.
- Les liens de reçu historiques `/suivi/<jeton>/recu` suivent la même compatibilité et redirigent vers `/suivi/recu` après échange.

## Sécurité

- Le cookie est limité à `/suivi` et ne doit jamais être envoyé aux consoles ou à des routes publiques sans rapport.
- Le jeton n'est jamais écrit dans les logs applicatifs.
- Les corps des requêtes POST ne doivent pas être journalisés.
- Les réponses 400/404/429 ne doivent pas différencier les commandes existantes des commandes inconnues sauf le `404` d'échange, qui reste générique côté texte.
- Le fragment n'est pas une protection suffisante en lui-même : l'échange HTTPS et le cookie HttpOnly sont obligatoires.
- La rotation de `COMMANDE_JETON_SECRET` continue d'invalider les liens ; elle doit rester documentée comme opération disruptive.

## Consommateurs à migrer

1. `src/app/commande/FormulaireCommande.tsx` — nouvelle URL `/suivi#jeton`.
2. `src/app/suivi/[jeton]/page.tsx` — route historique de compatibilité.
3. `src/app/suivi/[jeton]/recu/page.tsx` — route historique de compatibilité.
4. Nouvelle page `src/app/suivi/page.tsx` — lecture par cookie.
5. Nouvelle page `src/app/suivi/recu/page.tsx` — lecture par cookie.
6. `src/app/suivi/[jeton]/PropositionCarte.tsx` — action sans jeton client.
7. `src/app/suivi/[jeton]/PanneauPaiement.tsx` — action/liens sans jeton client.
8. `src/lib/commande/actions.ts` — lecture et validation de session serveur.
9. `src/lib/commande/requetes.ts` — conserver une primitive serveur par jeton, ajouter une primitive par session.
10. `src/app/restaurant/(console)/commandes/CommandeCarte.tsx` — liens générés par échange côté destinataire ; compatibilité à définir pour WhatsApp hors navigateur.
11. `src/app/restaurant/(console)/documents/page.tsx` — liens de document migrés ou marqués comme historiques.
12. `src/lib/paiement/documents.ts` — lecture par session pour les nouvelles routes.

## Point à trancher avant le code

Un lien WhatsApp ouvert sur un autre appareil ne partage pas le cookie du premier appareil. Pour conserver ce cas d'usage, le lien doit rester un lien historique `/suivi/<jeton>` ou utiliser un endpoint d'échange dédié ; dans les deux cas le jeton peut apparaître dans la première requête. La migration complète ne peut donc supprimer l'exposition des liens déjà envoyés ni garantir zéro exposition pour un lien secret ouvert sur un nouvel appareil sans introduire un code secondaire ou une authentification.
