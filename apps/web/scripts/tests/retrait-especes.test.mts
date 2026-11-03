import { readFileSync } from "node:fs";
import { join } from "node:path";
import { optionsPaiement, libelleStatutPaiement } from "../../src/lib/paiement/regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const lire = (rel: string) => readFileSync(join(racine, rel), "utf8");

// Décision du 3 novembre 2026 : Speedfood ne manipule jamais d'espèces. Rien n'est proposé ni accepté ; l'historique reste lisible.

// (A) Proposé au client
const codes = { orange: "123456", mtn: "654321" };
verifier("options : jamais d'espèces (restaurant sans déclaration)", optionsPaiement([], codes).map((o) => o.mode), []);
verifier("options : jamais d'espèces (restaurant qui les déclare)", optionsPaiement(["especes", "orange_money", "mtn_momo"], codes).map((o) => o.mode), ["orange_money", "mtn_momo"]);

const panneau = lire("src/app/suivi/[jeton]/PanneauPaiement.tsx");
verifier("suivi : plus de composant ni d'appel de déclaration en espèces", [/OptionEspeces/.test(panneau), /declarer\w*Action\([^)]*"especes"/.test(panneau), /Je paierai en espèces/.test(panneau)], [false, false, false]);
verifier("suivi : message Chap Chap Pay quand le paiement est ouvert sans aucun mode", /Le paiement en ligne Chap Chap Pay arrive bientôt\. Rien à régler pour le moment\./.test(panneau) && /ouvert\s*\n?\s*\?\s*MESSAGE_SANS_MODE_PAIEMENT/.test(panneau), true);
verifier("suivi : la page transmet l'état d'ouverture du paiement", /ouvert=\{paiementOuvert\(/.test(lire("src/app/suivi/[jeton]/page.tsx")), true);

const service = lire("src/lib/commande/declaration-paiement.ts");
verifier("service de déclaration : espèces refusées avant le plafond et la base", service.indexOf('mode === "especes"') > -1 && service.indexOf('mode === "especes"') < service.indexOf("limiterDeclarationPaiement()"), true);
verifier("service de déclaration : plus d'écriture du statut « especes »", /paiement_statut: "declare"/.test(service) && !/paiement_statut: choisi === "especes"/.test(service), true);

// (C) Réglage du restaurateur : l'option n'est plus à cocher
verifier("formulaires restaurateur et admin : liste sans espèces", [/MOYENS_SAISISSABLES\.map/.test(lire("src/app/restaurant/(console)/profil/FormulaireProfil.tsx")), /MOYENS_SAISISSABLES\.map/.test(lire("src/app/system/catalogue/restaurants/[id]/EditeurProfilRestaurant.tsx")), /MOYENS_PAIEMENT\.map/.test(lire("src/app/restaurant/(console)/profil/FormulaireProfil.tsx"))], [true, true, false]);

// (B) Historique : toujours lisible
verifier("historique : libellés d'anciennes commandes en espèces", [libelleStatutPaiement("recu", "especes"), libelleStatutPaiement("especes", "especes")], ["Espèces encaissées", "À régler en espèces au restaurant"]);
const requetes = lire("src/lib/commande/requetes.ts");
verifier("historique : le suivi lit encore le statut et le mode « especes »", [/valeur === "especes" \|\| valeur === "declare"/.test(requetes), /valeur === "especes" \|\| valeur === "orange_money"/.test(requetes)], [true, true]);
verifier("historique : reçu et console affichent encore « Espèces encaissées »", [/Espèces encaissées par le restaurant/.test(lire("src/app/suivi/[jeton]/recu/page.tsx")), /Espèces encaissées/.test(lire("src/app/restaurant/(console)/commandes/CommandeCarte.tsx"))], [true, true]);
verifier("historique : le panneau de suivi affiche encore un ancien statut « especes »", /statut === "declare" \|\| statut === "especes"/.test(panneau), true);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nretrait des espèces : tous les contrôles passent");
