// Parcours G3 automatisé du banc : le VRAI contrôleur, la VRAIE session, le VRAI client réseau (offre, course), la VRAIE route Hono et les vrais services de lecture,
// sur la base factice du banc, SANS serveur HTTP ni réseau (le fetch est branché directement sur l'application Hono locale). Aucune écriture réelle.
// Lancement (depuis la racine du dépôt) :
//   node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-livreur/parcours-g3.mjs
import assert from 'node:assert/strict';
import { creerBancLivreur, IDENTIFIANTS_BANC } from './serveur.mjs';
import { creerTransportControle } from './transport.ts';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE } from './identites.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { creerAuth } from '../src/connexion/client.ts';
import { creerControleEtatLivreur } from '../src/connexion/controle-etat-livreur.ts';

const CODE_FAUX = '0000';
const CODE_BON = '4821';
const attendre = ms => new Promise(r => setTimeout(r, ms));

function nouveauBanc() {
  const app = creerBancLivreur();
  const appelsRouteur = [];
  const transport = creerTransportControle((url, init) => { appelsRouteur.push(String(url)); return app.fetch(new Request(url, init)); });
  const sessionDe = compte => ({ accessToken: PORTEURS_CONTROLE[compte === 'A' ? 0 : 1], refreshToken: 'refresh-factice-' + compte, userId: COMPTES_CONTROLE[compte === 'A' ? 0 : 1], expiresAt: 9999999999 });
  const apiFermee = creerAuth(async () => { throw new Error('CONTROLE_APPEL_PRODUIT_REFUSE'); });
  let coffre = null;
  const session = new GestionSession({
    ...apiFermee,
    connecter: async email => sessionDe(email.startsWith('b@') ? 'B' : 'A'),
    renouveler: async refresh => sessionDe(refresh.endsWith('-B') ? 'B' : 'A'),
    ficheLivreur: transport.ficheLivreur, etatLivreur: transport.etatLivreur, basculerEnLigneLivreur: transport.basculerEnLigneLivreur,
    repondreOffreLivreur: transport.repondreOffreLivreur, avancerCourseLivreur: transport.avancerCourseLivreur,
    deconnecter: async () => undefined,
  }, { lire: async () => coffre, ecrire: async v => { coffre = v; }, effacer: async () => { coffre = null; } });
  const post = (chemin) => app.request(chemin, { method: 'POST' });
  const inspecter = async () => (await app.request('/__etat')).json();
  async function ouvrir(compte) {
    await session.connecter(compte.toLowerCase() + '@controle.invalid', 'factice');
    const pubs = [];
    const controle = creerControleEtatLivreur(session, e => pubs.push(JSON.parse(JSON.stringify(e))));
    return { controle, pubs, lu: () => pubs.at(-1) };
  }
  return { app, session, post, inspecter, ouvrir, appelsRouteur, scenario: cas => post('/__scenario?cas=' + cas), faute: type => post('/__faute?type=' + type) };
}
const course = e => e.lu().etatLivreur?.course ?? null;

const parcours = [];
const cas = (nom, fn) => parcours.push([nom, fn]);

cas('offre → accepter → vers le restaurant → récupérée (client visible seulement ici) → vers le client → code faux → code bon → terminée', async () => {
  const b = nouveauBanc(); await b.scenario('g3_offre');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  assert.equal(e.lu().etatLivreur.offre.offreId, IDENTIFIANTS_BANC.offreA); assert.equal(course(e), null);
  await e.controle.repondreOffre('acceptee');
  assert.equal(e.lu().etatLivreur.offre, null); assert.equal(course(e).statut, 'assignee'); assert.deepEqual(course(e).etapesPossibles, ['vers_restaurant']); assert.equal(course(e).client, null);
  await e.controle.avancerCourse('vers_restaurant');
  assert.equal(course(e).statut, 'vers_restaurant'); assert.deepEqual(course(e).etapesPossibles, ['recuperee']); assert.equal(course(e).client, null);
  assert.equal((await b.inspecter()).g3.clientsLus, 0, 'le client n’est jamais lu avant la récupération');
  assert.ok(!JSON.stringify(e.pubs).includes('+224 600 00 00 01'));
  await e.controle.avancerCourse('recuperee');
  assert.equal(course(e).statut, 'recuperee'); assert.equal(course(e).client.telephone, '+224 600 00 00 01'); assert.deepEqual(course(e).etapesPossibles, ['vers_client', 'echec']);
  await e.controle.avancerCourse('vers_client');
  assert.equal(course(e).statut, 'vers_client'); assert.deepEqual(course(e).etapesPossibles, ['livree', 'echec']);
  await e.controle.avancerCourse('livree', { code: CODE_FAUX });
  assert.match(e.lu().message, /4 essai\(s\) restant\(s\)/); assert.equal(course(e).statut, 'vers_client'); assert.equal(e.lu().incertain, false);
  await e.controle.avancerCourse('livree', { code: ' 48 21 ' });
  assert.equal(course(e), null); assert.equal(e.lu().etatLivreur.fiche.statut, 'disponible');
  assert.ok(!JSON.stringify(e.pubs.slice(e.pubs.length - 1)).includes('+224 600 00 00 01'), 'le client a disparu avec la course');
  const etat = await b.inspecter();
  assert.deepEqual(etat.g3.journal, ['A:offre:acceptee', 'A:course:vers_restaurant', 'A:course:recuperee', 'A:course:vers_client', 'A:course:livree:code_faux', 'A:course:livree']);
  assert.deepEqual(etat.g3.violations, []);
  assert.ok(!JSON.stringify(etat).includes(CODE_BON) && !JSON.stringify(e.pubs).includes(CODE_BON) && !JSON.stringify(e.pubs).includes(CODE_FAUX));
  assert.ok(b.appelsRouteur.every(u => u.startsWith('http://127.0.0.1:8797/')), 'aucun appel hors du banc');
});

