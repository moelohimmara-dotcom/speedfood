// Serveur de banc LOCAL seulement (lot M4a) : VRAIES routes Hono de la réservation de table et VRAIS services (client et restaurateur, règles de statut et de temps comprises)
// sur une base factice EN MÉMOIRE. Aucune écriture réelle, aucun appel réseau sortant, aucun secret : les « écritures » ne modifient qu'un objet JavaScript local.
// Les états, les transitions et les actions possibles viennent du module partagé (`packages/shared`), jamais recopiés ici.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import { routeReservations, routeReservationsRestaurant, routeReservationReglage } from '../../api/src/routes/reservation.ts';
import { creerServiceReservationClient } from '../../api/src/reservation/client.ts';
import { creerServiceReservationRestaurant } from '../../api/src/reservation/restaurateur.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { reponseErreur } from '../../api/src/http.ts';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE, RESTAURANTS_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE, RESTAURANTS_CONTROLE };

const [CLIENT_A, CLIENT_B, RESTAURATEUR] = COMPTES_CONTROLE;
const ACTIVES = ['demandee', 'confirmee'];
const CHARS = '23456789';
const JOUR_MS = 24 * 3600 * 1000;

export const scenariosReservation = {
  reservation_ouverte: 'Le restaurant accepte les réservations ; le client A n’a aucune réservation',
  reservation_fermee: 'Le restaurant n’accepte PAS les réservations : le bouton « Réserver une table » est masqué',
  reservations_compte: 'Le client A a trois réservations : une demandée, une confirmée, une refusée avec motif',
  restaurateur_demandes: 'Le restaurateur voit deux demandes à venir (demain) et une réservation confirmée (demain 20:00)',
  restaurateur_reglage: 'Le restaurateur a les réservations ouvertes et une capacité de 20 couverts ; aucune réservation',
};
const scenarios = new Set(Object.keys(scenariosReservation));
const fautes = new Set(['aucune', 'incertain_applique', 'incertain_perdue', 'capacite_pleine']);

/** Le jour (UTC = heure de Conakry), `jours` jours après aujourd'hui, à `heure` heures pile. */
function creneauDans(jours, heure) {
  const debut = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  return new Date(debut + jours * JOUR_MS + heure * 3600000).toISOString();
}

