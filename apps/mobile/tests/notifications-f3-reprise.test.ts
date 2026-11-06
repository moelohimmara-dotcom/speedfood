// Phase ROUGE du lot F3 (reprise) : reproduit B1 (appui à chaud sur `commande_nouvelle`) et B2 (deux demandes système en concurrence).
// Tests comportementaux déterministes : promesses différées, aucune attente temporelle, aucun réseau, aucun secret.
//
// Contrat du module pur envisagé pour B1 : `apps/mobile/src/connexion/ouverture-espace.ts`
//   creerDemandeEspace(): {
//     armer(demande: { espaceRestaurateur?: boolean } | null): void;   // nouvelle demande d'ouverture (appui) ; `null` ou sans drapeau = rien en attente
//     evaluer(etat: { ouvert: boolean; connectee: boolean; restaurateur: boolean | null }): boolean; // vrai UNE seule fois : l'espace doit s'ouvrir maintenant
//     fermer(): void;                                                  // l'écran « Mon compte » se ferme : la demande en attente est oubliée
//   }
// `restaurateur: null` = rôle pas encore connu. Le module est importé dynamiquement : son absence fait échouer seulement les tests B1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerServiceNotifications, type PortNatif } from '../src/notifications/service.ts';
import type { EtatSysteme } from '../src/notifications/autorisation.ts';

const charger = () => import('../src/connexion/ouverture-espace.ts');
const DEMANDE = { espaceRestaurateur: true } as const;

/* ---------- B1 : ouverture de l'Espace restaurateur ---------- */

test('B1 : à chaud, compte déjà connecté et membre → l\'espace s\'ouvre dès l\'ouverture de « Mon compte », une seule fois', async () => {
  const { creerDemandeEspace } = await charger();
  const d = creerDemandeEspace();
  d.armer(DEMANDE);
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), true);
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), false, 'consommée');
});
test('B1 : à chaud, rôle déjà lu avant l\'appui (restaurateur vrai) → ouvre sans attendre un changement de `connectee`', async () => {
  const { creerDemandeEspace } = await charger();
  const d = creerDemandeEspace();
  assert.equal(d.evaluer({ ouvert: false, connectee: true, restaurateur: true }), false, 'rien en attente');
  d.armer(DEMANDE);
  assert.equal(d.evaluer({ ouvert: false, connectee: true, restaurateur: true }), false, 'écran pas encore ouvert');
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), true);
});
test('B1 : à froid différé → attend la session puis le rôle, ouvre une seule fois', async () => {
  const { creerDemandeEspace } = await charger();
  const d = creerDemandeEspace();
  d.armer(DEMANDE);
  assert.equal(d.evaluer({ ouvert: true, connectee: false, restaurateur: null }), false, 'session pas restaurée');
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: null }), false, 'rôle inconnu');
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), true);
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), false);
});
test('B1 : non membre → n\'ouvre jamais l\'espace, même après fermeture et nouvelle évaluation', async () => {
  const { creerDemandeEspace } = await charger();
  const d = creerDemandeEspace();
  d.armer(DEMANDE);
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: false }), false);
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: false }), false);
  d.fermer();
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: false }), false);
});
test('B1 : pas de réouverture après le retour de l\'espace (demande consommée), ni après fermeture/réouverture de « Mon compte »', async () => {
  const { creerDemandeEspace } = await charger();
  const d = creerDemandeEspace();
  d.armer(DEMANDE);
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), true);
  // retour de l'espace : l'état du compte est inchangé, l'effet est réévalué
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), false);
  d.fermer();
  assert.equal(d.evaluer({ ouvert: true, connectee: true, restaurateur: true }), false, 'réouverture manuelle de « Mon compte » : pas d\'espace');
});
test('B1 : un nouvel appui après un retour rouvre l\'espace ; une demande sans drapeau ou nulle n\'ouvre rien ; fermer avant la fin oublie la demande', async () => {
  const { creerDemandeEspace } = await charger();
  const d = creerDemandeEspace();
  const etat = { ouvert: true, connectee: true, restaurateur: true } as const;
  d.armer(DEMANDE); assert.equal(d.evaluer(etat), true);
  d.armer(DEMANDE); assert.equal(d.evaluer(etat), true, 'nouvel appui = nouvelle demande');
  d.armer({}); assert.equal(d.evaluer(etat), false);
  d.armer(null); assert.equal(d.evaluer(etat), false);
  d.armer(DEMANDE); d.fermer(); assert.equal(d.evaluer(etat), false, 'oubliée à la fermeture');
});

/* ---------- B2 : une seule demande système en concurrence ---------- */

interface Differe { promesse: Promise<void>; liberer(): void }
function differe(): Differe {
  let liberer!: () => void;
  const promesse = new Promise<void>(r => { liberer = r; });
  return { promesse, liberer };
}
// Laisse tous les microtâches et rappels immédiats en attente s'exécuter (déterministe : aucune minuterie).
const vider = () => new Promise<void>(r => setImmediate(r));

const non_demandee: EtatSysteme = { statut: 'non_demandee', peutRedemander: true };
const accordee: EtatSysteme = { statut: 'accordee', peutRedemander: true };
const refusee: EtatSysteme = { statut: 'refusee', peutRedemander: false };

