import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMMENTAIRE_PLATS_A_CONFIRMER, ERREUR_CONSENTEMENT, LEGENDE_A_CONFIRMER, TEXTE_CONSENTEMENT, ageStatutAffichable, commandabilite, etapesParcours, etatPlat, moyensAffichables,
  libelleMoyen, nombreAConfirmer, ordonnerPlats, ordonnerRestaurants, phraseARegler,
} from '../src/catalogue/parcours-client.ts';
import { libelleStatut } from '../src/catalogue/menu-groupes.ts';
import { LIGNES_DIVULGATION, TEXTE_CHOIX_SUIVI } from '../src/connexion/consentement-position.ts';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const MAINTENANT = new Date('2026-11-18T12:00:00Z');
const ilYa = (heures: number) => new Date(MAINTENANT.getTime() - heures * 3_600_000).toISOString();

// Revue du 18/11/2026 : cinq décisions de parcours (accueil, paiement dit, plat à confirmer, position du livreur, restaurant fermé).

test('restaurant fermé ou en pause : le menu se lit, la commande est refusée avec une raison claire', () => {
  assert.deepEqual(commandabilite({ ouvert: true, accepteCommandes: true }), { commandable: true, raison: null, titre: '', message: '' });
  const ferme = commandabilite({ ouvert: false, accepteCommandes: true, horaires: 'Lun à Sam, 8 h à 22 h' });
  assert.equal(ferme.commandable, false); assert.equal(ferme.raison, 'ferme'); assert.equal(ferme.titre, 'Fermé pour le moment');
  assert.match(ferme.message, /parcourir le menu/); assert.match(ferme.message, /Lun à Sam, 8 h à 22 h/);
  assert.doesNotMatch(commandabilite({ ouvert: false, accepteCommandes: false }).message, /Horaires/, 'sans horaires, rien d’inventé');
  const pause = commandabilite({ ouvert: true, accepteCommandes: false });
  assert.equal(pause.commandable, false); assert.equal(pause.raison, 'pause'); assert.equal(pause.titre, 'Commandes en pause');
  assert.equal(commandabilite({ ouvert: false, accepteCommandes: false }).raison, 'ferme', 'fermé l’emporte sur la pause');
});

test('liste des restaurants : on peut commander d’abord, puis en pause, puis fermés ; l’ordre d’origine est gardé dans chaque groupe', () => {
  const liste = [
    { id: 'a', ouvert: false, accepteCommandes: false }, { id: 'b', ouvert: true, accepteCommandes: true }, { id: 'c', ouvert: true, accepteCommandes: false },
    { id: 'd', ouvert: true, accepteCommandes: true }, { id: 'e', ouvert: false, accepteCommandes: true },
  ];
  assert.deepEqual(ordonnerRestaurants(liste).map(r => r.id), ['b', 'd', 'c', 'a', 'e']);
  assert.deepEqual(liste.map(r => r.id), ['a', 'b', 'c', 'd', 'e'], 'la liste d’origine n’est pas modifiée');
});

test('liste des restaurants : à statut égal, les bons paliers du score qualité passent devant, sans jamais passer devant un restaurant qui prend des commandes', () => {
  const liste = [
    { id: 'a', ouvert: true, accepteCommandes: true, scorePalier: 'bon' as const }, { id: 'b', ouvert: true, accepteCommandes: true, scorePalier: 'excellent' as const },
    { id: 'c', ouvert: true, accepteCommandes: true, scorePalier: 'tres_bon' as const }, { id: 'd', ouvert: true, accepteCommandes: false, scorePalier: 'excellent' as const },
  ];
  assert.deepEqual(ordonnerRestaurants(liste).map(r => r.id), ['b', 'c', 'a', 'd']);
});

