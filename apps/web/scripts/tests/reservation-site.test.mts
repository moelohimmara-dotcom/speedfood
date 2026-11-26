import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NB_JOURS_RESERVABLES, creneauAccepte, creneauIso, creneauxDuJour, formaterCreneau, formaterHeure, formaterJour, joursReservables,
} from "../../src/lib/reservation/creneaux";
import { MESSAGE_CRENEAU_HORS_PLAGE, PREMIER_CRENEAU_HEURE, DERNIER_CRENEAU_HEURE, heuresDeLaPlage } from "../../src/lib/contracts/reservation";
import { recapitulatifReservation, validerFormulaireReservation, type BrutReservation } from "../../src/lib/reservation/formulaire";
import {
  construireReglage, construireDecision, jourSuivant, jourPrecedent, libelleAction, libelleCapacite, ordonnerActions, tonStatutReservation,
} from "../../src/lib/reservation/console";
import { classerMesReservations, peutAnnulerReservation } from "../../src/lib/reservation/liste";

// Réservation de table sur le site (lot M4b) : jours et créneaux en UTC, validation du formulaire, aides de la console. Fonctions pures, sans réseau ni base.
let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const RESTO = "0b6f2a5e-9a7e-4f43-8a52-6d1b0c9e1a11";
const MAINTENANT = new Date("2026-11-10T12:07:00.000Z");

// ---------- jours : 14 jours, calendrier UTC ----------
const jours = joursReservables(MAINTENANT);
verifier("14 jours proposés", [NB_JOURS_RESERVABLES, jours.length], [14, 14]);
verifier("premier jour = aujourd'hui (UTC)", jours[0].valeur, "2026-11-10");
verifier("dernier jour = aujourd'hui + 13", jours[13].valeur, "2026-11-23");
verifier("libellé du jour en français", jours[0].libelle, "mardi 10 novembre");
verifier("jours consécutifs, sans doublon", new Set(jours.map((j) => j.valeur)).size, 14);
verifier("passage de mois : 28 novembre -> décembre", joursReservables(new Date("2026-11-28T08:00:00Z")).slice(2, 5).map((j) => j.valeur), ["2026-11-30", "2026-12-01", "2026-12-02"]);
verifier("passage d'année : 30 décembre -> janvier", joursReservables(new Date("2026-12-30T08:00:00Z")).slice(1, 4).map((j) => j.valeur), ["2026-12-31", "2027-01-01", "2027-01-02"]);

// Frontière de minuit : à 23 h 50 il ne reste aucun créneau aujourd'hui (délai de 30 minutes) : on passe au lendemain, et on garde 14 jours.
const tard = joursReservables(new Date("2026-11-10T23:50:00.000Z"));
verifier("23:50 : aujourd'hui n'est plus proposé", [tard[0].valeur, tard.length, tard[13].valeur], ["2026-11-11", 14, "2026-11-24"]);
verifier("23:30:00 pile : plus rien aujourd'hui", creneauxDuJour("2026-11-10", new Date("2026-11-10T23:30:00.000Z")), []);
verifier("09:30:00 pile : 10:00 aujourd'hui proposé (délai exact de 30 minutes)", creneauxDuJour("2026-11-10", new Date("2026-11-10T09:30:00.000Z"))[0], "10:00");
verifier("09:30:00.001 : 10:00 refusé, 10:15 proposé", creneauxDuJour("2026-11-10", new Date("2026-11-10T09:30:00.001Z"))[0], "10:15");
verifier("22:00 : aujourd'hui garde 22:30 et 22:45 (le dernier créneau est 22:45)", creneauxDuJour("2026-11-10", new Date("2026-11-10T22:00:00.000Z")), ["22:30", "22:45"]);
verifier("22:16 : plus aucun créneau aujourd'hui, la liste des jours commence demain", [creneauxDuJour("2026-11-10", new Date("2026-11-10T22:16:00.000Z")), joursReservables(new Date("2026-11-10T22:16:00.000Z"))[0].valeur], [[], "2026-11-11"]);
verifier("22:15:00 pile : 22:45 encore proposé", creneauxDuJour("2026-11-10", new Date("2026-11-10T22:15:00.000Z")), ["22:45"]);
verifier("23:30 : demain commence à 10:00 (jamais 00:00 ni la nuit)", creneauxDuJour("2026-11-11", new Date("2026-11-10T23:30:00.000Z"))[0], "10:00");

