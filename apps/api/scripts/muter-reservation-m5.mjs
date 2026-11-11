// Mutations M5 (plage 10:00 à 22:45, disponibilité publique, création ATOMIQUE) : zéro réseau, sources gardées/restaurées en Buffer (try/finally), vérification finale par comparaison d'octets.
// Quatre suites : 'api' (tests/reservation-*.test.ts), 'sql' (test:cloisonnement : la fonction SQL rejouée sur une vraie base PostgreSQL jetable), 'site' (lanceur de tests purs du site),
// 'appli' (tests de l'application mobile, fichiers de réservation). Une mutation non détectée fait échouer le script (code 1).
// Usage (depuis la racine) : node apps/api/scripts/muter-reservation-m5.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const chemin = p => fileURLToPath(new URL(p, import.meta.url));
const api = chemin('..');
const web = chemin('../../web');
const mobile = chemin('../../mobile');

const PARTAGE = chemin('../../../packages/shared/src/contracts/reservation.ts');
const CLIENT = chemin('../src/reservation/client.ts');
const ACCES = chemin('../src/reservation/acces.ts');
const REGLES = chemin('../src/reservation/regles.ts');
const ROUTE = chemin('../src/routes/reservation.ts');
const WORKER = chemin('../src/worker.ts');
const SQL = chemin('../../../supabase/migrations/20261110110000_reservation_creation_atomique.sql');
const SITE_CRENEAUX = chemin('../../web/src/lib/reservation/creneaux.ts');
const SITE_FORMULAIRE = chemin('../../web/src/lib/reservation/formulaire.ts');
const SITE_API_SERVEUR = chemin('../../web/src/lib/reservation/api-serveur.ts');
const SITE_API_REGLES = chemin('../../web/src/lib/reservation/api-regles.ts');
const APPLI_CRENEAUX = chemin('../../mobile/src/domaine/creneaux-reservation.ts');
const APPLI_CONTROLE = chemin('../../mobile/src/connexion/controle-reservation-client.ts');
const APPLI_SESSION = chemin('../../mobile/src/connexion/session.ts');

