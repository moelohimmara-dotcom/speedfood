# Essais de concurrence en écriture

**Version :** 0.1, 19 octobre 2026

## À quoi ça sert
Les tests de cloisonnement (`npm run test:cloisonnement`, PGlite) n'ont qu'une seule connexion : ils ne peuvent pas prouver ce qui se passe quand deux personnes écrivent **en même temps**. Cet outil rejoue les migrations sur un **vrai PostgreSQL 17 jetable** et lance des transactions réellement simultanées sur des connexions distinctes. Rien ne touche la production.

## Comment
```bash
cd supabase/concurrence && npm ci      # une fois : télécharge environ 100 Mo (embedded-postgres 17, depuis npm)
cd ../.. && npm run test:concurrence   # environ 1 minute
```
Les données temporaires sont écrites dans le dossier temporaire du système et supprimées à la fin.

## Ce qui est vérifié (13 contrôles)
1. **Moyenne des avis** : 10 puis 30 avis simultanés sur un restaurant, le total et la somme affichés égalent la réalité.
2. **Numéro d'appel au comptoir** : 5, 10, 25, 50, 100 commandes simultanées, aucune perdue, tous les numéros différents (fonction `fn_attribuer_numero_appel`) ; le compteur repart après les numéros déjà pris dans la journée. L'ancien algorithme est rejoué pour mémoire.
3. **Ouverture de table** : 5 et 20 convives qui scannent ensemble, une seule session pour tous.
4. **Transitions de commande** : 30 courses « accepter / refuser » sur la même commande, la base n'en accepte qu'une.
5. **Rattachement d'une commande sans compte** : 20 commandes × 10 comptes simultanés, exactement un gagnant.
6. **Double envoi d'un avis** : jamais deux avis pour la même commande.

## Ce qu'ils ont trouvé le 19 octobre 2026 (corrigé par la migration `20261019100050`)
- **Totaux d'avis faux** : 30 avis simultanés affichaient un total de 2 (le dernier à écrire écrasait les autres) ; le total restait faux jusqu'à l'avis suivant. Correction : verrou `FOR NO KEY UPDATE` sur la ligne du restaurant avant le recalcul. Un premier essai avec `FOR UPDATE` provoquait des interblocages (28 insertions sur 30 échouées) : le verrou de clé étrangère pris par l'insertion entre en conflit.
- **Commandes perdues au comptoir** : 5 commandes simultanées en perdaient 2, 10 en perdaient 7, 50 en perdaient 44 (lire le dernier numéro, ajouter 1, insérer, trois essais). Correction : compteur par restaurant et par jour incrémenté de façon atomique.

## Ce que ça ne prouve pas
- La couche applicative (routes serveur, PostgREST, clé de service) : on exerce la base, pas le code TypeScript. La charge sur le Worker est mesurée à part (`docs/REVUE-2026-10-19.md` §1).
- Les conflits sur la **livraison** (attribution à un livreur, offres), le **paiement**, les **propositions de prix** et le stockage de fichiers : non couverts.
- PostgreSQL 17.10 local contre la version de la production (rôles Supabase remplacés par des bouchons, comme pour le rejeu).
