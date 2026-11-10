import { MODELES_CONSIGNES, PROFILS_PAIEMENT, moyensDuProfil } from "../../src/lib/system-admin/profil-pre-remplissage";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC pré-remplissage : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    pré-remplissage : ${nom}`);
  }
}

// Règle du 3 novembre 2026 : jamais d'espèces proposées. Un ancien profil enregistré avec « especes » reste toléré à la lecture (aucune exception, aucun moyen imposé).
verifier("profils proposés : sélection manuelle, mobile money, tous (plus « Espèces uniquement »)", PROFILS_PAIEMENT.map((p) => p.valeur), ["", "mobile", "tous"]);
verifier("aucun libellé de profil ne cite les espèces", PROFILS_PAIEMENT.some((p) => /esp[èe]ces/i.test(p.libelle)), false);
verifier("« tous » = mobile money seulement", moyensDuProfil("tous"), ["orange_money", "mtn_momo"]);
verifier("« mobile » = Orange Money + MTN MoMo", moyensDuProfil("mobile"), ["orange_money", "mtn_momo"]);
verifier("sélection manuelle : rien d'imposé", moyensDuProfil(""), null);
verifier("ancien profil « especes » : toléré, ne renvoie jamais d'espèces", moyensDuProfil("especes"), null);
for (const valeur of ["", "mobile", "tous", "especes", "x"]) verifier(`aucun profil (${valeur || "vide"}) ne produit « especes »`, (moyensDuProfil(valeur) ?? []).includes("especes"), false);
verifier("consignes : le modèle de retrait emploie le mot « À emporter »", MODELES_CONSIGNES.filter((m) => /emporter/i.test(m.libelle) && /^À emporter/.test(m.valeur)).length, 1);
verifier("consignes : plus de « Retrait sur place » dans les modèles", MODELES_CONSIGNES.some((m) => /Retrait sur place/i.test(m.valeur) || /Retrait sur place/i.test(m.libelle)), false);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
