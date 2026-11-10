import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * M4a : câblage des écrans de réservation (lecture du texte source, comme `clavier.test.ts` : aucun test d'interface). On vérifie ce qui ne doit JAMAIS changer : textes imposés,
 * heures en UTC seulement, aucune minuterie, aucun appel d'écriture direct depuis un écran, un seul appel réseau par écriture dans les contrôles, intégration sans casser les écrans existants.
 */
const lire = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const reserver = lire('../src/connexion/ReserverTableReel.tsx');
const mes = lire('../src/connexion/MesReservationsReel.tsx');
const resto = lire('../src/connexion/ReservationsRestaurateurReel.tsx');
const ecrans = { reserver, mes, resto };
const ctlClient = lire('../src/connexion/controle-reservation-client.ts');
const ctlResto = lire('../src/connexion/controle-reservation-restaurateur.ts');
const creneaux = lire('../src/domaine/creneaux-reservation.ts');
const reseau = lire('../src/connexion/reservation.ts');
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('écrans : aucun journal, aucun style en ligne pour la mise en page, aucun sélecteur de date natif, aucune minuterie', () => {
  for (const [nom, source] of Object.entries(ecrans)) {
    const code = sansCommentaires(source);
    assert.ok(!/console\./.test(code), nom + ' : console');
    assert.ok(!/style=\{\{/.test(code), nom + ' : style en ligne');
    assert.ok(!/DateTimePicker|datetimepicker|DatePickerAndroid/i.test(code), nom + ' : sélecteur de date natif');
    assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(code), nom + ' : minuterie');
    assert.ok(!/AsyncStorage|SecureStore|localStorage/.test(code), nom + ' : stockage');
  }
  for (const [nom, source] of Object.entries({ ctlClient, ctlResto, reseau })) assert.ok(!/setInterval|setTimeout|console\./.test(sansCommentaires(source)), nom + ' : minuterie ou journal');
});

test('heures : UTC seulement (jamais le fuseau du téléphone), dans les écrans, les créneaux et les contrôles', () => {
  for (const [nom, source] of Object.entries({ ...ecrans, creneaux, ctlClient, ctlResto })) {
    const code = sansCommentaires(source);
    assert.ok(!/\.getHours\(|\.getMinutes\(|\.getDate\(|\.getDay\(|\.getMonth\(|\.getFullYear\(|getTimezoneOffset|toLocaleTimeString|toLocaleDateString|toLocaleString|Intl\.DateTimeFormat/.test(code), nom + ' : heure locale');
  }
  assert.ok(/getUTCHours/.test(creneaux) && /toISOString/.test(creneaux));
});

test('texte imposé du récapitulatif, boutons et intitulés du client', () => {
  assert.ok(reserver.includes('Demande de réservation : table pour {nbPersonnes} personne{nbPersonnes > 1 ? \'s\' : \'\'}, {libelleJour(creneau.slice(0, 10))}, {libelleHeure(creneau)}, {restaurantNom}. Le restaurant doit la confirmer. Aucun paiement.'));
  for (const texte of ['titre="Réserver une table"', 'Envoyer ma demande', 'Vérifier mes réservations', 'Une personne de moins', 'Une personne de plus', 'Jour', 'Votre nom', 'Votre téléphone']) assert.ok(reserver.includes(texte), texte);
  assert.ok(reserver.includes('const visible = etat.disponibilite === \'oui\' || etat.incertain || etat.confirmee !== null;') && reserver.includes('if (!visible) return null;'), 'masqué sauf disponibilité « oui »');
  assert.ok(reserver.includes('<Action titre="Envoyer ma demande" agir={envoyer} disabled={occupe || verrou} />'), 'l’envoi est verrouillé pendant un envoi et après un résultat à vérifier');
  assert.ok(reserver.includes('<Action titre="Continuer" agir={continuer} disabled={occupe || verrou} />') && reserver.includes('<Action titre="Réserver une table" agir={ouvrirFormulaire} disabled={occupe} />'));
  for (const texte of ['Annuler la réservation', 'Oui, annuler la réservation', 'Non, la garder', 'Annuler cette réservation ? Cette action ne peut pas être annulée.']) assert.ok(mes.includes(texte), texte);
});

test('client : la confirmation précède l’annulation ; l’annulation n’est proposée que si la réservation est annulable ; aucun appel d’écriture direct', () => {
  assert.ok(mes.includes('annulable && confirmer !== r.id'), 'bouton d’abord, confirmation ensuite');
  assert.ok(mes.includes('controle.current?.annuler(r.id, true)') && mes.includes('peutAnnulerReservation(r, maintenant())'));
  for (const [nom, source] of Object.entries(ecrans)) assert.ok(!/session\.(creerReservation|annulerReservation|deciderReservation|ecrireReglageReservation)/.test(source), nom + ' : écriture directe');
  assert.ok(!/session\.(creerReservation|annulerReservation)/.test(reserver + mes));
});

test('restaurateur : boutons = EXACTEMENT actionsPossibles du serveur ; motif et confirmation pour refuser et annuler ; champs câblés au clavier', () => {
  assert.ok(resto.includes('r.actionsPossibles.map(a =>'), 'les boutons viennent de la liste du serveur');
  assert.ok(!/r\.statut === '(demandee|confirmee)'[^\n]*<Action/.test(resto), 'aucune action déduite de l’état');
  assert.ok(resto.includes('refuser:') && resto.includes('annuler:') && resto.includes('Cette action ne peut pas être annulée.'));
  assert.ok(resto.includes('decider(r.id, motifPour.action, { motif, confirme: true })'));
  assert.ok(resto.includes('Accepter les réservations') && resto.includes('Enregistrer la capacité'));
  for (const champ of ['reservation-capacite', "'reservation-motif-' + r.id"]) assert.ok(resto.includes(`ref={clavier.reference(${champ.startsWith("'") ? champ : `'${champ}'`})}`), champ);
  assert.equal((resto.match(/<TextInput [a-z]/g) ?? []).length, (resto.match(/<TextInput ref=/g) ?? []).length, 'tout champ est câblé au défilement du clavier');
});

test('contrôles : UN seul appel réseau par écriture (jamais de relance), aucune boucle autour de l’envoi', () => {
  const unique = (source: string, appel: string) => assert.equal((sansCommentaires(source).match(new RegExp('session\\.' + appel + '\\(', 'g')) ?? []).length, 1, appel);
  unique(ctlClient, 'creerReservation'); unique(ctlClient, 'annulerReservation'); unique(ctlResto, 'deciderReservation'); unique(ctlResto, 'ecrireReglageReservation');
  for (const [nom, source] of Object.entries({ ctlClient, ctlResto })) assert.ok(!/for \(|while \(|\.forEach\(|catch \([^)]*\) \{[^}]*(envoi|envoyer|decider|ecrire|annuler)\(/.test(sansCommentaires(source).replace(/for \(const/g, '')), nom + ' : boucle ou relance');
});

test('intégration : bouton sur l’écran du restaurant, section dans le compte, 4e onglet frère du restaurateur sans toucher aux sections existantes', () => {
  const catalogue = lire('../src/catalogue/CatalogueReel.tsx');
  assert.ok(catalogue.includes('<ReserverTableReel key={selection.id} session={gestion} restaurantId={selection.id}'));
  assert.ok(lire('../src/connexion/CompteReel.tsx').includes('<MesReservationsReel session={gestion}/>'));
  const parent = lire('../src/connexion/RestaurateurReel.tsx');
  assert.ok(parent.includes('SECTIONS_RESTAURATEUR.map(x =>') && parent.includes("{section === 'commandes' && <>"));
  assert.ok(parent.includes('<ReservationsRestaurateurReel session={gestion} clavier={{ reference, auFocus, auBlur }}'));
  assert.ok(parent.includes("section === 'menu' || section === 'service' ? undefined : s.masque"), 'le service reste masqué quand on affiche les réservations');
  assert.equal((parent.match(/<TextInput [a-z]/g) ?? []).length, (parent.match(/<TextInput ref=/g) ?? []).length);
  assert.ok(parent.includes('accessibilityLabel="Réservations"'));
});

test('lecture de la disponibilité : à l’ouverture et sur action de l’utilisateur seulement ; un échec masque le bouton sans bloquer l’écran', () => {
  assert.ok(reserver.includes('void controle.current?.lireDisponibilite(restaurantId);') && reserver.includes('[restaurantId, relireQuand]'));
  assert.ok(sansCommentaires(ctlClient).includes("disponibilite = 'erreur'"));
  assert.ok(lire('../src/catalogue/CatalogueReel.tsx').includes("relireQuand={String(compteOuvert) + '|' + (menu?.luLe ?? '')}"));
});
