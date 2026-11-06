// Mutations ciblées sur les corrections B1/B2 (lot F3 ; cible de partage adaptée au cycle de session du 6 novembre). Chaque mutation DOIT faire échouer notifications-f3-reprise.test.ts, sinon le script sort en code 1.
// Les sources sont lues en Buffer et restaurées octet pour octet ; seuls le nom de la mutation et les codes de sortie sont affichés. Aucun réseau, aucun shell.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const chemin = relatif => fileURLToPath(new URL(relatif, import.meta.url));
const racine = chemin('..');
const test = chemin('../tests/notifications-f3-reprise.test.ts');
const SERVICE = chemin('../src/notifications/service.ts');
const ESPACE = chemin('../src/connexion/ouverture-espace.ts');
const COMPTE = chemin('../src/connexion/CompteReel.tsx');

const mutations = [
  { nom: 'suppression du partage (service)', fichier: SERVICE, cible: 'permission ??= f(() => [...participants].some(valide)).finally(', remplace: 'f(() => [...participants].some(valide)).finally(' },
  { nom: 'demande jamais consommée (ouverture-espace)', fichier: ESPACE, cible: 'return etat.restaurateur;', remplace: 'enAttente = true; return etat.restaurateur;' },
  { nom: 'rôle null traité comme connu (ouverture-espace)', fichier: ESPACE, cible: '|| etat.restaurateur === null) return false;', remplace: ') return false;' },
  { nom: 'garde « occupé » retirée (CompteReel)', fichier: COMPTE, cible: 'if(restaurateurOccupe)return;', remplace: '' },
  { nom: 'armer débranché (CompteReel)', fichier: COMPTE, cible: 'useEffect(()=>{demandeEspace.armer(demande);},[demande]);', remplace: 'useEffect(()=>{},[demande]);' },
];

function arreter(message) { console.log(message); process.exit(1); }

// Originaux gardés en mémoire : restauration octet pour octet, même sur interruption.
const originaux = new Map();
for (const f of new Set(mutations.map(m => m.fichier))) originaux.set(f, readFileSync(f));
const restaurerTout = () => { for (const [f, buf] of originaux) writeFileSync(f, buf); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restaurerTout(); process.exit(1); });

// Vérification AVANT toute modification : chaque cible existe une fois et une seule.
const plans = mutations.map(m => {
  const source = originaux.get(m.fichier), cible = Buffer.from(m.cible);
  const debut = source.indexOf(cible);
  if (debut === -1) arreter(`cible absente : ${m.nom}`);
  if (source.indexOf(cible, debut + 1) !== -1) arreter(`cible multiple : ${m.nom}`);
  return { ...m, muté: Buffer.concat([source.subarray(0, debut), Buffer.from(m.remplace), source.subarray(debut + cible.length)]) };
});

const lancer = () => spawnSync(process.execPath, ['--test', test], { cwd: racine, shell: false, stdio: 'ignore', timeout: 180000 }).status;

let echec = false;
for (const p of plans) {
  let code;
  try {
    writeFileSync(p.fichier, p.muté);
    code = lancer();
  } finally {
    writeFileSync(p.fichier, originaux.get(p.fichier));
  }
  const tuee = code !== null && code !== 0;
  console.log(`${p.nom} : code ${code ?? 'indéterminé'}${tuee ? '' : ' — NON DÉTECTÉE'}`);
  if (!tuee) echec = true;
}

for (const [f, buf] of originaux) if (!readFileSync(f).equals(buf)) arreter('restauration incomplète');
const vert = lancer();
console.log(`après restauration : code ${vert ?? 'indéterminé'}`);
if (echec || vert !== 0) arreter('résultat : ÉCHEC');
console.log('résultat : OK, 5 mutations détectées, ciblé vert après restauration');
