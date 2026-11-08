// Mutations G1 : zéro réseau, sources gardées/restaurées en Buffer, test initial et final obligatoires.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const chemin = p => fileURLToPath(new URL(p, import.meta.url));
const racine = chemin('../../..');
const API = chemin('../../api/src/livreur/fiche.ts');
const ROUTE = chemin('../../api/src/routes/livreur.ts');
const CONTRAT = chemin('../../../packages/shared/src/contracts/livreur-fiche.ts');
const SESSION = chemin('../src/connexion/session.ts');
const LECTURE = chemin('../src/connexion/lecture-fiche-livreur.ts');
const TRANSPORT = chemin('../controle-livreur/transport.ts');
const METRO = chemin('../controle-livreur/metro.config.cjs');
const mutations = [
  { nom: 'filtre compte retiré malgré RLS support', fichier: API, cible: ".eq('utilisateur_id', utilisateurId)", remplace: '' },
  { nom: 'panne de base confondue avec absence', fichier: API, cible: "if (error) throw new Error('FICHE_LIVREUR_INDISPONIBLE');", remplace: 'if (error) return null;' },
  { nom: 'statuts et cycles inconnus acceptés', fichier: CONTRAT, cible: "typeof v !== 'string' || !valeurs.includes(v as T)", remplace: "typeof v !== 'string'" },
  { nom: 'champ téléphone repris dans la projection', fichier: CONTRAT, cible: 'return { nom: texte(o.nom, 80),', remplace: 'return { telephone: o.telephone, nom: texte(o.nom, 80),' },
  { nom: 'vérification locale à la place de stricte', fichier: ROUTE, cible: 'identifier(deps.verificateurs.strict,', remplace: 'identifier(deps.verificateurs.local,' },
  { nom: 'ancienne réponse session réacceptée', fichier: SESSION, cible: "const fiche = await this.api.ficheLivreur(acces);\n      if (n !== this.generation) throw new ErreurConnexion('Lecture annulée.');", remplace: 'const fiche = await this.api.ficheLivreur(acces);' },
  { nom: 'génération du contrôleur ignorée', fichier: LECTURE, cible: '&& generation === session.generationNotifications', remplace: '' },
  { nom: 'fermeture du contrôleur ignorée', fichier: LECTURE, cible: 'fermer() { ferme = true; revision++; }', remplace: 'fermer() {}' },
  { nom: 'origine du banc non contrôlée', fichier: TRANSPORT, cible: 'u.origin !== ORIGINE_CONTROLE || ', remplace: '' },
  { nom: 'redirections du banc réactivées', fichier: TRANSPORT, cible: "redirect: 'error', ", remplace: '' },
  { nom: 'singleton React du banc retiré', fichier: METRO, cible: "if (nom === 'react' || nom.startsWith('react/')) return { type: 'sourceFile', filePath: require.resolve(nom, { paths: [mobileRoot] }) };", remplace: '' },
  // Import TYPE seulement : le test source doit refuser ce couplage sans jamais exécuter le service à effets.
  { nom: 'couplage historique interdit ajouté sans exécution', fichier: API, cible: "import type { SupabaseClient } from '@supabase/supabase-js';", remplace: "import type { ResultatLivreur } from '@/lib/livraison/service-livreur';\nimport type { SupabaseClient } from '@supabase/supabase-js';" },
];
const originaux = new Map([...new Set(mutations.map(m => m.fichier))].map(f => [f, readFileSync(f)]));
const restaurer = () => { for (const [f, octets] of originaux) writeFileSync(f, octets); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restaurer(); process.exit(1); });
const plans = mutations.map(m => {
  const source = originaux.get(m.fichier);
  let cible = Buffer.from(m.cible);
  if (source.indexOf(cible) < 0 && m.cible.includes('\n')) cible = Buffer.from(m.cible.replace(/\n/g, '\r\n'));
  const debut = source.indexOf(cible);
  if (debut < 0 || source.indexOf(cible, debut + 1) >= 0) throw new Error('CIBLE_NON_UNIQUE : ' + m.nom);
  return { ...m, octets: Buffer.concat([source.subarray(0, debut), Buffer.from(m.remplace), source.subarray(debut + cible.length)]) };
});
const tester = () => spawnSync(process.execPath, ['--experimental-strip-types', '--import', new URL('../../api/scripts/enregistrer-resolveur.mjs', import.meta.url).href, '--test', '--test-timeout=15000', chemin('../../api/tests/livreur-fiche.test.ts'), chemin('../tests/livreur-fiche.test.ts'), chemin('../tests/livreur-metro-controle.test.ts')], { cwd: racine, shell: false, stdio: 'ignore', timeout: 60000 }).status;
if (tester() !== 0) { console.log('Ciblé initial non vert : aucune mutation appliquée.'); process.exit(1); }
let echec = false;
for (const p of plans) {
  let code;
  try { writeFileSync(p.fichier, p.octets); code = tester(); }
  finally { writeFileSync(p.fichier, originaux.get(p.fichier)); }
  const detectee = code !== null && code !== 0;
  console.log(`${p.nom} : code ${code ?? 'indéterminé'}${detectee ? '' : ' NON DÉTECTÉE'}`);
  if (!detectee) echec = true;
}
for (const [f, octets] of originaux) if (!readFileSync(f).equals(octets)) throw new Error('RESTAURATION_INCOMPLETE');
const final = tester(); console.log(`Après restauration : code ${final ?? 'indéterminé'}`);
if (echec || final !== 0) process.exit(1);
console.log('OK : 12 mutations détectées, restauration exacte et ciblé final vert.');
