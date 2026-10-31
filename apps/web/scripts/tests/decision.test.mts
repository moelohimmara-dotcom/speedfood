import { cibleBlocage, decision, type EntreeDecision } from "../../src/lib/system-admin/decision-restaurant";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const sansProprio = { cle: "proprietaire", libelle: "Propriétaire rattaché", detail: "Aucun propriétaire : personne ne peut recevoir les commandes." };
const sansMenu = { cle: "menu", libelle: "Menu", detail: "Aucun plat." };
const base: EntreeDecision = { publie: false, suspendu: false, correctionEnCours: false, bloquants: [], aProprietaire: true };
const d = (e: Partial<EntreeDecision>) => decision({ ...base, ...e });

// bloqué
const bloque = d({ bloquants: [sansProprio], aProprietaire: false });
verifier("bloqué : l'action est de régler le point, pas d'approuver", bloque.action, "regler");
verifier("bloqué : le premier point est proposé avec son moyen", [bloque.premierBlocage?.cle, bloque.premierBlocage?.cta, bloque.premierBlocage?.href], ["proprietaire", "Rattacher un propriétaire", "#equipe"]);
verifier("bloqué sans propriétaire : pas de correction (personne à qui écrire)", [bloque.correctionVisible, bloque.correctionDansPlus], [false, false]);
verifier("bloqué : le restaurant reste suspendable", bloque.suspensionVisible, true);
verifier("bloqué : barre du téléphone, un point", bloque.barre, { titre: "1 point à régler", sous: "Propriétaire rattaché", ton: "attention" });
verifier("bloqué : deux points = pluriel, le premier est affiché", d({ bloquants: [sansMenu, sansProprio] }).barre, { titre: "2 points à régler", sous: "Menu", ton: "attention" });
verifier("bloqué avec propriétaire : la correction est rangée dans « Plus d'actions »", [d({ bloquants: [sansMenu] }).correctionVisible, d({ bloquants: [sansMenu] }).correctionDansPlus], [false, true]);
verifier("bloqué : état « En attente »", bloque.etat, { libelle: "En attente", ton: "attention" });

// prêt
const pret = d({});
verifier("prêt : l'action principale est d'approuver", pret.action, "approuver");
verifier("prêt : aucun point à régler", pret.premierBlocage, null);
verifier("prêt : la correction est visible", [pret.correctionVisible, pret.correctionDansPlus], [true, false]);
verifier("prêt : état et barre", [pret.etat, pret.barre.titre], [{ libelle: "Prêt à publier", ton: "succes" }, "Prêt à publier"]);

// correction en cours
verifier("correction en cours, dossier complet : on peut réapprouver", d({ correctionEnCours: true }).action, "approuver");
verifier("correction en cours : l'état le dit", d({ correctionEnCours: true }).etat.libelle, "Correction demandée");

// en ligne
const enLigne = d({ publie: true });
verifier("en ligne : aucune action principale", enLigne.action, "aucune");
verifier("en ligne : correction visible, suspension possible", [enLigne.correctionVisible, enLigne.suspensionVisible], [true, true]);
verifier("en ligne : état", enLigne.etat, { libelle: "En ligne", ton: "succes" });

// suspendu
const suspendu = d({ publie: true, suspendu: true });
verifier("suspendu : l'action est de réactiver", suspendu.action, "reactiver");
verifier("suspendu : ni correction ni nouvelle suspension", [suspendu.correctionVisible, suspendu.correctionDansPlus, suspendu.suspensionVisible], [false, false, false]);
verifier("suspendu : la suspension prime même avec des points bloquants", d({ suspendu: true, bloquants: [sansProprio] }).action, "reactiver");

// cibles
verifier("cible : horaires", cibleBlocage("horaires").href, "#administration-restaurant");
verifier("cible : point inconnu = le dossier", cibleBlocage("autre"), { cta: "Voir le dossier", href: "#dossier" });

if (ko > 0) process.exit(1);
