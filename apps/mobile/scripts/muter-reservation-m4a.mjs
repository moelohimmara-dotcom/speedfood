// Mutations M4a (réservation de table) : zéro réseau, sources gardées/restaurées en Buffer (try/finally), suite complète initiale et finale obligatoires.
// Chaque mutation doit faire échouer au moins un test des fichiers ciblés ; une mutation survivante fait échouer le script. Restauration vérifiée octet par octet.
// Lancement (depuis apps/mobile) : node scripts/muter-reservation-m4a.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const chemin = p => fileURLToPath(new URL(p, import.meta.url));
const mobile = chemin('..');
const CONNEXION = f => chemin('../src/connexion/' + f);
const RESEAU = CONNEXION('reservation.ts');
const CLIENT = CONNEXION('client.ts');
const CTL_CLIENT = CONNEXION('controle-reservation-client.ts');
const CTL_RESTO = CONNEXION('controle-reservation-restaurateur.ts');
const CRENEAUX = chemin('../src/domaine/creneaux-reservation.ts');
const ECRAN_RESERVER = CONNEXION('ReserverTableReel.tsx');
const ECRAN_MES = CONNEXION('MesReservationsReel.tsx');
const ECRAN_RESTO = CONNEXION('ReservationsRestaurateurReel.tsx');
const BANC = chemin('../controle-reservation/serveur.mjs');
const TESTS_LOGIQUE = ['tests/reservation-creneaux.test.ts', 'tests/reservation-client-reseau.test.ts', 'tests/reservation-controle-client.test.ts', 'tests/reservation-controle-restaurateur.test.ts', 'tests/reservation-ecrans.test.ts', 'tests/reservation-parite.test.ts'];
const TESTS_BANC = ['tests/reservation-banc.test.ts'];
// Un seul `cible → remplace`, ou plusieurs (`edits`) appliqués dans l'ordre au même fichier. `tests` : les fichiers de test ciblés (défaut : la logique).
const mutations = [
  // --- actions déduites côté client, motif, confirmation (restaurateur) ---
  { nom: '1. action hors actionsPossibles acceptée (actions déduites côté client)', fichier: CTL_RESTO, cible: 'if (!reservation.actionsPossibles.includes(action)) {', remplace: 'if (false) {' },
  { nom: '2. motif non validé avant l’envoi (refuser sans motif de 3 à 200)', fichier: CTL_RESTO, cible: 'const p = preparerDecision(exigeMotif ? { action, motif: options.motif } : { action });', remplace: 'const p = { ok: true as const, corps: { action, motif: exigeMotif ? (options.motif ?? undefined) : undefined } };' },
  { nom: '3. confirmation de refuser et annuler sautée (restaurateur)', fichier: CTL_RESTO, cible: 'if (exigeMotif && options.confirme !== true) {', remplace: 'if (false) {' },
  { nom: '4. écran restaurateur : boutons figés au lieu de actionsPossibles', fichier: ECRAN_RESTO, cible: 'r.actionsPossibles.map(a =>', remplace: "(['confirmer', 'refuser'] as ActionReservationRestaurant[]).map(a =>" },
  // --- fuseau local ---
  { nom: '5. jour d’un instant calculé en heure locale du téléphone', fichier: CRENEAUX, cible: 'return new Date(ms).toISOString().slice(0, 10);', remplace: "const d = new Date(ms); return d.getFullYear() + '-' + deuxChiffres(d.getMonth() + 1) + '-' + deuxChiffres(d.getDate());" },
  { nom: '6. heure affichée en heure locale du téléphone', fichier: CRENEAUX, cible: "return deuxChiffres(d.getUTCHours()) + ':' + deuxChiffres(d.getUTCMinutes());", remplace: "return deuxChiffres(d.getHours()) + ':' + deuxChiffres(d.getMinutes());" },
  { nom: '7. écran restaurateur : jours décalés par le fuseau local', fichier: ECRAN_RESTO, cible: 'const jours = joursProposes(Date.now(), 8);', remplace: 'const jours = joursProposes(Date.now() + new Date().getTimezoneOffset() * 60000, 8);' },
  // --- créneaux ---
  { nom: '8. délai minimal : 30 minutes pile refusées', fichier: CRENEAUX, cible: 'instant >= plusTot', remplace: 'instant > plusTot' },
  { nom: '9. quatorze jours proposés → quinze', fichier: CRENEAUX, cible: 'export const JOURS_PROPOSES = 14;', remplace: 'export const JOURS_PROPOSES = 15;' },
  { nom: '10. pas du créneau de 30 minutes au lieu de 15', fichier: CRENEAUX, cible: 'minutes += PAS_CRENEAU_MINUTES', remplace: 'minutes += 30' },
  // --- rejeu automatique ---
  { nom: '11. rejeu automatique de l’envoi de la demande', fichier: CTL_CLIENT, cible: 'try { reponse = await session.creerReservation(d); } catch (e) { echec = e; }', remplace: 'try { reponse = await session.creerReservation(d); } catch (e) { try { reponse = await session.creerReservation(d); } catch (e2) { echec = e2; } }' },
  { nom: '12. rejeu automatique de l’annulation (client)', fichier: CTL_CLIENT, cible: 'try { await envoi(); reussi = true; } catch (e) { echec = e; }', remplace: 'try { await envoi(); reussi = true; } catch (e) { try { await envoi(); reussi = true; } catch (e2) { echec = e2; } }' },
  { nom: '13. rejeu automatique de la décision ou du réglage (restaurateur)', fichier: CTL_RESTO, cible: 'try { await envoi(); reussi = true; } catch (e) { echec = e; }', remplace: 'try { await envoi(); reussi = true; } catch (e) { try { await envoi(); reussi = true; } catch (e2) { echec = e2; } }' },
  { nom: '14. réponse 5xx du serveur traitée comme un refus (pas « à vérifier »)', fichier: CLIENT, cible: "if (!r.ok) throw new ErreurReservation('incertain', textes.indisponible);", remplace: "if (!r.ok) throw new ErreurReservation('refus', textes.indisponible);" },
  { nom: '15. réponse illisible traitée comme un refus', fichier: CLIENT, cible: "try { return lire(corps); } catch { throw new ErreurReservation('incertain', textes.illisible); }", remplace: "try { return lire(corps); } catch { throw new ErreurReservation('refus', textes.illisible); }" },
  // --- confirmation, verrous, relecture ---
  { nom: '16. annulation du client sans confirmation explicite', fichier: CTL_CLIENT, cible: 'if (confirme !== true) {', remplace: 'if (false) {' },
  { nom: '17. verrou « à vérifier » ignoré à l’envoi de la demande', fichier: CTL_CLIENT, cible: "const peutEnvoyer = (id: unknown) => !ferme && !envoiEnCours && !relectureEnCours && !lectureEnCours && !incertain && disponibilite === 'oui'", remplace: "const peutEnvoyer = (id: unknown) => !ferme && !envoiEnCours && !relectureEnCours && !lectureEnCours && disponibilite === 'oui'" },
  { nom: '18. verrou « à vérifier » ignoré pour les écritures du restaurateur', fichier: CTL_RESTO, cible: 'const peutEcrire = () => !ferme && !ecritureEnCours && !incertain && ', remplace: 'const peutEcrire = () => !ferme && !ecritureEnCours && ' },
  { nom: '19. changement de jour permis pendant un résultat à vérifier', fichier: CTL_RESTO, cible: 'if (incertain) { publierLu(MESSAGE_VERROU); return; }', remplace: '' },
  { nom: '20. relecture après écriture omise (restaurateur)', fichier: CTL_RESTO, cible: 'const relu = await lire(jourDemande);', remplace: 'const relu = true;' },
  { nom: '21. demande retrouvée sans tenir compte de l’état (annulée comptée comme enregistrée)', fichier: CTL_CLIENT, cible: "liste.find(r => (r.statut === 'demandee' || r.statut === 'confirmee') && memeDemande(r, cherchee))", remplace: 'liste.find(r => memeDemande(r, cherchee))' },
  { nom: '22. demande retrouvée sans comparer le nombre de personnes', fichier: RESEAU, cible: ' && r.nbPersonnes === d.nbPersonnes;', remplace: ';' },
  { nom: '23. annulation proposée pour un créneau passé', fichier: RESEAU, cible: ' && Date.parse(r.creneau) > maintenantMs;', remplace: ';' },
  // --- leçon de G3b : drapeaux remis à leur valeur finale AVANT la publication ---
  { nom: '24. drapeau de lecture remis à zéro APRÈS la publication (liste du client)', fichier: CTL_CLIENT, cible: 'finir => { if (lectureEnCours === p) lectureEnCours = null; return finir(); }', remplace: 'finir => { const r = finir(); if (lectureEnCours === p) lectureEnCours = null; return r; }' },
  { nom: '25. drapeau de lecture remis à zéro APRÈS la publication (restaurateur)', fichier: CTL_RESTO, cible: 'finir => { if (lectureEnCours === p) lectureEnCours = null; return finir(); }', remplace: 'finir => { const r = finir(); if (lectureEnCours === p) lectureEnCours = null; return r; }' },
  { nom: '26. drapeau d’envoi remis à zéro APRÈS la publication (demande)', fichier: CTL_CLIENT, cible: '    envoiEnCours = false;\n    if (ferme) return;', remplace: '    if (ferme) return;\n    queueMicrotask(() => { envoiEnCours = false; });' },
  // --- compte, jour, réglage ---
  { nom: '27. réponse d’un ancien compte publiée (génération ignorée, restaurateur)', fichier: CTL_RESTO, cible: 'const valide = (n: number, generation: number | null) => !ferme && n === revision && generation === session.generationNotifications;', remplace: 'const valide = (n: number, _generation: number | null) => !ferme && n === revision;' },
  { nom: '28. réponse d’un autre jour que celui demandé acceptée', fichier: CTL_RESTO, cible: '(jour !== null && jourRecu !== jour)', remplace: 'false' },
  { nom: '29. réglage envoyé sans validation locale (capacité hors 1 à 500)', fichier: CTL_RESTO, cible: 'const p = preparerReglage(valeurs);\n    if (!p.ok) { publierLu(p.message); return; }\n    const corps = p.corps;', remplace: 'const corps = valeurs as ValeursReglageReservation;' },
  // --- écrans ---
  { nom: '30. bouton « Réserver une table » affiché même quand le restaurant n’accepte pas', fichier: ECRAN_RESERVER, cible: "const visible = etat.disponibilite === 'oui' || etat.incertain || etat.confirmee !== null;", remplace: 'const visible = true;' },
  { nom: '31. récapitulatif sans « Aucun paiement »', fichier: ECRAN_RESERVER, cible: '{restaurantNom}. Le restaurant doit la confirmer. Aucun paiement.', remplace: '{restaurantNom}. Le restaurant doit la confirmer.' },
  { nom: '32. mise en page par style en ligne (Mes réservations)', fichier: ECRAN_MES, cible: '<View style={s.bloc}>', remplace: '<View style={{ gap: 12 }}>' },
  { nom: '33. envoi de la demande non verrouillé après un résultat à vérifier (écran)', fichier: ECRAN_RESERVER, cible: '<Action titre="Envoyer ma demande" agir={envoyer} disabled={occupe || verrou} />', remplace: '<Action titre="Envoyer ma demande" agir={envoyer} disabled={false} />' },
  // --- banc factice ---
  { nom: '34. banc : le journal retient le nom du client', fichier: BANC, cible: "noter('client:creer');", remplace: "noter('client:creer:' + ligne.nom);", tests: TESTS_BANC },
  { nom: '35. banc : la faute « perdue » applique quand même l’écriture', fichier: BANC, cible: "if (faute === 'incertain_perdue') throw new Error('PANNE_FACTICE_AVANT_ECRITURE');\n      const r = ajouter({", remplace: "const r = ajouter({", tests: TESTS_BANC },
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
function tester(liste) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-timeout=120000', ...liste], { cwd: mobile, shell: false, encoding: 'utf8', timeout: 480000 });
  const echecs = Number(/^ℹ fail (\d+)/m.exec(r.stdout ?? '')?.[1] ?? NaN) + Number(/^ℹ cancelled (\d+)/m.exec(r.stdout ?? '')?.[1] ?? 0);
  return { code: r.status, echecs };
}
const initial = tester(tous);
if (initial.code !== 0) { console.log('Initial non vert (code ' + initial.code + ') : aucune mutation appliquée.'); process.exit(1); }
console.log('Suite complète initiale : code 0, ' + initial.echecs + ' échec(s).');
let survivantes = 0;
for (const p of plans) {
  let r;
  try { writeFileSync(p.fichier, p.octets); r = tester(p.tests ?? TESTS_LOGIQUE); }
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
