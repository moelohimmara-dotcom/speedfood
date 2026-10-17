import {
  CYCLES_LIVREUR,
  LIGNES_MAX_GROUPE,
  analyserListeLivreurs,
  decouperLigne,
  expirationLien,
  genererJetonActivation,
  hacherJetonActivation,
  jetonActivationPlausible,
  lienWhatsAppVers,
  messageWhatsAppActivation,
  normaliserVehicule,
  peutQuitterLeTravail,
  peutTravailler,
  transitionCycleAutorisee,
  validerDossier,
  validerFicheLivreur,
  type CycleLivreur,
} from "../../src/lib/livraison/livreurs-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- cycle
const cycles = [...CYCLES_LIVREUR] as CycleLivreur[];
verifier("six cycles", cycles.length, 6);
verifier("parcours nominal : créé > invité > candidat > actif", [transitionCycleAutorisee("cree", "invite"), transitionCycleAutorisee("invite", "candidat"), transitionCycleAutorisee("candidat", "actif")], [true, true, true]);
verifier("sans approbation : invité > actif", transitionCycleAutorisee("invite", "actif"), true);
verifier("un nouveau lien : invité > invité", transitionCycleAutorisee("invite", "invite"), true);
verifier("actif <> suspendu", [transitionCycleAutorisee("actif", "suspendu"), transitionCycleAutorisee("suspendu", "actif")], [true, true]);
verifier("un candidat ne se suspend pas (on le refuse : archive)", [transitionCycleAutorisee("candidat", "suspendu"), transitionCycleAutorisee("candidat", "archive")], [false, true]);
verifier("on ne passe pas de créé à actif sans activation", transitionCycleAutorisee("cree", "actif"), false);
verifier("l'archive est définitive", cycles.every((v) => !transitionCycleAutorisee("archive", v)), true);
verifier("seul un livreur actif travaille", cycles.filter(peutTravailler), ["actif"]);
verifier("on ne quitte pas le travail en course", [peutQuitterLeTravail("en_course"), peutQuitterLeTravail("disponible"), peutQuitterLeTravail("hors_ligne")], [false, true, true]);

// --- véhicules
verifier("véhicules : synonymes et accents", ["Moto", "vélo", "VELO", "à pied", "A PIED", "Voiture", "scooter", ""].map(normaliserVehicule), ["moto", "velo", "velo", "pied", "pied", "voiture", "moto", "moto"]);
verifier("véhicule inconnu", normaliserVehicule("hélicoptère"), null);

// --- fiche
verifier("fiche valide", validerFicheLivreur({ nom: "  Mamadou   Diallo ", telephone: "622 12 34 56", vehicule: "moto", email: "Mamadou@Exemple.com " }), { ok: true, valeur: { nom: "Mamadou Diallo", telephone: "+224622123456", vehicule: "moto", email: "mamadou@exemple.com" } });
verifier("fiche : e-mail facultatif", (validerFicheLivreur({ nom: "Aïssatou Bah", telephone: "+224 666 00 11 22", vehicule: "" }) as { ok: true; valeur: { email: unknown } }).valeur.email, null);
verifier("fiche : nom trop court", validerFicheLivreur({ nom: "A", telephone: "622123456", vehicule: "moto" }).ok, false);
verifier("fiche : téléphone invalide", validerFicheLivreur({ nom: "Alpha Barry", telephone: "12345", vehicule: "moto" }).ok, false);
verifier("fiche : véhicule inconnu", validerFicheLivreur({ nom: "Alpha Barry", telephone: "622123456", vehicule: "fusée" }).ok, false);
verifier("fiche : e-mail invalide", validerFicheLivreur({ nom: "Alpha Barry", telephone: "622123456", vehicule: "moto", email: "pas-un-email" }).ok, false);

// --- découpage et liste
verifier("découpage : guillemets et séparateur dans un champ", decouperLigne('"Diallo; Mamadou";622123456;moto', ";"), ["Diallo; Mamadou", "622123456", "moto"]);
verifier("découpage : guillemet doublé", decouperLigne('"Il a dit ""oui""";1', ";"), ['Il a dit "oui"', "1"]);

const liste = analyserListeLivreurs(`Nom;Téléphone;Véhicule;Email
Mamadou Diallo;622 12 34 56;moto;mamadou@exemple.com
Fatoumata Camara;+224 666 11 22 33;vélo
Ibrahima Sow;623 45 67 89
Mamadou Bis;622123456;moto
Sékou;12345;moto
Alpha Barry;655 00 11 22;fusée
`);
verifier("liste : l'en-tête est ignoré", liste.lignes[0].numero, 2);
verifier("liste : 3 valides, 3 refusées", [liste.valides, liste.invalides], [3, 3]);
verifier("liste : doublon dans la liste, avec le numéro de la première ligne", liste.lignes[3].erreur, "Doublon dans la liste : même téléphone qu'à la ligne 2.");
verifier("liste : téléphone invalide refusé", liste.lignes[4].erreur?.startsWith("Téléphone"), true);
verifier("liste : véhicule inconnu refusé", liste.lignes[5].erreur?.startsWith("Véhicule inconnu"), true);
verifier("liste : véhicule vide = moto", liste.lignes[2].fiche?.vehicule, "moto");

