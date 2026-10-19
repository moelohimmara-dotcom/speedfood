// Validation d'une commande : surtout que rien de ce que le serveur attend en aval n'est perdu en route (régression du 19 octobre 2026 : la clé de
// table du QR n'était pas recopiée, donc toute commande à table d'un client était refusée).
import { validerCreationCommande } from "../../src/lib/commande/validation";

let echecs = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown): void {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`${ok ? "OK  " : "KO  "}  ${nom}${ok ? "" : ` : obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`}`);
  if (!ok) echecs += 1;
}

const RESTO = "73bd8244-71ed-445c-862b-53b9b07ff207";
const PLAT = "11111111-2222-4333-8444-555555555555";
const base = {
  cleIdempotence: "6f1e7c0a-1b2c-4d3e-8f4a-0123456789ab",
  restaurantId: RESTO,
  client: { nom: "Aïssatou Diallo", telephone: "622123456", adresse: null },
  mode: "sur_place",
  table: "12",
  cleTable: "0123456789abcdef",
  lignes: [{ menuItemId: PLAT, quantite: 2, optionIds: [] }],
  sousTotalAffiche: 20000,
  consentementReglement: true,
};

const r = validerCreationCommande(base);
verifier("une commande à table valide est acceptée", r.ok, true);
if (r.ok) {
  verifier("la clé de table du QR est conservée jusqu'à la création", r.valeurs.cleTable, "0123456789abcdef");
  verifier("le numéro de table est conservé", r.valeurs.table, "12");
  verifier("le mode est conservé", r.valeurs.mode, "sur_place");
}

const sansCle = validerCreationCommande({ ...base, cleTable: undefined });
verifier("sans clé : acceptée par la validation, clé nulle (c'est la création qui refusera)", sansCle.ok && sansCle.valeurs.cleTable, null);
const cleNonTexte = validerCreationCommande({ ...base, cleTable: 123 });
verifier("clé non textuelle : ignorée (nulle)", cleNonTexte.ok && cleNonTexte.valeurs.cleTable, null);
const cleTropLongue = validerCreationCommande({ ...base, cleTable: "a".repeat(65) });
verifier("clé démesurée : ignorée (nulle)", cleTropLongue.ok && cleTropLongue.valeurs.cleTable, null);

const retrait = validerCreationCommande({ ...base, mode: "retrait", table: null, cleTable: "0123456789abcdef" });
verifier("une commande en retrait reste acceptée", retrait.ok, true);

if (echecs > 0) {
  console.log(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nTout est bon (validation de commande).");
