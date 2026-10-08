import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AVERTISSEMENTS_TRACE, finaliserEcriture } from "../../src/lib/studio/apres-ecriture";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

/** Faux journal et faux cache qui notent l'ordre des appels. */
function etapes(options: { journalEnPanne?: boolean; cacheEnPanne?: boolean } = {}) {
  const ordre: string[] = [];
  return {
    ordre,
    invalider: async () => {
      ordre.push("invalider");
      if (options.cacheEnPanne) throw new Error("cache en panne");
    },
    journaliser: async () => {
      ordre.push("journaliser");
      if (options.journalEnPanne) throw new Error("L'action n'a pas pu être journalisée. Par prudence, elle est refusée.");
    },
  };
}

// --- Revue 6, I1 : publication réussie puis audit en échec -------------------------------------------------------
{
  const e = etapes();
  verifier("tout va bien : aucun avertissement", await finaliserEcriture(e, AVERTISSEMENTS_TRACE.publication(3)), {});
  verifier("tout va bien : cache invalidé AVANT la trace", e.ordre, ["invalider", "journaliser"]);
}
{
  const e = etapes({ journalEnPanne: true });
  const r = await finaliserEcriture(e, AVERTISSEMENTS_TRACE.publication(3));
  verifier("audit en échec : cache quand même invalidé, avant la trace", e.ordre, ["invalider", "journaliser"]);
  verifier("audit en échec : message exact (publiée, version, trace manquante)", r, {
    avertissement: "La page est publiée (version 3), mais la trace dans le journal d'audit n'a pas pu être écrite : prévenez un super administrateur.",
  });
  verifier("audit en échec : jamais « refusée »", /refus/i.test(r.avertissement ?? ""), false);
}
{
  const e = etapes({ cacheEnPanne: true });
  verifier("cache en panne : la trace est quand même écrite, sans avertissement", [await finaliserEcriture(e, "x"), e.ordre], [{}, ["invalider", "journaliser"]]);
}
{
  const e = etapes({ journalEnPanne: true });
  const r = await finaliserEcriture({ journaliser: e.journaliser }, AVERTISSEMENTS_TRACE.brouillon);
  verifier("brouillon (sans cache) : avertissement exact", r.avertissement, "Le brouillon est enregistré, mais la trace dans le journal d'audit n'a pas pu être écrite : prévenez un super administrateur.");
}
verifier("restauration : message exact", AVERTISSEMENTS_TRACE.restauration(7).startsWith("La version 7 est remise dans le brouillon, mais la trace"), true);
verifier("création : message exact", AVERTISSEMENTS_TRACE.creation.startsWith("La page est créée, mais la trace"), true);

// --- Garde-fou : les actions de pages-blocs.ts passent toutes par finaliserEcriture ----------------------------------
{
  const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
  const source = readFileSync(join(racine, "src/lib/system-admin/pages-blocs.ts"), "utf8").replace(/\r\n/g, "\n");
  const corps = (nom: string) => {
    const debut = source.indexOf(`export async function ${nom}(`);
    const fin = source.indexOf("\nexport ", debut + 1);
    return debut < 0 ? "" : source.slice(debut, fin < 0 ? undefined : fin);
  };
  verifier("pages-blocs.ts : aucune trace d'audit hors de finaliserEcriture", /await journaliserActionSysteme\(/.test(source), false);
  verifier("pages-blocs.ts : aucune invalidation hors de finaliserEcriture", /await invaliderCache\(/.test(source), false);
  const pub = corps("publierBlocsAction");
  verifier("publierBlocsAction : invalide page:<slug> ET navigation dans finaliserEcriture", /finaliserEcriture\(\s*\{\s*invalider: \(\) => invaliderCache\(\[`page:\$\{page\.slug\}`, "navigation"\]\)/.test(pub), true);
  verifier("publierBlocsAction : avertissement de publication", /AVERTISSEMENTS_TRACE\.publication\(version\)/.test(pub), true);
  verifier("publierBlocsAction : renvoie ok: true avec l'avertissement", /return \{ ok: true, version, [^}]*\.\.\.fin \};/.test(pub), true);
  for (const [nom, cle] of [["creerPageBlocsAction", "creation"], ["enregistrerBrouillonBlocsAction", "brouillon"], ["restaurerVersionAction", "restauration"]] as const) {
    const c = corps(nom);
    verifier(`${nom} : finaliserEcriture + avertissement ${cle}`, c.includes("finaliserEcriture(") && c.includes(`AVERTISSEMENTS_TRACE.${cle}`) && /\.\.\.fin \};/.test(c), true);
  }
  verifier("creerPageBlocsAction : invalide page:<slug>", /invalider: \(\) => invaliderCache\(\[`page:\$\{slug\}`\]\)/.test(corps("creerPageBlocsAction")), true);
}

if (ko) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nTous les tests de la suite d'écriture passent.");