// ---------- créneaux : quarts d'heure, délai de 30 minutes ----------
const aujourdhui = creneauxDuJour("2026-11-10", MAINTENANT);
verifier("12:07 : premier créneau 12:45 (au moins 30 minutes d'avance)", aujourdhui[0], "12:45");
verifier("dernier créneau 22:45", aujourdhui[aujourdhui.length - 1], "22:45");
verifier("tous les créneaux sont des quarts d'heure exacts", aujourdhui.every((h) => /^\d{2}:(00|15|30|45)$/.test(h)), true);
verifier("12:00:00 pile : 12:30 accepté", creneauxDuJour("2026-11-10", new Date("2026-11-10T12:00:00.000Z"))[0], "12:30");
verifier("00:00:00 : 52 créneaux aujourd'hui (10:00 à 22:45)", creneauxDuJour("2026-11-10", new Date("2026-11-10T00:00:00.000Z")).length, 52);
verifier("un jour futur : 52 créneaux, de 10:00 à 22:45", (() => { const l = creneauxDuJour("2026-11-12", MAINTENANT); return [l.length, l[0], l[51]]; })(), [52, "10:00", "22:45"]);
verifier("aucun créneau de nuit ni avant 10:00 ni après 22:45", (() => { const l = creneauxDuJour("2026-11-12", MAINTENANT); return [l.includes("09:45"), l.includes("23:00"), l.includes("00:00"), l.includes("23:45")]; })(), [false, false, false, false]);
verifier("un jour passé : aucun créneau", creneauxDuJour("2026-11-09", MAINTENANT), []);
verifier("un jour lointain (hors 60 jours) : aucun créneau", creneauxDuJour("2027-03-01", MAINTENANT), []);
verifier("jour invalide : aucun créneau", [creneauxDuJour("2026-02-30", MAINTENANT), creneauxDuJour("demain", MAINTENANT)], [[], []]);

// ---------- plage partagée : le site, l'application et le serveur lisent la MÊME constante ----------
verifier("parité : les heures du site sont exactement celles de la constante partagée (10:00 à 22:45)", creneauxDuJour("2026-11-12", MAINTENANT), heuresDeLaPlage());
verifier("parité : bornes de la constante", [PREMIER_CRENEAU_HEURE, DERNIER_CRENEAU_HEURE, heuresDeLaPlage().length], ["10:00", "22:45", 52]);
verifier("source : creneaux.ts ne recopie aucune borne (ni 10 * 60, ni 22 * 60, ni 22:45 en dur)", /10 * 60|22 * 60|"22:45"|"10:00"/.test(readFileSync(join(process.env.SPEEDFOOD_RACINE ?? process.cwd(), "src/lib/reservation/creneaux.ts"), "utf8")), false);

// ---------- créneau ISO et affichage : jamais le fuseau du navigateur ni du serveur ----------
verifier("créneau ISO UTC", creneauIso("2026-11-12", "19:15"), "2026-11-12T19:15:00.000Z");
verifier("créneau ISO : minuit", creneauIso("2026-11-12", "00:00"), "2026-11-12T00:00:00.000Z");
verifier("créneau ISO : pas un quart d'heure", creneauIso("2026-11-12", "19:10"), null);
verifier("créneau ISO : heure impossible", [creneauIso("2026-11-12", "24:00"), creneauIso("2026-11-12", "7:15"), creneauIso("2026-11-12", "")], [null, null, null]);
verifier("créneau ISO : jour impossible", creneauIso("2026-02-30", "19:15"), null);
verifier("affichage : jeudi 12 novembre à 19:15", formaterCreneau("2026-11-12T19:15:00.000Z"), "jeudi 12 novembre à 19:15");
verifier("affichage : minuit reste le même jour", formaterCreneau("2026-11-13T00:00:00.000Z"), "vendredi 13 novembre à 00:00");
verifier("affichage : 23:45", formaterCreneau("2026-11-12T23:45:00.000Z"), "jeudi 12 novembre à 23:45");
verifier("affichage : 1er du mois", formaterCreneau("2026-12-01T08:30:00.000Z"), "mardi 1er décembre à 08:30");
verifier("heure seule, en UTC", [formaterHeure("2026-11-12T19:15:00.000Z"), formaterHeure("2026-11-13T00:00:00.000Z"), formaterHeure("x")], ["19:15", "00:00", "--:--"]);
verifier("affichage d'un jour", formaterJour("2026-11-12"), "jeudi 12 novembre");
verifier("affichage illisible : texte neutre, pas d'exception", formaterCreneau("n'importe quoi"), "Date inconnue");

