// Mutations G3b : zéro réseau, sources gardées/restaurées en Buffer (try/finally), test initial et final obligatoires.
// Chaque mutation doit faire échouer au moins un test des fichiers ciblés ; une mutation survivante fait échouer le script.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const chemin = p => fileURLToPath(new URL(p, import.meta.url));
const mobile = chemin('..');
const LIVREUR = chemin('../src/connexion/livreur.ts');
const CONTROLE = chemin('../src/connexion/controle-etat-livreur.ts');
const CLIENT = chemin('../src/connexion/client.ts');
const ECRAN = chemin('../src/connexion/LivreurReel.tsx');
// Un seul `cible → remplace`, ou plusieurs (`edits`) appliqués dans l'ordre au même fichier.
const mutations = [
  { nom: '1a. client accepté avant la récupération (parseur)', fichier: LIVREUR, cible: '    if (!STATUTS_APRES_RECUPERATION.includes(statut)) return illisible();\n', remplace: '' },
  { nom: '1b. client affiché sans que le serveur le fournisse (inventé)', fichier: LIVREUR, cible: 'return course.client !== null && STATUTS_APRES_RECUPERATION.includes(course.statut) ? course.client : null;', remplace: "return course.client ?? { nom: 'Client', telephone: '', adresse: null };" },
  { nom: '1c. client affiché avant la récupération (garde d’affichage retirée)', fichier: LIVREUR, cible: 'return course.client !== null && STATUTS_APRES_RECUPERATION.includes(course.statut) ? course.client : null;', remplace: 'return course.client;' },
  { nom: '2a. code envoyé sans validation (contrôleur)', fichier: CONTROLE, cible: '      const code = lireCodeRemiseLivreur(saisie.code);\n      if (code === null) { publierLu(MESSAGE_CODE_REMISE_LIVREUR); return; }\n', remplace: "      const code = saisie.code ?? '';\n" },
  { nom: '2b. code envoyé sans validation (client réseau)', fichier: CLIENT, cible: 'const corps = lireCorpsCourseLivreur(demande);', remplace: 'const corps = demande as NonNullable<ReturnType<typeof lireCorpsCourseLivreur>>;' },
  { nom: '2c. écran envoie le code saisi, non validé', fichier: ECRAN, cible: "avancer('livree', { code: valide });", remplace: "avancer('livree', { code });" },
  { nom: '3a. réessai après réponse incertaine (contrôleur)', fichier: CONTROLE, cible: "    // Réponse incertaine : l'action a pu être appliquée. Verrou jusqu'à une relecture réussie ; jamais de second envoi automatique.\n", remplace: '    try { await envoi(); } catch { /* mutation */ }\n' },
  { nom: '3b. réessai après statut 5xx (client réseau)', fichier: CLIENT, cible: "      if (!r.ok) throw new ErreurLivreur('incertain', textes.indisponible);", remplace: "      if (!r.ok) { await fetcher(ORIGINE_CATALOGUE+chemin, { method:'POST', headers:{ Authorization:'Bearer '+accessToken, 'Content-Type':'application/json' }, body: JSON.stringify(corpsEnvoye) }); throw new ErreurLivreur('incertain', textes.indisponible); }" },
  { nom: '4. livraisonId omis dans l’envoi', fichier: CONTROLE, cible: 'const demande: DemandeCourseLivreur = { livraisonId: course.livraisonId, vers };', remplace: 'const demande = { vers } as DemandeCourseLivreur;' },
  { nom: '5a. ancienne réponse réaffichée après changement de compte (génération ignorée)', fichier: CONTROLE, cible: 'const valide = (n: number, generation: number | null) => !ferme && n === revision && generation === session.generationNotifications;', remplace: 'const valide = (n: number, _generation: number | null) => !ferme && n === revision;' },
  { nom: '5b. données de l’ancien compte conservées (oubli neutralisé)', fichier: CONTROLE, cible: 'function oublier() { dernier = null; aDernier = false; incertain = false; messageDiffere = null; generationLue = undefined; }', remplace: 'function oublier() { /* mutation */ }' },
  { nom: '6a. bouton hors etapesPossibles affiché', fichier: LIVREUR, cible: 'return ETAPES_COURSE_LIVREUR.filter(e => course.etapesPossibles.includes(e));', remplace: 'return [...ETAPES_COURSE_LIVREUR];' },
  { nom: '6b. étape hors etapesPossibles acceptée par le contrôleur', fichier: CONTROLE, cible: 'if (!course.etapesPossibles.includes(vers)) {', remplace: 'if (false) {' },
  { nom: '7a. échec envoyé sans confirmation (contrôleur)', fichier: CONTROLE, cible: 'if (saisie.confirme !== true) {', remplace: 'if (false) {' },
  { nom: '7b. échec envoyé dès le premier appui (écran)', fichier: ECRAN, cible: 'agir={() => setConfirmerEchec(true)}', remplace: "agir={() => avancer('echec', { raison: 'sans confirmation', confirme: true })}" },
  { nom: '8a. code journalisé (contrôleur)', fichier: CONTROLE, cible: 'demande.code = code; secret = code;', remplace: "demande.code = code; secret = code; console.log('code', code);" },
  { nom: '8b. code journalisé (client réseau)', fichier: CLIENT, cible: 'const code = corps.code;', remplace: "const code = corps.code; console.log('envoi', code);" },
  { nom: '8c. code repris dans le message publié', fichier: CONTROLE, cible: 'publierLu(echec instanceof ErreurLivreur ? sansSecret(echec.message, secret, MESSAGE_INCERTAIN) : MESSAGE_INCERTAIN);', remplace: 'publierLu(echec instanceof ErreurLivreur ? echec.message : MESSAGE_INCERTAIN);' },
  { nom: '8d. code conservé dans l’état publié', fichier: CONTROLE, edits: [
    ['let incertain = false;\n', 'let incertain = false;\n  let memoireCode: string | null = null;\n'],
    ['demande.code = code; secret = code;', 'demande.code = code; secret = code; memoireCode = code;'],
    ["publier({ etat: 'lu', etatLivreur: dernier, ecritureEnCours,", "publier({ etat: 'lu', memoireCode, etatLivreur: dernier, ecritureEnCours,"],
  ] },
  { nom: '8e. code non effacé du champ avant l’envoi (écran)', fichier: ECRAN, cible: "              setCode(''); setErreurSaisie(null);\n              avancer('livree', { code: valide });", remplace: "              avancer('livree', { code: valide });" },
  { nom: '8f. message du serveur repris avec le code (client réseau)', fichier: CLIENT, cible: "message !== null && code !== undefined && message.includes(code) ? 'Code de remise incorrect.' : ", remplace: '' },
  // Mutations de comportement complémentaires.
  { nom: '9. relecture après succès omise', fichier: CONTROLE, cible: '      const relu = await lire();\n      // La relecture', remplace: '      const relu = true;\n      // La relecture' },
  { nom: '10. verrou « à vérifier » ignoré', fichier: CONTROLE, cible: 'const peutEcrire = () => !ferme && !ecritureEnCours && !incertain && ', remplace: 'const peutEcrire = () => !ferme && !ecritureEnCours && ' },
  { nom: '11. second envoi pendant l’envoi permis', fichier: CONTROLE, cible: 'const peutEcrire = () => !ferme && !ecritureEnCours && ', remplace: 'const peutEcrire = () => !ferme && ' },
  { nom: '12. relecture impossible après succès non verrouillée', fichier: CONTROLE, cible: 'if (!relu && !ferme && generation === session.generationNotifications) { incertain = true;', remplace: 'if (false) { incertain = true;' },
  { nom: '13. statut inconnu accepté par le parseur', fichier: LIVREUR, cible: "const statut = (STATUTS_COURSE_ACTIVE as readonly unknown[]).includes(o.statut) ? (o.statut as CourseLivreur['statut']) : illisible();", remplace: "const statut = o.statut as CourseLivreur['statut'];" },
  { nom: '14. champ excédentaire accepté par le parseur', fichier: LIVREUR, cible: 'if (Object.keys(o).length !== cles.length || !cles.every(c => Object.hasOwn(o, c))) return illisible();', remplace: 'if (!cles.every(c => Object.hasOwn(o, c))) return illisible();' },
  { nom: '15. frais non entiers acceptés', fichier: LIVREUR, cible: '!Number.isSafeInteger(o.fraisGnf) || ', remplace: '' },
  { nom: '16. clé course facultative (faux « aucune course »)', fichier: LIVREUR, cible: "const o = objetExact((v as { etat: unknown }).etat, ['fiche', 'offre', 'course']);\n  return { fiche: base.fiche, offre: base.offre, course: lireCourseStricte(o.course) };", remplace: "const o = (v as { etat: Record<string, unknown> }).etat;\n  return { fiche: base.fiche, offre: base.offre, course: lireCourseStricte(o.course ?? null) };" },
  { nom: '17. drapeau de lecture remis a null APRES la publication (boutons gries)', fichier: CONTROLE, cible: 'finir => { if (lectureEnCours === p) lectureEnCours = null; return finir(); });', remplace: 'finir => { const r = finir(); if (lectureEnCours === p) lectureEnCours = null; return r; });' },
  { nom: '18. client affiche pendant a verifier (clientAffiche sans masque)', fichier: LIVREUR, cible: 'return incertain ? null : clientVisible(course);', remplace: 'return clientVisible(course);' },
  { nom: '19. ecran affiche le client sans tenir compte de a verifier', fichier: ECRAN, cible: 'clientAffiche(course, incertain)', remplace: 'clientVisible(course)' },
];
const fichiers = [...new Set(mutations.map(m => m.fichier))];
const originaux = new Map(fichiers.map(f => [f, readFileSync(f)]));
const restaurer = () => { for (const [f, octets] of originaux) writeFileSync(f, octets); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restaurer(); process.exit(1); });
function appliquer(octets, cible, remplace, nom) {
  let c = Buffer.from(cible);
  if (octets.indexOf(c) < 0 && cible.includes('\n')) c = Buffer.from(cible.replace(/\n/g, '\r\n'));
  const debut = octets.indexOf(c);
  if (debut < 0 || octets.indexOf(c, debut + 1) >= 0) throw new Error('CIBLE_NON_UNIQUE : ' + nom + ' : ' + cible.slice(0, 60));
  const crlf = c.includes('\r\n');
  return Buffer.concat([octets.subarray(0, debut), Buffer.from(crlf ? remplace.replace(/\r?\n/g, '\r\n') : remplace), octets.subarray(debut + c.length)]);
}
const plans = mutations.map(m => {
  let octets = originaux.get(m.fichier);
  for (const [cible, remplace] of (m.edits ?? [[m.cible, m.remplace]])) octets = appliquer(octets, cible, remplace, m.nom);
  return { ...m, octets };
});
const tous = readdirSync(chemin('../tests')).filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f);
const cibles = ['tests/livreur-g3.test.ts', 'tests/livreur-etat.test.ts'];
function tester(liste) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-timeout=60000', ...liste], { cwd: mobile, shell: false, encoding: 'utf8', timeout: 240000 });
  const echecs = Number(/^ℹ fail (\d+)/m.exec(r.stdout ?? '')?.[1] ?? NaN) + Number(/^ℹ cancelled (\d+)/m.exec(r.stdout ?? '')?.[1] ?? 0);
  return { code: r.status, echecs };
}
const initial = tester(tous);
if (initial.code !== 0) { console.log('Initial non vert (code ' + initial.code + ') : aucune mutation appliquée.'); process.exit(1); }
let survivantes = 0;
for (const p of plans) {
  let r;
  try { writeFileSync(p.fichier, p.octets); r = tester(cibles); }
  finally { writeFileSync(p.fichier, originaux.get(p.fichier)); }
  const detectee = r.code !== null && r.code !== 0 && r.echecs >= 1;
  if (!detectee) survivantes++;
  console.log(`${p.nom} : code ${r.code ?? 'indéterminé'}, ${Number.isNaN(r.echecs) ? '?' : r.echecs} test(s) en échec${detectee ? '' : ' NON DÉTECTÉE'}`);
}
for (const [f, octets] of originaux) if (!readFileSync(f).equals(octets)) throw new Error('RESTAURATION_INCOMPLETE : ' + f);
const final = tester(tous);
console.log(`Après restauration (suite complète) : code ${final.code ?? 'indéterminé'}, ${final.echecs} échec(s)`);
if (survivantes > 0 || final.code !== 0) { console.log(survivantes + ' mutation(s) survivante(s).'); process.exit(1); }
console.log('OK : ' + plans.length + ' mutations détectées, restauration exacte, suite complète verte.');