test('menu : disponibles d’abord, puis à confirmer, puis épuisés ; l’ordre du restaurant est gardé dans chaque groupe', () => {
  const plats = [
    { id: '1', disponibilite: 'epuise' as const }, { id: '2', disponibilite: 'a_confirmer' as const }, { id: '3', disponibilite: 'disponible' as const },
    { id: '4', disponibilite: 'a_confirmer' as const }, { id: '5', disponibilite: 'disponible' as const },
  ];
  assert.deepEqual(ordonnerPlats(plats).map(p => p.id), ['3', '5', '2', '4', '1']);
  assert.equal(nombreAConfirmer(plats), 2);
  assert.equal(nombreAConfirmer([null, undefined]), 0);
});

test('plat à confirmer : jamais une date qui fait peur ; au-delà de 7 jours, « pas confirmé récemment »', () => {
  assert.deepEqual(etatPlat({ disponibilite: 'disponible', confirmeLe: ilYa(2) }, MAINTENANT), { texte: 'Disponible', ton: 'succes', detail: 'confirmé il y a 2 h' });
  const recent = etatPlat({ disponibilite: 'a_confirmer', confirmeLe: ilYa(24 * 3) }, MAINTENANT);
  assert.equal(recent.texte, 'À confirmer'); assert.equal(recent.ton, 'attention'); assert.equal(recent.detail, 'dernière confirmation il y a 3 jours');
  assert.equal(etatPlat({ disponibilite: 'a_confirmer', confirmeLe: ilYa(24 * 37) }, MAINTENANT).detail, 'pas confirmé récemment', 'pas de « il y a 37 jours »');
  assert.equal(etatPlat({ disponibilite: 'a_confirmer', confirmeLe: null }, MAINTENANT).detail, 'pas confirmé récemment');
  assert.equal(etatPlat({ disponibilite: 'a_confirmer', confirmeLe: 'pas une date' }, MAINTENANT).detail, 'pas confirmé récemment');
  assert.deepEqual(etatPlat({ disponibilite: 'epuise', confirmeLe: ilYa(1) }, MAINTENANT), { texte: 'Épuisé', ton: 'neutre', detail: null });
  assert.equal(etatPlat({ disponibilite: 'disponible', confirmeLe: null }, MAINTENANT).detail, null, 'disponible sans date : rien d’inventé');
});

test('statut du restaurant : la même règle (date affichée seulement si elle reste parlante)', () => {
  const r = (heures: number) => ({ ouvert: true, accepteCommandes: true, statutMisAJourLe: ilYa(heures) });
  assert.match(libelleStatut(r(2), MAINTENANT) ?? '', /^Statut confirmé il y a 2 h$/);
  assert.match(libelleStatut(r(48), MAINTENANT) ?? '', /^Statut à confirmer \(dernière confirmation il y a 2 jours\)$/);
  assert.equal(libelleStatut(r(24 * 37), MAINTENANT), 'Statut à confirmer');
  assert.equal(libelleStatut({ ouvert: false, accepteCommandes: false, statutMisAJourLe: ilYa(1) }, MAINTENANT), null);
  assert.equal(ageStatutAffichable(new Date(ilYa(24 * 8)), MAINTENANT), null);
  assert.equal(ageStatutAffichable(new Date(ilYa(24 * 7)), MAINTENANT), 'il y a 7 jours');
});

