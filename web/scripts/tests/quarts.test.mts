import {
  ACTIONS_QUART,
  DELAI_RELANCE_MINUTES_PAR_DEFAUT,
  NB_OPERATEURS_PAR_DEFAUT,
  PERIMETRE_AFFECTATION_PAR_DEFAUT,
  ROLES_EQUIPE,
  commandesNonReprises,
  compterNonReprises,
  delaiRelanceMinutes,
  delaiRelanceValide,
  estCommandeNonReprise,
  estMembreEquipe,
  etatEtablissement,
  libelleAttente,
  libelleDelai,
  libelleEtatEtablissement,
  libelleRoleOperateur,
  messageErreurAffectation,
  minutesDepuis,
  operateursAffectables,
  peutLiberer,
  peutPrendre,
  trierParUrgence,
} from "../../src/lib/system-admin/quarts-regles";
import type { CommandeQuart, OperateurQuart } from "../../src/lib/system-admin/quarts-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC quarts : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    quarts : ${nom}`);
  }
}

const MAINTENANT = new Date("2026-10-24T10:00:00.000Z");
const ilYA = (minutes: number) => new Date(MAINTENANT.getTime() - minutes * 60_000).toISOString();

function commande(id: string, minutes: number): CommandeQuart {
  return {
    id,
    reference: `SF-${id}`,
    restaurantId: "resto-1",
    restaurantNom: "Le Comptoir",
    statut: "en_attente",
    modeCommande: "livraison",
    creeLe: ilYA(minutes),
  };
}

const MOI = "operateur-moi";
const AUTRE = "operateur-autre";
const OPERATEURS: OperateurQuart[] = [
  { utilisateurId: MOI, email: "moi@speedfood.test", role: "support" },
  { utilisateurId: AUTRE, email: "autre@speedfood.test", role: "super_admin" },
];

// --- Ancienneté et commande non reprise ------------------------------------
verifier("minutes écoulées", minutesDepuis(ilYA(12), MAINTENANT), 12);
verifier("minutes écoulées, date absente", minutesDepuis(null, MAINTENANT), 0);
verifier("minutes écoulées, date illisible", minutesDepuis("hier", MAINTENANT), 0);
verifier("minutes écoulées, date future", minutesDepuis(ilYA(-5), MAINTENANT), 0);
verifier("minutes écoulées, arrondi à la minute", minutesDepuis(ilYA(9.9), MAINTENANT), 9);

verifier("non reprise avant le délai", estCommandeNonReprise(ilYA(9), MAINTENANT, 10), false);
verifier("non reprise au délai exact", estCommandeNonReprise(ilYA(10), MAINTENANT, 10), true);
verifier("non reprise au-delà du délai", estCommandeNonReprise(ilYA(42), MAINTENANT, 10), true);
verifier("non reprise, délai nul", estCommandeNonReprise(ilYA(42), MAINTENANT, 0), false);
verifier("non reprise, délai illisible", estCommandeNonReprise(ilYA(42), MAINTENANT, Number.NaN), false);
verifier("non reprise, date absente", estCommandeNonReprise(null, MAINTENANT, 10), false);

// --- Barème de relance ------------------------------------------------------
verifier("délai par défaut documenté", DELAI_RELANCE_MINUTES_PAR_DEFAUT, 10);
verifier("délai valide, entier", delaiRelanceValide(15), true);
verifier("délai valide, texte", delaiRelanceValide("15"), true);
verifier("délai invalide, zéro", delaiRelanceValide(0), false);
verifier("délai invalide, négatif", delaiRelanceValide(-5), false);
verifier("délai invalide, trop grand", delaiRelanceValide(1000), false);
verifier("délai invalide, décimal", delaiRelanceValide(10.5), false);
verifier("délai invalide, texte", delaiRelanceValide("dix"), false);
verifier("délai retenu, valeur valide", delaiRelanceMinutes(25), 25);
verifier("délai retenu, valeur invalide", delaiRelanceMinutes("dix"), DELAI_RELANCE_MINUTES_PAR_DEFAUT);
verifier("libellé du délai au pluriel", libelleDelai(10), "10 minutes");
verifier("libellé du délai au singulier", libelleDelai(1), "1 minute");

// --- État d'un établissement ------------------------------------------------
verifier("établissement non pris", etatEtablissement(null, MOI), "non_pris");
verifier("établissement à moi", etatEtablissement(MOI, MOI), "a_moi");
verifier("établissement pris par un autre", etatEtablissement(AUTRE, MOI), "pris_par_autre");
verifier("on peut prendre un établissement non pris", peutPrendre("non_pris"), true);
verifier("on ne peut pas prendre un établissement à soi", peutPrendre("a_moi"), false);
verifier("on ne peut pas prendre un établissement pris par un autre", peutPrendre("pris_par_autre"), false);
verifier("on peut libérer un établissement à soi", peutLiberer("a_moi"), true);
verifier("on peut libérer un établissement pris par un autre (déblocage)", peutLiberer("pris_par_autre"), true);
verifier("on ne peut pas libérer un établissement non pris", peutLiberer("non_pris"), false);
verifier("libellé de l'état à moi", libelleEtatEtablissement("a_moi"), { texte: "À moi", ton: "succes" });
verifier("libellé de l'état non pris", libelleEtatEtablissement("non_pris"), { texte: "Non pris", ton: "neutre" });

