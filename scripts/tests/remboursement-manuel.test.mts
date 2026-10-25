import { LIBELLE_MOYEN, MOYENS_REMBOURSEMENT, estMoyenRemboursement, validerRemboursementManuel } from "../../src/lib/paiement/en-ligne/remboursement-manuel";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const base = { moyen: "orange_money", reference: "OM2410251234", recuPar: "", motif: "Commande refusée par le restaurant" };
const erreur = (s: Parameters<typeof validerRemboursementManuel>[0]) => {
  const r = validerRemboursementManuel(s);
  return r.ok ? null : r.erreur;
};

verifier("trois moyens, dont les espèces en dernier", [...MOYENS_REMBOURSEMENT], ["orange_money", "mtn_momo", "especes"]);
verifier("libellés de tous les moyens", MOYENS_REMBOURSEMENT.every((m) => LIBELLE_MOYEN[m].length > 0), true);
verifier("moyen inconnu refusé", estMoyenRemboursement("virement"), false);
verifier("orange money valide", validerRemboursementManuel(base), { ok: true, valeur: { moyen: "orange_money", reference: "OM2410251234", recuPar: null, motif: "Commande refusée par le restaurant" } });
verifier("MTN MoMo valide", validerRemboursementManuel({ ...base, moyen: "mtn_momo", reference: " MP-2410.77 " }).ok, true);
verifier("moyen manquant", erreur({ ...base, moyen: "" })?.startsWith("Choisissez le moyen"), true);
verifier("mobile money sans référence", erreur({ ...base, reference: "" })?.startsWith("Indiquez la référence"), true);
verifier("référence trop courte", erreur({ ...base, reference: "ab" })?.startsWith("Indiquez la référence"), true);
verifier("référence avec symboles dangereux", erreur({ ...base, reference: "<script>" })?.startsWith("Indiquez la référence"), true);
verifier("motif trop court", erreur({ ...base, motif: "oui" })?.startsWith("Indiquez le motif"), true);
verifier("motif trop long", erreur({ ...base, motif: "x".repeat(301) })?.startsWith("Le motif est trop long"), true);
const especes = { moyen: "especes", reference: "", recuPar: "Mariam Camara", motif: "Client sans téléphone mobile money, remise en main propre" };
verifier("espèces valides sans numéro de reçu", validerRemboursementManuel(especes), { ok: true, valeur: { moyen: "especes", reference: null, recuPar: "Mariam Camara", motif: "Client sans téléphone mobile money, remise en main propre" } });
verifier("espèces avec numéro de reçu", validerRemboursementManuel({ ...especes, reference: "RECU-0042" }).ok, true);
verifier("espèces sans nom du receveur", erreur({ ...especes, recuPar: "" })?.startsWith("Espèces : indiquez le nom"), true);
verifier("espèces avec motif de 18 caractères accepté", erreur({ ...especes, motif: "client sans mobile" }), null);
verifier("espèces avec motif trop court", erreur({ ...especes, motif: "pas de mobile" })?.startsWith("Espèces : expliquez"), true);
verifier("reçu espèces invalide", erreur({ ...especes, reference: "$$" })?.startsWith("Le numéro de reçu"), true);

if (ko > 0) {
  console.log(`ECHEC remboursement-manuel : ${ko} verification(s) en echec`);
  process.exit(1);
}
console.log("OK remboursement-manuel");
