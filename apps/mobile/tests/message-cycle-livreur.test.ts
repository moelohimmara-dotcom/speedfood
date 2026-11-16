import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messageCycleLivreur } from '../src/connexion/message-cycle-livreur.ts';
// Parité Kotlin (tranche 10.9, G21) : messages d'état de la fiche livreur non active.
test('fiche active : aucun message', () => { assert.equal(messageCycleLivreur('actif', null), null); assert.equal(messageCycleLivreur('actif', 'x'), null); });
test('candidat : texte de l’ancienne appli, pas une erreur', () => {
  assert.deepEqual(messageCycleLivreur('candidat', null), { texte: 'Votre fiche est en cours d’examen par l’équipe Speedfood. Vous pourrez recevoir des courses dès qu’elle sera approuvée.', erreur: false });
});
test('suspendu : le motif du serveur est repris, sans motif la phrase reste correcte, toujours une erreur', () => {
  assert.deepEqual(messageCycleLivreur('suspendu', 'Documents périmés'), { texte: 'Votre fiche est suspendue. Motif : Documents périmés. Contactez l’équipe Speedfood.', erreur: true });
  assert.equal(messageCycleLivreur('suspendu', null)?.texte, 'Votre fiche est suspendue. Contactez l’équipe Speedfood.');
  assert.equal(messageCycleLivreur('suspendu', '   ')?.texte, 'Votre fiche est suspendue. Contactez l’équipe Speedfood.', 'motif vide après rognage = pas de motif');
  assert.equal(messageCycleLivreur('suspendu', undefined)?.erreur, true);
});
test('archivée : « n’est plus active » ; créée ou invitée : « pas encore activée » (jamais « plus active »)', () => {
  assert.deepEqual(messageCycleLivreur('archive', null), { texte: 'Votre fiche n’est plus active. Contactez l’équipe Speedfood.', erreur: true });
  for (const c of ['cree', 'invite'] as const) {
    const m = messageCycleLivreur(c, null);
    assert.match(m!.texte, /pas encore activée/); assert.doesNotMatch(m!.texte, /plus active/); assert.equal(m!.erreur, false);
  }
});
test('câblage (source) : l’écran livreur affiche ce message à la place de la phrase générique, sans doubler le motif', () => {
  const s = readFileSync(new URL('../src/connexion/LivreurReel.tsx', import.meta.url), 'utf8');
  assert.match(s, /messageCycleLivreur\(fiche\.cycle, fiche\.motifCycle\)/);
  assert.match(s, /fiche\.motifCycle && fiche\.cycle !== 'suspendu'/);
  assert.doesNotMatch(s, /Votre fiche n’est pas active : la mise en ligne n’est pas possible/);
});