cas('refuser une offre', async () => {
  const b = nouveauBanc(); await b.scenario('g3_offre');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  await e.controle.repondreOffre('refusee');
  assert.equal(e.lu().etatLivreur.offre, null); assert.equal(course(e), null); assert.equal(e.lu().etatLivreur.fiche.statut, 'disponible');
  assert.deepEqual((await b.inspecter()).g3.journal, ['A:offre:refusee']);
});

cas('échec avec raison, confirmation explicite obligatoire', async () => {
  const b = nouveauBanc(); await b.scenario('g3_course_vers_client');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  await e.controle.avancerCourse('echec', { raison: 'Client injoignable' });
  assert.equal((await b.inspecter()).g3.journal.length, 0, 'sans confirmation rien n’est envoyé');
  await e.controle.avancerCourse('echec', { raison: 'Client injoignable', confirme: true });
  assert.equal(course(e), null);
  const etat = await b.inspecter();
  assert.deepEqual(etat.g3.journal, ['A:course:echec']); assert.deepEqual(etat.g3.raisons, ['Client injoignable']);
});

cas('réponse incertaine (appliquée) : verrou, aucun réessai, relecture manuelle = vérité', async () => {
  const b = nouveauBanc(); await b.scenario('g3_course_vers_restaurant');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  await b.faute('incertain_applique');
  await e.controle.avancerCourse('recuperee');
  assert.equal(e.lu().incertain, true); assert.match(e.lu().message, /peut-être été enregistrée/);
  await e.controle.avancerCourse('recuperee'); await e.controle.avancerCourse('recuperee');
  assert.deepEqual((await b.inspecter()).g3.journal, ['A:course:recuperee'], 'une seule écriture, aucun réessai');
  await e.controle.actualiser();
  assert.equal(e.lu().incertain, false); assert.equal(course(e).statut, 'recuperee'); assert.ok(course(e).client !== null, 'la vérité relue montre que l’étape a bien été appliquée');
});

cas('réponse incertaine (perdue) : après relecture rien n’a été appliqué, la main reste à l’utilisateur', async () => {
  const b = nouveauBanc(); await b.scenario('g3_course_vers_restaurant');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  await b.faute('incertain_perdue');
  await e.controle.avancerCourse('recuperee');
  assert.equal(e.lu().incertain, true);
  await e.controle.actualiser();
  assert.equal(course(e).statut, 'vers_restaurant'); assert.equal(e.lu().incertain, false);
  assert.deepEqual((await b.inspecter()).g3.journal, []);
  await e.controle.avancerCourse('recuperee');
  assert.equal(course(e).statut, 'recuperee');
});

cas('réponse incertaine par délai dépassé (6 s) : même verrou', async () => {
  const b = nouveauBanc(); await b.scenario('g3_course_vers_restaurant');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  await b.faute('incertain_delai');
  await e.controle.avancerCourse('recuperee');
  assert.equal(e.lu().incertain, true);
  await attendre(1500);
  await e.controle.actualiser();
  assert.equal(e.lu().incertain, false); assert.equal(course(e).statut, 'recuperee');
});

