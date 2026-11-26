import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// Un bouton à icône seule n'est jamais muet : son nom accessible dit l'action en toutes lettres (« Supprimer « Maison » », « Ajouter Poulet au panier »…).
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiers(p) : /\.tsx$/.test(n) ? [p] : []; });
}
const racine = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
test('chaque bouton à icône seule porte un titre (nom accessible) complet', () => {
  let vus = 0; const fautifs: string[] = [];
  for (const f of fichiers(decodeURIComponent(racine))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<(?:Bouton|Action|Rond)\b[^\n]*?\biconeSeule\b[^\n]*/g)) {
      vus++;
      const titre = m[0].match(/\btitre=(?:"([^"]*)"|\{([^}]*)\})/);
      // Titre littéral d'au moins 6 caractères (« Retour »), expression d'au moins 8 (« Supprimer « x » »), ou simple relais `titre={titre}` d'un composant enveloppe.
      const ok = !!titre && (titre[1] !== undefined ? titre[1].length >= 6 : titre[2] === 'titre' || titre[2].length >= 8);
      if (!ok) fautifs.push(f.split('src')[1] + ' : ' + m[0].slice(0, 90));
    }
  }
  assert.ok(vus >= 8, 'au moins huit boutons à icône seule sont attendus (trouvés : ' + vus + ')');
  assert.deepEqual(fautifs, []);
});
test('le composant Bouton garde le titre complet comme nom accessible, même en icône seule', () => {
  const src = readFileSync(decodeURIComponent(racine) + 'design/Composants.tsx', 'utf8');
  assert.match(src, /iconeSeule && icone[\s\S]{0,260}accessibilityLabel=\{titre\}/);
});
test('les icônes choisies sont celles que tout le monde reconnaît : cœur, plus, corbeille, retour, actualiser', () => {
  const lu = (p: string) => readFileSync(decodeURIComponent(racine) + p, 'utf8');
  assert.match(lu('connexion/FavoriFiche.tsx'), /<Icone nom="coeur"/);
  assert.match(lu('catalogue/FicheRestaurant.tsx'), /icone="plus" iconeSeule/);
  assert.match(lu('catalogue/PanierReelVue.tsx'), /icone="corbeille"/);
  assert.match(lu('connexion/AideReelle.tsx'), /icone="retour" iconeSeule/);
  assert.match(lu('catalogue/CatalogueReel.tsx'), /icone="actualiser" iconeSeule/);
});
