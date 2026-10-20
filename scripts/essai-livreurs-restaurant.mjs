// Essai sur la VRAIE base des liens d'activation des livreurs d'un restaurant (lot 3 du module livreurs, docs/LIVRAISON-LIVREURS-V2.md).
//
// Prouve ce que les tests unitaires ne prouvent pas : que `genererLien` et `fichePourJeton` (lectures imbriquées livreur → restaurant,
// écritures d'invitation) fonctionnent contre la vraie base, et que le cloisonnement par restaurant tient. N'active AUCUN compte (cela
// exigerait de créer un compte) : l'activation elle-même est couverte par les règles pures testées. Données de test créées et supprimées
// à la main (voir docs/LIVRAISON-LIVREURS-V2.md §14) ; aucun secret n'est affiché.
//
// Usage : node scripts/essai-livreurs-restaurant.mjs <restaurantA> <restaurantB> <livreurA> <livreurB> <livreurGroupeCree> <livreurArchive>
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierEnv = join(racine, ".env.local");
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const [RESTO_A, RESTO_B, LIV_A, LIV_B, LIV_GROUPE, LIV_ARCHIVE] = process.argv.slice(2);
if (![RESTO_A, RESTO_B, LIV_A, LIV_B, LIV_GROUPE, LIV_ARCHIVE].every((x) => /^[0-9a-f-]{36}$/.test(x ?? ""))) {
  console.error("Six identifiants attendus : restaurant A, restaurant B, livreur A, livreur B, livreur du groupe (créé), livreur archivé.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "speedfood-liv-"));
const paquets = { "@supabase/supabase-js": import.meta.resolve("@supabase/supabase-js") };
function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const contenu = readFileSync(join(racine, rel), "utf8")
    .replace(/import\s+"server-only";?/g, "")
    .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
    .replace(/from\s+"(@supabase\/supabase-js)"/g, (_, nom) => `from "${paquets[nom]}"`)
    .replace(/from\s+"@\/([^"]+?)(?<!\.ts)"/g, (_, chemin) => {
      const relatif = relative(dirname(dest), join(tmp, "src")).split("\\").join("/");
      return `from "${relatif.startsWith(".") ? relatif : "./" + relatif}/${chemin}.ts"`;
    });
  writeFileSync(dest, contenu);
}
for (const f of ["livreurs-service", "livreurs-regles", "lecture", "frais", "garde-fou-speedfood"]) copier(`src/lib/livraison/${f}.ts`);
copier("src/lib/commande/telephone.ts");
copier("src/lib/db/admin.ts");

let ko = 0;
function verifier(nom, ok, detail = "") {
  if (!ok) ko++;
  console.log(`${ok ? "OK   " : "ECHEC"} ${nom}${!ok && detail ? "\n       " + detail : ""}`);
}

try {
  const importer = (rel) => import(pathToFileURL(join(tmp, rel)).href);
  const { genererLien, fichePourJeton } = await importer("src/lib/livraison/livreurs-service.ts");
  const { clientLivraison } = await importer("src/lib/livraison/lecture.ts");
  const db = clientLivraison();

  const cycle = async (id) => (await db.from("livreurs").select("cycle, utilisateur_id").eq("id", id).maybeSingle()).data;

  const a1 = await genererLien(LIV_A, null, db, RESTO_A);
  verifier("livreur du restaurant A : lien généré par son restaurant", a1.ok === true, JSON.stringify(a1.ok ? "ok" : a1));
  const a1c = await cycle(LIV_A);
  verifier("livreur du restaurant : reste « actif » (pas d'approbation), toujours sans compte", a1c?.cycle === "actif" && a1c.utilisateur_id === null, JSON.stringify(a1c));
  const fiche = a1.ok ? await fichePourJeton(a1.lien.jeton, db) : null;
  verifier("le lien ouvre la fiche avec le nom du livreur ET celui de son restaurant (lecture imbriquée)", fiche !== null && fiche.restaurantNom !== null && fiche.restaurantNom.startsWith("ESSAI"), JSON.stringify(fiche));

  const croise = await genererLien(LIV_A, null, db, RESTO_B);
  verifier("le restaurant B ne peut pas générer de lien pour le livreur de A", croise.ok === false, JSON.stringify(croise));
  const croise2 = await genererLien(LIV_B, null, db, RESTO_A);
  verifier("le restaurant A ne peut pas générer de lien pour le livreur de B", croise2.ok === false, JSON.stringify(croise2));

  const a2 = await genererLien(LIV_A, null, db, RESTO_A);
  const ancien = a1.ok ? await fichePourJeton(a1.lien.jeton, db) : "x";
  const recent = a2.ok ? await fichePourJeton(a2.lien.jeton, db) : null;
  verifier("un nouveau lien annule le précédent", a2.ok === true && ancien === null && recent !== null, JSON.stringify({ ancien, recent: recent !== null }));

  const g = await genererLien(LIV_GROUPE, null, db, null);
  const gc = await cycle(LIV_GROUPE);
  verifier("fiche du groupe Speedfood (créée) : lien généré par l'exploitation, la fiche passe à « invitée »", g.ok === true && gc?.cycle === "invite", JSON.stringify([g.ok, gc]));
  const gf = g.ok ? await fichePourJeton(g.lien.jeton, db) : null;
  verifier("fiche du groupe : le lien n'annonce aucun restaurant", gf !== null && gf.restaurantNom === null, JSON.stringify(gf));
  const gDepuisResto = await genererLien(LIV_GROUPE, null, db, RESTO_A);
  verifier("un restaurant ne peut pas générer de lien pour une fiche du groupe Speedfood", gDepuisResto.ok === false, JSON.stringify(gDepuisResto));

  const arch = await genererLien(LIV_ARCHIVE, null, db, RESTO_A);
  verifier("livreur archivé : aucun lien", arch.ok === false, JSON.stringify(arch));

  const { data: invitations } = await db.from("livreur_invitations").select("empreinte").in("livreur_id", [LIV_A, LIV_GROUPE]).limit(20);
  verifier("seules des empreintes sont conservées (64 caractères hexadécimaux), jamais le lien", (invitations ?? []).length >= 3 && (invitations ?? []).every((i) => /^[0-9a-f]{64}$/.test(i.empreinte)));
} catch (e) {
  ko++;
  console.log(`ECHEC essai interrompu : ${e instanceof Error ? e.message : "erreur inconnue"}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(ko === 0 ? "\nESSAI RÉUSSI sur la vraie base." : `\n${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
