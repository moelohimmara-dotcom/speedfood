/**
 * Partie PURE de `scripts/verifier-base.mjs` : déduire, depuis les fichiers de `supabase/migrations/`, les tables du schéma
 * public que la base doit contenir. Testée par `scripts/tests/verifierbase.test.mts`. Syntaxe TypeScript « effaçable »
 * seulement (Node l'exécute directement).
 *
 * Règles : `create table [if not exists] [public.]nom` ajoute une table ; `drop table [if exists] [public.]nom` la retire ;
 * `alter table [only] [public.]a rename to b` la renomme. Les tables d'un autre schéma (auth, storage…) sont ignorées. Les
 * commentaires SQL (`--` et bloc) sont retirés avant l'analyse.
 */

export function retirerCommentaires(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** Nom de table du schéma public, ou `null` pour un autre schéma. Guillemets retirés, minuscules. */
function nomPublic(schema: string | undefined, nom: string): string | null {
  const s = schema?.replace(/"/g, "").toLowerCase();
  if (s && s !== "public") return null;
  return nom.replace(/"/g, "").toLowerCase();
}

const IDENT = String.raw`("?[A-Za-z_][A-Za-z0-9_]*"?)`;
const QUALIFIE = String.raw`(?:${IDENT}\s*\.\s*)?${IDENT}`;

/** Applique les instructions d'un fichier, dans l'ordre, à l'ensemble `tables` (modifié en place). */
export function appliquerMigration(tables: Set<string>, sql: string): void {
  const propre = retirerCommentaires(sql);
  const motif = new RegExp(
    String.raw`\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${QUALIFIE}` +
      String.raw`|\bdrop\s+table\s+(?:if\s+exists\s+)?${QUALIFIE}` +
      String.raw`|\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${QUALIFIE}\s+rename\s+to\s+${IDENT}`,
    "gi"
  );
  for (const m of propre.matchAll(motif)) {
    if (m[2] !== undefined) {
      const nom = nomPublic(m[1], m[2]);
      if (nom) tables.add(nom);
    } else if (m[4] !== undefined) {
      const nom = nomPublic(m[3], m[4]);
      if (nom) tables.delete(nom);
    } else if (m[6] !== undefined && m[7] !== undefined) {
      const ancien = nomPublic(m[5], m[6]);
      if (ancien && tables.delete(ancien)) tables.add(m[7].replace(/"/g, "").toLowerCase());
    }
  }
}

/** Tables attendues après toutes les migrations, appliquées dans l'ordre de leur nom (horodatage en tête). Triées. */
export function tablesAttendues(fichiers: readonly { nom: string; sql: string }[]): string[] {
  const tables = new Set<string>();
  for (const f of [...fichiers].sort((a, b) => a.nom.localeCompare(b.nom))) appliquerMigration(tables, f.sql);
  return [...tables].sort();
}

/**
 * Lecture de vérification d'une table : absente si PostgREST répond « table introuvable » (PGRST205, ou 42P01 côté
 * Postgres) ; présente si la lecture réussit OU si elle est refusée par les droits (la table existe) ; sinon `inconnu`
 * (réseau, clé invalide…) : l'appelant échoue alors par prudence.
 */
export function etatTable(erreur: { code?: string | null } | null | undefined): "presente" | "absente" | "inconnu" {
  if (!erreur) return "presente";
  if (erreur.code === "PGRST205" || erreur.code === "42P01") return "absente";
  if (erreur.code === "42501") return "presente";
  return "inconnu";
}
