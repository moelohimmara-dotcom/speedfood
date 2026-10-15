import { commandesATraiter, propositionActiveMin } from "../../src/lib/commande/a-traiter";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const maintenant = new Date("2026-10-15T12:00:00Z");
const dans1h = "2026-10-15T13:00:00Z";
const ilYa1h = "2026-10-15T11:00:00Z";

verifier("sans proposition : pas d'attente du client", propositionActiveMin([], maintenant), false);
verifier("liste absente : pas d'attente du client", propositionActiveMin(null, maintenant), false);
verifier("proposition en attente non expirée : le client doit répondre", propositionActiveMin([{ statut: "en_attente", expire_le: dans1h }], maintenant), true);
verifier("proposition en attente sans échéance : le client doit répondre", propositionActiveMin([{ statut: "en_attente", expire_le: null }], maintenant), true);
verifier("proposition échue : plus d'attente du client", propositionActiveMin([{ statut: "en_attente", expire_le: ilYa1h }], maintenant), false);
verifier("proposition acceptée : plus d'attente du client", propositionActiveMin([{ statut: "acceptee", expire_le: dans1h }], maintenant), false);
verifier("proposition refusée : plus d'attente du client", propositionActiveMin([{ statut: "refusee", expire_le: null }], maintenant), false);

const commandes = [
  { id: "a", cree_le: "2026-10-15T11:50:00Z", order_proposals: [] },
  { id: "b", cree_le: "2026-10-15T11:40:00Z", order_proposals: [{ statut: "en_attente", expire_le: dans1h }] },
  { id: "c", cree_le: "2026-10-15T11:30:00Z", order_proposals: [{ statut: "refusee", expire_le: null }] },
  { id: "d", cree_le: "2026-10-15T11:20:00Z", order_proposals: null },
  { id: "e", cree_le: "2026-10-15T11:10:00Z" },
];
verifier(
  "à traiter : la commande qui attend le client est exclue, l'ordre est conservé",
  commandesATraiter(commandes, maintenant).map((c) => c.id),
  ["a", "c", "d", "e"]
);

if (ko > 0) process.exit(1);
