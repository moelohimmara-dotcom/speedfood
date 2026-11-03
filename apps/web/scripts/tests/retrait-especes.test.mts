import { readFileSync } from "node:fs";
import { join } from "node:path";
import { optionsPaiement, libelleStatutPaiement, type StatutPaiement } from "../../src/lib/paiement/regles";
import { decisionPanneau, optionsAffichables, texteSansMode, MESSAGE_SANS_MODE_PAIEMENT } from "../../src/lib/paiement/affichage-suivi";

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
// Comportement du panneau de suivi (logique extraite dans affichage-suivi.ts, appelée par PanneauPaiement.tsx).
verifier("panneau : aucune option espèces affichable, même si elle arrive du serveur", optionsAffichables([{ mode: "especes", libelle: "Espèces", code: null }, { mode: "mtn_momo", libelle: "MTN MoMo", code: "654321" }]).map((o) => o.mode), ["mtn_momo"]);
const statuts: StatutPaiement[] = ["non_demande", "especes", "declare", "non_recu", "recu"];
verifier("panneau, sans aucune option ni paiement en ligne : carte courte SEULEMENT pour non_demande ; recu = carte payée ; sinon rendu principal avec le libellé du statut",
  statuts.map((st) => decisionPanneau(st, 0, false)), ["sans_mode", "principal", "principal", "principal", "recu"]);
verifier("panneau, avec une option : rendu principal (recu mis à part)", statuts.map((st) => decisionPanneau(st, 1, false)), ["principal", "principal", "principal", "principal", "recu"]);
verifier("panneau, paiement en ligne affiché sans option : rendu principal", decisionPanneau("non_demande", 0, true), "principal");
verifier("ancien statut espèces ou déclaré sans option : « Rien à régler » n'est jamais le message", (["especes", "declare", "non_recu"] as StatutPaiement[]).map((st) => decisionPanneau(st, 0, false) === "sans_mode"), [false, false, false]);
verifier("les libellés des statuts en cours restent affichables", [libelleStatutPaiement("especes", "especes"), libelleStatutPaiement("declare", "orange_money"), libelleStatutPaiement("non_recu", "orange_money")], ["À régler en espèces au restaurant", "Paiement déclaré, en attente de confirmation du restaurant", "Paiement non retrouvé par le restaurant"]);
verifier("carte courte : message Chap Chap Pay si ouvert, attente de l'acceptation sinon (sans espèces)", [texteSansMode(true), /espèces/i.test(texteSansMode(false)), texteSansMode(false).includes("accepté")], [MESSAGE_SANS_MODE_PAIEMENT, false, true]);
verifier("message Chap Chap Pay identique à l'application", MESSAGE_SANS_MODE_PAIEMENT, "Le paiement en ligne Chap Chap Pay arrive bientôt. Rien à régler pour le moment.");
// Câblage (motifs de code, seule vérification possible sans rendu) : le panneau passe par la logique ci-dessus, plus de composant espèces, la page transmet l'ouverture.
verifier("câblage : le panneau utilise decisionPanneau / optionsAffichables, sans composant ni appel espèces", [/decisionPanneau\(/.test(panneau), /optionsAffichables\(/.test(panneau), /OptionEspeces|Je paierai en espèces/.test(panneau), /declarer\w*Action\([^)]*"especes"/.test(panneau)], [true, true, false, false]);
verifier("câblage : la page transmet l'état d'ouverture du paiement", /ouvert=\{paiementOuvert\(/.test(lire("src/app/suivi/[jeton]/page.tsx")), true);

verifier("textes publics : aucune promesse de code marchand ni d'espèces", ["src/app/commande/FormulaireCommande.tsx", "src/app/comment-ca-marche/page.tsx", "src/app/connexion/page.tsx", "src/app/restaurant/(console)/affiche/page.tsx"].map((f) => /code marchand|en espèces|Espèces ou/.test(lire(f).split("\n").filter((l) => /Chap Chap Pay/.test(l)).join("\n"))), [false, false, false, false]);

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