// --- Qui peut affecter qui -------------------------------------------------
verifier("périmètre par défaut", PERIMETRE_AFFECTATION_PAR_DEFAUT, "membre_equipe");
verifier("périmètre équipe : toute l'équipe", operateursAffectables("membre_equipe", OPERATEURS, MOI).length, 2);
verifier("périmètre équipe : les opérateurs affectables", operateursAffectables("membre_equipe", OPERATEURS, MOI).map((o) => o.utilisateurId), [MOI, AUTRE]);
verifier("périmètre personnel : soi seul", operateursAffectables("soi_meme_uniquement", OPERATEURS, MOI).map((o) => o.utilisateurId), [MOI]);
verifier("périmètre personnel : personne d'autre", operateursAffectables("soi_meme_uniquement", OPERATEURS, AUTRE).map((o) => o.utilisateurId), [AUTRE]);
verifier("effectif par défaut documenté", NB_OPERATEURS_PAR_DEFAUT, 4);
verifier("rôles de l'équipe", [...ROLES_EQUIPE], ["support", "super_admin"]);
verifier("un support est de l'équipe", estMembreEquipe("support"), true);
verifier("un super administrateur est de l'équipe", estMembreEquipe("super_admin"), true);
verifier("un opérateur (rôle opérations) n'est pas de l'équipe d'exploitation", estMembreEquipe("operations"), false);
verifier("un rôle inconnu n'est pas de l'équipe", estMembreEquipe("inconnu"), false);
verifier("libellé du rôle", libelleRoleOperateur("super_admin"), "Super administrateur");
verifier("libellé d'un rôle inconnu", libelleRoleOperateur("inconnu"), "inconnu");

// --- Tri et comptage --------------------------------------------------------
const COMMANDES = [commande("a", 3), commande("b", 25), commande("c", 12)];
verifier("tri par urgence : la plus ancienne d'abord", trierParUrgence(COMMANDES, MAINTENANT).map((c) => c.id), ["b", "c", "a"]);
verifier("tri par urgence : la liste d'origine n'est pas modifiée", COMMANDES.map((c) => c.id), ["a", "b", "c"]);
verifier("commandes non reprises", commandesNonReprises(COMMANDES, MAINTENANT, 10).map((c) => c.id), ["b", "c"]);
verifier("nombre de commandes non reprises", compterNonReprises(COMMANDES, MAINTENANT, 10), 2);
verifier("nombre de commandes non reprises, délai long", compterNonReprises(COMMANDES, MAINTENANT, 60), 0);
verifier("ancienneté lisible", libelleAttente(ilYA(12), MAINTENANT), "il y a 12 min");
verifier("ancienneté lisible, date absente", libelleAttente(null, MAINTENANT), "à l'instant");

// --- Messages de refus ------------------------------------------------------
verifier("refus connu, établissement déjà pris", messageErreurAffectation("Cet etablissement est deja tenu par un autre operateur"), "Cet établissement est déjà tenu par un autre opérateur.");
verifier("refus connu avec contexte Postgres", messageErreurAffectation("CONTEXT: SQL statement \"SELECT 1\"\nPL/pgSQL function fn_quarts_prendre(...) line 3 at RAISE\nCet etablissement est deja tenu par un autre operateur"), "Cet établissement est déjà tenu par un autre opérateur.");
verifier("refus connu, établissement introuvable", messageErreurAffectation("Etablissement introuvable"), "Établissement introuvable.");
verifier("refus inconnu : message générique", messageErreurAffectation("pg_bug: something exploded"), "L'opération n'a pas pu aboutir. Rechargez la page et réessayez.");
verifier("refus vide : message générique", messageErreurAffectation(""), "L'opération n'a pas pu aboutir. Rechargez la page et réessayez.");

// --- Ce qui reste hors de l'écran ------------------------------------------
verifier("prendre un établissement reste dans l'écran", ACTIONS_QUART.affecterEtablissement, true);
verifier("affecter à un membre de l'équipe reste dans l'écran", ACTIONS_QUART.affecterAUnMembre, true);
verifier("relancer une commande reste dans l'écran", ACTIONS_QUART.relancerCommande, true);
verifier("le transfert d'une commande en cours reste hors de l'écran", ACTIONS_QUART.transfertCommandeEnCoursHorsEcran, true);
verifier("la suppression d'une trace reste hors de l'écran", ACTIONS_QUART.suppressionTraceHorsEcran, true);

console.log(ko === 0 ? `OK    quarts : ${total} vérifications` : `ECHEC quarts : ${ko} échec(s) sur ${total} vérifications`);
if (ko > 0) process.exit(1);