/** Drapeau LENT : la lecture capture la valeur au moment de l'appel puis attend la porte ; l'écriture et la demande système attendent aussi leur porte. */
function bancLent(apres: EtatSysteme = accordee, estRestaurateur = true) {
  const portes = { lecture: differe(), ecriture: differe(), systeme: differe() };
  const journal = { demandes: 0, lectures: 0, ecritures: 0, enregistrements: 0 };
  let drapeau = false; let courant: EtatSysteme = non_demandee;
  const natif: PortNatif = {
    etat: async () => courant,
    demander: async () => { journal.demandes++; await portes.systeme.promesse; courant = apres; return apres; },
    creerCanal: async () => undefined, derniere: () => null, ecouter: () => () => undefined, surRenouvellementJeton: () => () => undefined,
  };
  const memoire = {
    lire: async () => { journal.lectures++; const valeur = drapeau; await portes.lecture.promesse; return valeur; },
    marquer: async () => { journal.ecritures++; await portes.ecriture.promesse; drapeau = true; },
  };
  const appareil = { dejaConnu: () => false, enregistrer: async () => { journal.enregistrements++; return 'enregistre' as const; }, retirer: async () => 'enregistre' as const };
  const service = creerServiceNotifications({
    natif, appareil, memoire, obtenirAcces: async () => 'porteur-factice', ouvrirSuivi: () => undefined, ouvrirRestaurateur: () => undefined,
    lireEstRestaurateur: async () => estRestaurateur,
  });
  const toutLiberer = () => { portes.lecture.liberer(); portes.ecriture.liberer(); portes.systeme.liberer(); };
  return { service, journal, toutLiberer };
}

test('B2 : deux déclencheurs resto simultanés (session + ouverture de l\'espace), drapeau lent → UNE seule demande système', async () => {
  const b = bancLent();
  const a1 = b.service.apresContexteRestaurateur(true);
  const a2 = b.service.apresContexteRestaurateur(true);
  await vider(); b.toutLiberer();
  const [r1, r2] = await Promise.all([a1, a2]);
  assert.equal(b.journal.demandes, 1);
  assert.equal(r1, 'actives'); assert.equal(r2, 'actives');
});
test('B2 : contexte restaurateur + après commande simultanés, drapeau lent → UNE seule demande système', async () => {
  const b = bancLent();
  const a1 = b.service.apresContexteRestaurateur(true);
  const a2 = b.service.apresCommande();
  await vider(); b.toutLiberer();
  const [r1, r2] = await Promise.all([a1, a2]);
  assert.equal(b.journal.demandes, 1);
  assert.equal(r1, 'actives'); assert.equal(r2, 'actives');
});
test('B2 : sessionOuverte + contexte + commande en même temps (connexion d\'un membre qui commande), drapeau lent → UNE seule demande système', async () => {
  const b = bancLent();
  const a1 = b.service.sessionOuverte();
  const a2 = b.service.apresContexteRestaurateur(true);
  const a3 = b.service.apresCommande();
  await vider(); b.toutLiberer();
  await Promise.all([a1, a2, a3]);
  assert.equal(b.journal.demandes, 1);
});
test('B2 : refus pendant la demande, appelants simultanés puis appel tardif → toujours UNE seule demande, état « désactivées » pour tous', async () => {
  const b = bancLent(refusee);
  const a1 = b.service.apresContexteRestaurateur(true);
  const a2 = b.service.apresCommande();
  await vider(); b.toutLiberer();
  const [r1, r2] = await Promise.all([a1, a2]);
  assert.equal(r1, 'desactivees'); assert.equal(r2, 'desactivees');
  await b.service.apresContexteRestaurateur(true); await b.service.apresCommande();
  assert.equal(b.journal.demandes, 1);
});
test('B2 : un non-membre en concurrence avec une commande ne déclenche rien de plus qu\'une demande (celle de la commande)', async () => {
  const b = bancLent(accordee, false);
  const a1 = b.service.apresContexteRestaurateur(false);
  const a2 = b.service.apresCommande();
  await vider(); b.toutLiberer();
  await Promise.all([a1, a2]);
  assert.equal(b.journal.demandes, 1);
});

/* ---------- Câblage React (texte source) : ne remplace NI un rendu réel NI l'essai F3 sur émulateur ---------- */

const source = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('câblage (source) : CompteReel arme la demande à chaque nouvel appui et l\'évalue avec session, rôle et verrou « occupé » en dépendances', () => {
  const c = source('../src/connexion/CompteReel.tsx');
  assert.ok(c.includes("import { creerDemandeEspace } from './ouverture-espace';"));
  assert.ok(c.includes('useState<boolean|null>(null)'), 'rôle inconnu = null');
  assert.ok(c.includes('useEffect(()=>{demandeEspace.armer(demande);},[demande]);'));
  assert.ok(c.indexOf('demandeEspace.armer(demande)') < c.indexOf('demandeEspace.evaluer('), 'armer avant évaluer');
  assert.ok(c.includes('if(!ouvert){demandeEspace.fermer();return;}'));
  assert.ok(c.includes('if(restaurateurOccupe)return;'));
  assert.ok(c.includes('demandeEspace.evaluer({ouvert,connectee,restaurateur})'));
  assert.ok(c.includes('[demande,ouvert,connectee,restaurateur,restaurateurOccupe]'));
  assert.ok(!c.includes('demandeRef.current?.espaceRestaurateur'), 'l\'ancienne ouverture (seulement à froid) est retirée');
});
test('câblage (source) : une demande exclusivement restaurateur ne relit pas les commandes client', () => {
  const c = source('../src/connexion/CompteReel.tsx');
  assert.ok(c.includes('if(demande&&!demande.espaceRestaurateur){const liste=await lireCommandes();'));
});
test('câblage (source) : le service partage une seule promesse pour contexte et commande, un non-membre en est exclu', () => {
  const s = source('../src/notifications/service.ts');
  assert.ok(s.includes('return enCours ??= f().finally(() => { enCours = null; });'));
  assert.equal(s.split('return partage(async () => {').length - 1, 2, 'contexte et commande');
  assert.ok(s.includes('if (!estRestaurateur) return null;'));
});
