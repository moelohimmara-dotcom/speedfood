import { lireAllergenesFormulaire, modeInitial } from "../../src/lib/menu/allergenes-formulaire";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) { ko++; console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`); } else console.log(`OK    ${nom}`);
}
const MAINTENANT = () => new Date("2026-11-26T09:00:00Z");
const form = (mode: string | null, allergenes: string[] = []) => { const f = new FormData(); if (mode !== null) f.set("allergenes_mode", mode); for (const a of allergenes) f.append("allergenes", a); return f; };

verifier("champ absent : allergènes inchangés (aucune colonne écrite)", lireAllergenesFormulaire(form(null), MAINTENANT), { ok: true, valeurs: null });
verifier("mode inchange : rien n'est écrit même si des cases traînent", lireAllergenesFormulaire(form("inchange", ["lait"]), MAINTENANT), { ok: true, valeurs: null });
verifier("non renseigné : les deux colonnes à null", lireAllergenesFormulaire(form("non_renseigne"), MAINTENANT), { ok: true, valeurs: { allergenes: null, allergenes_declares_le: null } });
verifier("aucun : liste vide datée", lireAllergenesFormulaire(form("aucun", ["lait"]), MAINTENANT), { ok: true, valeurs: { allergenes: [], allergenes_declares_le: "2026-11-26T09:00:00.000Z" } });
verifier("liste : cases cochées datées", lireAllergenesFormulaire(form("liste", ["lait", "gluten"]), MAINTENANT), { ok: true, valeurs: { allergenes: ["lait", "gluten"], allergenes_declares_le: "2026-11-26T09:00:00.000Z" } });
verifier("liste vide refusée (ce serait « aucun » sans le dire)", lireAllergenesFormulaire(form("liste"), MAINTENANT).ok, false);
verifier("allergène inconnu ou répété refusé", [lireAllergenesFormulaire(form("liste", ["pizza"]), MAINTENANT).ok, lireAllergenesFormulaire(form("liste", ["lait", "lait"]), MAINTENANT).ok], [false, false]);
verifier("mode inconnu refusé", lireAllergenesFormulaire(form("peut-etre"), MAINTENANT).ok, false);
verifier("mode initial : trois états", [modeInitial(null), modeInitial(undefined), modeInitial([]), modeInitial(["lait"])], ["non_renseigne", "non_renseigne", "aucun", "liste"]);

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
