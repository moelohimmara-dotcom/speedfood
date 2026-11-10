// Parcours automatisé du banc réservation (lot M4a) : les VRAIS contrôles, la VRAIE session, le VRAI client réseau (neuf méthodes de réservation), les VRAIES routes Hono et les VRAIS services
// (règles de statut et de temps), sur la base factice du banc, SANS serveur HTTP ni réseau (le fetch est branché directement sur l'application Hono locale). Aucune écriture réelle.
// Lancement (depuis la racine du dépôt) :
//   node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-reservation/parcours-reservation.mjs
import assert from 'node:assert/strict';
import { creerBancReservation, RESTAURANTS_CONTROLE } from './serveur.mjs';
import { creerTransportControle } from './transport.ts';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE } from './identites.ts';
import { GestionSession } from '../src/connexion/session.ts';
import { creerAuth } from '../src/connexion/client.ts';
import { creerControleDemandeReservation, creerControleListeReservations } from '../src/connexion/controle-reservation-client.ts';
import { creerControleReservationRestaurateur } from '../src/connexion/controle-reservation-restaurateur.ts';

const POSITION = { A: 0, B: 1, R: 2 };
const JOUR_MS = 24 * 3600 * 1000;
const OUVERT = RESTAURANTS_CONTROLE.ouvert;
const FERME = RESTAURANTS_CONTROLE.ferme;
/** Le créneau « jours » jours après aujourd'hui à `heure` heures pile (UTC = heure de Conakry). */
const creneauDans = (jours, heure, minutes = 0) => new Date(Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z') + jours * JOUR_MS + heure * 3600000 + minutes * 60000).toISOString();
const demande = (creneau, surcharge = {}) => ({ restaurantId: OUVERT, creneau, nbPersonnes: 2, nom: 'Aminata Camara', telephone: '620 00 00 01', note: 'Au calme', ...surcharge });

function nouveauBanc() {
  const app = creerBancReservation();
  const transport = creerTransportControle((url, init) => app.fetch(new Request(url, init)));
  const apiFermee = creerAuth(async () => { throw new Error('CONTROLE_APPEL_PRODUIT_REFUSE'); });
  const sessionDe = compte => ({ accessToken: PORTEURS_CONTROLE[POSITION[compte]], refreshToken: 'refresh-factice-' + compte, userId: COMPTES_CONTROLE[POSITION[compte]], expiresAt: 9999999999 });
  const sessions = {};
  async function session(compte) {
    if (sessions[compte]) return sessions[compte];
    let coffre = null;
    const s = new GestionSession({
      ...apiFermee,
      connecter: async email => sessionDe(email.startsWith('b@') ? 'B' : email.startsWith('r@') ? 'R' : 'A'),
      renouveler: async refresh => sessionDe(refresh.endsWith('-B') ? 'B' : refresh.endsWith('-R') ? 'R' : 'A'),
      ...transport.api,
      deconnecter: async () => undefined,
    }, { lire: async () => coffre, ecrire: async v => { coffre = v; }, effacer: async () => { coffre = null; } });
    await s.connecter(compte.toLowerCase() + '@controle.invalid', 'factice');
    return (sessions[compte] = s);
  }
  const post = chemin => app.request(chemin, { method: 'POST' });
  const inspecter = async () => (await app.request('/__etat')).json();
  async function client(compte = 'A') {
    const s = await session(compte);
    const pubsD = []; const pubsL = [];
    const demandeCtl = creerControleDemandeReservation(s, e => pubsD.push(JSON.parse(JSON.stringify(e))));
    const listeCtl = creerControleListeReservations(s, e => pubsL.push(JSON.parse(JSON.stringify(e))));
    return { demande: demandeCtl, liste: listeCtl, etatD: () => pubsD.at(-1), etatL: () => pubsL.at(-1), pubsD, pubsL };
  }
  async function resto() {
    const s = await session('R');
    const pubs = [];
    const controle = creerControleReservationRestaurateur(s, e => pubs.push(JSON.parse(JSON.stringify(e))));
    return { controle, pubs, lu: () => pubs.at(-1) };
  }
  return { app, post, inspecter, client, resto, session, scenario: cas => post('/__scenario?cas=' + cas), faute: type => post('/__faute?type=' + type) };
}

const parcours = [];
const cas = (nom, fn) => parcours.push([nom, fn]);
const aucunVerrou = e => assert.ok(e && e.incertain === false && e.envoiEnCours === false && e.relectureEnCours === false && e.lectureEnCours === false, 'drapeaux : ' + JSON.stringify(e && { i: e.incertain, e: e.envoiEnCours, r: e.relectureEnCours, l: e.lectureEnCours }));
const aucunVerrouResto = e => assert.ok(e.etat === 'lu' && e.incertain === false && e.ecritureEnCours === false && e.lectureEnCours === false, 'resto : ' + JSON.stringify({ i: e.incertain, w: e.ecritureEnCours, l: e.lectureEnCours }));
const aucunVerrouListe = e => assert.ok(e.etat === 'lu' && e.incertain === false && e.ecritureEnCours === false && e.lectureEnCours === false, 'liste : ' + JSON.stringify({ i: e.incertain, w: e.ecritureEnCours, l: e.lectureEnCours }));

cas('réservation ouverte : le bouton apparaît, une demande part UNE fois, elle est « demandée », le client la retrouve dans sa liste', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_ouverte');
  const c = await b.client('A');
  await c.demande.lireDisponibilite(OUVERT);
  assert.equal(c.etatD().disponibilite, 'oui'); aucunVerrou(c.etatD());
  await c.demande.envoyer(demande(creneauDans(2, 19)));
  assert.equal(c.etatD().confirmee.statut, 'demandee'); assert.match(c.etatD().confirmee.reference, /^SF-R-/); aucunVerrou(c.etatD());
  assert.match(c.etatD().message, /Le restaurant doit la confirmer\. Aucun paiement\./);
  const etat = await b.inspecter();
  assert.deepEqual(etat.journal, ['client:creer']); assert.equal(etat.parStatut.demandee, 1);
  await c.liste.actualiser();
  assert.equal(c.etatL().reservations.length, 1); assert.equal(c.etatL().reservations[0].statut, 'demandee'); aucunVerrouListe(c.etatL());
});

