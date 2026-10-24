import {
  CANAUX_RAPPEL,
  DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT,
  HEURE_RAPPEL_AVANT_SERVICE_DEFAUT,
  HEURE_SERVICE_DEBUT_DEFAUT,
  LIBELLES_ETAT_MENU,
  SEUIL_FRAICHEUR_HEURES_DEFAUT,
  calculerFraicheurMenu,
  classerEtatMenu,
  compterMenus,
  doitEtreReconfirme,
  evaluerRappel,
  listerEtablissementsAReconfirmer,
  normaliserCanalRappel,
  planifierConfirmationMenu,
  type EtatMenuEtablissement,
} from "../../src/lib/system-admin/menus-confirmation-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC menus confirmation : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    menus confirmation : ${nom}`);
  }
}

const MAINTENANT = new Date("2026-10-24T10:00:00Z");
const HEURES = (nombre: number) => new Date(MAINTENANT.getTime() - nombre * 3_600_000);

function etat(partiel: Partial<EtatMenuEtablissement> = {}): EtatMenuEtablissement {
  return {
    restaurantId: "r1",
    nom: "Le Palmier",
    quartier: "Dixinn",
    plats: 6,
    platsDisponibles: 5,
    platsEpuises: 1,
    platsAConfirmer: 0,
    dernierConfirmationLe: HEURES(1),
    dernierRappelLe: null,
    ...partiel,
  };
}

// --- Valeurs par défaut (un seul endroit à changer) -------------------------------
verifier("seuil de fraîcheur par défaut = 6 h", SEUIL_FRAICHEUR_HEURES_DEFAUT, 6);
verifier("heure de service par défaut = 11 h", HEURE_SERVICE_DEBUT_DEFAUT, 11);
verifier("fenêtre de rappel = 2 h avant le service", HEURE_RAPPEL_AVANT_SERVICE_DEFAUT, 2);
verifier("rappel périmé après 24 h", DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT, 24);

// --- Fraîcheur ---------------------------------------------------------------------
const jamais = calculerFraicheurMenu(null, 6, MAINTENANT);
verifier("jamais confirmé : drapeau", jamais.jamaisConfirme, true);
verifier("jamais confirmé : périmé", jamais.perime, true);
verifier("jamais confirmé : texte", jamais.libelle, "Jamais confirmé");

const frais = calculerFraicheurMenu(HEURES(2), 6, MAINTENANT);
verifier("confirmation fraîche : âge en heures", frais.ageHeures, 2);
verifier("confirmation fraîche : pas périmée", frais.perime, false);
verifier("confirmation fraîche : texte", frais.libelle, "Confirmé il y a 2 h");

const pile = calculerFraicheurMenu(HEURES(9), 6, MAINTENANT);
verifier("confirmation périmée au-delà du seuil", pile.perime, true);
verifier("confirmation périmée : texte", pile.libelle, "Confirmé il y a 9 h — confirmation périmée");

const vieux = calculerFraicheurMenu(HEURES(50), 6, MAINTENANT);
verifier("confirmation de plus d'un jour : texte", vieux.libelle, "Confirmé il y a 2 jours — confirmation périmée");

// --- Classement du menu ------------------------------------------------------------
verifier("jamais confirmé", classerEtatMenu(etat({ dernierConfirmationLe: null }), 6, MAINTENANT), "jamais_confirme");
verifier("un plat à reconfirmer", classerEtatMenu(etat({ platsAConfirmer: 1 }), 6, MAINTENANT), "perime");
verifier("menu à jour", classerEtatMenu(etat(), 6, MAINTENANT), "confirme");
verifier(
  "confirmation ancienne avec tous les plats frais",
  classerEtatMenu(etat({ dernierConfirmationLe: HEURES(9) }), 6, MAINTENANT),
  "perime"
);
verifier("établissement sans plat", classerEtatMenu(etat({ plats: 0, platsDisponibles: 0, platsEpuises: 0 }), 6, MAINTENANT), "confirme");
verifier("établissement fermé mais menu frais", classerEtatMenu(etat(), 6, MAINTENANT), "confirme");

verifier("pastille « Jamais confirmé »", LIBELLES_ETAT_MENU.jamais_confirme.texte, "Jamais confirmé");
verifier("pastille « À reconfirmer »", LIBELLES_ETAT_MENU.perime.texte, "À reconfirmer");

