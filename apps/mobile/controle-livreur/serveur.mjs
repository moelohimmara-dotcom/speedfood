// Serveur de banc LOCAL seulement : vraie route Hono + vrais services de lecture (fiche, état, course) sur une base factice EN MÉMOIRE.
// G3c : le banc joue aussi l'offre et la course (acceptation, étapes, code de remise, échec) sur des identités et des données factices.
// Aucune écriture réelle, aucun appel réseau sortant, aucun secret : les « écritures » ne modifient qu'un objet JavaScript local.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import { routeLivreur } from '../../api/src/routes/livreur.ts';
import { creerServiceLivreur } from '../../api/src/livreur/fiche.ts';
import { creerLectureEtat } from '../../api/src/livreur/etat.ts';
import { creerLectureCommande } from '../../api/src/livreur/commande.ts';
import { creerAvancementCourse, creerLectureCourseActive } from '../../api/src/livreur/course.ts';
import { acteurPeut } from '../../web/src/lib/livraison/statuts.ts';
import { ErreurMetier } from '@speedfood/shared/contracts/erreurs';
import { reponseErreur } from '../../api/src/http.ts';
import { PORTEURS_CONTROLE, COMPTES_CONTROLE } from './identites.ts';
export { PORTEURS_CONTROLE };

const [A, B] = COMPTES_CONTROLE;
const LIVREUR_A = 'livreur-témoin-A';
const LIVREUR_B = 'livreur-témoin-B';
/** Identifiants au format UUID : les corps des routes d'offre et de course l'exigent. */
export const IDENTIFIANTS_BANC = {
  offreA: 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  courseA: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  courseAChangee: 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
  courseB: 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
};
/** Code de remise FACTICE du banc (aucun rapport avec un vrai code) ; il n'apparaît dans aucune réponse ni dans /__etat. */
const CODE_REMISE_FACTICE = '4821';
const ESSAIS_CODE_MAX = 5;
const APRES_RECUPERATION = ['recuperee', 'vers_client'];
const STATUTS_ACTIFS = ['assignee', 'vers_restaurant', 'recuperee', 'vers_client'];

const scenariosHistoriques = ['actif', 'suspendu', 'archive', 'absente', 'panne', 'lente', 'restaurant_masque', 'offre', 'offre_expiree'];
/** Scénarios G3 : ils réinitialisent le monde factice (offres, courses, essais de code, journal). */
const scenariosG3 = {
  g3_offre: 'A est disponible et a une offre en attente',
  g3_course: 'A a une course acceptée (groupe Speedfood)',
  g3_course_vers_restaurant: 'A est en route vers le restaurant',
  g3_course_recuperee: 'A a récupéré la commande (client visible)',
  g3_course_vers_client: 'A est en route vers le client (client visible, code de remise attendu)',
  g3_propre: 'Livraison par le personnel du restaurant (étapes réduites)',
  g3_lente: 'A (lente) et B ont chacun leur course ; seule la lecture de A est lente',
};
const scenarios = new Set([...scenariosHistoriques, ...Object.keys(scenariosG3)]);
const fautes = new Set(['aucune', 'incertain_applique', 'incertain_perdue', 'incertain_delai']);
const attendre = ms => new Promise(r => setTimeout(r, ms));

function nouveauMonde() { return { livraisons: [], offres: [], essais: {}, journal: [], raisons: [], clientsLus: 0, violations: [], faute: 'aucune' }; }
const ligneCourse = (id, livreur, statut, extra = {}) => ({ id, livreur_id: livreur, mode: 'speedfood', statut, frais_gnf: 7000, order_id: 'ord-' + id, cree_le: '2026-11-09T10:00:00.000Z', restaurant: 'Restaurant témoin A', reference: 'SF-TEST-0001', client: { nom: 'Client témoin', telephone: '+224 600 00 00 01', adresse: 'Rue témoin 12, Conakry' }, ...extra });