cas('réservation fermée : le bouton reste masqué et rien ne peut être envoyé', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_fermee');
  const c = await b.client('A');
  await c.demande.lireDisponibilite(OUVERT);
  assert.equal(c.etatD().disponibilite, 'non');
  await c.demande.envoyer(demande(creneauDans(2, 19)));
  assert.equal((await b.inspecter()).reservations, 0);
  await c.demande.lireDisponibilite(FERME);
  assert.equal(c.etatD().disponibilite, 'non');
});

cas('mes réservations : demandée, confirmée, refusée avec motif ; annulation confirmée de la demandée, jamais de la refusée', async () => {
  const b = nouveauBanc(); await b.scenario('reservations_compte');
  const c = await b.client('A');
  await c.liste.actualiser();
  const l = c.etatL().reservations;
  assert.deepEqual(l.map(r => r.statut).sort(), ['confirmee', 'demandee', 'refusee']);
  assert.equal(l.find(r => r.statut === 'refusee').motif, 'Complet ce soir'); aucunVerrouListe(c.etatL());
  const refusee = l.find(r => r.statut === 'refusee'); const demandee = l.find(r => r.statut === 'demandee');
  await c.liste.annuler(refusee.id, true); await c.liste.annuler(demandee.id, false);
  assert.deepEqual((await b.inspecter()).journal, [], 'rien ne part pour une refusée ni sans confirmation');
  await c.liste.annuler(demandee.id, true);
  assert.deepEqual((await b.inspecter()).journal, ['client:annuler']);
  assert.equal(c.etatL().reservations.find(r => r.id === demandee.id).statut, 'annulee_client'); aucunVerrouListe(c.etatL());
});

cas('restaurateur : deux demandes à venir ; confirmer ; refuser exige motif ET confirmation ; le client lit le motif', async () => {
  const b = nouveauBanc(); await b.scenario('restaurateur_demandes');
  const r = await b.resto(); await r.controle.actualiser();
  assert.equal(r.lu().etat, 'lu');
  const demandes = r.lu().reservations.filter(x => x.statut === 'demandee');
  assert.equal(demandes.length, 2); for (const d of demandes) assert.deepEqual(d.actionsPossibles, ['confirmer', 'refuser']);
  const demain = creneauDans(1, 0).slice(0, 10);
  await r.controle.choisirJour(demain);
  assert.equal(r.lu().jour, demain); assert.equal(r.lu().reservations.length, 3);
  const [premiere, seconde] = demandes;
  await r.controle.decider(premiere.id, 'confirmer', {});
  assert.equal(r.lu().reservations.find(x => x.id === premiere.id).statut, 'confirmee'); aucunVerrouResto(r.lu());
  await r.controle.decider(seconde.id, 'refuser', { motif: '', confirme: true });
  await r.controle.decider(seconde.id, 'refuser', { motif: 'Complet ce soir', confirme: false });
  assert.deepEqual((await b.inspecter()).journal, ['resto:confirmee'], 'pas de refus sans motif ni sans confirmation');
  await r.controle.decider(seconde.id, 'refuser', { motif: 'Complet ce soir', confirme: true });
  assert.equal(r.lu().reservations.find(x => x.id === seconde.id).statut, 'refusee');
  const confirmee = r.lu().reservations.find(x => x.statut === 'confirmee' && x.nom === 'Mariama Barry');
  assert.ok(confirmee, 'la réservation confirmée de demain est visible'); assert.deepEqual(confirmee.actionsPossibles, ['annuler']);
  await r.controle.decider(confirmee.id, 'honoree', {});
  assert.equal((await b.inspecter()).journal.length, 2, 'une action absente de actionsPossibles ne part jamais');
  const clientB = await b.client('B'); await clientB.liste.actualiser();
  assert.equal(clientB.etatL().reservations.find(x => x.statut === 'refusee').motif, 'Complet ce soir');
});

