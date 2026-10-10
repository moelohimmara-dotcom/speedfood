# Audit logique et sécurité — Speedfood

**État : partiel, 10 octobre 2026.** Aucune donnée, configuration, rôle ou commande n’a été modifié pendant l’audit.

## Risques majeurs

### Jetons de suivi présents dans les journaux Worker

La section 9 de `docs/cadrage/PROCEDURE-SECURITE.md` indique que les journaux Worker conservent les routes `/suivi/<jeton>` pendant sept jours. Le masquage de chaîne de requête ne couvre pas le chemin. Toute personne ayant accès à ces journaux peut donc accéder aux commandes en cours. Ce risque est documenté comme accepté le 7 octobre 2026, mais n’a pas été revalidé dans la console Cloudflare pendant cet audit.

### Absence de préproduction

La procédure décrit un seul Worker et une seule base Supabase. Une régression de commande, d’autorisation ou de contenu peut toucher directement les utilisateurs et les données de production.

## Constats authentifiés

Le compte fourni par le propriétaire a été utilisé en lecture seule. Il a accès à `/restaurant` pour « barbie food » et à `/system` comme super administrateur; le lien entre les deux consoles fonctionne.

- La double authentification est inactive alors que le compte privilégié peut accéder à des coordonnées de clients.
- Le tableau de bord indique 4 restaurants de test à nettoyer, contrairement à l’objectif de nettoyage avant pilote.
- 13 restaurants sont publiés, mais l’indicateur d’alertes de commande est à 0 / 13.
- « barbie food » est ouverte et accepte les commandes dans sa console, tout en restant non publiée : cette séparation est cohérente avec le TDR.

Ces constats ne prouvent pas l’isolation des rôles `operations`, `content_editor` et `support`, dont les comptes n’ont pas été fournis.

## Contrôles de qualité et code

- `npm ci` : réussi.
- `npm run typecheck` : échec bloquant dans `src/app/layout.tsx:99` — `LayoutProps` est introuvable.
- `npm run lint` : réussi avec 8 avertissements de variables inutilisées.
- `npm run test:unit` : réussi, y compris les suites disponibilité, redirection, alternatives, partage, IP, propositions, profil, paiement et Studio.
- `npm audit --offline --json` : aucune vulnérabilité dans les données locales; cette information diverge du résumé de `npm ci` et doit être revalidée par un audit réseau, sans `npm audit fix` automatique.

## Cohérence métier confirmée par lecture du code

Les montants GNF sont des entiers. La proposition révisée conserve une échéance et l’acceptation client est atomique côté base avant passage à `acceptee`. Le statut « attente de confirmation client » est dérivé d’une commande stockée `en_attente`.
