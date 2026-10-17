# Tests de cloisonnement entre restaurants

**Version :** 0.1, 17 octobre 2026

## À quoi ça sert

Prouver, à chaque modification de la base, qu'un restaurant ne voit ni ne modifie les données d'un autre, qu'un client ou un visiteur anonyme ne voit rien de privé, et qu'une fonction privilégiée ne fuit pas quand le mauvais appelant s'en sert. Avant ces tests, ce cloisonnement n'était vérifié que par relecture (revue indépendante du 17 octobre : « aucune fuite trouvée », mais « tests avec de vrais jetons non vérifiés »).

## Comment

```bash
npm run test:cloisonnement
```

Prérequis, une seule fois : `cd supabase/rejeu && npm ci` (le même outil que `npm run export:verifier`). Durée : environ 15 secondes.

Les 80 fichiers de `supabase/migrations/` sont rejoués sur une base PostgreSQL jetable en mémoire (PGlite). Cinq faux comptes y sont créés (restaurateur A, restaurateur B, client, administrateur, support) avec deux restaurants publiés et un non publié, des plats, des commandes, des lignes, des propositions, des abonnements, etc. Chaque contrôle se connecte « en tant que » un de ces comptes avec le rôle `anon` ou `authenticated` et l'identité lue par les policies (`request.jwt.claims`), comme le fait l'API de Supabase.

**Rien n'est touché en production** : aucun compte réel, aucune clé, aucun réseau.

## Ce qui est vérifié (103 contrôles)

1. **Lecture** : pour chaque table privée rattachée à un restaurant (commandes, lignes, historique, propositions, abonnements push, code marchand, identité, scans), A voit ses lignes (garde-fou contre un test creux), jamais celles de B ; B jamais celles de A ; un client connecté et un anonyme ne voient rien.
2. **Publié / non publié** : l'anonyme voit les restaurants publiés et leur menu, pas les autres ; un restaurateur voit son restaurant non publié, pas celui d'un autre ; l'administrateur voit tout.
3. **Écriture** : A ne peut ni modifier, ni supprimer, ni créer, ni déplacer vers B (plats, commandes, historique, propositions, fiche, membres, zones) ; personne ne peut s'attribuer un rôle système ; l'anonyme n'écrit nulle part.
4. **Double authentification** : un compte qui a activé la 2FA perd ses droits en session au mot de passe seul (aal1) et les retrouve en aal2.
5. **Fonctions privilégiées** (`SECURITY DEFINER`, ouvertes aux comptes connectés) : appelées par un mauvais appelant avec des arguments visant B, elles refusent ou ne renvoient rien de B ; des **contrôles positifs** (le support, l'administrateur) prouvent que les refus ne viennent pas d'une erreur d'appel.
6. **Gardes structurelles** : toutes les tables du schéma public ont la RLS ; aucune policy ouverte à tous hors catégories et quartiers ; aucune fonction privilégiée pour l'anonyme ; **toute nouvelle fonction privilégiée ouverte aux comptes connectés fait échouer le test** tant qu'elle n'est pas déclarée dans `definerConnu` (et testée).

Le test a été vérifié à l'envers : en ajoutant volontairement une policy `using (true)` sur les commandes, une policy de modification ouverte sur le menu et une fonction privilégiée non déclarée, 10 contrôles échouent.

## Ce que ça ne prouve pas

- Les **jetons réels** de Supabase Auth et le passage par l'API (PostgREST) : les identités sont simulées dans la base. C'est équivalent pour les policies, pas pour la validation des jetons elle-même.
- Les **routes serveur** qui utilisent la clé de service (qui contourne la RLS) : leur propre contrôle d'accès est du code applicatif, à relire (revue du 17 octobre) et non couvert ici.
- Le **stockage** (fichiers : politiques de seaux), la configuration de Supabase Auth, les droits `GRANT` hors ceux rejoués par les migrations.
- La **concurrence** (deux requêtes simultanées).
- PGlite est PostgreSQL 18 ; la production est 17.

## Quand le lancer

Après toute migration touchant une table, une policy ou une fonction, et avant un déploiement qui en dépend. À brancher dans une intégration continue si elle existe un jour (ce n'est pas le cas aujourd'hui).
