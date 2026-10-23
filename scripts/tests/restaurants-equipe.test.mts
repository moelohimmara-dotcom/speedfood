import {
  ACTIONS_EQUIPE_RESTAURANTS,
  modeVenteEquipe,
  validerProfilSimpleEquipe,
  visibleParLesClients,
} from "../../src/lib/system-admin/restaurants-equipe-regles";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC restaurants équipe : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    restaurants équipe : ${nom}`);
  }
}

// Mode de vente : une valeur inconnue ne doit jamais être interprétée comme « speedfood ».
verifier("mode de vente speedfood", modeVenteEquipe("speedfood"), "speedfood");
verifier("mode de vente autonome", modeVenteEquipe("autonome"), "autonome");
verifier("mode de vente inconnu = autonome", modeVenteEquipe("autre"), "autonome");
verifier("mode de vente absent = autonome", modeVenteEquipe(null), "autonome");
verifier("mode de vente vide = autonome", modeVenteEquipe(undefined), "autonome");

// Visibilité par les clients : publié ET non suspendu.
verifier("publié et non suspendu = visible", visibleParLesClients(true, null), true);
verifier("publié mais suspendu = invisible", visibleParLesClients(true, "2026-10-23T08:00:00Z"), false);
verifier("non publié = invisible", visibleParLesClients(false, null), false);
verifier("non publié et suspendu = invisible", visibleParLesClients(false, "2026-10-23T08:00:00Z"), false);

// Modification simple : les horaires sont obligatoires.
verifier("horaires vides = refus", validerProfilSimpleEquipe("   ", "+224612345678"), {
  ok: false,
  message: "Renseignez les horaires avant d'enregistrer.",
});
verifier("horaires trop longs = refus", validerProfilSimpleEquipe("a".repeat(501), ""), {
  ok: false,
  message: "Les horaires ne peuvent pas dépasser 500 caractères.",
});
verifier("horaires à 500 = accepté", validerProfilSimpleEquipe("a".repeat(500), "").ok, true);

// Numéro à joindre : vide = retrait ; sinon numéro guinéen valide.
verifier("numéro vide = retrait", validerProfilSimpleEquipe("Lun-Sam 9h-21h", "  "), {
  ok: true,
  horaires: "Lun-Sam 9h-21h",
  telephone: null,
});
verifier("numéro national valide", validerProfilSimpleEquipe("Lun-Sam 9h-21h", "612345678"), {
  ok: true,
  horaires: "Lun-Sam 9h-21h",
  telephone: "+224612345678",
});
verifier("numéro avec indicatif", validerProfilSimpleEquipe("Lun-Sam 9h-21h", "+224 61 23 45 678"), {
  ok: true,
  horaires: "Lun-Sam 9h-21h",
  telephone: "+224612345678",
});
verifier("numéro à 10 chiffres = refus", validerProfilSimpleEquipe("Lun-Sam 9h-21h", "6123456789"), {
  ok: false,
  message: "Ce numéro n'est pas un numéro guinéen valide.",
});
verifier("numéro invalide = refus", validerProfilSimpleEquipe("Lun-Sam 9h-21h", "12345"), {
  ok: false,
  message: "Ce numéro n'est pas un numéro guinéen valide.",
});
verifier("numéro non guinéen = refus", validerProfilSimpleEquipe("Lun-Sam 9h-21h", "+33612345678"), {
  ok: false,
  message: "Ce numéro n'est pas un numéro guinéen valide.",
});

// Les horaires sont nettoyés (espaces de bord retirés) mais le texte est conservé tel quel.
const nettoyes = validerProfilSimpleEquipe("  Lun-Sam 9h-21h  ", "");
verifier("horaires nettoyés", nettoyes.ok ? nettoyes.horaires : null, "Lun-Sam 9h-21h");

// La publication reste sur le site : l'application ne propose que la modification simple.
verifier("publication sur le site seulement", ACTIONS_EQUIPE_RESTAURANTS.publicationSurLeSiteSeulement, true);
verifier("modification simple autorisée", ACTIONS_EQUIPE_RESTAURANTS.modifierProfilSimple, true);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
