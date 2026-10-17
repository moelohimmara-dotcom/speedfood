import {
  ETIQUETTES,
  SEUIL_AFFICHAGE,
  combinaisonAutorisee,
  comparerParNote,
  estPublique,
  libelleNote,
  messageRefus,
  moyenne,
  moyenneAffichee,
  noteLissee,
  noteModifiable,
  nettoyerTexte,
  prenomAffiche,
  raisonNotationImpossible,
  scoreClassement,
  sousLeSeuil,
  troisMauvaisesDeSuite,
  validerAvis,
  validerReponse,
} from "../../src/lib/notation/regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- qui note qui
verifier("client > restaurant et livreur", [combinaisonAutorisee("client", "restaurant"), combinaisonAutorisee("client", "livreur")], [true, true]);
verifier("restaurant et livreur > client", [combinaisonAutorisee("restaurant", "client"), combinaisonAutorisee("livreur", "client")], [true, true]);
verifier("pas de note à soi-même ni à l'envers", [combinaisonAutorisee("restaurant", "restaurant"), combinaisonAutorisee("restaurant", "livreur"), combinaisonAutorisee("livreur", "restaurant"), combinaisonAutorisee("client", "client")], [false, false, false, false]);
verifier("seul un restaurant a une note publique", [estPublique("restaurant"), estPublique("livreur"), estPublique("client")], [true, false, false]);

// --- validation
verifier("avis complet valide", validerAvis({ auteur: "client", cible: "restaurant", note: 5, etiquettes: ["plat_chaud", "emballage_soigne"], commentaire: "  Très   bon !  " }), { ok: true, avis: { note: 5, etiquettes: ["plat_chaud", "emballage_soigne"], commentaire: "Très bon !" } });
verifier("note seule valide", validerAvis({ auteur: "client", cible: "livreur", note: 3 }), { ok: true, avis: { note: 3, etiquettes: [], commentaire: null } });
verifier("note hors bornes ou à virgule", [0, 6, 3.5, "5", null, Number.NaN].map((n) => validerAvis({ auteur: "client", cible: "restaurant", note: n }).ok), [false, false, false, false, false, false]);
verifier("étiquette d'une autre cible refusée", validerAvis({ auteur: "client", cible: "restaurant", note: 4, etiquettes: ["rapide"] }).ok, false);
verifier("étiquettes en double regroupées", (validerAvis({ auteur: "client", cible: "restaurant", note: 4, etiquettes: ["plat_chaud", "plat_chaud"] }) as { ok: true; avis: { etiquettes: string[] } }).avis.etiquettes, ["plat_chaud"]);
verifier("trop d'étiquettes", validerAvis({ auteur: "client", cible: "restaurant", note: 4, etiquettes: ETIQUETTES.restaurant.slice(0, 6).map((e) => e.cle) }).ok, false);
verifier("étiquettes pas un tableau", validerAvis({ auteur: "client", cible: "restaurant", note: 4, etiquettes: "plat_chaud" }).ok, false);
verifier("commentaire trop long", validerAvis({ auteur: "client", cible: "restaurant", note: 4, commentaire: "x".repeat(501) }).ok, false);
verifier("commentaire à 500 accepté", validerAvis({ auteur: "client", cible: "restaurant", note: 4, commentaire: "x".repeat(500) }).ok, true);
verifier("note sur un client : étiquettes oui, commentaire non", [validerAvis({ auteur: "restaurant", cible: "client", note: 2, etiquettes: ["injoignable"] }).ok, validerAvis({ auteur: "restaurant", cible: "client", note: 2, commentaire: "Il a menti" }).ok], [true, false]);
verifier("combinaison interdite refusée", validerAvis({ auteur: "restaurant", cible: "restaurant", note: 5 }).ok, false);
verifier("caractères de contrôle retirés", nettoyerTexte("Bon\u0000 plat\u0007  \n\n\n\nmerci"), "Bon plat \n\nmerci");
verifier("réponse valide / trop courte / trop longue", [validerReponse("Merci pour votre avis").ok, validerReponse(" a ").ok, validerReponse("x".repeat(501)).ok, validerReponse(42).ok], [true, false, false, false]);

