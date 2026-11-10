// Mutations M3 (réservation de table, serveur) : zéro réseau, sources gardées/restaurées en Buffer (try/finally), suite complète initiale ET finale obligatoires.
// Chaque mutation doit faire échouer au moins un test des fichiers `tests/reservation-*.test.ts` ; une mutation survivante fait échouer le script (code 1).
// Usage (depuis apps/api ou la racine) : node apps/api/scripts/muter-reservation-m3.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const chemin = p => fileURLToPath(new URL(p, import.meta.url));
const api = chemin('..');
const CLIENT = chemin('../src/reservation/client.ts');
const RESTAURATEUR = chemin('../src/reservation/restaurateur.ts');
const REGLES = chemin('../src/reservation/regles.ts');
const ACCES = chemin('../src/reservation/acces.ts');
const ROUTE = chemin('../src/routes/reservation.ts');
const CONTRAT = chemin('../../../packages/shared/src/contracts/reservation.ts');
const APP = chemin('../src/app.ts');
const WORKER = chemin('../src/worker.ts');

// Un seul `cible → remplace` par mutation (la cible doit être UNIQUE dans le fichier, sinon le script s'arrête).
const mutations = [
  // --- création : règles métier ---
  { nom: '01. capacité exacte refusée (> devient >=)', fichier: CLIENT, cible: 'if (deja + d.nbPersonnes > restaurant.capaciteCouverts) {', remplace: 'if (deja + d.nbPersonnes >= restaurant.capaciteCouverts) {' },
  { nom: '02. capacité jamais contrôlée', fichier: CLIENT, cible: 'if (deja + d.nbPersonnes > restaurant.capaciteCouverts) {', remplace: 'if (false) {' },
  { nom: '03. plafond de 3 réservations actives repoussé à 4', fichier: CLIENT, cible: 'if (actives.length >= MAX_RESERVATIONS_ACTIVES_PAR_COMPTE) {', remplace: 'if (actives.length > MAX_RESERVATIONS_ACTIVES_PAR_COMPTE) {' },
  { nom: '04. doublon de créneau du compte accepté', fichier: CLIENT, cible: 'if (actives.some((r) => Date.parse(r.creneau) === creneauMs)) {', remplace: 'if (false) {' },
  { nom: '05. rejeu idempotent supprimé (une seconde réservation serait créée)', fichier: CLIENT, cible: 'if (existante) return', remplace: 'if (false) return' },
  { nom: '06. rejeu idempotent sans comparer le nombre de personnes', fichier: CLIENT, cible: ' && r.nbPersonnes === d.nbPersonnes);', remplace: ');' },
  { nom: '07. rejeu idempotent sans comparer le restaurant', fichier: CLIENT, cible: 'r.restaurantId === d.restaurantId && ', remplace: '' },
  { nom: '08. compte écrit pris ailleurs que du jeton', fichier: CLIENT, cible: 'clientUserId: utilisateurId,', remplace: 'clientUserId: d.restaurantId,' },
  { nom: '09. restaurant non publié ou suspendu accepté', fichier: CLIENT, cible: 'if (!restaurant.publie || restaurant.suspendu) return', remplace: 'if (false) return' },
  { nom: '10. restaurant qui n\'accepte pas les réservations accepté', fichier: CLIENT, cible: 'if (!restaurant.accepteReservation) return', remplace: 'if (false) return' },
  { nom: '11. collision de référence : un seul essai', fichier: CLIENT, cible: 'essai <= ESSAIS_INSERTION;', remplace: 'essai <= 1;' },
  { nom: '12. erreur de la base reprise telle quelle (fuite du texte SQL)', fichier: CLIENT, cible: 'if (r.genre === "base") return refus(traduireErreurBase(r.erreur));\n        // « reference_prise »', remplace: 'if (r.genre === "base") return refus({ code: "ERREUR_SERVEUR", message: String(r.erreur.message) });\n        // « reference_prise »' },
  { nom: '13. fenêtre : 30 minutes pile refusées', fichier: REGLES, cible: 'if (creneauMs < maintenantMs + DELAI_MIN_MINUTES * MINUTE)', remplace: 'if (creneauMs <= maintenantMs + DELAI_MIN_MINUTES * MINUTE)' },
  // --- annulation par le client ---
  { nom: '14. annulation client : idempotence supprimée (une écriture est refaite)', fichier: CLIENT, cible: 'if (actuelle.statut === "annulee_client") return { ok: true as const, reservation: actuelle };', remplace: '' },
  { nom: '15. annulation client : créneau passé accepté', fichier: REGLES, cible: 'if (creneauMs <= maintenantMs) return { code: "CONFLIT_ETAT", message: "Le créneau est passé : cette réservation ne peut plus être annulée." };', remplace: '' },
  { nom: '16. lecture d\'une réservation sans filtrer sur le compte', fichier: ACCES, cible: '.eq("id", id).eq("client_user_id", utilisateurId).maybeSingle();', remplace: '.eq("id", id).maybeSingle();' },
  // --- restaurateur ---
  { nom: '17. appartenance non vérifiée à la lecture d\'une réservation', fichier: ACCES, cible: '.eq("id", id).eq("restaurant_id", restaurantId).maybeSingle();\n      if (error) throw new Error("RESERVATIONS_INDISPONIBLES");\n      return data ? versLigneRestaurant', remplace: '.eq("id", id).maybeSingle();\n      if (error) throw new Error("RESERVATIONS_INDISPONIBLES");\n      return data ? versLigneRestaurant' },
  { nom: '18. appartenance non vérifiée à l\'écriture du statut', fichier: ACCES, cible: '.eq("restaurant_id", restaurantId)\n        .eq("statut", ancien)', remplace: '.eq("statut", ancien)' },
  { nom: '19. écriture du statut sans comparaison d\'état (écrasement possible)', fichier: ACCES, cible: '        .eq("statut", ancien)\n', remplace: '' },
  { nom: '20. transitions de statuts.ts ignorées', fichier: REGLES, cible: 'if (!transitionPermise(statut, cible)) {', remplace: 'if (false) {' },
  { nom: '21. confirmer un créneau passé accepté', fichier: REGLES, cible: 'if (cible === "confirmee" && creneauMs <= maintenantMs)', remplace: 'if (false)' },
  { nom: '22. « honorée » refusée à l\'heure pile (borne exacte)', fichier: REGLES, cible: 'if (cible === "honoree" && maintenantMs < creneauMs - HONOREE_AVANCE_MINUTES * MINUTE)', remplace: 'if (cible === "honoree" && maintenantMs <= creneauMs - HONOREE_AVANCE_MINUTES * MINUTE)' },
  { nom: '23. « non honorée » avant la fin du créneau acceptée', fichier: REGLES, cible: 'if (cible === "non_honoree" && maintenantMs < creneauMs)', remplace: 'if (false)' },
  { nom: '24. décision rejouée : idempotence supprimée', fichier: RESTAURATEUR, cible: 'if (actuelle.statut === cible) return', remplace: 'if (false) return' },
  { nom: '25. motif jamais enregistré', fichier: RESTAURATEUR, cible: 'actuelle.statut, cible, decision.motif);', remplace: 'actuelle.statut, cible, null);' },
  { nom: '26. liste du restaurateur sans les demandes à venir', fichier: RESTAURATEUR, cible: 'for (const l of [...duJour, ...demandes])', remplace: 'for (const l of [...duJour])' },
  // --- contrat : corps et parseurs ---
  { nom: '27. création : clés inconnues (compte, statut) acceptées', fichier: CONTRAT, cible: 'for (const cle of Object.keys(o)) if (!CLES_CREATION.includes(cle)) return refus("Demande invalide.");', remplace: '' },
  { nom: '28. création : créneau hors quart d\'heure accepté', fichier: CONTRAT, cible: 'if (instant % (PAS_CRENEAU_MINUTES * 60_000) !== 0)', remplace: 'if (false)' },
  { nom: '29. création : téléphone non normalisé (règle commune ignorée)', fichier: CONTRAT, cible: 'const telephone = typeof o.telephone === "string" ? normaliserTelephone(o.telephone) : null;', remplace: 'const telephone = typeof o.telephone === "string" ? o.telephone : null;' },
  { nom: '30. décision : motif non exigé', fichier: CONTRAT, cible: 'if (motif.length < MOTIF_RESERVATION_MIN || motif.length > MOTIF_RESERVATION_MAX) {', remplace: 'if (false) {' },
  { nom: '31. décision : « annuler » sans motif exigé', fichier: CONTRAT, cible: 'return action === "refuser" || action === "annuler";', remplace: 'return action === "refuser";' },
  { nom: '32. décision : restaurant ou compte dans le corps accepté', fichier: CONTRAT, cible: 'for (const cle of Object.keys(o)) if (cle !== "action" && cle !== "motif") return refus("Demande invalide.");', remplace: '' },
  { nom: '33. réglage : capacité 501 acceptée', fichier: CONTRAT, cible: 'c > CAPACITE_COUVERTS_MAX)) {', remplace: 'c > 5000)) {' },
  { nom: '34. parseur strict : statut inconnu accepté', fichier: CONTRAT, cible: 'if (!estStatutReservation(o.statut)) return illisible();', remplace: '' },
  { nom: '35. parseur strict : champ en trop accepté', fichier: CONTRAT, cible: 'if (!o || Object.keys(o).length !== cles.length || !cles.every((c) => Object.hasOwn(o, c))) return illisible();', remplace: 'if (!o || !cles.every((c) => Object.hasOwn(o, c))) return illisible();' },
  // --- routes ---
  { nom: '36. route client : plafond par compte retiré', fichier: ROUTE, cible: ', limiterParCompte(deps.limiterClientApplication)] as const;', remplace: '] as const;' },
  { nom: '37. route client : réponse non reprojetée (fuite possible du compte ou du jeton)', fichier: ROUTE, cible: 'const versClient = (brute: unknown) => projeterReservationClient(brute) ?? illisible();', remplace: 'const versClient = (brute: unknown) => brute;' },
  { nom: '38. route client : rejeu idempotent répondu en 201', fichier: ROUTE, cible: ', r.idempotent ? 200 : 201);', remplace: ', 201);' },
  { nom: '39. route client : identifiant mal formé transmis au service', fichier: ROUTE, cible: '    if (!REGEX_UUID.test(id)) return reponseErreur(c, INTROUVABLE);\n    const r = await deps.reservations.lire(', remplace: '    const r = await deps.reservations.lire(' },
  { nom: '40. route restaurateur : contexte (appartenance) non appelé avant la décision', fichier: ROUTE, cible: '  route.post("/:id/decision", identite, async (c) => {\n    const ctx = await contexteRestaurant(deps, c);', remplace: '  route.post("/:id/decision", identite, async (c) => {\n    const ctx = { supabase: {}, utilisateurId: c.get("utilisateurId"), restaurantId: "inconnu", role: "x" };' },
  { nom: '41. route restaurateur : réponse de décision non reprojetée', fichier: ROUTE, cible: 'const versRestaurant = (brute: unknown) => projeterReservationRestaurant(brute) ?? illisible();', remplace: 'const versRestaurant = (brute: unknown) => brute;' },
  // --- accès base ---
  { nom: '42. accès : un select sans colonnes explicites (select *)', fichier: ACCES, cible: 'export const COLONNES_REGLAGE_RESERVATION = "accepte_reservation, reservation_capacite_couverts";', remplace: 'export const COLONNES_REGLAGE_RESERVATION = "*";' },
  { nom: '43. accès : collision de référence non reconnue', fichier: ACCES, cible: 'if (erreur.code !== "23505") return false;', remplace: 'return false;' },
  { nom: '44. accès : liste du client non bornée à 50', fichier: ACCES, cible: 'const LIMITE_LISTE_CLIENT = 50;', remplace: 'const LIMITE_LISTE_CLIENT = 5000;' },
  // --- lot M4-0 : disponibilité (route GET /reservations/restaurants/:restaurantId/disponibilite) ---
  { nom: '47. disponibilité : « publié » ignoré', fichier: CLIENT, cible: 'dispo.publie && ', remplace: '' },
  { nom: '48. disponibilité : « suspendu » ignoré', fichier: CLIENT, cible: '!dispo.suspendu && ', remplace: '' },
  { nom: '49. disponibilité : « accepte les réservations » ignoré', fichier: CLIENT, cible: ' && dispo.accepteReservation };', remplace: ' };' },
  { nom: '50. disponibilité : restaurant inconnu répondu true', fichier: CLIENT, cible: 'dispo !== null && dispo.publie', remplace: 'dispo === null || dispo.publie' },
  { nom: '51. disponibilité : select * sur restaurants', fichier: ACCES, cible: 'export const COLONNES_DISPONIBILITE_RESERVATION = "publie, suspendu_le, accepte_reservation";', remplace: 'export const COLONNES_DISPONIBILITE_RESERVATION = "*";' },
  { nom: '52. disponibilité : colonne « publie » non lue (toujours publié)', fichier: ACCES, cible: 'return { publie: r.publie === true, suspendu', remplace: 'return { publie: true, suspendu' },
  { nom: '53. disponibilité : capacité ajoutée aux colonnes lues', fichier: ACCES, cible: 'export const COLONNES_DISPONIBILITE_RESERVATION = "publie, suspendu_le, accepte_reservation";', remplace: 'export const COLONNES_DISPONIBILITE_RESERVATION = "publie, suspendu_le, accepte_reservation, reservation_capacite_couverts";' },
  { nom: '54. disponibilité route : identifiant mal formé transmis au service', fichier: ROUTE, cible: '    if (!REGEX_UUID.test(restaurantId)) return reponseErreur(c, { code: "VALIDATION", message: "Restaurant invalide." });\n', remplace: '' },
  { nom: '55. disponibilité route : réponse non construite par le contrat (fuite du service amont)', fichier: ROUTE, cible: 'return repondre(c, construireReponseDisponibiliteReservation(restaurantId, r.accepteReservation));', remplace: 'return repondre(c, { ...r, ...construireReponseDisponibiliteReservation(restaurantId, r.accepteReservation) });' },
  { nom: '56. disponibilité route : porteur et plafond retirés', fichier: ROUTE, cible: 'route.get("/restaurants/:restaurantId/disponibilite", ...garde, async', remplace: 'route.get("/restaurants/:restaurantId/disponibilite", async' },
  { nom: '57. disponibilité contrat : borne dupliquée au lieu de NB_PERSONNES_MAX', fichier: CONTRAT, cible: 'accepteReservation, nbPersonnesMax: NB_PERSONNES_MAX };', remplace: 'accepteReservation, nbPersonnesMax: 10 };' },
  { nom: '58. disponibilité contrat : parseur sans borne haute', fichier: CONTRAT, cible: 'max < NB_PERSONNES_MIN || max > NB_PERSONNES_MAX)', remplace: 'max < NB_PERSONNES_MIN || max > 999)' },
  // --- montage ---
  { nom: '45. route client non montée dans app.ts', fichier: APP, cible: '  app.route("/api/v1/reservations", routeReservations(deps));', remplace: '' },
  { nom: '46. services de réservation non câblés dans worker.ts', fichier: WORKER, cible: '  reservations: serviceReservations,', remplace: '' },
];

