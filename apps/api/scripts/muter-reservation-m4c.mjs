// Mutations M4c (notifications de la réservation de table) : zéro réseau, sources gardées/restaurées en Buffer (try/finally), vérification finale par comparaison d'octets.
// Trois suites : API (tests/reservation-*.test.ts), site (lanceur de tests purs, détection par le message de réussite du fichier visé) et appli (tests de notifications).
// Une mutation survivante fait échouer le script (code 1). Usage (depuis la racine) : node apps/api/scripts/muter-reservation-m4c.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const chemin = p => fileURLToPath(new URL(p, import.meta.url));
const api = chemin('..');
const web = chemin('../../web');
const mobile = chemin('../../mobile');

const CLIENT = chemin('../src/reservation/client.ts');
const RESTAURATEUR = chemin('../src/reservation/restaurateur.ts');
const PLANIF = chemin('../src/reservation/planification.ts');
const CABLAGE = chemin('../src/reservation/cablage.ts');
const SITE_API = chemin('../src/notifications/reservation-site.ts');
const ROUTE = chemin('../src/routes/reservation.ts');
const FCM = chemin('../../web/src/lib/push/fcm.ts');
const INTERNE = chemin('../../web/src/lib/api/alerte-interne.ts');
const MESSAGES = chemin('../../web/src/lib/push/reservation-messages.ts');
const JETONS = chemin('../../web/worker-jetons.js');
const ROUTE_MESSAGE = chemin('../../web/src/app/api/v1/interne/message-reservation/route.ts');
const OUVERTURE = chemin('../../mobile/src/notifications/ouverture.ts');
const ECRAN = chemin('../../mobile/src/catalogue/CatalogueReel.tsx');

const PLANIFIER_ALERTE = 'planifier(apres, p.alerterNouvelleDemande && (() => p.alerterNouvelleDemande!(d.restaurantId, environnement)));';
const PLANIFIER_MESSAGE = 'planifier(apres, p.prevenirClient && (() => p.prevenirClient!(id, "confirmee", environnement)));';

