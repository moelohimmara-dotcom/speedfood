import { MOTIF_MAX, MOTIF_MIN, validerConfirmation } from "../../src/lib/console/confirmation";
import { DUREE_MS, MAX_NOTIFICATIONS, ajouterNotification, retirerNotification, type Notification } from "../../src/lib/console/notifications";

import { filtrerEntrees, normaliser, type EntreeRecherche } from "../../src/lib/console/recherche";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Confirmation : niveau simple
verifier("simple : toujours valide", validerConfirmation("simple", ""), { ok: true });

// Confirmation : motif
verifier("motif : vide refusé", validerConfirmation("motif", "   ").ok, false);
verifier("motif : trop court refusé", validerConfirmation("motif", "abc").ok, false);
verifier("motif : message d'erreur mentionne le minimum", (validerConfirmation("motif", "abc") as { erreur: string }).erreur.includes(String(MOTIF_MIN)), true);
verifier("motif : valide, espaces normalisés", validerConfirmation("motif", "  client   injoignable  "), { ok: true, motif: "client injoignable" });
verifier("motif : trop long refusé", validerConfirmation("motif", "a".repeat(MOTIF_MAX + 1)).ok, false);
verifier("motif : longueur maximale acceptée", validerConfirmation("motif", "a".repeat(MOTIF_MAX)).ok, true);

// Confirmation : saisie d'une phrase
verifier("saisie : phrase exacte", validerConfirmation("saisie", "SUPPRIMER", "SUPPRIMER"), { ok: true });
verifier("saisie : casse et espaces tolérés", validerConfirmation("saisie", "  supprimer ", "SUPPRIMER"), { ok: true });
verifier("saisie : phrase fausse refusée", validerConfirmation("saisie", "SUPPRIME", "SUPPRIMER").ok, false);
verifier("saisie : vide refusé", validerConfirmation("saisie", "", "SUPPRIMER").ok, false);
verifier("saisie : sans phrase définie, refusée (jamais confirmée par défaut)", validerConfirmation("saisie", "x").ok, false);
verifier("saisie : phrase de plusieurs mots", validerConfirmation("saisie", "tout   rétablir", "Tout rétablir"), { ok: true });

// Notifications
let liste: Notification[] = [];
liste = ajouterNotification(liste, { ton: "succes", message: "Enregistré." }, 1);
verifier("notification : ajoutée", liste, [{ id: 1, ton: "succes", message: "Enregistré." }]);
verifier("notification : message vide ignoré", ajouterNotification(liste, { ton: "info", message: "   " }, 2), liste);
verifier("notification : doublon identique non répété", ajouterNotification(liste, { ton: "succes", message: "Enregistré." }, 2), liste);
verifier("notification : même message, ton différent accepté", ajouterNotification(liste, { ton: "erreur", message: "Enregistré." }, 2).length, 2);
for (let i = 2; i <= 6; i++) liste = ajouterNotification(liste, { ton: "info", message: `Message ${i}` }, i);
verifier("notification : au plus " + MAX_NOTIFICATIONS + ", les plus récentes gardées", liste.map((n) => n.id), [4, 5, 6]);
verifier("notification : retrait par identifiant", retirerNotification(liste, 5).map((n) => n.id), [4, 6]);
verifier("notification : message tronqué à 300 caractères", ajouterNotification([], { ton: "info", message: "x".repeat(500) }, 1)[0].message.length, 300);
verifier("notification : une erreur reste plus longtemps qu'un succès", DUREE_MS.erreur > DUREE_MS.succes, true);


// Recherche rapide
const ENTREES: EntreeRecherche[] = [
  { libelle: "Restaurants", famille: "Catalogue", href: "/system/catalogue/restaurants" },
  { libelle: "Taxonomie", famille: "Catalogue", href: "/system/catalogue/taxonomie" },
  { libelle: "Liste d'attente", famille: "Catalogue", href: "/system/catalogue/liste-attente" },
  { libelle: "Pages", famille: "Contenu", href: "/system/contenu/pages" },
  { libelle: "Bannières", famille: "Contenu", href: "/system/contenu/bannieres" },
  { libelle: "Rôles système", famille: "Accès", href: "/system/acces/roles" },
];
const libelles = (r: EntreeRecherche[]) => r.map((e) => e.libelle);
verifier("recherche : accents et casse ignorés", normaliser("  BANNIÈRES  "), "bannieres");
verifier("recherche : apostrophe typographique", normaliser("Liste d’attente"), "liste d attente");
verifier("recherche : sans accent trouve avec accent", libelles(filtrerEntrees(ENTREES, "bannieres")), ["Bannières"]);
verifier("recherche : début de libellé, puis libellé contenant, puis famille", libelles(filtrerEntrees(ENTREES, "ta")), ["Taxonomie", "Restaurants", "Liste d'attente"]);
verifier("recherche : par famille", libelles(filtrerEntrees(ENTREES, "contenu")), ["Pages", "Bannières"]);
verifier("recherche : plusieurs mots (libellé + famille)", libelles(filtrerEntrees(ENTREES, "catalogue liste")), ["Liste d'attente"]);
verifier("recherche : mot interne du libellé", libelles(filtrerEntrees(ENTREES, "attente")), ["Liste d'attente"]);
verifier("recherche : rien ne correspond", filtrerEntrees(ENTREES, "zzz"), []);
verifier("recherche : requête vide = premières entrées dans l'ordre", libelles(filtrerEntrees(ENTREES, "", 3)), ["Restaurants", "Taxonomie", "Liste d'attente"]);
verifier("recherche : limite respectée", filtrerEntrees(ENTREES, "e", 2).length, 2);

if (ko > 0) process.exit(1);