const tab = analyserListeLivreurs("Alpha Barry\t622000001\tmoto\nBintou Keita\t622000002\tvelo");
verifier("liste copiée depuis un tableur (tabulations)", [tab.valides, tab.invalides], [2, 0]);
const virgules = analyserListeLivreurs("Alpha Barry,622000001,moto");
verifier("liste séparée par des virgules", virgules.valides, 1);
verifier("liste vide", analyserListeLivreurs("  \n\n"), { lignes: [], valides: 0, invalides: 0, tropDeLignes: false });
verifier("doublon avec une fiche existante", analyserListeLivreurs("Alpha Barry;622000001;moto", new Set(["+224622000001"])).lignes[0].erreur, "Ce numéro a déjà une fiche livreur.");
const grosse = analyserListeLivreurs(Array.from({ length: LIGNES_MAX_GROUPE + 5 }, (_, i) => `Livreur ${i + 1};6${String(10000000 + i).slice(1)};moto`).join("\n"));
verifier("liste trop longue : coupée à 100, signalée", [grosse.lignes.length, grosse.tropDeLignes], [LIGNES_MAX_GROUPE, true]);

// --- lien d'activation
const jeton = genererJetonActivation();
verifier("jeton : 32 caractères sûrs", jetonActivationPlausible(jeton), true);
verifier("jeton : deux tirages différents", jeton !== genererJetonActivation(), true);
verifier("jeton : forme invalide refusée", [jetonActivationPlausible("abc"), jetonActivationPlausible("a".repeat(31) + "+")], [false, false]);
verifier("empreinte : 64 caractères, stable, dépend du jeton", [/^[0-9a-f]{64}$/.test(await hacherJetonActivation(jeton)), (await hacherJetonActivation(jeton)) === (await hacherJetonActivation(jeton)), (await hacherJetonActivation(jeton)) === (await hacherJetonActivation(genererJetonActivation()))], [true, true, false]);
verifier("expiration à 7 jours", expirationLien(new Date("2026-10-17T12:00:00Z"), 7), "2026-10-24T12:00:00.000Z");
const message = messageWhatsAppActivation("Mamadou Diallo", "https://exemple.invalid/livreur/activer?jeton=X", 7);
verifier("message WhatsApp : prénom, lien, validité", [message.includes("Bonjour Mamadou,"), message.includes("jeton=X"), message.includes("7 jours")], [true, true, true]);
verifier("lien WhatsApp vers le numéro", lienWhatsAppVers("+224622123456", "Salut").startsWith("https://wa.me/224622123456?text="), true);

// --- dossier
const aucun = { pieceRequise: false, urgenceRequise: false };
verifier("dossier : rien d'exigé, rien de saisi", validerDossier({}, aucun), { ok: true, dossier: { pieceType: null, pieceNumero: null, urgenceNom: null, urgenceTelephone: null } });
verifier("dossier : pièce exigée mais absente", validerDossier({}, { pieceRequise: true, urgenceRequise: false }).ok, false);
verifier("dossier : pièce exigée et complète", validerDossier({ pieceType: "carte_identite", pieceNumero: " AB 12345 " }, { pieceRequise: true, urgenceRequise: false }), { ok: true, dossier: { pieceType: "carte_identite", pieceNumero: "AB 12345", urgenceNom: null, urgenceTelephone: null } });
verifier("dossier : type de pièce inconnu", validerDossier({ pieceType: "badge", pieceNumero: "12345" }, aucun).ok, false);
verifier("dossier : contact d'urgence exigé", validerDossier({ urgenceNom: "Aïssatou", urgenceTelephone: "622 00 11 22" }, { pieceRequise: false, urgenceRequise: true }), { ok: true, dossier: { pieceType: null, pieceNumero: null, urgenceNom: "Aïssatou", urgenceTelephone: "+224622001122" } });
verifier("dossier : téléphone d'urgence invalide", validerDossier({ urgenceNom: "Aïssatou", urgenceTelephone: "1" }, aucun).ok, false);
verifier("dossier : un champ saisi non exigé doit rester valide", validerDossier({ pieceNumero: "12" }, aucun).ok, false);

if (ko > 0) {
  console.log(`\n${ko} échec(s)`);
  process.exit(1);
}