cas('restaurateur : fermer les réservations masque le bouton du client ; la capacité refuse la demande qui dépasse', async () => {
  const b = nouveauBanc(); await b.scenario('restaurateur_reglage');
  const r = await b.resto(); await r.controle.actualiser();
  assert.deepEqual(r.lu().reglage, { accepteReservation: true, capaciteCouverts: 20 });
  await r.controle.ecrireReglage({ capaciteCouverts: 1 });
  assert.equal(r.lu().reglage.capaciteCouverts, 1); aucunVerrouResto(r.lu());
  const c = await b.client('A'); await c.demande.lireDisponibilite(OUVERT);
  await c.demande.envoyer(demande(creneauDans(2, 19), { nbPersonnes: 2 }));
  assert.match(c.etatD().message, /pas assez de places/); assert.equal(c.etatD().confirmee, null); aucunVerrou(c.etatD());
  await r.controle.ecrireReglage({ capaciteCouverts: null });
  assert.equal(r.lu().reglage.capaciteCouverts, null);
  await r.controle.ecrireReglage({ accepteReservation: false });
  assert.equal((await b.inspecter()).restaurant.accepteReservation, false);
  await c.demande.lireDisponibilite(OUVERT);
  assert.equal(c.etatD().disponibilite, 'non');
});

cas('faute « incertain_applique » à l’envoi : verrou, aucun renvoi, la relecture retrouve la demande et lève le verrou', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_ouverte');
  const c = await b.client('A'); await c.demande.lireDisponibilite(OUVERT);
  await b.faute('incertain_applique');
  const creneau = creneauDans(2, 19);
  await c.demande.envoyer(demande(creneau));
  assert.equal(c.etatD().incertain, true); assert.equal((await b.inspecter()).reservations, 1);
  await c.demande.envoyer(demande(creneau));
  assert.equal((await b.inspecter()).reservations, 1, 'aucun second envoi tant que le résultat est à vérifier');
  await c.demande.relire();
  aucunVerrou(c.etatD()); assert.equal(c.etatD().confirmee.statut, 'demandee'); assert.match(c.etatD().message, /bien enregistrée/);
  assert.deepEqual((await b.inspecter()).journal, ['client:creer']);
});

cas('faute « incertain_perdue » à l’envoi : verrou, la relecture ne trouve rien, le client peut renvoyer volontairement (une seule demande au final)', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_ouverte');
  const c = await b.client('A'); await c.demande.lireDisponibilite(OUVERT);
  await b.faute('incertain_perdue');
  const creneau = creneauDans(2, 19);
  await c.demande.envoyer(demande(creneau));
  assert.equal(c.etatD().incertain, true); assert.equal((await b.inspecter()).reservations, 0);
  await c.demande.relire();
  aucunVerrou(c.etatD()); assert.match(c.etatD().message, /Aucune demande trouvée/);
  await c.demande.envoyer(demande(creneau));
  assert.equal(c.etatD().confirmee.statut, 'demandee'); assert.equal((await b.inspecter()).reservations, 1);
});

cas('refus du serveur : capacité pleine, 4e réservation, créneau en double — messages du serveur affichés, aucun verrou', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_ouverte');
  const c = await b.client('A'); await c.demande.lireDisponibilite(OUVERT);
  await b.faute('capacite_pleine');
  await c.demande.envoyer(demande(creneauDans(2, 19)));
  assert.match(c.etatD().message, /pas assez de places/); aucunVerrou(c.etatD());
  for (const h of [19, 20, 21]) { await c.demande.envoyer(demande(creneauDans(3, h))); assert.equal(c.etatD().confirmee.statut, 'demandee'); }
  await c.demande.envoyer(demande(creneauDans(4, 19)));
  assert.match(c.etatD().message, /3 réservations/); aucunVerrou(c.etatD()); assert.equal((await b.inspecter()).reservations, 3);
  const b2 = nouveauBanc(); await b2.scenario('reservation_ouverte');
  const c2 = await b2.client('A'); await c2.demande.lireDisponibilite(OUVERT);
  await c2.demande.envoyer(demande(creneauDans(2, 19), { nbPersonnes: 2 }));
  await c2.demande.envoyer(demande(creneauDans(2, 19), { nbPersonnes: 3 }));
  assert.match(c2.etatD().message, /déjà une réservation à ce créneau/); aucunVerrou(c2.etatD());
});

