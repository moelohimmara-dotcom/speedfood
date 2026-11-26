import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde d'ordre de la fiche restaurant (26/11/2026) : on y vient pour commander, donc le MENU vient avant les AVIS.
 * Constaté en production : une dizaine d'avis s'enchaînaient avant « À la carte », le menu était enterré (surtout sur téléphone).
 * Garde statique sur le code de la page : l'ordre des blocs dans le JSX est l'ordre d'affichage.
 */

let ko = 0;
function verifier(nom: string, ok: boolean, detail = "") {
  if (!ok) {
    ko++;
    console.log(`ECHEC ${nom}${detail ? `\n   ${detail}` : ""}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
const page = readFileSync(join(racine, "src/app/restaurants/[id]/page.tsx"), "utf8");

const positionMenu = page.indexOf("<MenuFiltre");
const positionAvis = page.indexOf("<AvisPublics");
const positionGrille = page.indexOf('className="fiche-grille"');
const positionFerme = page.indexOf("Ce restaurant est actuellement fermé");
const positionPause = page.indexOf("ne prend plus de commandes pour le moment");

verifier("la fiche affiche le menu", positionMenu > -1);
verifier("la fiche affiche les avis, une seule fois", positionAvis > -1 && page.indexOf("<AvisPublics", positionAvis + 1) === -1);
verifier("le menu vient avant les avis", positionMenu > -1 && positionAvis > positionMenu, `menu à ${positionMenu}, avis à ${positionAvis}`);
verifier("les avis viennent après toute la grille menu et panier", positionAvis > positionGrille && positionGrille > -1);
verifier("les messages « fermé » et « en pause » restent avant le menu", positionFerme > -1 && positionPause > -1 && positionFerme < positionMenu && positionPause < positionMenu);

if (ko > 0) {
  console.log(`\n${ko} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("\nOrdre de la fiche restaurant vérifié.");
