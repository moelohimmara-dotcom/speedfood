import { cellule, construireCsv } from "../../src/lib/system-admin/csv";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("cellule simple", cellule("Kankan"), '"Kankan"');
verifier("guillemets doublés", cellule('Il a dit "oui"'), '"Il a dit ""oui"""');
verifier("formule neutralisée (=)", cellule("=1+1"), '"\'=1+1"');
verifier("formule neutralisée (+ suivi de texte)", cellule("+SUM(A1)"), '"\'+SUM(A1)"');
verifier("numéro de téléphone normalisé laissé lisible", cellule("+224622000000"), '"+224622000000"');
verifier("formule neutralisée (@)", cellule("@SUM(A1)"), '"\'@SUM(A1)"');
verifier("vide et null", [cellule(null), cellule(undefined), cellule("")], ['""', '""', '""']);
verifier("nombre", cellule(12), '"12"');
verifier("nombre négatif non neutralisé", cellule(-13.55), '"-13.55"');
verifier("texte négatif neutralisé", cellule("-13.55"), '"\'-13.55"');
verifier("CSV complet : BOM, séparateur point-virgule, fin de ligne", construireCsv(["Zone", "Contact"], [["Kankan", "a@b.co"]]), '﻿"Zone";"Contact"\r\n"Kankan";"a@b.co"\r\n');

if (ko > 0) process.exit(1);