cas('créneau trop proche ou trop lointain : refusé AVANT le réseau (rien ne part)', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_ouverte');
  const c = await b.client('A'); await c.demande.lireDisponibilite(OUVERT);
  const proche = new Date(Math.ceil((Date.now() + 5 * 60000) / 900000) * 900000).toISOString();
  await c.demande.envoyer(demande(proche)); assert.match(c.etatD().message, /trop proche/);
  await c.demande.envoyer(demande(creneauDans(90, 19))); assert.match(c.etatD().message, /60 jours/);
  assert.equal((await b.inspecter()).reservations, 0); aucunVerrou(c.etatD());
});

cas('faute à l’annulation par le client : verrou, la relecture montre l’annulation appliquée et lève le verrou', async () => {
  const b = nouveauBanc(); await b.scenario('reservations_compte');
  const c = await b.client('A'); await c.liste.actualiser();
  const confirmee = c.etatL().reservations.find(r => r.statut === 'confirmee');
  await b.faute('incertain_applique');
  await c.liste.annuler(confirmee.id, true);
  assert.equal(c.etatL().incertain, true);
  await c.liste.annuler(confirmee.id, true);
  assert.deepEqual((await b.inspecter()).journal, ['client:annuler'], 'jamais rejoué');
  await c.liste.actualiser();
  aucunVerrouListe(c.etatL()); assert.equal(c.etatL().reservations.find(r => r.id === confirmee.id).statut, 'annulee_client');
});

cas('faute à la décision du restaurateur : verrou sur toutes les actions ; la relecture montre la décision appliquée et lève le verrou', async () => {
  const b = nouveauBanc(); await b.scenario('restaurateur_demandes');
  const r = await b.resto(); await r.controle.actualiser(); await r.controle.choisirJour(creneauDans(1, 0).slice(0, 10));
  const [premiere, seconde] = r.lu().reservations.filter(x => x.statut === 'demandee');
  await b.faute('incertain_applique');
  await r.controle.decider(premiere.id, 'confirmer', {});
  assert.equal(r.lu().incertain, true);
  await r.controle.decider(seconde.id, 'confirmer', {}); await r.controle.ecrireReglage({ capaciteCouverts: 5 });
  assert.deepEqual((await b.inspecter()).journal, ['resto:confirmee'], 'jamais rejoué, aucune autre écriture');
  await r.controle.actualiser();
  aucunVerrouResto(r.lu()); assert.equal(r.lu().reservations.find(x => x.id === premiere.id).statut, 'confirmee');
  await b.faute('incertain_perdue');
  await r.controle.ecrireReglage({ capaciteCouverts: 5 });
  assert.equal(r.lu().incertain, true);
  await r.controle.actualiser();
  aucunVerrouResto(r.lu()); assert.equal(r.lu().reglage.capaciteCouverts, null);
});

cas('un compte client n’ouvre pas la section restaurateur ; les données du compte A ne sont jamais lues par B', async () => {
  const b = nouveauBanc(); await b.scenario('reservations_compte');
  const r = await (async () => { const s = await b.session('A'); const pubs = []; const controle = creerControleReservationRestaurateur(s, e => pubs.push(e)); return { controle, pubs }; })();
  await r.controle.actualiser();
  assert.equal(r.pubs.at(-1).etat, 'erreur');
  const cb = await b.client('B'); await cb.liste.actualiser();
  assert.equal(cb.etatL().reservations.length, 0, 'B ne voit pas les réservations de A');
});

cas('le journal du banc ne contient ni nom, ni téléphone, ni note', async () => {
  const b = nouveauBanc(); await b.scenario('reservation_ouverte');
  const c = await b.client('A'); await c.demande.lireDisponibilite(OUVERT);
  await c.demande.envoyer(demande(creneauDans(2, 19)));
  const texte = JSON.stringify(await b.inspecter());
  for (const secret of ['Aminata', '620000001', '620 00 00 01', 'Au calme', 'Bearer']) assert.ok(!texte.includes(secret), secret);
  assert.ok(!JSON.stringify(c.pubsD).includes('Aminata') && !JSON.stringify(c.pubsD).includes('Au calme'), 'les états publiés ne contiennent pas les coordonnées');
});

let echecs = 0;
for (const [nom, fn] of parcours) {
  try { await fn(); console.log('OK     ' + nom); }
  catch (e) { echecs++; console.log('ECHEC  ' + nom + '\n' + (e && e.stack ? e.stack : String(e))); }
}
if (echecs > 0) { console.log('PARCOURS RESERVATION : ' + echecs + ' ECHEC(S) sur ' + parcours.length); process.exit(1); }
console.log('PARCOURS RESERVATION : ' + parcours.length + ' parcours OK');
