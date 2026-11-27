import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const lire = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('plat cliquable : la carte ouvre le détail, le bouton plus reste en dehors de la zone cliquable', () => {
  const fiche = lire('../src/catalogue/FicheRestaurant.tsx');
  assert.match(fiche, /ouvrirDetail\?: \(\) => void/, 'CartePlat accepte un ouvreur de détail facultatif');
  assert.match(fiche, /accessibilityLabel=\{ouvrirDetail \? `Voir le détail de \$\{p\.nom\}/, 'la zone cliquable annonce le détail');
  const catalogue = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(catalogue, /ouvrirDetail=\{\(\) => setPlatDetail\(p\)\}/, 'le catalogue ouvre le détail du plat touché');
  assert.match(catalogue, /<DetailPlat key=\{platDetail\?\.id \?\? 'aucun'\} plat=\{platDetail\}/, 'le détail est monté dans le catalogue, remonté à chaque plat');
});

test('détail du plat : grande photo agrandissable seulement si une photo existe, ajout au panier présent', () => {
  const detail = lire('../src/catalogue/DetailPlat.tsx');
  assert.match(detail, /Touchez la photo pour l’agrandir/, 'la grande photo annonce le zoom');
  assert.match(detail, /<ZoomImage url=\{p\.photoUrl\}/, 'le zoom reçoit la photo du plat');
  assert.match(detail, /Aucune photo pour ce plat/, 'sans photo, la fiche reste complète sans zoom');
  assert.match(detail, /Suppléments disponibles/, 'les suppléments sont listés avec leurs prix');
  assert.match(detail, /fermer\(\); ajouter\(p\)/, 'ajouter reçoit le plat explicitement, jamais une lecture d’état périmée');
  assert.match(detail, /onError=\{\(\) => setPhotoEchouee/, 'une photo en échec retombe sur la fiche sans photo');
});

test('lot 8 : couverture zoomable, partage, signalement et déjà commandé dans la fiche du plat', () => {
  const fiche = lire('../src/catalogue/FicheRestaurant.tsx');
  assert.match(fiche, /Photo de \$\{r\.nom\}\. Touchez pour agrandir/, 'la couverture du restaurant ouvre le zoom');
  assert.match(fiche, /<ZoomImage url=\{r\.photoUrl\}/, 'la couverture réutilise le zoom des plats');
  const detail = lire('../src/catalogue/DetailPlat.tsx');
  assert.match(detail, /Partager ce plat/, 'bouton de partage présent');
  assert.match(detail, /#plat-\$\{p\.id\}/, 'le partage pointe le plat lui-même, pas seulement le restaurant');
  assert.match(detail, /Signaler une photo inexacte/, 'bouton de signalement présent');
  assert.match(detail, /Vous avez déjà commandé ce plat/, 'mention déjà commandé présente');
  const catalogue = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(catalogue, /signalerPhoto=\{/, 'le catalogue branche le signalement WhatsApp');
  assert.match(catalogue, /dejaCommande=\{platDetail !== null/, 'le déjà commandé vient des commandes mémorisées de l’appareil');
});

test('zoom photo : échelles bornées, double appui, réinitialisation et fermeture', () => {
  const zoom = lire('../src/catalogue/ZoomImage.tsx');
  assert.match(zoom, /ECHELLES = \[1, 1\.5, 2, 3\]/, 'échelles de zoom bornées');
  assert.match(zoom, /accessibilityLabel="Fermer le zoom"/, 'fermeture accessible');
  assert.match(zoom, /accessibilityLabel="Réinitialiser le zoom"/, 'réinitialisation accessible');
  assert.match(zoom, /if \(!url\) return null/, 'sans photo, aucun zoom');
  assert.match(zoom, /PanResponder/, 'déplacement au doigt dans l’image agrandie');
  assert.match(zoom, /useEffect\(\(\) => \{ setIndexEchelle\(0\)/, 'échelle remise à zéro à chaque photo');
});
