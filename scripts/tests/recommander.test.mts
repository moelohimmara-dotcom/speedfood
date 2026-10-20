import { messageRecommande, reconstruireCommande, type PlatDuMenu } from "../../src/lib/client/recommander";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const plat = (id: string, surcharge: Partial<PlatDuMenu> = {}): PlatDuMenu => ({
  id,
  nom: `Plat ${id}`,
  prix: 5000,
  prixPromo: null,
  disponible: true,
  archive: false,
  options: [
    { id: `${id}-o1`, nom: "Piment", prix: 500, disponible: true },
    { id: `${id}-o2`, nom: "Fromage", prix: 1000, disponible: true },
  ],
  ...surcharge,
});
const menu = [plat("a"), plat("b", { prixPromo: 4000 }), plat("c", { disponible: false }), plat("d", { archive: true })];

const r1 = reconstruireCommande([{ menuItemId: "a", nom: "Plat a", quantite: 2, optionIds: ["a-o1"] }], menu);
verifier("un plat disponible est repris avec sa quantité et son supplément", r1.lignes.map((l) => [l.menuItemId, l.quantite, l.options.map((o) => o.id)]), [["a", 2, ["a-o1"]]]);
verifier("aucun message quand tout est repris à l'identique", messageRecommande(r1), null);

const r2 = reconstruireCommande([{ menuItemId: "b", nom: "Plat b", quantite: 1, optionIds: [] }], menu);
verifier("le prix est celui d'AUJOURD'HUI (promotion appliquée)", r2.lignes[0].prix, 4000);

const r3 = reconstruireCommande([
  { menuItemId: "c", nom: "Plat c", quantite: 1, optionIds: [] },
  { menuItemId: "d", nom: "Plat d", quantite: 1, optionIds: [] },
  { menuItemId: null, nom: "Plat supprimé", quantite: 1, optionIds: [] },
  { menuItemId: "inconnu", nom: "Plat inconnu", quantite: 1, optionIds: [] },
], menu);
verifier("plat indisponible, archivé, supprimé ou inconnu : écarté et signalé, jamais ajouté", [r3.lignes.length, r3.indisponibles], [0, ["Plat c", "Plat d", "Plat supprimé", "Plat inconnu"]]);

const r4 = reconstruireCommande([{ menuItemId: "a", nom: "Plat a", quantite: 1, optionIds: ["a-o1", "a-disparu", "b-o1"] }], menu);
verifier("supplément disparu ou d'un autre plat : retiré, le plat est repris sans lui", [r4.lignes[0].options.map((o) => o.id), r4.supplementsRetires], [["a-o1"], 2]);

const menuSansSupp = [plat("a", { options: [{ id: "a-o1", nom: "Piment", prix: 500, disponible: false }] })];
const r5 = reconstruireCommande([{ menuItemId: "a", nom: "Plat a", quantite: 1, optionIds: ["a-o1"] }], menuSansSupp);
verifier("supplément devenu indisponible : retiré", [r5.lignes[0].options.length, r5.supplementsRetires], [0, 1]);

const r6 = reconstruireCommande([
  { menuItemId: "a", nom: "Plat a", quantite: 20, optionIds: ["a-o2", "a-o1"] },
  { menuItemId: "a", nom: "Plat a", quantite: 20, optionIds: ["a-o1", "a-o2"] },
], menu);
verifier("même plat, mêmes suppléments (ordre différent) : une seule ligne, quantité plafonnée à 30", [r6.lignes.length, r6.lignes[0].quantite], [1, 30]);

const r7 = reconstruireCommande([{ menuItemId: "a", nom: "Plat a", quantite: 1, optionIds: [] }, { menuItemId: "a", nom: "Plat a", quantite: 1, optionIds: ["a-o1"] }], menu);
verifier("même plat avec et sans supplément : deux lignes", r7.lignes.length, 2);

verifier("quantité absurde ramenée à 1 au moins", reconstruireCommande([{ menuItemId: "a", nom: "Plat a", quantite: 0, optionIds: [] }, { menuItemId: "b", nom: "Plat b", quantite: Number.NaN, optionIds: [] }], menu).lignes.map((l) => l.quantite), [1, 1]);
verifier("commande vide : panier vide", reconstruireCommande([], menu), { lignes: [], indisponibles: [], supplementsRetires: 0 });

verifier("message : un plat, plusieurs plats, suppléments", [
  messageRecommande({ lignes: [], indisponibles: ["Poulet braisé"], supplementsRetires: 0 }),
  messageRecommande({ lignes: [], indisponibles: ["A", "B", "C", "D"], supplementsRetires: 0 }),
  messageRecommande({ lignes: [], indisponibles: [], supplementsRetires: 1 }),
], [
  "« Poulet braisé » n'est plus proposé. Vérifiez votre panier : les prix sont ceux d'aujourd'hui.",
  "4 plats ne sont plus proposés (A, B, C…). Vérifiez votre panier : les prix sont ceux d'aujourd'hui.",
  "1 supplément n'existe plus. Vérifiez votre panier : les prix sont ceux d'aujourd'hui.",
]);

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nCommander à nouveau vérifié.");