// --- fenêtres
const maintenant = new Date("2026-10-18T12:00:00Z");
const il_y_a_jours = (j: number) => new Date(maintenant.getTime() - j * 86_400_000).toISOString();
verifier("commande terminée récente : notable", raisonNotationImpossible({ statut: "terminee", estTest: false, clotureLe: il_y_a_jours(2) }, maintenant), null);
verifier("commande de test : refusée", raisonNotationImpossible({ statut: "terminee", estTest: true, clotureLe: il_y_a_jours(1) }, maintenant), "commande_de_test");
verifier("commande pas terminée : refusée", ["en_attente", "acceptee", "prete", "refusee", "annulee"].map((s) => raisonNotationImpossible({ statut: s, estTest: false, clotureLe: il_y_a_jours(0) }, maintenant)), Array(5).fill("pas_terminee"));
verifier("14 jours exactement : encore notable", raisonNotationImpossible({ statut: "terminee", estTest: false, clotureLe: il_y_a_jours(14) }, maintenant), null);
verifier("15 jours : délai dépassé", raisonNotationImpossible({ statut: "terminee", estTest: false, clotureLe: il_y_a_jours(15) }, maintenant), "delai_depasse");
verifier("date illisible : refusée", raisonNotationImpossible({ statut: "terminee", estTest: false, clotureLe: "n'importe quoi" }, maintenant), "delai_depasse");
verifier("messages de refus lisibles", ["pas_terminee", "commande_de_test", "delai_depasse"].map((r) => messageRefus(r as "pas_terminee").length > 10), [true, true, true]);
verifier("modifiable 24 h, pas 25 h, pas dans le futur", [noteModifiable(new Date(maintenant.getTime() - 23 * 3_600_000).toISOString(), maintenant), noteModifiable(new Date(maintenant.getTime() - 25 * 3_600_000).toISOString(), maintenant), noteModifiable(new Date(maintenant.getTime() + 3_600_000).toISOString(), maintenant)], [true, false, false]);

// --- moyennes
verifier("moyenne simple", [moyenne(43, 10), moyenne(0, 0), moyenne(5, 1)], [4.3, null, 5]);
verifier("moyenne affichée seulement à partir de 5 avis", [moyenneAffichee(20, 4), moyenneAffichee(22, 5)], [null, 4.4]);
verifier("seuil d'affichage : 5", SEUIL_AFFICHAGE, 5);
verifier("lissage : sans avis = 4,0", noteLissee(0, 0), 4);
verifier("lissage : un seul avis à 5 reste modeste", Math.round(noteLissee(5, 1) * 100) / 100, 4.09);
verifier("lissage : 20 avis à 5 tirent vers 5", Math.round(noteLissee(100, 20) * 100) / 100, 4.67);
verifier("lissage : un avis à 1 ne détruit pas un restaurant", Math.round(noteLissee(1, 1) * 100) / 100, 3.73);
verifier("score de classement : seulement à partir de 5 avis", [scoreClassement(25, 4), scoreClassement(25, 5) !== null], [null, true]);
const a = { somme: 50, total: 10 }; // 5,0
const b = { somme: 40, total: 10 }; // 4,0
const peu = { somme: 5, total: 1 };
verifier("classement : le mieux noté d'abord", [comparerParNote(a, b) < 0, comparerParNote(b, a) > 0], [true, true]);
verifier("classement : un restaurant sans assez d'avis passe après ceux qui ont un score, sans en changer l'ordre entre eux", [comparerParNote(peu, b) > 0, comparerParNote(b, peu) < 0, comparerParNote(peu, { somme: 4, total: 1 })], [true, true, 0]);
verifier("classement : 30 avis à 4,5 devant 5 avis à 5", comparerParNote({ somme: 135, total: 30 }, { somme: 25, total: 5 }) < 0, true);
verifier("libellés", [libelleNote(0, 0), libelleNote(5, 1), libelleNote(43, 10).replace(/\s/g, " ")], ["Nouveau", "Nouveau · 1 avis", "4,3 · 10 avis"]);

// --- alertes
verifier("sous le seuil : 5 notes à 3,0", sousLeSeuil(15, 5), true);
verifier("pas d'alerte avec 4 notes seulement", sousLeSeuil(8, 4), false);
verifier("pas d'alerte à 3,5 pile", sousLeSeuil(35, 10), false);
verifier("trois mauvaises de suite", [troisMauvaisesDeSuite([2, 1, 2, 5]), troisMauvaisesDeSuite([2, 3, 1]), troisMauvaisesDeSuite([1, 1])], [true, false, false]);

// --- prénom
verifier("prénom affiché", [prenomAffiche("Mamadou Diallo"), prenomAffiche("  aïssatou  bah "), prenomAffiche(""), prenomAffiche("1234"), prenomAffiche("x")], ["Mamadou", "Aïssatou", "Client", "Client", "Client"]);
verifier("prénom jamais trop long", prenomAffiche("A".repeat(60)).length <= 20, true);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