// suite : 'api' | 'site' (marqueur = phrase imprimée seulement si TOUS les contrôles du fichier visé passent) | 'appli'
const mutations = [
  // --- API : alerte du restaurant ---
  { suite: 'api', nom: 'A01. alerte envoyée aussi pour un REJEU idempotent', fichier: CLIENT, cible: 'if (existante) return { ok: true as const, reservation: existante, idempotent: true };', remplace: 'if (existante) { ' + PLANIFIER_ALERTE + ' return { ok: true as const, reservation: existante, idempotent: true }; }' },
  { suite: 'api', nom: 'A02. alerte planifiée même quand l\'insertion échoue (erreur de la base)', fichier: CLIENT, cible: 'const r = await p.inserer(ligne);', remplace: 'const r = await p.inserer(ligne);\n        ' + PLANIFIER_ALERTE },
  { suite: 'api', nom: 'A03. alerte adressée au compte du client au lieu du restaurant', fichier: CLIENT, cible: 'p.alerterNouvelleDemande!(r.reservation.restaurantId, environnement)', remplace: 'p.alerterNouvelleDemande!(utilisateurId, environnement)' },
  { suite: 'api', nom: 'A04. alerte jouée avant la réponse (appel direct au lieu de la planification)', fichier: CLIENT, cible: 'planifier(apres, p.alerterNouvelleDemande && (() => p.alerterNouvelleDemande!(r.reservation.restaurantId, environnement)));', remplace: 'void p.alerterNouvelleDemande?.(r.reservation.restaurantId, environnement);' },
  { suite: 'api', nom: 'A05. une panne du planificateur fait échouer la création (plus absorbée)', fichier: PLANIF, cible: '  } catch { /* pas de contexte d\'exécution : rien à planifier */ }', remplace: '  } catch (e) { throw e; }' },
  { suite: 'api', nom: 'A06. une panne de la notification n\'est plus absorbée dans la tâche', fichier: PLANIF, cible: 'try { await tache(); } catch { /* meilleur effort : la notification n\'est jamais une raison d\'échouer */ }', remplace: 'await tache();' },
  // --- API : message au client ---
  { suite: 'api', nom: 'A07. mauvais type : toujours « confirmee »', fichier: RESTAURATEUR, cible: 'p.prevenirClient!(id, cible as StatutReponseReservation, environnement)', remplace: 'p.prevenirClient!(id, "confirmee", environnement)' },
  { suite: 'api', nom: 'A08. client prévenu aussi pour « honorée » et « non honorée »', fichier: RESTAURATEUR, cible: 'new Set<StatutReservation>(["confirmee", "refusee", "annulee_restaurant"])', remplace: 'new Set<StatutReservation>(["confirmee", "refusee", "annulee_restaurant", "honoree", "non_honoree"])' },
  { suite: 'api', nom: 'A09. message envoyé aussi sur une décision REJOUÉE (relecture)', fichier: RESTAURATEUR, cible: 'if (actuelle.statut === cible) return { ok: true as const, reservation: enrichir(actuelle, p.maintenant().getTime()) };', remplace: 'if (actuelle.statut === cible) { ' + PLANIFIER_MESSAGE + ' return { ok: true as const, reservation: enrichir(actuelle, p.maintenant().getTime()) }; }' },
  { suite: 'api', nom: 'A10. message planifié avant de savoir si l\'écriture a réussi (erreur de la base)', fichier: RESTAURATEUR, cible: 'const r = await p.ecrireStatut(ctx.supabase, ctx.restaurantId, id, actuelle.statut, cible, decision.motif);', remplace: 'const r = await p.ecrireStatut(ctx.supabase, ctx.restaurantId, id, actuelle.statut, cible, decision.motif);\n      ' + PLANIFIER_MESSAGE },
  { suite: 'api', nom: 'A11. message envoyé aussi après la relecture d\'un changement concurrent', fichier: RESTAURATEUR, cible: 'if (relue.statut === cible) return { ok: true as const, reservation: enrichir(relue, p.maintenant().getTime()) };', remplace: 'if (relue.statut === cible) { ' + PLANIFIER_MESSAGE + ' return { ok: true as const, reservation: enrichir(relue, p.maintenant().getTime()) }; }' },
  { suite: 'api', nom: 'A12. donnée personnelle (motif) transmise avec le message', fichier: RESTAURATEUR, cible: 'p.prevenirClient!(id, cible as StatutReponseReservation, environnement)', remplace: 'p.prevenirClient!(id, cible as StatutReponseReservation, environnement, decision.motif)' },
  // --- API : liaison de service ---
  { suite: 'api', nom: 'A13. liaison non vérifiée (méthode absente appelée quand même)', fichier: SITE_API, cible: '    if (typeof fonction !== "function") return;\n', remplace: '' },
  { suite: 'api', nom: 'A14. alerte envoyée deux fois (rejeu)', fichier: SITE_API, cible: 'return (restaurantId) => appelerSite(lire, "alerterReservation", [restaurantId], delaiMs);', remplace: 'return async (restaurantId) => { await appelerSite(lire, "alerterReservation", [restaurantId], delaiMs); await appelerSite(lire, "alerterReservation", [restaurantId], delaiMs); };' },
  { suite: 'api', nom: 'A15. méthode des commandes (`alerter`) appelée au lieu de `alerterReservation`', fichier: SITE_API, cible: 'return (restaurantId) => appelerSite(lire, "alerterReservation", [restaurantId], delaiMs);', remplace: 'return (restaurantId) => appelerSite(lire, "alerter" as never, [restaurantId], delaiMs);' },
  { suite: 'api', nom: 'A16. donnée dans le journal d\'échec', fichier: SITE_API, cible: 'console.error("alerte_reservation_site_echec");', remplace: 'console.error("alerte_reservation_site_echec", args);' },
  { suite: 'api', nom: 'A17. statut hors réponses du restaurant transmis au site', fichier: SITE_API, cible: '    if (!estReponseReservation(statut)) return;\n', remplace: '' },
  { suite: 'api', nom: 'A18. délai jamais appliqué (attente illimitée)', fichier: SITE_API, cible: 'minuterie = setTimeout(() => refuser(new Error()), delaiMs);', remplace: 'minuterie = undefined;' },
  // --- API : routes et câblage ---
  { suite: 'api', nom: 'A19. route création : environnement non transmis', fichier: ROUTE, cible: 'deps.reservations.creer(c.get("utilisateurId"), corps.valeurs, apres, c.env);', remplace: 'deps.reservations.creer(c.get("utilisateurId"), corps.valeurs, apres, undefined);' },
  { suite: 'api', nom: 'A20. route décision : planificateur non transmis', fichier: ROUTE, cible: 'corps.valeurs, apres, c.env);\n    if (!r.ok) return reponseErreur(c, r.erreur);\n    return repondre(c, { ok: true, reservation: versRestaurant', remplace: 'corps.valeurs);\n    if (!r.ok) return reponseErreur(c, r.erreur);\n    return repondre(c, { ok: true, reservation: versRestaurant' },
  { suite: 'api', nom: 'A21. câblage : le message au client part par l\'alerte du restaurant', fichier: CABLAGE, cible: 'fournirMessageReservationSite(() => environnement)(reservationId, statut)', remplace: 'fournirAlerteReservationSite(() => environnement)(reservationId)' },
  // --- Site ---
  { suite: 'site', marqueur: 'Notifications poussées natives vérifiées.', nom: 'S01. donnée personnelle dans le texte de l\'alerte du restaurant', fichier: FCM, cible: 'texte: "Une demande de table attend votre réponse. Ouvrez Speedfood."', remplace: 'texte: "Une demande de table pour 4 personnes attend votre réponse. Ouvrez Speedfood."' },
  { suite: 'site', marqueur: 'Notifications poussées natives vérifiées.', nom: 'S02. mauvais canal pour « confirmée »', fichier: FCM, cible: 'Ouvrez Speedfood pour voir les détails.", canal: "suivi_commande"', remplace: 'Ouvrez Speedfood pour voir les détails.", canal: "alerte_commande"' },
  { suite: 'site', marqueur: 'Notifications poussées natives vérifiées.', nom: 'S03. mauvais type pour « refusée »', fichier: FCM, cible: 'statut === "refusee" ? "reservation_refusee"', remplace: 'statut === "refusee" ? "reservation_confirmee"' },
  { suite: 'site', marqueur: 'Notifications poussées natives vérifiées.', nom: 'S04. client notifié pour « honorée »', fichier: FCM, cible: '"reservation_annulee" : null;', remplace: '"reservation_annulee" : statut === "honoree" ? "reservation_confirmee" : null;' },
  { suite: 'site', marqueur: 'Alerte interne vérifiée.', nom: 'S05. route interne : statut quelconque accepté', fichier: INTERNE, cible: ' || typeof statut !== "string" || !STATUTS_REPONSE_RESERVATION.includes(statut)) return', remplace: ' || typeof statut !== "string") return' },
  { suite: 'site', marqueur: 'Messages de réservation vérifiés.', nom: 'S06. état en base non comparé à la réponse annoncée', fichier: MESSAGES, cible: '!ligne || ligne.statut !== statut || typeof', remplace: '!ligne || typeof' },
  { suite: 'site', marqueur: 'Messages de réservation vérifiés.', nom: 'S07. un second compte (identifiant de réservation) ajouté aux destinataires', fichier: MESSAGES, cible: 'await ports.notifier([ligne.clientUserId], type);', remplace: 'await ports.notifier([ligne.clientUserId, reservationId], type);' },
  { suite: 'site', marqueur: 'Alerte interne vérifiée.', nom: 'S08. RPC : identifiant de réservation non validé', fichier: JETONS, cible: 'if (typeof reservationId !== "string" || !UUID.test(reservationId)) return;', remplace: '' },
  { suite: 'site', marqueur: 'Alerte interne vérifiée.', nom: 'S09. RPC : l\'alerte de réservation part sur la route des commandes', fichier: JETONS, cible: '"/api/v1/interne/alerte-reservation", { restaurantId }', remplace: '"/api/v1/interne/alerte-commande", { restaurantId }' },
  { suite: 'site', marqueur: 'Alerte interne vérifiée.', nom: 'S10. route du message : mauvais notifieur', fichier: ROUTE_MESSAGE, cible: 'after,\n    notifierClientReservation', remplace: 'after,\n    notifierRestaurantReservation' },
  // --- Appli ---
  { suite: 'appli', nom: 'P01. `reservation_nouvelle` retiré de la liste blanche restaurateur', fichier: OUVERTURE, cible: "['commande_nouvelle', 'reservation_nouvelle'] as const", remplace: "['commande_nouvelle'] as const" },
  { suite: 'appli', nom: 'P02. une réponse de réservation ouvre le suivi de commande', fichier: OUVERTURE, cible: 'else if (reservation !== null) d.ouvrirReservations?.();', remplace: 'else if (reservation !== null) d.ouvrirSuivi();' },
  { suite: 'appli', nom: 'P03. notification traitée plusieurs fois (identifiant non mémorisé)', fichier: OUVERTURE, cible: 'if (traitees.has(id)) return; ', remplace: '' },
  { suite: 'appli', nom: 'P04. type de réponse inconnu accepté (liste client élargie)', fichier: OUVERTURE, cible: "['reservation_confirmee', 'reservation_refusee', 'reservation_annulee'] as const", remplace: "['reservation_confirmee', 'reservation_refusee', 'reservation_annulee', 'reservation_inconnue'] as const" },
  { suite: 'appli', nom: 'P05. l\'ouverture « réservations » demande une relecture automatique', fichier: ECRAN, cible: 'setDemandeCompte(null); setCompteOuvert(true); } })).current;', remplace: 'setDemandeCompte({ reference: null }); setCompteOuvert(true); } })).current;' },
  { suite: 'appli', nom: 'P06. la fin du verrou ne rejoue pas l\'ouverture « réservations »', fichier: ECRAN, cible: ' ouvertureReservations.verrouillageChange(); }}', remplace: ' }}' },
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

const testsApi = readdirSync(chemin('../tests')).filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f);
const ciblesApi = testsApi.filter(f => /^tests\/reservation-.*\.test\.ts$/.test(f));
const ciblesAppli = ['tests/notifications-reservation.test.ts', 'tests/notifications.test.ts', 'tests/notifications-relecture.test.ts'];