const fichiers = [...new Set(mutations.map(m => m.fichier))];
const originaux = new Map(fichiers.map(f => [f, readFileSync(f)]));
const restaurer = () => { for (const [f, octets] of originaux) writeFileSync(f, octets); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restaurer(); process.exit(1); });

function appliquer(octets, cible, remplace, nom) {
  let c = Buffer.from(cible);
  if (octets.indexOf(c) < 0 && cible.includes('\n')) c = Buffer.from(cible.replace(/\n/g, '\r\n'));
  const debut = octets.indexOf(c);
  if (debut < 0 || octets.indexOf(c, debut + 1) >= 0) throw new Error('CIBLE_ABSENTE_OU_NON_UNIQUE : ' + nom + ' : ' + cible.slice(0, 70));
  const crlf = c.includes('\r\n');
  return Buffer.concat([octets.subarray(0, debut), Buffer.from(crlf ? remplace.replace(/\r?\n/g, '\r\n') : remplace), octets.subarray(debut + c.length)]);
}

// Toutes les mutations sont préparées (et leurs cibles vérifiées) AVANT d'écrire quoi que ce soit.
const plans = mutations.map(m => ({ ...m, octets: appliquer(originaux.get(m.fichier), m.cible, m.remplace, m.nom) }));
const tous = readdirSync(chemin('../tests')).filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f);
const cibles = tous.filter(f => /^tests\/reservation-.*\.test\.ts$/.test(f));

