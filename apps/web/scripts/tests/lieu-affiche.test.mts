import { readFileSync } from "node:fs";
import { join } from "node:path";
import { communeDuQuartier, lieuAffiche } from "../../src/lib/geographie/quartiers";

/**
 * Lieu affiché sur les cartes de restaurant (26/11/2026). Constaté en production : 23 restaurants sur 61 ont un quartier « Centre de … »
 * (technique, `generique`) ; les cartes affichaient « Riz & sauces · » avec un lieu vide, alors que la fiche affichait la commune.
 */

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("quartier réel : son nom", lieuAffiche({ nom: "Kipé", generique: false, communes: { nom: "Ratoma" } }), "Kipé");
verifier("quartier « Centre de … » : la commune", lieuAffiche({ nom: "Centre de Coyah", generique: true, communes: { nom: "Coyah" } }), "Coyah");
verifier("commune reçue sous forme de liste", lieuAffiche({ nom: "Centre de Coyah", generique: true, communes: [{ nom: "Coyah" }] }), "Coyah");
verifier("quartier technique sans commune : vide, jamais le nom technique", lieuAffiche({ nom: "Centre de Coyah", generique: true, communes: null }), "");
verifier("quartier sans nom : la commune", lieuAffiche({ nom: "  ", generique: false, communes: { nom: "Ratoma" } }), "Ratoma");
verifier("quartier absent : vide", lieuAffiche(null), "");
verifier("la commune seule reste lue comme avant", communeDuQuartier({ communes: { nom: "Ratoma" } }), "Ratoma");

// Gardes statiques : les cartes et les plats vedettes affichent le LIEU, les filtres gardent le quartier réel.
const racine = process.env.SPEEDFOOD_RACINE ?? join(import.meta.dirname, "..", "..");
const lire = (chemin: string) => readFileSync(join(racine, chemin), "utf8");
const liste = lire("src/app/restaurants/page.tsx");
verifier("la liste affiche le lieu sur les cartes", liste.includes("quartier={r.lieu}"), true);
verifier("le plat vedette affiche le lieu", liste.includes("{vedette.restaurantNom} · {vedette.lieu}"), true);
verifier("les filtres gardent le quartier réel", liste.includes("r.restaurant.quartier === x.nom"), true);
verifier("les alternatives affichent le lieu", lire("src/app/restaurants/[id]/alternatives/page.tsx").includes("quartier={a.restaurant.lieu}"), true);

if (ko > 0) {
  console.log(`\n${ko} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("\nLieu affiché vérifié.");
