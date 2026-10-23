import {
  ACTIONS_EQUIPE_COMPTES,
  compteEquipeDeTest,
  filtrerComptesEquipe,
  libelleAffiliationEquipe,
  libelleRoleSystemeEquipe,
  libelleTypeCompteEquipe,
  typeCompteEquipeValide,
  type CompteEquipeFiltrable,
} from "../../src/lib/system-admin/comptes-equipe-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC comptes équipe : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    comptes équipe : ${nom}`);
  }
}

const compte = (email: string, roleSysteme: string | null, nombreRestaurants: number, test = false): CompteEquipeFiltrable => ({
  email,
  roleSysteme,
  nombreRestaurants,
  test,
});

const annuaire = [
  compte("a@exemple.gn", "super_admin", 0),
  compte("b@exemple.gn", null, 2),
  compte("c@exemple.gn", null, 0),
  compte("d@exemple.gn", "operations", 1, true),
  compte("e@exemple.gn", null, 0, true),
];

// Filtres : une valeur inconnue retombe sur « Tous », jamais sur une liste vide surprise.
verifier("filtre tous", typeCompteEquipeValide("tous"), "tous");
verifier("filtre restaurateur", typeCompteEquipeValide("restaurateur"), "restaurateur");
verifier("filtre systeme", typeCompteEquipeValide("systeme"), "systeme");
verifier("filtre sans affiliation", typeCompteEquipeValide("sans_affiliation"), "sans_affiliation");
verifier("filtre test", typeCompteEquipeValide("test"), "test");
verifier("filtre inconnu = tous", typeCompteEquipeValide("nimporte"), "tous");
verifier("filtre vide = tous", typeCompteEquipeValide(""), "tous");
verifier("filtre absent = tous", typeCompteEquipeValide(null), "tous");
verifier("filtre undefined = tous", typeCompteEquipeValide(undefined), "tous");

// Libellés lisibles.
verifier("libellé tous", libelleTypeCompteEquipe("tous"), "Tous");
verifier("libellé restaurateurs", libelleTypeCompteEquipe("restaurateur"), "Restaurateurs");
verifier("libellé rôles système", libelleTypeCompteEquipe("systeme"), "Rôles système");
verifier("libellé sans affiliation", libelleTypeCompteEquipe("sans_affiliation"), "Sans affiliation");
verifier("libellé comptes de test", libelleTypeCompteEquipe("test"), "Comptes de test");
verifier("libellé filtre inconnu = tous", libelleTypeCompteEquipe("nimporte"), "Tous");

// Rôles système : libellé connu, rôle hors matrice affiché tel quel, aucun rôle = pas de libellé.
verifier("rôle super_admin", libelleRoleSystemeEquipe("super_admin"), "Super administrateur");
verifier("rôle operations", libelleRoleSystemeEquipe("operations"), "Opérations");
verifier("rôle content_editor", libelleRoleSystemeEquipe("content_editor"), "Éditeur de contenu");
verifier("rôle support", libelleRoleSystemeEquipe("support"), "Support");
verifier("rôle hors matrice = tel quel", libelleRoleSystemeEquipe("lecture_seule"), "lecture_seule");
verifier("aucun rôle = pas de libellé", libelleRoleSystemeEquipe(null), null);

// Affiliation : propriétaire ou équipier.
verifier("affiliation owner", libelleAffiliationEquipe("owner"), "Propriétaire");
verifier("affiliation manager", libelleAffiliationEquipe("manager"), "Équipier");
verifier("affiliation inconnue = équipier", libelleAffiliationEquipe("autre"), "Équipier");

// Filtres de l'annuaire.
verifier("tous = annuaire complet", filtrerComptesEquipe(annuaire, { type: "tous" }).length, 5);
verifier("restaurateurs", filtrerComptesEquipe(annuaire, { type: "restaurateur" }).map((c) => c.email), ["b@exemple.gn", "d@exemple.gn"]);
verifier("rôles système", filtrerComptesEquipe(annuaire, { type: "systeme" }).map((c) => c.email), ["a@exemple.gn", "d@exemple.gn"]);
verifier("sans affiliation", filtrerComptesEquipe(annuaire, { type: "sans_affiliation" }).map((c) => c.email), ["c@exemple.gn", "e@exemple.gn"]);
verifier("comptes de test", filtrerComptesEquipe(annuaire, { type: "test" }).map((c) => c.email), ["d@exemple.gn", "e@exemple.gn"]);

// Recherche par e-mail : partielle, insensible à la casse.
verifier("recherche exacte", filtrerComptesEquipe(annuaire, { q: "b@exemple.gn" }).map((c) => c.email), ["b@exemple.gn"]);
verifier("recherche partielle", filtrerComptesEquipe(annuaire, { q: "@exemple" }).length, 5);
verifier("recherche insensible à la casse", filtrerComptesEquipe(annuaire, { q: "B@EXEMPLE" }).map((c) => c.email), ["b@exemple.gn"]);
verifier("recherche sans résultat", filtrerComptesEquipe(annuaire, { q: "zzz" }).length, 0);
verifier("recherche vide = annuaire complet", filtrerComptesEquipe(annuaire, { q: "   " }).length, 5);

// Recherche et filtre combinés.
verifier("recherche + filtre", filtrerComptesEquipe(annuaire, { q: "exemple", type: "test" }).map((c) => c.email), ["d@exemple.gn", "e@exemple.gn"]);
verifier("recherche + filtre contradictoire", filtrerComptesEquipe(annuaire, { q: "a@", type: "test" }).length, 0);

// Comptes de test : repère étroit, jamais une décision automatique.
verifier("compte de test : mot test", compteEquipeDeTest("compte-test@example.gn"), true);
verifier("compte de test : mot essai", compteEquipeDeTest("essai.resto@example.gn"), true);
verifier("compte de test : préfixe de bloc", compteEquipeDeTest("bloc8b-x@example.gn"), true);
verifier("compte de test : domaine d'exemple", compteEquipeDeTest("a@example.com"), true);
verifier("compte de test : majuscules", compteEquipeDeTest("TEST@EXAMPLE.GN"), true);
verifier("pas un compte de test", compteEquipeDeTest("contact@kaloum-solidarite.gn"), false);
verifier("pas un compte de test : mot test dans le domaine", compteEquipeDeTest("a@contest.gn"), false);
verifier("pas un compte de test : vide", compteEquipeDeTest(""), false);
verifier("pas un compte de test : absent", compteEquipeDeTest(null), false);

// Ce qui reste sur le site : l'irréversible et les rôles système.
verifier("annuaire dans l'application", ACTIONS_EQUIPE_COMPTES.lireAnnuaire, true);
verifier("suppression d'un compte sur le site seulement", ACTIONS_EQUIPE_COMPTES.suppressionCompteSurLeSiteSeulement, true);
verifier("suppression groupée sur le site seulement", ACTIONS_EQUIPE_COMPTES.suppressionGroupeeSurLeSiteSeulement, true);
verifier("réinitialisation des questions sur le site seulement", ACTIONS_EQUIPE_COMPTES.reinitialisationQuestionsSurLeSiteSeulement, true);
verifier("attribution des rôles sur le site seulement", ACTIONS_EQUIPE_COMPTES.attributionRolesSurLeSiteSeulement, true);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