function testerApi(liste) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--import', './scripts/enregistrer-resolveur.mjs', '--test', '--test-timeout=120000', ...liste], { cwd: api, shell: false, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status };
}
function testerAppli(liste) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-timeout=120000', ...liste], { cwd: mobile, shell: false, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status };
}
function testerSite() {
  const r = spawnSync(process.execPath, ['scripts/tests/lancer.mjs'], { cwd: web, shell: false, encoding: 'utf8', timeout: 900000, maxBuffer: 256 * 1024 * 1024 });
  return { code: r.status, sortie: (r.stdout ?? '') };
}

const marqueursSite = [...new Set(mutations.filter(m => m.suite === 'site').map(m => m.marqueur))];
let survivantes = 0;

const initialApi = testerApi(testsApi);
if (initialApi.code !== 0) { console.log('Suite API initiale non verte (code ' + initialApi.code + ') : aucune mutation appliquée.'); process.exitCode = 1; throw new Error('INITIAL_API_NON_VERT'); }
const initialAppli = testerAppli(['tests/*.test.ts'].flatMap(() => readdirSync(chemin('../../mobile/tests')).filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f)));
if (initialAppli.code !== 0) { console.log('Suite appli initiale non verte (code ' + initialAppli.code + ').'); process.exitCode = 1; throw new Error('INITIAL_APPLI_NON_VERT'); }
const initialSite = testerSite();
for (const m of marqueursSite) if (!initialSite.sortie.includes(m)) { console.log('Suite site initiale : marqueur absent « ' + m + ' » : aucune mutation appliquée.'); process.exitCode = 1; throw new Error('INITIAL_SITE_NON_VERT'); }

