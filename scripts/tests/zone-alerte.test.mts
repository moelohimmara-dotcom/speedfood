import { validerContactAlerte } from "../../src/lib/site/zone-alerte";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("e-mail valide, mis en minuscules", validerContactAlerte("  Aminata@Exemple.COM "), { ok: true, type: "email", contact: "aminata@exemple.com" });
verifier("e-mail sans domaine refusé", validerContactAlerte("aminata@exemple").ok, false);
verifier("téléphone national normalisé", validerContactAlerte("622 00 00 00"), { ok: true, type: "telephone", contact: "+224622000000" });
verifier("téléphone avec indicatif", validerContactAlerte("+224 664 11 22 33"), { ok: true, type: "telephone", contact: "+224664112233" });
verifier("numéro étranger refusé", validerContactAlerte("+33 6 12 34 56 78").ok, false);
verifier("vide refusé", validerContactAlerte("   ").ok, false);
verifier("e-mail trop long refusé", validerContactAlerte(`${"a".repeat(130)}@exemple.com`).ok, false);

if (ko > 0) process.exit(1);