test('paiement dit avant l’envoi : trois temps, rien à payer maintenant, jamais d’espèces affichées comme moyen de l’application', () => {
  assert.deepEqual(moyensAffichables(['Orange Money', 'Espèces', ' MTN MoMo ', 'cash', '']), ['Orange Money', 'MTN MoMo']);
  assert.deepEqual(moyensAffichables(undefined), []);
  const avec = etapesParcours(['Orange Money', 'MTN MoMo']);
  assert.deepEqual(avec.map(e => e.numero), [1, 2, 3]);
  assert.equal(avec[0].texte, 'Rien à payer maintenant.');
  assert.match(avec[1].texte, /accepte votre commande, ou vous propose un changement/);
  assert.match(avec[2].texte, /\(Orange Money, MTN MoMo\)/); assert.match(avec[2].texte, /Speedfood ne reçoit pas votre argent/);
  const sans = etapesParcours([]);
  assert.match(sans[2].texte, /Le restaurant vous indique comment le régler/); assert.doesNotMatch(sans[2].texte, /\(/);
  assert.equal(phraseARegler(45000), 'À régler au restaurant après sa confirmation : ' + new Intl.NumberFormat('fr-FR').format(45000) + ' GNF');
  assert.equal(phraseARegler(null), null);
});

test('moyens de paiement : le client voit des libellés (Orange Money, MTN MoMo), jamais les identifiants de l’API', () => {
  // Constaté sur l’application (26/11/2026) : « Paiement accepté : orange_money, mtn_momo ».
  assert.deepEqual(moyensAffichables(['orange_money', 'mtn_momo']), ['Orange Money', 'MTN MoMo']);
  assert.deepEqual(moyensAffichables(['especes', 'orange_money']), ['Orange Money']);
  assert.deepEqual(moyensAffichables([' ORANGE_MONEY ', 'Orange Money']), ['Orange Money', 'Orange Money'], 'identifiant en majuscules lu aussi ; aucun dédoublonnage, comme avant');
  assert.equal(libelleMoyen('airtel_money'), 'Airtel money');
  assert.equal(libelleMoyen('Wave'), 'Wave');
  const etapes = etapesParcours(['orange_money', 'mtn_momo']);
  assert.match(etapes[2].texte, /\(Orange Money, MTN MoMo\)/); assert.doesNotMatch(etapes[2].texte, /orange_money|mtn_momo/);
});

test('textes du parcours : aucun tiret long, le consentement dit la même chose que l’erreur', () => {
  const textes = [LEGENDE_A_CONFIRMER, COMMENTAIRE_PLATS_A_CONFIRMER(1), COMMENTAIRE_PLATS_A_CONFIRMER(3), TEXTE_CONSENTEMENT, ERREUR_CONSENTEMENT, TEXTE_CHOIX_SUIVI,
    ...etapesParcours(['Orange Money']).flatMap(e => [e.titre, e.texte]), ...LIGNES_DIVULGATION.flatMap(l => [l.titre, l.texte]), commandabilite({ ouvert: false, accepteCommandes: false }).message];
  for (const t of textes) assert.doesNotMatch(t, /[—–]/, t);
  assert.match(COMMENTAIRE_PLATS_A_CONFIRMER(1), /^1 plat est/); assert.match(COMMENTAIRE_PLATS_A_CONFIRMER(3), /^3 plats sont/);
  assert.match(TEXTE_CONSENTEMENT, /ne paie rien maintenant/); assert.match(ERREUR_CONSENTEMENT, /compris comment se passe le paiement/);
});

test('divulgation de la position : ce qui est collecté, quand, pourquoi, ce que le livreur garde en main', () => {
  assert.deepEqual(LIGNES_DIVULGATION.map(l => l.titre), ['Ce qui est collecté', 'Quand', 'Pourquoi', 'Vous gardez la main']);
  assert.match(LIGNES_DIVULGATION[1].texte, /écran éteint ou application fermée/); assert.match(LIGNES_DIVULGATION[1].texte, /notification/);
  assert.match(LIGNES_DIVULGATION[3].texte, /hors ligne/);
});

test('câblage : accueil direct, fiche et commande bloquées si fermé, divulgation en fenêtre dédiée', () => {
  const catalogue = lire('../src/catalogue/CatalogueReel.tsx');
  assert.doesNotMatch(catalogue, /EntreeReelle|doitOuvrirEntree|doitOuvrirVisite|setEntreeOuverte/, 'aucun écran ne s’ouvre par-dessus le catalogue au premier lancement');
  assert.match(catalogue, /ordonnerRestaurants\(filtrerRestaurants\(/);
  assert.match(catalogue, /ordonnerPlats\(g\.plats\)\.map\(p => <CartePlat key=\{p\.id\} plat=\{p\} desactive=\{!panier\.pret\} commandable=\{commandabilite\(menu\.restaurant\)\.commandable\}/);
  assert.match(catalogue, /if \(dispo && !dispo\.commandable\) \{ setMessagePanier\(/, 'un ajout est refusé même si le bouton était atteint');
  assert.match(catalogue, /ouvrirCandidature=\{\(\) => setCandidatureOuverte\(true\)\}/);
  const fiche = lire('../src/catalogue/FicheRestaurant.tsx');
  assert.match(fiche, /disabled=\{desactive \|\| !commandable \|\| p\.disponibilite === 'epuise'\}/);
  assert.match(fiche, /attention: c\.avertissement/);
  const panier = lire('../src/catalogue/PanierReelVue.tsx');
  assert.match(panier, /\(dispo !== null && !dispo\.commandable\)\} onPress=\{commander\}/);
  const commande = lire('../src/catalogue/CommandeReelle.tsx');
  assert.match(commande, /disabled=\{!peutEnvoyer \|\| bloque\}/);
  assert.ok(commande.includes('{TEXTE_CONSENTEMENT}') && commande.includes('etapesParcours(etat.menu?.restaurant.moyensPaiement)'));
  const compte = lire('../src/connexion/CompteReel.tsx');
  assert.match(compte, /Restaurateur ou livreur \?/); assert.match(compte, /!restaurateur&&ouvrirCandidature&&<LigneNavigation titre="J’ai un restaurant"/);
  assert.doesNotMatch(compte, /Équipe Speedfood/, 'l’accès équipe n’apparaît que pour un compte qui en a le droit');
  const livreur = lire('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /<DivulgationPosition ouvert=\{demanderChoix\}/);
  assert.doesNotMatch(livreur, /\{demanderChoix && <View style=\{s\.carte\}>/, 'plus de simple carte sous le bouton');
  const divulgation = lire('../src/connexion/DivulgationPosition.tsx');
  assert.match(divulgation, /<Modal visible=\{ouvert\} animationType="slide" onRequestClose=\{annuler\}>/);
  assert.match(divulgation, /Linking\.openURL\(SITE_WEB \+ '\/confidentialite'\)/);
});

test('plat à confirmer, cas limites : une date dans le futur vaut « à l’instant », 7 jours pile reste dit, 8 jours devient « pas confirmé récemment »', () => {
  const futur = etatPlat({ disponibilite: 'a_confirmer', confirmeLe: new Date(MAINTENANT.getTime() + 3_600_000).toISOString() }, MAINTENANT);
  assert.equal(futur.texte, 'À confirmer'); assert.equal(futur.ton, 'attention');
  // Valeur réelle vérifiée : `ancienneteLisible` renvoie « à l'instant » avec une apostrophe droite (packages/shared), d’où l’échappement ici.
  assert.equal(futur.detail, 'dernière confirmation à l\'instant', 'décalage d’horloge : le futur est traité comme maintenant');
  assert.equal(etatPlat({ disponibilite: 'a_confirmer', confirmeLe: ilYa(24 * 7) }, MAINTENANT).detail, 'dernière confirmation il y a 7 jours');
  assert.equal(etatPlat({ disponibilite: 'a_confirmer', confirmeLe: new Date(MAINTENANT.getTime() - (7 * 86_400_000 + 1_000)).toISOString() }, MAINTENANT).detail, 'pas confirmé récemment', '7 jours et une seconde : la borne est exacte, pas tronquée en jours pleins');
  assert.equal(etatPlat({ disponibilite: 'a_confirmer', confirmeLe: ilYa(24 * 8) }, MAINTENANT).detail, 'pas confirmé récemment');
});

test('statut du restaurant, cas limites : 0 minute et 7 jours pile affichés, 7 jours et une seconde ne le sont plus', () => {
  assert.equal(ageStatutAffichable(new Date(MAINTENANT), MAINTENANT), 'à l\'instant', 'valeur réelle : apostrophe droite de ancienneteLisible');
  assert.equal(ageStatutAffichable(new Date(ilYa(24 * 7)), MAINTENANT), 'il y a 7 jours');
  assert.equal(ageStatutAffichable(new Date(MAINTENANT.getTime() - (7 * 86_400_000 + 1_000)), MAINTENANT), null);
});

test('moyens affichables, cas limites : toutes les variantes d’espèces sont retirées, Orange Money et MTN MoMo restent, les doublons ne sont pas fusionnés', () => {
  assert.deepEqual(moyensAffichables(['ESPÈCES', 'Espece', 'espèces', 'cash', 'Paiement en liquide']), []);
  assert.deepEqual(moyensAffichables(['Orange Money', 'MTN MoMo', 'Orange Money']), ['Orange Money', 'MTN MoMo', 'Orange Money'], 'comportement actuel : aucun dédoublonnage');
});

test('étapes du parcours, cas limites : toujours trois étapes numérotées 1, 2, 3 ; que des espèces donne la phrase neutre, sans parenthèses', () => {
  for (const moyens of [undefined, [], ['Orange Money'], ['Espèces', 'cash']]) {
    const etapes = etapesParcours(moyens);
    assert.equal(etapes.length, 3); assert.deepEqual(etapes.map(e => e.numero), [1, 2, 3]);
  }
  const neutre = etapesParcours(['Espèces', 'cash'])[2].texte;
  assert.equal(neutre, 'Le restaurant vous indique comment le régler, puis vous le déclarez dans « Commandes ». Speedfood ne reçoit pas votre argent.');
  assert.doesNotMatch(neutre, /\(/);
});

test('tris, cas limites : liste vide, un seul élément, tous du même rang dans l’ordre d’origine, liste d’entrée jamais modifiée', () => {
  assert.deepEqual(ordonnerRestaurants([]), []);
  assert.deepEqual(ordonnerPlats([]), []);
  const seulR = [{ id: 'x', ouvert: false, accepteCommandes: false }];
  assert.deepEqual(ordonnerRestaurants(seulR).map(r => r.id), ['x']);
  const seulP = [{ id: 'x', disponibilite: 'epuise' as const }];
  assert.deepEqual(ordonnerPlats(seulP).map(p => p.id), ['x']);
  const memesR = [
    { id: 'a', ouvert: true, accepteCommandes: true }, { id: 'b', ouvert: true, accepteCommandes: true }, { id: 'c', ouvert: true, accepteCommandes: true },
  ];
  assert.deepEqual(ordonnerRestaurants(memesR).map(r => r.id), ['a', 'b', 'c'], 'même rang : ordre inchangé');
  assert.deepEqual(memesR.map(r => r.id), ['a', 'b', 'c'], 'la liste d’entrée n’est pas modifiée');
  const memesP = [
    { id: '1', disponibilite: 'disponible' as const }, { id: '2', disponibilite: 'disponible' as const }, { id: '3', disponibilite: 'disponible' as const },
  ];
  assert.deepEqual(ordonnerPlats(memesP).map(p => p.id), ['1', '2', '3'], 'même rang : ordre inchangé');
  assert.deepEqual(memesP.map(p => p.id), ['1', '2', '3'], 'la liste d’entrée n’est pas modifiée');
});

test('phrase à régler, cas limites : 0 donne « 0 GNF », null donne null, un grand montant prend le séparateur de milliers français', () => {
  assert.equal(phraseARegler(0), 'À régler au restaurant après sa confirmation : 0 GNF');
  assert.equal(phraseARegler(null), null);
  assert.equal(phraseARegler(12_345_678), 'À régler au restaurant après sa confirmation : ' + new Intl.NumberFormat('fr-FR').format(12_345_678) + ' GNF');
});
