# Rejeu des migrations sur une base jetable

Vérifie que les fichiers de `supabase/migrations/` **reconstruisent bien la base** et que le résultat est identique à la production. Sans Docker, sans compte, sans coût : PGlite est un vrai PostgreSQL compilé en WebAssembly qui tourne en mémoire dans Node. Ce dossier est autonome (son propre `package.json`) : ce n'est pas une dépendance de l'application.

```bash
cd supabase/rejeu
npm install
npm run rejeu
```

Le script rejoue chaque fichier dans l'ordre (arrêt à la première erreur) puis affiche une signature du schéma `public` (tables, colonnes, contraintes, index, policies RLS, triggers, fonctions).

**Comparer à la production :** exécuter le contenu de `signature.sql` sur la base de production (par exemple avec l'outil `execute_sql`) et comparer les sept lignes. Des hachages identiques signifient un schéma identique.

**À faire après chaque migration** (le dépôt doit toujours pouvoir reconstruire la base).

## Limites connues (à ne pas oublier en lisant « identique »)

- PGlite est PostgreSQL 18 ; la production est PostgreSQL 17. Les contraintes `NOT NULL` sont donc exclues de la comparaison.
- Les éléments propres à Supabase sont remplacés par des bouchons minimaux : rôles `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`, `storage.buckets`. La fonction `rls_auto_enable` (fournie par Supabase) est exclue. L'extension `pgcrypto` n'existe pas dans PGlite et est ignorée (`gen_random_uuid()` est natif).
- **Ne sont pas comparés :** les droits (`GRANT`/`REVOKE`) sur les fonctions et tables, le contenu des tables (aucune donnée), les objets du stockage, la configuration de Supabase Auth.
- Les corps de fonctions sont comparés sans commentaires, fins de ligne ni espaces.