const mutations = [
  // --- API et contrat partagé ---
  { suite: 'api', nom: 'P01. plage : dernier créneau repoussé à 23:45', fichier: PARTAGE, cible: 'export const DERNIER_CRENEAU_MINUTES = 22 * 60 + 45;', remplace: 'export const DERNIER_CRENEAU_MINUTES = 23 * 60 + 45;' },
  { suite: 'api', nom: 'P02. plage : premier créneau avancé à 09:00', fichier: PARTAGE, cible: 'export const PREMIER_CRENEAU_MINUTES = 10 * 60;', remplace: 'export const PREMIER_CRENEAU_MINUTES = 9 * 60;' },
  { suite: 'api', nom: 'P03. plage : borne basse exclue (10:00 refusé)', fichier: PARTAGE, cible: 'return minutes >= PREMIER_CRENEAU_MINUTES && minutes <= DERNIER_CRENEAU_MINUTES;', remplace: 'return minutes > PREMIER_CRENEAU_MINUTES && minutes <= DERNIER_CRENEAU_MINUTES;' },
  { suite: 'api', nom: 'P04. plage : borne haute exclue (22:45 refusé)', fichier: PARTAGE, cible: 'return minutes >= PREMIER_CRENEAU_MINUTES && minutes <= DERNIER_CRENEAU_MINUTES;', remplace: 'return minutes >= PREMIER_CRENEAU_MINUTES && minutes < DERNIER_CRENEAU_MINUTES;' },
  { suite: 'api', nom: 'P05. plage : corps de création non contrôlé', fichier: PARTAGE, cible: '  if (!creneauDansPlage(instant)) return refus(MESSAGE_CRENEAU_HORS_PLAGE);\n', remplace: '' },
  { suite: 'api', nom: 'P06. plage : le service ne la contrôle plus avant l\'appel à la base', fichier: CLIENT, cible: 'if (horsPlage) return refus(horsPlage);', remplace: '' },
  { suite: 'api', nom: 'P07. plage : refus hors plage traduit en message de fenêtre', fichier: REGLES, cible: 'return creneauDansPlage(creneauMs) ? null : { code: "VALIDATION", message: MESSAGE_CRENEAU_HORS_PLAGE };', remplace: 'return creneauDansPlage(creneauMs) ? null : { code: "VALIDATION", message: "Choisissez un autre horaire." };' },
  { suite: 'api', nom: 'D01. disponibilité : limite par adresse retirée', fichier: ROUTE, cible: '    await deps.limiterDisponibiliteReservation();\n', remplace: '' },
  { suite: 'api', nom: 'D02. disponibilité : jeton de nouveau exigé (la route redevient privée)', fichier: ROUTE, cible: 'route.get("/restaurants/:restaurantId/disponibilite", async (c) => {', remplace: 'route.get("/restaurants/:restaurantId/disponibilite", ...garde, async (c) => {' },
  { suite: 'api', nom: 'D03. disponibilité : un restaurant inconnu répondrait « oui »', fichier: ROUTE, cible: 'construireReponseDisponibiliteReservation(restaurantId, r.accepteReservation)', remplace: 'construireReponseDisponibiliteReservation(restaurantId, true)' },
  { suite: 'api', nom: 'D04. disponibilité : limite par adresse non câblée dans le Worker', fichier: WORKER, cible: '  limiterDisponibiliteReservation,\n', remplace: '  limiterDisponibiliteReservation: async () => undefined,\n' },
  { suite: 'api', nom: 'A01. atomique : compte transmis à la fonction SQL pris ailleurs', fichier: ACCES, cible: 'p_client_user_id: ligne.clientUserId,', remplace: 'p_client_user_id: ligne.restaurantId,' },
  { suite: 'api', nom: 'A02. atomique : état inconnu de la réponse accepté', fichier: ACCES, cible: 'if (o.etat !== "creee" && o.etat !== "rejeu") throw new Error("RESERVATION_ILLISIBLE");', remplace: '' },
  { suite: 'api', nom: 'A03. atomique : un rejeu déclenche une alerte et un statut 201', fichier: CLIENT, cible: 'if (r.etat === "rejeu") return { ok: true as const, reservation: r.reservation, idempotent: true };', remplace: 'if (false) return { ok: true as const, reservation: r.reservation, idempotent: true };' },
  { suite: 'api', nom: 'A04. atomique : tout refus de la fonction SQL traduit en « capacité »', fichier: CLIENT, cible: 'traduireRefusCreation(r.code, d.nbPersonnes)', remplace: 'traduireRefusCreation("CAPACITE", d.nbPersonnes)' },
  // --- SQL (fonction rejouée par test:cloisonnement) ---
  { suite: 'sql', nom: 'Q01. SQL : dernier créneau 23:45', fichier: SQL, cible: 'c_dernier constant integer := 22 * 60 + 45;', remplace: 'c_dernier constant integer := 23 * 60 + 45;' },
  { suite: 'sql', nom: 'Q02. SQL : 22:45 refusé (borne haute exclue)', fichier: SQL, cible: 'v_minutes > c_dernier then', remplace: 'v_minutes >= c_dernier then' },
  { suite: 'sql', nom: 'Q03. SQL : 10:00 refusé (borne basse exclue)', fichier: SQL, cible: 'v_minutes < c_premier or', remplace: 'v_minutes <= c_premier or' },
  { suite: 'sql', nom: 'Q04. SQL : verrou du compte retiré', fichier: SQL, cible: "  perform pg_advisory_xact_lock(hashtextextended('speedfood:reservation:compte:' || p_client_user_id::text, 0));\n", remplace: '' },
  { suite: 'sql', nom: 'Q05. SQL : verrou du restaurant et du créneau retiré', fichier: SQL, cible: "  perform pg_advisory_xact_lock(hashtextextended('speedfood:reservation:creneau:' || p_restaurant_id::text || ':' || extract(epoch from p_creneau)::text, 0));\n", remplace: '' },
  { suite: 'sql', nom: 'Q06. SQL : plafond de 3 repoussé à 4', fichier: SQL, cible: 'if v_nb_actives >= c_plafond then', remplace: 'if v_nb_actives > c_plafond then' },
  { suite: 'sql', nom: 'Q07. SQL : capacité exacte refusée (> devient >=)', fichier: SQL, cible: 'if v_deja + p_nb_personnes > v_resto.reservation_capacite_couverts then', remplace: 'if v_deja + p_nb_personnes >= v_resto.reservation_capacite_couverts then' },
  { suite: 'sql', nom: 'Q08. SQL : capacité jamais contrôlée', fichier: SQL, cible: 'if v_resto.reservation_capacite_couverts is not null then', remplace: 'if false then' },
  { suite: 'sql', nom: 'Q09. SQL : rejeu sans comparer le nombre de personnes', fichier: SQL, cible: '    and r.nb_personnes = p_nb_personnes\n', remplace: '' },
  { suite: 'sql', nom: 'Q10. SQL : rejeu sans comparer le restaurant', fichier: SQL, cible: '    and r.restaurant_id = p_restaurant_id\n    and r.creneau = p_creneau\n    and r.nb_personnes', remplace: '    and r.creneau = p_creneau\n    and r.nb_personnes' },
  { suite: 'sql', nom: 'Q11. SQL : doublon accepté', fichier: SQL, cible: "return jsonb_build_object('etat', 'refus', 'code', 'DOUBLON');", remplace: "null;" },
  { suite: 'sql', nom: 'Q12. SQL : fonction ouverte aux comptes connectés', fichier: SQL, cible: 'grant execute on function public.fn_creer_reservation_atomique(uuid, uuid, text, text, integer, timestamptz, text) to service_role;', remplace: 'grant execute on function public.fn_creer_reservation_atomique(uuid, uuid, text, text, integer, timestamptz, text) to service_role, authenticated;' },
  { suite: 'sql', nom: 'Q13. SQL : chemin de recherche non fixé (création)', fichier: SQL, cible: 'security definer\nset search_path = public\nas $$\ndeclare', remplace: 'security definer\nas $$\ndeclare' },
  { suite: 'sql', nom: 'Q14. SQL : un seul essai de référence', fichier: SQL, cible: 'c_essais constant integer := 4;', remplace: 'c_essais constant integer := 1;' },
  { suite: 'sql', nom: 'Q15. SQL : fenêtre de 30 minutes non appliquée', fichier: SQL, cible: "if p_creneau < now() + interval '30 minutes' then", remplace: 'if false then' },
  // --- Site ---
  { suite: 'site', nom: 'W01. site : le formulaire propose des heures jusqu\'à minuit', fichier: SITE_CRENEAUX, cible: 'minutes <= DERNIER_CRENEAU_MINUTES; minutes += PAS_CRENEAU_MINUTES', remplace: 'minutes < 24 * 60; minutes += PAS_CRENEAU_MINUTES' },
  { suite: 'site', nom: 'W02. site : le formulaire ne refuse plus une heure hors plage', fichier: SITE_FORMULAIRE, cible: '      else if (!creneauDansPlage(Date.parse(creneau))) erreurs.heure = MESSAGE_CRENEAU_HORS_PLAGE;\n', remplace: '' },
  { suite: 'site', nom: 'W03. site : la disponibilité n\'est plus lue en mode public', fichier: SITE_API_SERVEUR, cible: 'lire: lireReponseDisponibiliteReservation, publique: true', remplace: 'lire: lireReponseDisponibiliteReservation' },
  { suite: 'site', nom: 'W04. site : le mode public s\'ouvre aussi aux écritures', fichier: SITE_API_REGLES, cible: 'const publique = options.publique === true && !ecriture;', remplace: 'const publique = options.publique === true;' },
  // --- Appli ---
  { suite: 'appli', nom: 'L01. appli : les heures vont jusqu\'à minuit', fichier: APPLI_CRENEAUX, cible: 'minutes <= DERNIER_CRENEAU_MINUTES; minutes += PAS_CRENEAU_MINUTES', remplace: 'minutes < 24 * 60; minutes += PAS_CRENEAU_MINUTES' },
  { suite: 'appli', nom: 'L02. appli : un visiteur est cru connecté', fichier: APPLI_CONTROLE, cible: 'connecte: session.generationNotifications !== null', remplace: 'connecte: true' },
  { suite: 'appli', nom: 'L03. appli : la disponibilité exige de nouveau une session', fichier: APPLI_SESSION, cible: 'this.api.disponibiliteReservation(null, restaurantId)', remplace: 'this.api.disponibiliteReservation(await this.jeton(), restaurantId)' },
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

// Toutes les mutations sont préparées (cibles vérifiées) AVANT d'écrire quoi que ce soit.
const plans = mutations.map(m => ({ ...m, octets: appliquer(originaux.get(m.fichier), m.cible, m.remplace, m.nom) }));
const testsApi = readdirSync(chemin('../tests')).filter(f => /^reservation-.*\.test\.ts$/.test(f)).map(f => 'tests/' + f);
const testsAppli = readdirSync(chemin('../../mobile/tests')).filter(f => /^reservation-.*\.test\.ts$/.test(f)).map(f => 'tests/' + f);

const lancer = {
  api: () => spawnSync(process.execPath, ['--experimental-strip-types', '--import', './scripts/enregistrer-resolveur.mjs', '--test', '--test-timeout=120000', ...testsApi], { cwd: api, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 }),
  sql: () => spawnSync(process.execPath, ['scripts/tests/cloisonnement.mjs'], { cwd: web, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 }),
  site: () => spawnSync(process.execPath, ['scripts/tests/lancer.mjs'], { cwd: web, encoding: 'utf8', timeout: 900000, maxBuffer: 256 * 1024 * 1024 }),
  appli: () => spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-timeout=120000', ...testsAppli], { cwd: mobile, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 }),
};
/** Échecs « propres au lot » : le site a deux contrôles de variables CSS déjà rouges avant ce lot (design.test.mts), ignorés ici. */
const base = {};
function verdict(suite, r) {
  const sortie = (r.stdout ?? '') + (r.stderr ?? '');
  if (suite === 'site') {
    const echecs = sortie.split('\n').filter(l => l.startsWith('ECHEC') && !/variable CSS du site/.test(l));
    return { vert: echecs.length === 0 && /Messages de réservation vérifiés\./.test(sortie), detail: echecs.length + ' échec(s) hors design' + (echecs.length ? ' : ' + echecs.join(' | ') : '') + (/Messages de réservation vérifiés\./.test(sortie) ? '' : ' (marqueur absent)') };
  }
  if (suite === 'sql') {
    // Le cloisonnement peut porter des échecs qui ne sont pas du lot (zone du remboursement) : on compare aux échecs de la suite de référence.
    const echecs = sortie.split('\n').filter(l => l.startsWith('ECHEC'));
    const termine = /CLOISONNEMENT VÉRIFIÉ|échec\(s\) sur/.test(sortie);
    if (base.sql === undefined) { base.sql = new Set(echecs); return { vert: termine, detail: echecs.length + ' échec(s) de référence' }; }
    const neufs = echecs.filter(l => !base.sql.has(l));
    return { vert: neufs.length === 0 && termine, detail: neufs.length + ' échec(s) nouveau(x), code ' + r.status };
  }
  return { vert: r.status === 0, detail: 'code ' + r.status };
}

// Suites de référence : toutes vertes AVANT toute mutation.
for (const suite of new Set(plans.map(p => p.suite))) {
  const v = verdict(suite, lancer[suite]());
  if (!v.vert) { console.log('Suite « ' + suite + ' » non verte avant mutation (' + v.detail + ') : aucune mutation appliquée.'); process.exit(1); }
}
let survivantes = 0;
for (const p of plans) {
  let v;
  try { writeFileSync(p.fichier, p.octets); v = verdict(p.suite, lancer[p.suite]()); }
  finally { writeFileSync(p.fichier, originaux.get(p.fichier)); }
  if (v.vert) survivantes++;
  console.log(`[${p.suite}] ${p.nom} : ${v.vert ? 'NON DÉTECTÉE' : 'détectée'} (${v.detail})`);
}
let identiques = true;
for (const [f, octets] of originaux) if (!readFileSync(f).equals(octets)) { identiques = false; console.log('SOURCE NON RESTAURÉE : ' + f); }
console.log(`Mutations : ${plans.length}, détectées : ${plans.length - survivantes}, non détectées : ${survivantes}. Sources restaurées octet pour octet : ${identiques ? 'oui' : 'NON'}.`);
process.exit(survivantes === 0 && identiques ? 0 : 1);