for (const fuseau of ["Pacific/Auckland", "America/Los_Angeles", "Asia/Kolkata"]) {
  const avant = process.env.TZ;
  process.env.TZ = fuseau;
  verifier(`fuseau ${fuseau} : jours identiques`, joursReservables(MAINTENANT).map((j) => j.valeur), jours.map((j) => j.valeur));
  verifier(`fuseau ${fuseau} : créneaux identiques`, creneauxDuJour("2026-11-10", MAINTENANT), aujourdhui);
  verifier(`fuseau ${fuseau} : créneau ISO identique`, creneauIso("2026-11-12", "23:45"), "2026-11-12T23:45:00.000Z");
  verifier(`fuseau ${fuseau} : affichage identique`, formaterCreneau("2026-11-12T23:45:00.000Z"), "jeudi 12 novembre à 23:45");
  if (avant === undefined) delete process.env.TZ;
  else process.env.TZ = avant;
}

const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const sourceCreneaux = readFileSync(join(racine, "src/lib/reservation/creneaux.ts"), "utf8");
verifier(
  "creneaux.ts : aucune fonction d'heure locale ni de fuseau (getHours, getDate, getDay, toLocale, Intl, getTimezoneOffset, new Date(a, b))",
  /\.(getHours|getMinutes|getDate|getDay|getMonth|getFullYear|getTimezoneOffset)\(|toLocale|Intl\.|new Date\(\s*\d/.test(sourceCreneaux),
  false,
);

verifier("créneau accepté", creneauAccepte("2026-11-10T12:45:00.000Z", MAINTENANT), "ok");
verifier("créneau trop proche (moins de 30 minutes)", creneauAccepte("2026-11-10T12:30:00.000Z", MAINTENANT), "trop_proche");
verifier("créneau pile à 30 minutes : accepté", creneauAccepte("2026-11-10T12:37:00.000Z", MAINTENANT), "ok");
verifier("créneau passé", creneauAccepte("2026-11-09T12:45:00.000Z", MAINTENANT), "trop_proche");
verifier("créneau au-delà des 14 jours proposés", creneauAccepte("2026-11-25T12:45:00.000Z", MAINTENANT), "trop_loin");
verifier("créneau le dernier jour proposé", creneauAccepte("2026-11-23T22:45:00.000Z", MAINTENANT), "ok");
verifier("créneau hors plage : 09:45 et 23:00 et minuit", [creneauAccepte("2026-11-12T09:45:00.000Z", MAINTENANT), creneauAccepte("2026-11-12T23:00:00.000Z", MAINTENANT), creneauAccepte("2026-11-13T00:00:00.000Z", MAINTENANT)], ["hors_plage", "hors_plage", "hors_plage"]);
verifier("créneau en plage : 10:00 et 22:45", [creneauAccepte("2026-11-12T10:00:00.000Z", MAINTENANT), creneauAccepte("2026-11-12T22:45:00.000Z", MAINTENANT)], ["ok", "ok"]);
verifier("créneau illisible", creneauAccepte("demain soir", MAINTENANT), "invalide");

// ---------- formulaire ----------
const BON: BrutReservation = { restaurantId: RESTO, jour: "2026-11-12", heure: "19:15", nbPersonnes: "4", nom: "  Aïssatou   Diallo ", telephone: "620 00 00 00", note: "" };
const ok = validerFormulaireReservation(BON, MAINTENANT, 12);
verifier("formulaire valide : demande normalisée", ok.ok ? ok.demande : ok, { restaurantId: RESTO, creneau: "2026-11-12T19:15:00.000Z", nbPersonnes: 4, nom: "Aïssatou Diallo", telephone: "+224620000000", note: null });
verifier("formulaire valide : la note est gardée nettoyée", (() => { const r = validerFormulaireReservation({ ...BON, note: "  Près de la fenêtre,\n merci " }, MAINTENANT, 12); return r.ok ? r.demande.note : null; })(), "Près de la fenêtre, merci");
verifier("formulaire valide : nombre de personnes en nombre", (() => { const r = validerFormulaireReservation({ ...BON, nbPersonnes: 12 }, MAINTENANT, 12); return r.ok ? r.demande.nbPersonnes : null; })(), 12);
verifier("formulaire : téléphone avec indicatif", (() => { const r = validerFormulaireReservation({ ...BON, telephone: "+224 620 00 00 00" }, MAINTENANT, 12); return r.ok ? r.demande.telephone : null; })(), "+224620000000");

function erreurs(brut: Partial<BrutReservation>, nbMax = 12, maintenant = MAINTENANT): string[] {
  const r = validerFormulaireReservation({ ...BON, ...brut }, maintenant, nbMax);
  return r.ok ? [] : Object.keys(r.erreurs).sort();
}
verifier("nombre de personnes : 0 refusé", erreurs({ nbPersonnes: "0" }), ["nbPersonnes"]);
verifier("nombre de personnes : au-delà du maximum du restaurant", erreurs({ nbPersonnes: "9" }, 8), ["nbPersonnes"]);
verifier("nombre de personnes : égal au maximum accepté", erreurs({ nbPersonnes: "8" }, 8), []);
verifier("nombre de personnes : texte ou décimal refusé", [erreurs({ nbPersonnes: "abc" }), erreurs({ nbPersonnes: "2.5" }), erreurs({ nbPersonnes: "" })], [["nbPersonnes"], ["nbPersonnes"], ["nbPersonnes"]]);
verifier("nombre de personnes : jamais au-delà de 12, même si le maximum annoncé est plus haut", erreurs({ nbPersonnes: "13" }, 99), ["nbPersonnes"]);
verifier("nom trop court", erreurs({ nom: "A" }), ["nom"]);
verifier("nom trop long (61)", erreurs({ nom: "x".repeat(61) }), ["nom"]);
verifier("nom : 60 caractères acceptés", erreurs({ nom: "x".repeat(60) }), []);
verifier("téléphone invalide", erreurs({ telephone: "123" }), ["telephone"]);
verifier("téléphone vide", erreurs({ telephone: "" }), ["telephone"]);
verifier("note trop longue (201)", erreurs({ note: "n".repeat(201) }), ["note"]);
verifier("note : 200 caractères acceptés", erreurs({ note: "n".repeat(200) }), []);
verifier("heure : pas un quart d'heure", erreurs({ heure: "19:10" }), ["heure"]);
verifier("heure : 09:45 et 23:00 refusées (plage de 10:00 à 22:45)", [erreurs({ heure: "09:45" }), erreurs({ heure: "23:00" }), erreurs({ heure: "00:00" })], [["heure"], ["heure"], ["heure"]]);
verifier("heure : 10:00 et 22:45 acceptées", [erreurs({ heure: "10:00" }), erreurs({ heure: "22:45" })], [[], []]);
verifier("heure hors plage : message clair, sans reprendre la saisie", (() => { const r = validerFormulaireReservation({ ...BON, heure: "23:00" }, MAINTENANT, 12); return r.ok ? null : r.erreurs.heure; })(), MESSAGE_CRENEAU_HORS_PLAGE);
verifier("heure absente", erreurs({ heure: "" }), ["heure"]);
verifier("jour absent", erreurs({ jour: "" }), ["jour"]);
verifier("jour au-delà des 14 jours", erreurs({ jour: "2026-11-24" }), ["jour"]);
verifier("jour passé", erreurs({ jour: "2026-11-09" }), ["jour"]);
verifier("créneau trop proche : message sur l'heure", erreurs({ jour: "2026-11-10", heure: "12:15" }), ["heure"]);
verifier("restaurant invalide", erreurs({ restaurantId: "pas-un-uuid" }), ["restaurantId"]);
verifier("plusieurs erreurs à la fois", erreurs({ nom: "A", telephone: "1", nbPersonnes: "0" }), ["nbPersonnes", "nom", "telephone"]);
verifier("un message en français correct, jamais la saisie", (() => {
  const r = validerFormulaireReservation({ ...BON, nom: "A", telephone: "SECRET-123" }, MAINTENANT, 12);
  return r.ok ? "ok" : [JSON.stringify(r).includes("SECRET-123"), r.message.length > 0, /caract[eè]res/.test(r.erreurs.nom ?? "")];
})(), [false, true, true]);
verifier("des caractères de contrôle dans le nom sont nettoyés", (() => { const r = validerFormulaireReservation({ ...BON, nom: "Mamadou\u0000\u0007 Bah" }, MAINTENANT, 12); return r.ok ? r.demande.nom : null; })(), "Mamadou Bah");
verifier("jamais de clé d'identité dans la demande", (() => {
  const r = validerFormulaireReservation({ ...BON, utilisateurId: "u-1", compte: "c-1" } as unknown as BrutReservation, MAINTENANT, 12);
  return r.ok ? Object.keys(r.demande).sort() : null;
})(), ["creneau", "nbPersonnes", "nom", "note", "restaurantId", "telephone"]);

verifier(
  "récapitulatif : demande, confirmation par le restaurant, aucun paiement",
  recapitulatifReservation({ restaurantId: RESTO, creneau: "2026-11-12T19:15:00.000Z", nbPersonnes: 4, nom: "Aïssatou Diallo", telephone: "+224620000000", note: null }, "Chez Fatou"),
  { demande: "Demande de réservation : Chez Fatou, jeudi 12 novembre à 19:15, 4 personnes, au nom de Aïssatou Diallo.", suite: "Le restaurant doit la confirmer. Aucun paiement." },
);
verifier("récapitulatif : une personne au singulier", recapitulatifReservation({ restaurantId: RESTO, creneau: "2026-11-12T19:15:00.000Z", nbPersonnes: 1, nom: "Bah", telephone: "+224620000000", note: null }, "Chez Fatou").demande.includes("1 personne,"), true);

// ---------- console du restaurateur ----------
verifier("action : libellés français", (["confirmer", "refuser", "annuler", "honoree", "non_honoree"] as const).map(libelleAction), ["Confirmer", "Refuser", "Annuler la réservation", "Client venu", "Client absent"]);
verifier("les actions affichées sont EXACTEMENT celles de l'API, sans ajout ni déduction", ordonnerActions(["refuser", "confirmer"]), ["confirmer", "refuser"]);
verifier("aucune action renvoyée : aucune action affichée (rien déduit du statut)", ordonnerActions([]), []);
verifier("une seule action renvoyée : une seule affichée", ordonnerActions(["annuler"]), ["annuler"]);
verifier("décision sans motif pour confirmer", construireDecision("confirmer", ""), { ok: true, corps: { action: "confirmer", motif: null } });
verifier("décision : un motif saisi pour confirmer n'est pas envoyé", construireDecision("honoree", "bonjour"), { ok: true, corps: { action: "honoree", motif: null } });
verifier("refuser exige un motif", construireDecision("refuser", "").ok, false);
verifier("refuser : motif de 2 caractères refusé", construireDecision("refuser", "ab").ok, false);
verifier("refuser : motif de 3 caractères accepté", construireDecision("refuser", "abc"), { ok: true, corps: { action: "refuser", motif: "abc" } });
verifier("annuler : motif de 200 caractères accepté, 201 refusé", [construireDecision("annuler", "m".repeat(200)).ok, construireDecision("annuler", "m".repeat(201)).ok], [true, false]);
verifier("annuler : motif nettoyé", construireDecision("annuler", "  Plus   de place \n ce soir "), { ok: true, corps: { action: "annuler", motif: "Plus de place ce soir" } });
verifier("décision : message de refus clair", (() => { const r = construireDecision("refuser", "a"); return r.ok ? "ok" : r.message; })(), "Indiquez un motif de 3 à 200 caractères : le client le lira.");

verifier("réglage : capacité vide = sans plafond", construireReglage(true, ""), { ok: true, corps: { accepteReservation: true, capaciteCouverts: null } });
verifier("réglage : capacité de 40", construireReglage(false, " 40 "), { ok: true, corps: { accepteReservation: false, capaciteCouverts: 40 } });
verifier("réglage : bornes 1 et 500", [construireReglage(true, "1").ok, construireReglage(true, "500").ok, construireReglage(true, "0").ok, construireReglage(true, "501").ok], [true, true, false, false]);
verifier("réglage : texte ou décimal refusé", [construireReglage(true, "beaucoup").ok, construireReglage(true, "2,5").ok, construireReglage(true, "-3").ok], [false, false, false]);
verifier("réglage : message de capacité", (() => { const r = construireReglage(true, "900"); return r.ok ? "ok" : r.message; })(), "La capacité doit être comprise entre 1 et 500 couverts.");
verifier("capacité affichée", [libelleCapacite(null), libelleCapacite(1), libelleCapacite(40)], ["Sans plafond", "1 couvert par créneau", "40 couverts par créneau"]);

verifier("jour suivant et précédent (UTC, frontière de mois)", [jourSuivant("2026-11-30"), jourPrecedent("2026-12-01"), jourSuivant("2026-12-31"), jourPrecedent("2027-01-01")], ["2026-12-01", "2026-11-30", "2027-01-01", "2026-12-31"]);
verifier("jour suivant d'un jour invalide : null", [jourSuivant("2026-02-30"), jourPrecedent("x")], [null, null]);
verifier("tons des états", (["demandee", "confirmee", "refusee", "annulee_client", "annulee_restaurant", "honoree", "non_honoree"] as const).map(tonStatutReservation), ["neutre", "succes", "danger", "danger", "danger", "succes", "danger"]);

// ---------- mes réservations ----------
const resa = (id: string, statut: string, creneau: string) => ({ id, statut, creneau }) as unknown as Parameters<typeof peutAnnulerReservation>[0] & { id: string };
verifier("annulation proposée : demandée ou confirmée, à venir", [peutAnnulerReservation(resa("a", "demandee", "2026-11-12T19:00:00.000Z"), MAINTENANT), peutAnnulerReservation(resa("a", "confirmee", "2026-11-12T19:00:00.000Z"), MAINTENANT)], [true, true]);
verifier("annulation non proposée : créneau passé", peutAnnulerReservation(resa("a", "confirmee", "2026-11-10T11:00:00.000Z"), MAINTENANT), false);
verifier("annulation non proposée : états finals", ["refusee", "annulee_client", "annulee_restaurant", "honoree", "non_honoree"].map((s) => peutAnnulerReservation(resa("a", s, "2026-11-12T19:00:00.000Z"), MAINTENANT)), [false, false, false, false, false]);
const classees = classerMesReservations(
  [resa("loin", "confirmee", "2026-11-20T19:00:00.000Z"), resa("hier", "honoree", "2026-11-09T19:00:00.000Z"), resa("proche", "demandee", "2026-11-11T19:00:00.000Z"), resa("refusee", "refusee", "2026-11-15T19:00:00.000Z"), resa("avant-hier", "non_honoree", "2026-11-08T19:00:00.000Z")],
  MAINTENANT,
);
verifier("à venir : le plus proche d'abord", classees.aVenir.map((r) => r.id), ["proche", "loin"]);
verifier("passées et terminées : le plus récent d'abord", classees.passees.map((r) => r.id), ["refusee", "hier", "avant-hier"]);
verifier("classement : la liste d'origine n'est pas modifiée", (() => { const l = [resa("b", "confirmee", "2026-11-20T19:00:00.000Z"), resa("a", "confirmee", "2026-11-12T19:00:00.000Z")]; classerMesReservations(l, MAINTENANT); return l.map((r) => r.id); })(), ["b", "a"]);

// ---------- vocabulaire : aucune mention d'espèces dans les fichiers de la réservation du site ----------
for (const f of ["src/lib/reservation/creneaux.ts", "src/lib/reservation/formulaire.ts", "src/lib/reservation/console.ts", "src/lib/reservation/liste.ts"]) {
  verifier(`aucune mention d'espèces : ${f}`, /esp[eè]ces|\bcash\b/i.test(readFileSync(join(racine, f), "utf8")), false);
}

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nRéservation du site (jours, créneaux, formulaire, console) vérifiée.");