function tester(liste) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './scripts/enregistrer-resolveur.mjs', '--test', '--test-timeout=120000', ...liste], { cwd: api, shell: false, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  const echecs = Number(/^ℹ fail (\d+)/m.exec(r.stdout ?? '')?.[1] ?? NaN) + Number(/^ℹ cancelled (\d+)/m.exec(r.stdout ?? '')?.[1] ?? 0);
  return { code: r.status, echecs };
}

const initial = tester(tous);
if (initial.code !== 0) { console.log('Suite initiale non verte (code ' + initial.code + ') : aucune mutation appliquée.'); process.exitCode = 1; throw new Error('INITIAL_NON_VERT'); }
let survivantes = 0;
for (const p of plans) {
  let r;
  try { writeFileSync(p.fichier, p.octets); r = tester(cibles); }
  finally { writeFileSync(p.fichier, originaux.get(p.fichier)); }
  const detectee = r.code !== null && r.code !== 0 && r.echecs >= 1;
  if (!detectee) survivantes++;
  console.log(`${p.nom} : code ${r.code ?? 'indéterminé'}, ${Number.isNaN(r.echecs) ? '?' : r.echecs} test(s) en échec${detectee ? '' : ' NON DÉTECTÉE'}`);
}
for (const [f, octets] of originaux) if (!readFileSync(f).equals(octets)) throw new Error('RESTAURATION_INCOMPLETE : ' + f);
const final = tester(tous);
console.log(`Après restauration (suite complète) : code ${final.code ?? 'indéterminé'}, ${final.echecs} échec(s)`);
if (survivantes > 0 || final.code !== 0) { console.log(survivantes + ' mutation(s) survivante(s).'); process.exitCode = 1; throw new Error('MUTATIONS_SURVIVANTES'); }
console.log('OK : ' + plans.length + ' mutations détectées, restauration exacte, suite complète verte.');