export function creerBancReservation() {
  let scenario = 'reservation_ouverte';
  let monde;
  function nouveauMonde(cas) {
    const m = { restaurants: new Map(), reservations: [], journal: [], faute: 'aucune', lectures: 0, compteur: 0 };
    m.restaurants.set(RESTAURANTS_CONTROLE.ouvert, { id: RESTAURANTS_CONTROLE.ouvert, nom: 'Chez Fatou (témoin)', publie: true, suspendu: false, accepte: cas !== 'reservation_fermee', capacite: cas === 'restaurateur_reglage' ? 20 : null });
    m.restaurants.set(RESTAURANTS_CONTROLE.ferme, { id: RESTAURANTS_CONTROLE.ferme, nom: 'Chez Mariama (témoin)', publie: true, suspendu: false, accepte: false, capacite: null });
    return m;
  }
  function ajouter(surcharge) {
    monde.compteur++;
    const n = monde.compteur;
    const r = {
      id: 'aaaaaaaa-0000-4000-8000-' + String(n).padStart(12, '0'), reference: 'SF-R-2222' + CHARS[n % 8], restaurantId: RESTAURANTS_CONTROLE.ouvert, clientUid: CLIENT_A,
      nom: 'Aminata Camara', telephone: '+224620000001', nbPersonnes: 4, creneau: creneauDans(2, 19), note: null, statut: 'demandee', motif: null, creeLe: new Date().toISOString(), ...surcharge,
    };
    monde.reservations.push(r);
    return r;
  }
  function preparer(cas) {
    monde = nouveauMonde(cas);
    if (cas === 'reservations_compte') {
      ajouter({ statut: 'demandee', creneau: creneauDans(2, 19), nbPersonnes: 4 });
      ajouter({ statut: 'confirmee', creneau: creneauDans(3, 20), nbPersonnes: 2, note: 'Près de la fenêtre' });
      ajouter({ statut: 'refusee', creneau: creneauDans(1, 12), nbPersonnes: 6, motif: 'Complet ce soir' });
    } else if (cas === 'restaurateur_demandes') {
      ajouter({ clientUid: CLIENT_B, nom: 'Aminata Diallo', telephone: '+224622123456', statut: 'demandee', creneau: creneauDans(1, 12), nbPersonnes: 2, note: 'Anniversaire' });
      ajouter({ clientUid: CLIENT_B, nom: 'Ibrahima Sow', telephone: '+224655987654', statut: 'demandee', creneau: creneauDans(1, 19), nbPersonnes: 4 });
      ajouter({ clientUid: CLIENT_A, nom: 'Mariama Barry', telephone: '+224664111222', statut: 'confirmee', creneau: creneauDans(1, 20), nbPersonnes: 3 });
    }
  }
  preparer(scenario);

  const versClient = r => ({ id: r.id, reference: r.reference, restaurantId: r.restaurantId, restaurantNom: monde.restaurants.get(r.restaurantId).nom, creneau: r.creneau, nbPersonnes: r.nbPersonnes, nom: r.nom, telephone: r.telephone, note: r.note, statut: r.statut, motif: r.motif, creeLe: r.creeLe });
  const versLigne = r => ({ id: r.id, reference: r.reference, creneau: r.creneau, nbPersonnes: r.nbPersonnes, nom: r.nom, telephone: r.telephone, note: r.note, statut: r.statut, motif: r.motif, creeLe: r.creeLe });
  /** Faute programmée : ne vaut que pour la PROCHAINE écriture, puis disparaît. */
  function prendreFaute(...valides) { if (!valides.includes(monde.faute)) return 'aucune'; const f = monde.faute; monde.faute = 'aucune'; return f; }
  const noter = ligne => monde.journal.push(ligne);

  const portsClient = {
    maintenant: () => new Date(),
    async lireRestaurant(id) {
      const r = monde.restaurants.get(id); if (!r) return null;
      const pleine = prendreFaute('capacite_pleine') === 'capacite_pleine';
      return { id: r.id, publie: r.publie, suspendu: r.suspendu, accepteReservation: r.accepte, capaciteCouverts: pleine ? 0 : r.capacite };
    },
    async listerActives(uid, maintenant) { return monde.reservations.filter(r => r.clientUid === uid && ACTIVES.includes(r.statut) && Date.parse(r.creneau) > maintenant.getTime()).map(versClient); },
    async sommeCouverts(restaurantId, creneau) { return monde.reservations.filter(r => r.restaurantId === restaurantId && ACTIVES.includes(r.statut) && Date.parse(r.creneau) === creneau.getTime()).reduce((t, r) => t + r.nbPersonnes, 0); },
    async inserer(ligne) {
      const faute = prendreFaute('incertain_applique', 'incertain_perdue');
      if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');
      const r = ajouter({ restaurantId: ligne.restaurantId, clientUid: ligne.clientUserId, nom: ligne.nom, telephone: ligne.telephone, nbPersonnes: ligne.nbPersonnes, creneau: ligne.creneau, note: ligne.note, statut: 'demandee' });
      noter('client:creer');
      if (faute === 'incertain_applique') throw new Error('PANNE_FACTICE_APRES_ECRITURE');
      return { ok: true, reservation: versClient(r) };
    },
    async lireDisponibilite(id) { const r = monde.restaurants.get(id); return r ? { publie: r.publie, suspendu: r.suspendu, accepteReservation: r.accepte } : null; },
    async lister(uid) { monde.lectures++; return monde.reservations.filter(r => r.clientUid === uid).sort((a, b) => Date.parse(a.creneau) - Date.parse(b.creneau)).slice(0, 50).map(versClient); },
    async lire(uid, id) { const r = monde.reservations.find(x => x.id === id && x.clientUid === uid); return r ? versClient(r) : null; },
    async annuler(uid, id) {
      const faute = prendreFaute('incertain_applique', 'incertain_perdue');
      if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');
      const r = monde.reservations.find(x => x.id === id && x.clientUid === uid && ACTIVES.includes(x.statut));
      if (!r) return { ok: false, genre: 'aucune_ligne' };
      r.statut = 'annulee_client'; noter('client:annuler');
      if (faute === 'incertain_applique') throw new Error('PANNE_FACTICE_APRES_ECRITURE');
      return { ok: true, ligne: versClient(r) };
    },
  };
  const portsRestaurateur = {
    maintenant: () => new Date(),
    async lireDuJour(_c, rid, debut, fin) { monde.lectures++; return monde.reservations.filter(r => r.restaurantId === rid && Date.parse(r.creneau) >= debut.getTime() && Date.parse(r.creneau) < fin.getTime()).map(versLigne); },
    async lireDemandesAVenir(_c, rid, maintenant) { return monde.reservations.filter(r => r.restaurantId === rid && r.statut === 'demandee' && Date.parse(r.creneau) > maintenant.getTime()).map(versLigne); },
    async lire(_c, rid, id) { const r = monde.reservations.find(x => x.id === id && x.restaurantId === rid); return r ? versLigne(r) : null; },
    async ecrireStatut(_c, rid, id, ancien, nouveau, motif) {
      const faute = prendreFaute('incertain_applique', 'incertain_perdue');
      if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');
      const r = monde.reservations.find(x => x.id === id && x.restaurantId === rid && x.statut === ancien);
      if (!r) return { ok: false, genre: 'aucune_ligne' };
      r.statut = nouveau; if (motif !== null) r.motif = motif; noter('resto:' + nouveau);
      if (faute === 'incertain_applique') throw new Error('PANNE_FACTICE_APRES_ECRITURE');
      return { ok: true, ligne: versLigne(r) };
    },
    async lireReglage(_c, rid) { const r = monde.restaurants.get(rid); return r ? { accepteReservation: r.accepte, capaciteCouverts: r.capacite } : null; },
    async ecrireReglage(_c, rid, valeurs) {
      const faute = prendreFaute('incertain_applique', 'incertain_perdue');
      if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');
      const r = monde.restaurants.get(rid); if (!r) return { ok: false, genre: 'aucune_ligne' };
      if (valeurs.accepteReservation !== undefined) r.accepte = valeurs.accepteReservation;
      if (valeurs.capaciteCouverts !== undefined) r.capacite = valeurs.capaciteCouverts;
      noter('resto:reglage');
      if (faute === 'incertain_applique') throw new Error('PANNE_FACTICE_APRES_ECRITURE');
      return { ok: true, ligne: { accepteReservation: r.accepte, capaciteCouverts: r.capacite } };
    },
  };

  const deps = {
    verificateurs: { strict: async j => { const i = PORTEURS_CONTROLE.indexOf(j); return i < 0 ? null : { id: COMPTES_CONTROLE[i] }; }, local: async () => { throw Error('MODE_LOCAL_INTERDIT'); } },
    limiterClientApplication: async () => undefined,
    restaurant: { contexte: async (_jeton, utilisateurId) => {
      if (utilisateurId !== RESTAURATEUR) throw new ErreurMetier('NON_AUTORISE', 'Ce compte n’est rattaché à aucun restaurant.');
      return { supabase: {}, utilisateurId, restaurantId: RESTAURANTS_CONTROLE.ouvert, role: 'manager' };
    } },
    reservations: creerServiceReservationClient(portsClient),
    reservationsRestaurant: creerServiceReservationRestaurant(portsRestaurateur),
  };

  const app = new Hono();
  app.get('/__etat', c => {
    const parStatut = {};
    for (const r of monde.reservations) parStatut[r.statut] = (parStatut[r.statut] ?? 0) + 1;
    const o = monde.restaurants.get(RESTAURANTS_CONTROLE.ouvert);
    // Aucun nom, téléphone ni note : seulement des compteurs, des états et le journal des écritures.
    return c.json({ scenario, faute: monde.faute, journal: monde.journal, lectures: monde.lectures, reservations: monde.reservations.length, parStatut, restaurant: { accepteReservation: o.accepte, capaciteCouverts: o.capacite } });
  });
  app.post('/__scenario', c => {
    const cas = c.req.query('cas');
    if (!scenarios.has(cas)) return c.json({ ok: false }, 400);
    scenario = cas; preparer(cas);
    return c.json({ ok: true, scenario });
  });
  /** Faute programmée pour la prochaine écriture : `incertain_applique` (appliquée puis panne), `incertain_perdue` (panne avant l'écriture), `capacite_pleine` (la prochaine demande est refusée faute de places). */
  app.post('/__faute', c => {
    const type = c.req.query('type');
    if (!fautes.has(type)) return c.json({ ok: false }, 400);
    monde.faute = type; return c.json({ ok: true, faute: type });
  });
  app.route('/api/v1/reservations', routeReservations(deps));
  app.route('/api/v1/restaurant/reservations', routeReservationsRestaurant(deps));
  app.route('/api/v1/restaurant/reservation-reglage', routeReservationReglage(deps));
  app.onError((e, c) => e instanceof ErreurMetier ? reponseErreur(c, e.toApi()) : c.json({ ok: false, erreur: { code: 'ERREUR_SERVEUR', message: 'Panne factice du banc.' } }, 500));
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = creerBancReservation();
  createServer(async (req, res) => {
    try {
      const morceaux = [];
      for await (const morceau of req) morceaux.push(morceau);
      const corps = Buffer.concat(morceaux);
      const reponse = await app.fetch(new Request('http://127.0.0.1:8798' + (req.url ?? '/'), { method: req.method, headers: req.headers, body: corps.length > 0 && req.method !== 'GET' && req.method !== 'HEAD' ? corps : undefined }));
      res.writeHead(reponse.status, Object.fromEntries(reponse.headers)); res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch { res.writeHead(500); res.end('ERREUR_BANC'); }
  }).listen(8798, '127.0.0.1', () => console.log('Banc réservation local prêt sur 127.0.0.1:8798 ; aucune base réelle.'));
}
