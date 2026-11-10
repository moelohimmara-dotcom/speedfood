import { envoyerMessageReservation, type PortsMessageReservation } from "../../src/lib/push/reservation-messages";
import type { TypeNotification } from "../../src/lib/push/fcm";

// Lot M4c : message au client quand le restaurant répond à sa réservation. Règles pures (le site relit le compte du client lui-même) ; les ports sont des doublures, aucun réseau, aucune base.
let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const RES = "aaaaaaaa-0000-4000-8000-000000000001";
const CLIENT = "00000000-0000-4000-8000-00000000000a";

function ports(ligne: { clientUserId: string | null; statut: string } | null | Error) {
  const lectures: string[] = [];
  const envois: Array<{ comptes: string[]; type: TypeNotification }> = [];
  const p: PortsMessageReservation = {
    lireReservation: async (id) => { lectures.push(id); if (ligne instanceof Error) throw ligne; return ligne; },
    notifier: async (comptes, type) => { envois.push({ comptes, type }); },
  };
  return { p, lectures, envois };
}

for (const [statut, type] of [["confirmee", "reservation_confirmee"], ["refusee", "reservation_refusee"], ["annulee_restaurant", "reservation_annulee"]] as const) {
  const b = ports({ clientUserId: CLIENT, statut });
  const issue = await envoyerMessageReservation(b.p, RES, statut);
  verifier(`« ${statut} » : le compte du client reçoit « ${type} », rien d'autre (un seul compte, un seul envoi)`, [issue, b.lectures, b.envois], ["envoye", [RES], [{ comptes: [CLIENT], type }]]);
}

for (const statut of ["honoree", "non_honoree", "demandee", "annulee_client", "x", "", undefined, 3, null]) {
  const b = ports({ clientUserId: CLIENT, statut: "confirmee" });
  const issue = await envoyerMessageReservation(b.p, RES, statut as never);
  verifier(`statut ${JSON.stringify(statut)} : rien n'est lu ni envoyé`, [issue, b.lectures, b.envois], ["ignore", [], []]);
}

for (const [nom, ligne] of [
  ["l'état en base n'est plus celui annoncé (demandée)", { clientUserId: CLIENT, statut: "demandee" }],
  ["l'état en base est un autre (annulée par le client)", { clientUserId: CLIENT, statut: "annulee_client" }],
  ["la réponse annoncée est « refusée » mais la base dit « confirmée »", { clientUserId: CLIENT, statut: "confirmee" }],
  ["réservation introuvable", null],
  ["réservation sans compte (invité)", { clientUserId: null, statut: "refusee" }],
  ["compte illisible", { clientUserId: "pas-un-uuid", statut: "refusee" }],
] as const) {
  const b = ports(ligne);
  const issue = await envoyerMessageReservation(b.p, RES, "refusee");
  verifier(`${nom} : rien n'est envoyé`, [issue, b.envois], ["ignore", []]);
}

{
  const b = ports(new Error("panne de base"));
  let leve = "";
  try { await envoyerMessageReservation(b.p, RES, "confirmee"); } catch (e) { leve = (e as Error).message; }
  verifier("lecture en panne : l'erreur remonte (la route interne la journalise sous un code fixe), rien n'est envoyé", [leve, b.envois], ["panne de base", []]);
}

{
  const b = ports({ clientUserId: CLIENT, statut: "confirmee" });
  await envoyerMessageReservation(b.p, RES, "confirmee");
  const vu = JSON.stringify(b.envois);
  verifier("l'envoi ne porte que le compte et le type : ni identifiant de réservation, ni statut brut, ni nom, ni téléphone", [vu.includes(RES), vu.includes('"statut"'), /Aminata|\+224/.test(vu)], [false, false, false]);
}

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nMessages de réservation vérifiés.");
