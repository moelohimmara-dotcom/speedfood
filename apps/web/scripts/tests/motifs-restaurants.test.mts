import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { IDENTIFIANTS_PAR_APPEL, indexerMotifs, lireMotifsRestaurants } from "../../src/lib/restaurant/motifs";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- indexation
const index = indexerMotifs([
  { restaurant_id: "a", motif_correction: "Corriger les horaires", suspendu_motif: null },
  { restaurant_id: "b", motif_correction: "", suspendu_motif: "Plainte" },
  { restaurant_id: 5 as never, motif_correction: "x", suspendu_motif: "y" },
]);
verifier("motifs : une correction lue est gardée", index.get("a"), { motifCorrection: "Corriger les horaires", suspenduMotif: null });
verifier("motifs : un texte vide devient « aucun motif »", index.get("b"), { motifCorrection: null, suspenduMotif: "Plainte" });
verifier("motifs : une ligne sans identifiant valable est ignorée", index.size, 2);
verifier("motifs : pas de réponse = index vide, sans erreur", indexerMotifs(null).size + indexerMotifs(undefined).size, 0);

// --- appels par lots
const appels: string[][] = [];
const faux = (echouer: (lot: string[]) => boolean) => ({
  rpc: async (_nom: string, args: { p_ids: string[] }) => {
    appels.push(args.p_ids);
    if (echouer(args.p_ids)) return { data: null, error: { code: "57014" } };
    return { data: args.p_ids.map((id) => ({ restaurant_id: id, motif_correction: "m-" + id, suspendu_motif: null })), error: null };
  },
}) as never;
const ids = Array.from({ length: IDENTIFIANTS_PAR_APPEL * 2 + 3 }, (_, i) => "id" + i);
const sortie = await lireMotifsRestaurants(faux(() => false), [...ids, ...ids.slice(0, 10)]);
verifier("motifs : lots de 500 identifiants, doublons retirés", appels.map((l) => l.length), [IDENTIFIANTS_PAR_APPEL, IDENTIFIANTS_PAR_APPEL, 3]);
verifier("motifs : tous les restaurants demandés sont rendus", sortie.size, ids.length);
appels.length = 0;
const partiel = await lireMotifsRestaurants(faux((lot) => lot[0] === "id500"), ids);
verifier("motifs : un lot qui échoue ne casse pas les autres (la page reste affichée)", partiel.size, IDENTIFIANTS_PAR_APPEL + 3);
verifier("motifs : aucun appel sans identifiant", (appels.length = 0, (await lireMotifsRestaurants(faux(() => false), [])).size + appels.length), 0);

// --- garde statique : plus aucune lecture directe des deux colonnes internes
// (migration 20261118120100 : ni la clé publique ni un compte connecté ne les lisent ; on passe par fn_motifs_restaurants ou correction_demandee).
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const src = join(racine, "src");
// Autorisés : les types générés, l'assistant lui-même, et le client ADMIN du serveur (service_role, droits propres, non concerné par le retrait).
const AUTORISES = new Set(["lib/db/database.types.ts", "lib/restaurant/motifs.ts", "lib/system-admin/restaurants-equipe-service.ts"]);
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}
const LECTURE = /\.select\(\s*(["'`])[^"'`]*\b(motif_correction|suspendu_motif)\b|\.(is|not|eq|neq|ilike|order)\(\s*["'](motif_correction|suspendu_motif)["']/;
const fautifs = fichiers(src)
  .map((f) => relative(src, f).replace(/\\/g, "/"))
  .filter((f) => !AUTORISES.has(f))
  .filter((f) => LECTURE.test(readFileSync(join(src, f), "utf8")));
verifier("aucune lecture directe de motif_correction ou suspendu_motif hors des fichiers autorisés", fautifs, []);

if (ko > 0) process.exit(1);
console.log("Tous les tests des motifs de restaurants passent.");