for (const p of plans) {
  let detectee;
  let detail;
  try {
    writeFileSync(p.fichier, p.octets);
    if (p.suite === 'api') { const r = testerApi(ciblesApi); detectee = r.code !== null && r.code !== 0; detail = 'code ' + r.code; }
    else if (p.suite === 'appli') { const r = testerAppli(ciblesAppli); detectee = r.code !== null && r.code !== 0; detail = 'code ' + r.code; }
    else { const r = testerSite(); detectee = !r.sortie.includes(p.marqueur); detail = 'marqueur ' + (detectee ? 'absent' : 'présent'); }
  } finally { writeFileSync(p.fichier, originaux.get(p.fichier)); }
  if (!detectee) survivantes++;
  console.log(`[${p.suite}] ${p.nom} : ${detail}${detectee ? '' : ' NON DÉTECTÉE'}`);
}
for (const [f, octets] of originaux) if (!readFileSync(f).equals(octets)) throw new Error('RESTAURATION_INCOMPLETE : ' + f);
const finalApi = testerApi(testsApi);
const finalAppli = testerAppli(readdirSync(chemin('../../mobile/tests')).filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f));
console.log(`Après restauration : API code ${finalApi.code}, appli code ${finalAppli.code}`);
if (survivantes > 0 || finalApi.code !== 0 || finalAppli.code !== 0) { console.log(survivantes + ' mutation(s) survivante(s).'); process.exitCode = 1; throw new Error('MUTATIONS_SURVIVANTES'); }
console.log('OK : ' + plans.length + ' mutations détectées, restauration exacte, suites API et appli vertes.');
