import { detailLivraison, libelleLivraison, statutLivraison, type LigneZoneDesservie } from "../../src/lib/site/livraison";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const communeDuQuartier = new Map([
  ["q-kipe", "c-ratoma"],
  ["q-bonfi", "c-matam"],
]);
const ligneCommune = (communeId: string, fraisGnf: number | null = null, delaiMinutes: number | null = null): LigneZoneDesservie => ({ communeId, quartierId: null, fraisGnf, delaiMinutes });
const ligneQuartier = (quartierId: string, fraisGnf: number | null = null, delaiMinutes: number | null = null): LigneZoneDesservie => ({ communeId: null, quartierId, fraisGnf, delaiMinutes });

verifier("aucune zone déclarée : on n'affirme rien", statutLivraison([], { niveau: "commune", id: "c-ratoma", communeId: "c-ratoma" }, communeDuQuartier), { type: "non-declaree" });
verifier("commune entière desservie", statutLivraison([ligneCommune("c-ratoma", 10000, 45)], { niveau: "commune", id: "c-ratoma", communeId: "c-ratoma" }, communeDuQuartier), { type: "livre", fraisGnf: 10000, delaiMinutes: 45 });
verifier("quartier couvert par sa commune entière", statutLivraison([ligneCommune("c-ratoma", 5000)], { niveau: "quartier", id: "q-kipe", communeId: "c-ratoma" }, communeDuQuartier), { type: "livre", fraisGnf: 5000, delaiMinutes: null });
verifier("la ligne du quartier prime sur celle de la commune", statutLivraison([ligneCommune("c-ratoma", 5000), ligneQuartier("q-kipe", 2000)], { niveau: "quartier", id: "q-kipe", communeId: "c-ratoma" }, communeDuQuartier), { type: "livre", fraisGnf: 2000, delaiMinutes: null });
verifier("commune visée, seulement certains quartiers desservis", statutLivraison([ligneQuartier("q-kipe")], { niveau: "commune", id: "c-ratoma", communeId: "c-ratoma" }, communeDuQuartier), { type: "partielle" });
verifier("zone non desservie", statutLivraison([ligneCommune("c-matam")], { niveau: "commune", id: "c-ratoma", communeId: "c-ratoma" }, communeDuQuartier), { type: "non" });
verifier("autre quartier d'une même commune non desservi", statutLivraison([ligneQuartier("q-kipe")], { niveau: "quartier", id: "q-autre", communeId: "c-ratoma" }, communeDuQuartier), { type: "non" });

verifier("détail : frais et délai", detailLivraison(10000, 45), "10 000 GNF · environ 45 min");
verifier("détail : gratuite", detailLivraison(0, null), "gratuite");
verifier("détail : rien de renseigné", detailLivraison(null, null), "");
verifier("libellé : livre sans détail", libelleLivraison({ type: "livre", fraisGnf: null, delaiMinutes: null }, "Ratoma"), "Livre à Ratoma");
verifier("libellé : non déclarée = silence", libelleLivraison({ type: "non-declaree" }, "Ratoma"), null);

if (ko > 0) process.exit(1);