export function creerBancLivreur() {
  let scenario = 'actif'; const appels = []; const bascules = []; let declenchements = 0;
  let statutA = 'hors_ligne';
  let monde = nouveauMonde();

  function preparerScenarioG3(cas) {
    monde = nouveauMonde();
    const I = IDENTIFIANTS_BANC;
    statutA = 'en_course';
    if (cas === 'g3_offre') {
      statutA = 'disponible';
      monde.offres.push({ id: I.offreA, livreur_id: LIVREUR_A, statut: 'en_attente', expire_le: new Date(Date.now() + 3600000).toISOString(), livraisonId: I.courseA });
      monde.livraisons.push(ligneCourse(I.courseA, null, 'offre_envoyee'));
    } else if (cas === 'g3_course') monde.livraisons.push(ligneCourse(I.courseA, LIVREUR_A, 'assignee'));
    else if (cas === 'g3_course_vers_restaurant') monde.livraisons.push(ligneCourse(I.courseA, LIVREUR_A, 'vers_restaurant'));
    else if (cas === 'g3_course_recuperee') monde.livraisons.push(ligneCourse(I.courseA, LIVREUR_A, 'recuperee'));
    else if (cas === 'g3_course_vers_client') monde.livraisons.push(ligneCourse(I.courseA, LIVREUR_A, 'vers_client'));
    else if (cas === 'g3_propre') monde.livraisons.push(ligneCourse(I.courseA, LIVREUR_A, 'assignee', { mode: 'propre', restaurant: 'Restaurant témoin A (livraison par le restaurant)' }));
    else if (cas === 'g3_lente') {
      monde.livraisons.push(ligneCourse(I.courseA, LIVREUR_A, 'vers_client'));
      monde.livraisons.push(ligneCourse(I.courseB, LIVREUR_B, 'vers_restaurant', { restaurant: 'Restaurant témoin B', reference: 'SF-TEST-B001', client: { nom: 'Client témoin B', telephone: '+224 600 00 00 02', adresse: 'Rue témoin B 7' } }));
    }
  }

  function tableLivraisons() {
    // Gardes de projection comme les autres tables : projections EXACTES, filtres connus, aucune requête sans filtre, client lu seulement après récupération.
    const PROJECTIONS = new Set(['id, mode, statut, frais_gnf, order_id, restaurants(nom)', 'id', 'statut, orders(reference)', 'statut, orders(reference, client_nom, client_telephone, client_adresse)']);
    const filtres = []; const ordres = []; let projection = null; let limite = Number.POSITIVE_INFINITY;
    return {
      select(champs) { const p = String(champs).trim(); if (!PROJECTIONS.has(p)) throw new Error('PROJECTION_NON_PREVUE'); projection = p; return this; },
      eq(champ, valeur) { if (champ !== 'id' && champ !== 'livreur_id') throw new Error('FILTRE_NON_PREVU'); filtres.push(l => l[champ] === valeur); return this; },
      in(champ, valeurs) { if (champ !== 'statut' || !Array.isArray(valeurs)) throw new Error('FILTRE_NON_PREVU'); filtres.push(l => valeurs.includes(l.statut)); return this; },
      order(champ, options) { if (champ !== 'cree_le' && champ !== 'id') throw new Error('TRI_NON_PREVU'); ordres.push([champ, options?.ascending !== false]); return this; },
      limit(n) { if (!Number.isInteger(n) || n < 1) throw new Error('LIMITE_NON_PREVUE'); limite = n; return this; },
      async maybeSingle() {
        if (projection === null) throw new Error('PROJECTION_ABSENTE');
        if (filtres.length === 0) throw new Error('REQUETE_SANS_FILTRE');
        if (scenario === 'panne') return { data: null, error: { code: 'PANNE_FACTICE' } };
        const lignes = monde.livraisons.filter(l => filtres.every(f => f(l)));
        lignes.sort((a, b) => { for (const [champ, croissant] of ordres) { const x = String(a[champ]); const y = String(b[champ]); if (x !== y) return (x < y ? -1 : 1) * (croissant ? 1 : -1); } return 0; });
        const l = lignes.slice(0, limite)[0];
        if (!l) return { data: null, error: null };
        if (projection === 'id') return { data: { id: l.id }, error: null };
        if (projection.startsWith('id, mode')) return { data: { id: l.id, mode: l.mode, statut: l.statut, frais_gnf: l.frais_gnf, order_id: l.order_id, restaurants: { nom: l.restaurant } }, error: null };
        if (projection === 'statut, orders(reference)') return { data: { statut: l.statut, orders: { reference: l.reference } }, error: null };
        if (!APRES_RECUPERATION.includes(l.statut)) { monde.violations.push('CLIENT_AVANT_RECUPERATION:' + l.statut); throw new Error('CLIENT_AVANT_RECUPERATION'); }
        monde.clientsLus++;
        return { data: { statut: l.statut, orders: { reference: l.reference, client_nom: l.client.nom, client_telephone: l.client.telephone, client_adresse: l.client.adresse } }, error: null };
      },
    };
  }

  function tableOffres() {
    const filtres = [];
    return {
      select(champs) { if (String(champs).includes('*')) throw new Error('PROJECTION_NON_PREVUE'); return this; },
      eq(champ, valeur) { if (champ !== 'livreur_id' && champ !== 'statut') throw new Error('FILTRE_NON_PREVU'); filtres.push(o => o[champ] === valeur); return this; },
      gt(champ, valeur) { if (champ !== 'expire_le') throw new Error('FILTRE_NON_PREVU'); filtres.push(o => Date.parse(o.expire_le) > Date.parse(valeur)); return this; },
      order() { return this; }, limit() { return this; },
      async maybeSingle() {
        const cas = scenario;
        if (cas === 'panne') return { data: null, error: { code: 'PANNE_FACTICE' } };
        if (cas === 'offre' && statutA === 'disponible') return { data: { id: 'offre-témoin-1', expire_le: new Date(Date.now() + 90000).toISOString(), livraisons: { distance_m: 3200, frais_gnf: 5000, depart_latitude: 10.4, depart_longitude: -13.53, restaurants: { nom: 'Restaurant témoin A' } } }, error: null };
        const o = monde.offres.filter(x => filtres.every(f => f(x)))[0];
        if (!o) return { data: null, error: null };
        return { data: { id: o.id, expire_le: o.expire_le, livraisons: { distance_m: 3200, frais_gnf: 5000, depart_latitude: 10.4, depart_longitude: -13.53, restaurants: { nom: 'Restaurant témoin A' } } }, error: null };
      },
    };
  }

  function clientFictif() {
    return { from(table) {
      if (table === 'livraison_offres') return tableOffres();
      if (table === 'livraisons') return tableLivraisons();
      if (table !== 'livreurs') throw new Error('TABLE_NON_PREVUE');
      let uid = null;
      return { select(champs) { if (champs.includes('*')) throw new Error('PROJECTION_NON_PREVUE'); return this; }, eq(champ, valeur) { if (champ !== 'utilisateur_id') throw new Error('FILTRE_NON_PREVU'); uid = valeur; return this; }, async maybeSingle() {
        const cas = scenario;
        if ((cas === 'lente' || cas === 'g3_lente') && uid === A) await attendre(2500);
        if (cas === 'panne') return { data: null, error: { code: 'PANNE_FACTICE' } };
        if (cas === 'absente') return { data: null, error: null };
        const lignes = [
          { id: LIVREUR_B, utilisateur_id: B, nom: 'Livreur témoin B', statut: cas === 'g3_lente' ? 'en_course' : 'disponible', vehicule: 'pied', cycle: 'actif', motif_cycle: null, latitude: null, longitude: null, restaurants: { nom: 'Restaurant témoin B' } },
          { id: LIVREUR_A, utilisateur_id: A, nom: 'Livreuse témoin A', statut: statutA, vehicule: 'moto', cycle: cas === 'suspendu' ? 'suspendu' : cas === 'archive' ? 'archive' : 'actif', motif_cycle: cas === 'suspendu' ? 'Dossier à vérifier' : null, latitude: 10.39, longitude: -13.52, restaurants: null },
        ];
        const ligne = lignes.find(l => l.utilisateur_id === uid) ?? lignes[0];
        return { data: cas === 'restaurant_masque' ? { ...ligne, restaurants: null } : ligne, error: null };
      } };
    } };
  }
  const service = creerServiceLivreur({ clientDuJeton: clientFictif, limiter: async () => undefined });
  // Vrais services de lecture (état, course, commande) sur la base factice ; règles de statut du site (fonction pure `acteurPeut`).
  const lireEtat = creerLectureEtat({ clientDuJeton: () => clientFictif(), regles: { acteurPeut }, lireCommande: creerLectureCommande({ client: () => clientFictif() }) });
  const courseActive = creerLectureCourseActive({ clientDuJeton: () => clientFictif() });

  async function basculerFactice(utilisateurId, enLigne) {
    const cas = scenario;
    if (cas === 'suspendu' || cas === 'archive') return { ok: false, message: 'Votre fiche n’est pas active : elle ne peut pas changer de disponibilité.' };
    bascules.push((utilisateurId === A ? 'A' : 'B') + ':' + (enLigne ? 'en_ligne' : 'hors_ligne'));
    if (utilisateurId === A) statutA = enLigne ? 'disponible' : 'hors_ligne';
    return { ok: true };
  }

  const acteur = utilisateurId => (utilisateurId === A ? 'A' : 'B');
  const livreurDe = utilisateurId => (utilisateurId === A ? LIVREUR_A : LIVREUR_B);
  /** Faute programmée : ne vaut que pour la PROCHAINE écriture, puis disparaît. */
  function prendreFaute() { const f = monde.faute; monde.faute = 'aucune'; return f; }
  async function apresEcriture(faute) {
    if (faute === 'incertain_applique') throw new Error('PANNE_FACTICE_APRES_ECRITURE');
    if (faute === 'incertain_delai') { await attendre(7000); throw new Error('PANNE_FACTICE_DELAI'); }
  }

  async function repondreOffreFactice(utilisateurId, offreId, reponse) {
    const faute = prendreFaute();
    if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');
    const o = monde.offres.find(x => x.id === offreId && x.livreur_id === livreurDe(utilisateurId) && x.statut === 'en_attente' && Date.parse(x.expire_le) > Date.now());
    if (!o) return { ok: false, message: 'Cette offre n’est plus disponible.' };
    o.statut = reponse;
    monde.journal.push(acteur(utilisateurId) + ':offre:' + reponse);
    if (reponse === 'acceptee') {
      const l = monde.livraisons.find(x => x.id === o.livraisonId);
      if (l) { l.livreur_id = livreurDe(utilisateurId); l.statut = 'assignee'; }
      if (utilisateurId === A) statutA = 'en_course';
    }
    await apresEcriture(faute);
    return { ok: true };
  }

  async function avancerFactice(utilisateurId, vers, code, raison) {
    const faute = prendreFaute();
    if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');
    const cours = monde.livraisons.filter(l => l.livreur_id === livreurDe(utilisateurId) && STATUTS_ACTIFS.includes(l.statut)).sort((a, b) => (a.cree_le + a.id < b.cree_le + b.id ? -1 : 1))[0];
    if (!cours) return { ok: false, message: 'Aucune course en cours.' };
    if (!acteurPeut('livreur', cours.statut, vers, cours.mode)) return { ok: false, message: 'Cette étape n’est pas possible depuis l’état actuel de la course.' };
    if (vers === 'livree') {
      const essais = monde.essais[cours.id] ?? 0;
      if (essais >= ESSAIS_CODE_MAX) return { ok: false, message: 'Trop d’essais de code. Contactez l’assistance.' };
      monde.essais[cours.id] = essais + 1;
      if (code !== CODE_REMISE_FACTICE) {
        monde.journal.push(acteur(utilisateurId) + ':course:livree:code_faux');
        return { ok: false, message: 'Code incorrect. Demandez au client le code à 4 chiffres affiché sur son suivi (' + (ESSAIS_CODE_MAX - essais - 1) + ' essai(s) restant(s)).' };
      }
    }
    cours.statut = vers;
    if (vers === 'echec' && raison !== undefined) monde.raisons.push(raison);
    if ((vers === 'livree' || vers === 'echec') && utilisateurId === A) statutA = 'disponible';
    monde.journal.push(acteur(utilisateurId) + ':course:' + vers);
    await apresEcriture(faute);
    return { ok: true };
  }

  const app = new Hono();
  app.get('/__etat', c => c.json({
    scenario, lectures: appels.length, comptesLus: appels, bascules, declenchements,
    g3: { journal: monde.journal, raisons: monde.raisons, clientsLus: monde.clientsLus, violations: monde.violations, faute: monde.faute, essais: Object.values(monde.essais),
      livraisons: monde.livraisons.map(l => ({ id: l.id, livreur: l.livreur_id === LIVREUR_A ? 'A' : l.livreur_id === LIVREUR_B ? 'B' : null, statut: l.statut, mode: l.mode })),
      offres: monde.offres.map(o => ({ id: o.id, statut: o.statut })) },
  }));
  app.post('/__scenario', c => {
    const cas = c.req.query('cas');
    if (!scenarios.has(cas)) return c.json({ ok: false }, 400);
    const venaitDeG3 = scenario in scenariosG3;
    scenario = cas;
    if (cas in scenariosG3) preparerScenarioG3(cas);
    else { monde = nouveauMonde(); if (venaitDeG3) statutA = 'hors_ligne'; }
    return c.json({ ok: true, scenario });
  });
  /** Faute programmée pour la prochaine écriture : `incertain_applique` (appliquée puis panne), `incertain_perdue` (panne avant l'écriture), `incertain_delai` (appliquée puis silence de 7 s). */
  app.post('/__faute', c => {
    const type = c.req.query('type');
    if (!fautes.has(type)) return c.json({ ok: false }, 400);
    monde.faute = type; return c.json({ ok: true, faute: type });
  });
  /** Le « serveur » change la course de A entre deux lectures : l'ancienne course est annulée, une autre (autre identifiant) la remplace. */
  app.post('/__changer-course', c => {
    const ancienne = monde.livraisons.find(l => l.livreur_id === LIVREUR_A && STATUTS_ACTIFS.includes(l.statut));
    if (!ancienne) return c.json({ ok: false }, 409);
    ancienne.statut = 'annulee';
    monde.livraisons.push(ligneCourse(IDENTIFIANTS_BANC.courseAChangee, LIVREUR_A, 'assignee', { reference: 'SF-TEST-0002', cree_le: '2026-11-09T10:05:00.000Z' }));
    monde.journal.push('serveur:course_changee');
    return c.json({ ok: true });
  });
  app.route('/api/v1/livreur', routeLivreur({
    verificateurs: { strict: async j => j === PORTEURS_CONTROLE[0] ? { id: A } : j === PORTEURS_CONTROLE[1] ? { id: B } : null, local: async () => { throw Error('MODE_LOCAL_INTERDIT'); } },
    livreur: {
      ...service,
      lireFiche: (j, id) => { appels.push(id === A ? 'A' : 'B'); return service.lireFiche(j, id); },
      lireEtat, basculer: basculerFactice, avancerOffres: async () => { declenchements++; },
      repondreOffre: repondreOffreFactice,
      avancerCourse: creerAvancementCourse({ courseActive, avancer: avancerFactice }),
    },
  }));
  app.onError((e, c) => e instanceof ErreurMetier ? reponseErreur(c, e.toApi()) : c.json({ ok: false, erreur: { code: 'ERREUR_SERVEUR', message: 'Panne factice de la lecture.' } }, 500));
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = creerBancLivreur();
  createServer(async (req, res) => {
    try {
      const morceaux = [];
      for await (const morceau of req) morceaux.push(morceau);
      const corps = Buffer.concat(morceaux);
      const reponse = await app.fetch(new Request('http://127.0.0.1:8797' + (req.url ?? '/'), { method: req.method, headers: req.headers, body: corps.length > 0 ? corps : undefined }));
      res.writeHead(reponse.status, Object.fromEntries(reponse.headers)); res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch { res.writeHead(500); res.end('ERREUR_BANC'); }
  }).listen(8797, '127.0.0.1', () => console.log('Banc livreur local prêt sur 127.0.0.1:8797 ; aucune base réelle.'));
}
