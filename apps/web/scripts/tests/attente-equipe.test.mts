import {
  ACTIONS_EQUIPE_ATTENTE,
  aTraiterPartenariat,
  formePartenariatValide,
  libelleFormePartenariat,
  libelleNiveauAttente,
  libelleStatutPartenariat,
  niveauAttenteValide,
  nonPrevenues,
  statutsProposesPartenariat,
  statutPartenariatValide,
  zoneAMarquerPrevenue,
} from "../../src/lib/system-admin/attente-equipe-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC attente équipe : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    attente équipe : ${nom}`);
  }
}

// Statuts proposés : tous sauf l'actuel, dans l'ordre du parcours.
verifier("statuts proposés depuis nouvelle", statutsProposesPartenariat("nouvelle"), ["en_cours", "traitee", "classee"]);
verifier("statuts proposés depuis en cours", statutsProposesPartenariat("en_cours"), ["nouvelle", "traitee", "classee"]);
verifier("statuts proposés depuis traitée", statutsProposesPartenariat("traitee"), ["nouvelle", "en_cours", "classee"]);
verifier("statuts proposés : jamais l'actuel", statutsProposesPartenariat("classee").includes("classee"), false);

// Une demande « nouvelle » n'a pas encore été lue : elle passe en tête.
verifier("nouvelle = à traiter", aTraiterPartenariat("nouvelle"), true);
verifier("en cours = pas à traiter", aTraiterPartenariat("en_cours"), false);
verifier("traitée = pas à traiter", aTraiterPartenariat("traitee"), false);

// Libellés lisibles (jamais le code brut renvoyé à l'écran).
verifier("libellé statut nouvelle", libelleStatutPartenariat("nouvelle"), "Nouvelle");
verifier("libellé statut en cours", libelleStatutPartenariat("en_cours"), "En cours");
verifier("libellé statut traitee", libelleStatutPartenariat("traitee"), "Traitée");
verifier("libellé statut classee", libelleStatutPartenariat("classee"), "Classée");
verifier("libellé forme investir", libelleFormePartenariat("investir"), "Investir");
verifier("libellé forme soutenir", libelleFormePartenariat("soutenir"), "Soutenir la communauté");
verifier("libellé niveau quartier", libelleNiveauAttente("quartier"), "Quartier");
verifier("libellé niveau region", libelleNiveauAttente("region"), "Région");

// Revalidation côté serveur : une valeur hors liste est refusée, jamais devinée.
verifier("statut valide", statutPartenariatValide("en_cours"), "en_cours");
verifier("statut inconnu = refus", statutPartenariatValide("supprime"), null);
verifier("statut vide = refus", statutPartenariatValide(""), null);
verifier("statut absent = refus", statutPartenariatValide(null), null);
verifier("forme valide", formePartenariatValide("moyens"), "moyens");
verifier("forme inconnue = refus", formePartenariatValide("autre"), null);

// Niveaux de zone : ils choisissent la colonne de la base, donc un niveau inconnu est refusé.
verifier("niveau region valide", niveauAttenteValide("region"), "region");
verifier("niveau prefecture valide", niveauAttenteValide("prefecture"), "prefecture");
verifier("niveau commune valide", niveauAttenteValide("commune"), "commune");
verifier("niveau quartier valide", niveauAttenteValide("quartier"), "quartier");
verifier("niveau inconnu = refus", niveauAttenteValide("pays"), null);
verifier("niveau vide = refus", niveauAttenteValide(""), null);

// Zones : combien de personnes restent à prévenir, et la zone peut-elle encore être marquée.
verifier("non prévenues", nonPrevenues(10, 4), 6);
verifier("non prévenues : jamais négatif", nonPrevenues(3, 5), 0);
verifier("zone à marquer", zoneAMarquerPrevenue(10, 4), true);
verifier("zone déjà prévenue = plus rien à marquer", zoneAMarquerPrevenue(4, 4), false);
verifier("zone vide = rien à marquer", zoneAMarquerPrevenue(0, 0), false);

// Ce qui reste sur le site : l'irréversible et les données personnelles.
verifier("suivi des partenariats dans l'application", ACTIONS_EQUIPE_ATTENTE.lireEtSuivrePartenariats, true);
verifier("marquage de zone dans l'application", ACTIONS_EQUIPE_ATTENTE.marquerZonePrevenue, true);
verifier("suppression d'une demande sur le site seulement", ACTIONS_EQUIPE_ATTENTE.suppressionPartenariatSurLeSiteSeulement, true);
verifier("suppression des contacts sur le site seulement", ACTIONS_EQUIPE_ATTENTE.suppressionContactsSurLeSiteSeulement, true);
verifier("export des contacts sur le site seulement", ACTIONS_EQUIPE_ATTENTE.exportContactsSurLeSiteSeulement, true);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
