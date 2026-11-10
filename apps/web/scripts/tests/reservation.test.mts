import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELAI_MIN_MINUTES, estStatutReservation, estTerminal, HONOREE_AVANCE_MINUTES, HORIZON_MAX_JOURS, libelleStatutReservation, motifObligatoire, NB_PERSONNES_MAX, NB_PERSONNES_MIN,
  STATUTS_RESERVATION, TRANSITIONS_RESERVATION, transitionPermise, type StatutReservation,
} from "@speedfood/shared/reservation/statuts";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// ---- statuts et transitions
verifier("sept états", STATUTS_RESERVATION.length, 7);
verifier("états attendus", [...STATUTS_RESERVATION], ["demandee", "confirmee", "refusee", "annulee_client", "annulee_restaurant", "honoree", "non_honoree"]);
verifier("demandee -> confirmee permis", transitionPermise("demandee", "confirmee"), true);
verifier("demandee -> refusee permis", transitionPermise("demandee", "refusee"), true);
verifier("demandee -> annulee_client permis", transitionPermise("demandee", "annulee_client"), true);
verifier("demandee -> annulee_restaurant interdit", transitionPermise("demandee", "annulee_restaurant"), false);
verifier("demandee -> honoree interdit", transitionPermise("demandee", "honoree"), false);
verifier("demandee -> non_honoree interdit", transitionPermise("demandee", "non_honoree"), false);
verifier("confirmee -> annulee_client permis", transitionPermise("confirmee", "annulee_client"), true);
verifier("confirmee -> annulee_restaurant permis", transitionPermise("confirmee", "annulee_restaurant"), true);
verifier("confirmee -> honoree permis", transitionPermise("confirmee", "honoree"), true);
verifier("confirmee -> non_honoree permis", transitionPermise("confirmee", "non_honoree"), true);
verifier("confirmee -> refusee interdit", transitionPermise("confirmee", "refusee"), false);
verifier("confirmee -> demandee interdit", transitionPermise("confirmee", "demandee"), false);
verifier("un état ne mène pas à lui-même", STATUTS_RESERVATION.some((s) => transitionPermise(s, s)), false);
for (const s of ["refusee", "annulee_client", "annulee_restaurant", "honoree", "non_honoree"] as StatutReservation[]) {
  verifier(`${s} est terminal`, estTerminal(s), true);
  verifier(`${s} ne mène nulle part`, STATUTS_RESERVATION.filter((v) => transitionPermise(s, v)), []);
}
verifier("demandee n'est pas terminal", estTerminal("demandee"), false);
verifier("confirmee n'est pas terminal", estTerminal("confirmee"), false);
verifier("chaque destination est un état connu", Object.values(TRANSITIONS_RESERVATION).flat().every((s) => estStatutReservation(s)), true);
verifier("estStatutReservation refuse l'inconnu", [estStatutReservation("x"), estStatutReservation(null), estStatutReservation(3)], [false, false, false]);
verifier("motif obligatoire : refusee", motifObligatoire("refusee"), true);
verifier("motif obligatoire : annulee_restaurant", motifObligatoire("annulee_restaurant"), true);
verifier("motif non exigé : annulee_client", motifObligatoire("annulee_client"), false);
verifier("motif non exigé : confirmee", motifObligatoire("confirmee"), false);

// ---- libellés
verifier("libellé demandee", libelleStatutReservation("demandee"), "Demandée");
verifier("libellé confirmee", libelleStatutReservation("confirmee"), "Confirmée");
verifier("libellé refusee", libelleStatutReservation("refusee"), "Refusée");
verifier("libellé annulee_client", libelleStatutReservation("annulee_client"), "Annulée par vous");
verifier("libellé annulee_restaurant", libelleStatutReservation("annulee_restaurant"), "Annulée par le restaurant");
verifier("libellé honoree", libelleStatutReservation("honoree"), "Honorée");
verifier("libellé non_honoree", libelleStatutReservation("non_honoree"), "Non honorée");
verifier("libellé inconnu retombe sur Demandée", libelleStatutReservation("n'importe quoi"), "Demandée");
verifier("chaque état a un libellé distinct", new Set(STATUTS_RESERVATION.map(libelleStatutReservation)).size, 7);

// ---- bornes
verifier("nb de personnes min", NB_PERSONNES_MIN, 1);
verifier("nb de personnes max", NB_PERSONNES_MAX, 12);
verifier("délai minimum", DELAI_MIN_MINUTES, 30);
verifier("horizon maximum", HORIZON_MAX_JOURS, 60);
verifier("avance de « honorée »", HONOREE_AVANCE_MINUTES, 60);

// ---- parité avec la migration SQL (analysée dans son texte)
const racine = process.env.SPEEDFOOD_RACINE;
if (racine) {
  const sql = readFileSync(join(racine, "..", "..", "supabase", "migrations", "20261110090000_reservations_table.sql"), "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

  const bloc = sql.match(/statut text not null default 'demandee'\s*check \(statut in \(([^)]*)\)\)/);
  verifier("SQL : la liste des états est trouvée", bloc !== null, true);
  const statutsSql = bloc ? [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];
  verifier("SQL : les états sont ceux du module TypeScript, dans le même ordre", statutsSql, [...STATUTS_RESERVATION]);

  const trans = sql.match(/\(old\.statut, new\.statut\) not in \(([\s\S]*?)\n\s*\) then/);
  verifier("SQL : la liste des transitions est trouvée", trans !== null, true);
  const pairesSql = trans ? [...trans[1].matchAll(/\('([a-z_]+)',\s*'([a-z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort() : [];
  const pairesTs = STATUTS_RESERVATION.flatMap((de) => TRANSITIONS_RESERVATION[de].map((vers) => `${de}>${vers}`)).sort();
  verifier("SQL : les transitions sont exactement celles du module TypeScript", pairesSql, pairesTs);

  const terminauxSql = sql.match(/if old\.statut in \(([^)]*)\)\s*\n\s*and new\.motif_refus/);
  const listeTerminaux = terminauxSql ? [...terminauxSql[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort() : [];
  verifier("SQL : les états terminaux figés sont ceux du module", listeTerminaux, STATUTS_RESERVATION.filter(estTerminal).sort());

  const motifSql = sql.match(/check \(statut not in \(([^)]*)\) or motif_refus is not null\)/);
  const motifs = motifSql ? [...motifSql[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort() : [];
  verifier("SQL : les états qui exigent un motif sont ceux du module", motifs, STATUTS_RESERVATION.filter(motifObligatoire).sort());

  verifier("SQL : bornes du nombre de personnes", sql.includes(`nb_personnes between ${NB_PERSONNES_MIN} and ${NB_PERSONNES_MAX}`), true);
  verifier("SQL : délai minimum de création", sql.includes(`interval '${DELAI_MIN_MINUTES} minutes'`), true);
  verifier("SQL : horizon maximum de création", sql.includes(`interval '${HORIZON_MAX_JOURS} days'`), true);
  verifier("SQL : avance de « honorée »", sql.includes(`now() < old.creneau - interval '${HONOREE_AVANCE_MINUTES / 60} hour'`), true);
}

if (ko > 0) {
  console.log(`\n${ko} test(s) de la réservation en échec.`);
  process.exit(1);
}
console.log("\nTous les tests de la réservation passent.");