// --- Liste des établissements à reconfirmer -------------------------------------------
const jamais2 = etat({ restaurantId: "r2", nom: "Al Baik", dernierConfirmationLe: null });
const perime = etat({ restaurantId: "r3", nom: "Zoko", platsAConfirmer: 3, dernierConfirmationLe: HEURES(9) });
const frais2 = etat({ restaurantId: "r4", nom: "Mango" });
const liste = listerEtablissementsAReconfirmer([frais2, perime, jamais2], 6, MAINTENANT);
verifier("la liste ne garde que les menus à reconfirmer", liste.map((e) => e.restaurantId), ["r2", "r3"]);
verifier("jamais confirmé passe devant", liste[0].restaurantId, "r2");
verifier("un établissement à jour n'est pas listé", doitEtreReconfirme(frais2, 6, MAINTENANT), false);
verifier("un établissement jamais confirmé est listé", doitEtreReconfirme(jamais2, 6, MAINTENANT), true);

// --- Compteurs ----------------------------------------------------------------------
const compteurs = compterMenus([jamais2, perime, frais2], 6, MAINTENANT);
verifier("compteur : établissements", compteurs.etablissements, 3);
verifier("compteur : à reconfirmer", compteurs.aConfirmer, 2);
verifier("compteur : plats à reconfirmer", compteurs.platsAConfirmer, 3);
verifier("compteur : confirmés", compteurs.confirmes, 1);

// --- Fenêtre de rappel ----------------------------------------------------------------
// Heures construites en heure locale : la fenêtre de rappel dépend de l'heure affichée par
// l'écran, pas du fuseau du serveur — le test doit passer partout.
const options = {
  heureService: HEURE_SERVICE_DEBUT_DEFAUT,
  heureRappelAvant: HEURE_RAPPEL_AVANT_SERVICE_DEFAUT,
  dureeRappelHeures: DUREE_RAPPEL_OBSOLETE_HEURES_DEFAUT,
};
const avantService = evaluerRappel(null, new Date(2026, 9, 24, 8, 30), options);
verifier("avant la fenêtre de rappel : pas dû", avantService.du, false);
verifier("avant la fenêtre de rappel : aucun rappel", avantService.libelle, "Aucun rappel envoyé");

const dansLaFenetre = evaluerRappel(null, new Date(2026, 9, 24, 9, 30), options);
verifier("dans la fenêtre de rappel : dû", dansLaFenetre.du, true);

const pendantLeService = evaluerRappel(null, new Date(2026, 9, 24, 11, 30), options);
verifier("pendant le service : le rappel reste dû", pendantLeService.du, true);

const rappelRecent = evaluerRappel(new Date(2026, 9, 24, 8, 0), new Date(2026, 9, 24, 9, 30), options);
verifier("rappel de 1 h 30 : encore frais", rappelRecent.rappelRecent, true);
verifier("rappel de 1 h 30 : pas périmé", rappelRecent.rappelPerime, false);

const rappelVieux = evaluerRappel(new Date(2026, 9, 22, 9, 30), new Date(2026, 9, 24, 9, 30), options);
verifier("rappel de 2 jours : périmé", rappelVieux.rappelPerime, true);
verifier("rappel de 2 jours : texte", rappelVieux.libelle, "Rappel ancien (il y a 2 jours)");

// --- Confirmation « en un geste » ---------------------------------------------------------
verifier("confirmation : établissement avec des plats", planifierConfirmationMenu({ plats: 6, platsAConfirmer: 2 }), {
  ok: true,
  plats: 6,
});
verifier("confirmation : établissement sans plat = refus", planifierConfirmationMenu({ plats: 0, platsAConfirmer: 0 }), {
  ok: false,
  message: "Cet établissement n'a aucun plat actif : il n'y a rien à confirmer.",
});

// --- Canal de rappel -------------------------------------------------------------------------
verifier("canaux proposés", CANAUX_RAPPEL, ["interne", "appel"]);
verifier("canal « appel »", normaliserCanalRappel("appel"), "appel");
verifier("canal inconnu = notification interne", normaliserCanalRappel("sms"), "interne");
verifier("canal absent = notification interne", normaliserCanalRappel(null), "interne");

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