cas('course changée côté serveur entre deux lectures : refus du livraisonId périmé, vérité relue', async () => {
  const b = nouveauBanc(); await b.scenario('g3_course_vers_restaurant');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  assert.equal(course(e).livraisonId, IDENTIFIANTS_BANC.courseA);
  await b.post('/__changer-course');
  await e.controle.avancerCourse('recuperee');
  assert.match(e.lu().message, /La course a changé, relisez/);
  assert.equal(course(e).livraisonId, IDENTIFIANTS_BANC.courseAChangee); assert.equal(course(e).statut, 'assignee');
  const journal = (await b.inspecter()).g3.journal;
  assert.deepEqual(journal, ['serveur:course_changee'], 'aucune étape n’a été appliquée à la nouvelle course');
});

cas('mode propre : étapes réduites', async () => {
  const b = nouveauBanc(); await b.scenario('g3_propre');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  assert.equal(course(e).mode, 'propre'); assert.deepEqual(course(e).etapesPossibles, ['vers_client']);
  await e.controle.avancerCourse('recuperee');
  assert.equal(course(e).statut, 'assignee'); assert.match(e.lu().message, /pas disponible/);
  await e.controle.avancerCourse('vers_client');
  assert.equal(course(e).statut, 'vers_client'); assert.deepEqual(course(e).etapesPossibles, ['livree', 'echec']);
  assert.deepEqual((await b.inspecter()).g3.journal, ['A:course:vers_client']);
});

cas('essais de code : plafond du serveur affiché, jamais de renvoi automatique', async () => {
  const b = nouveauBanc(); await b.scenario('g3_course_vers_client');
  const e = await b.ouvrir('A'); await e.controle.actualiser();
  for (let i = 0; i < 5; i++) await e.controle.avancerCourse('livree', { code: CODE_FAUX });
  assert.match(e.lu().message, /0 essai\(s\) restant\(s\)/);
  await e.controle.avancerCourse('livree', { code: CODE_BON });
  assert.match(e.lu().message, /Trop d’essais/); assert.equal(course(e).statut, 'vers_client');
  assert.deepEqual((await b.inspecter()).g3.essais, [5], 'le plafond n’est pas dépassé');
});

cas('réponse lente de A puis changement vers B : rien de A ne réapparaît', async () => {
  const b = nouveauBanc(); await b.scenario('g3_lente');
  const a = await b.ouvrir('A');
  const lectureA = a.controle.actualiser();            // lente : 2,5 s
  await attendre(100);
  const bb = await b.ouvrir('B');                      // le compte change AVANT la réponse de A
  await bb.controle.actualiser();
  assert.equal(bb.lu().etatLivreur.fiche.nom, 'Livreur témoin B'); assert.equal(course(bb).commandeReference, 'SF-TEST-B001'); assert.equal(course(bb).client, null);
  await lectureA;
  const vuA = JSON.stringify(a.pubs.slice(a.pubs.findIndex(p => p.etat === 'erreur') >= 0 ? a.pubs.findIndex(p => p.etat === 'erreur') : a.pubs.length));
  assert.ok(!vuA.includes('SF-TEST-0001') && !vuA.includes('Client témoin') && !vuA.includes('+224 600 00 00 01'), 'aucune donnée de A après le changement');
  assert.equal(a.lu().etat, 'erreur');
  assert.ok(!JSON.stringify(bb.pubs).includes('SF-TEST-0001') && !JSON.stringify(bb.pubs).includes('+224 600 00 00 01'), 'B ne voit jamais la course de A');
});

cas('B ne peut pas répondre à l’offre de A ni faire avancer la course de A', async () => {
  const b = nouveauBanc(); await b.scenario('g3_offre');
  const e = await b.ouvrir('B'); await e.controle.actualiser();
  assert.equal(e.lu().etatLivreur.offre, null);
  const rep = await b.app.request('/api/v1/livreur/offre', { method: 'POST', headers: { authorization: 'Bearer ' + PORTEURS_CONTROLE[1], 'content-type': 'application/json' }, body: JSON.stringify({ offreId: IDENTIFIANTS_BANC.offreA, reponse: 'acceptee' }) });
  assert.equal(rep.status, 400);
  assert.deepEqual((await b.inspecter()).g3.journal, []);
});

let echecs = 0;
for (const [nom, fn] of parcours) {
  try { await fn(); console.log('OK  ' + nom); } catch (e) { echecs++; console.log('ECHEC  ' + nom + '\n   ' + (e instanceof Error ? e.message.split('\n').slice(0, 6).join('\n   ') : String(e))); }
}
console.log(echecs === 0 ? 'PARCOURS G3 : ' + parcours.length + ' parcours OK' : 'PARCOURS G3 : ' + echecs + ' échec(s)');
process.exit(echecs === 0 ? 0 : 1);
