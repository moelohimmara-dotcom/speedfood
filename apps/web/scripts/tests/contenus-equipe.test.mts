import {
  ACTIONS_EQUIPE_CONTENUS,
  LIBELLES_STATUT_BANNERE,
  PARAMETRES_EQUIPE,
  filtrerBannieresEquipe,
  fusionnerMisesAJour,
  libelleEtatFonctionnalite,
  libelleGroupeFonctionnalite,
  libelleStatutBanniereEquipe,
  statutBanniereEquipeValide,
  type BanniereEquipeFiltrable,
  type FonctionnaliteEtat,
  type MiseAJourCatalogue,
} from "../../src/lib/system-admin/contenus-equipe-regles";
import { MISES_A_JOUR } from "../../src/lib/system-admin/misesAJourCatalogue";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC contenus équipe : ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    contenus équipe : ${nom}`);
  }
}

/** Bannière d'essai : le type de base ne porte que le statut et l'image ; le titre sert aux vérifications. */
interface BanniereEssai extends BanniereEquipeFiltrable {
  titre: string;
}

const banniere = (titre: string, statut: string, imageUrl: string | null = null): BanniereEssai => ({
  titre,
  statut,
  imageUrl,
});

const bannieres = [
  banniere("Rentrée des prix", "publie", "https://exemple.gn/a.png"),
  banniere("Livraison offerte", "publie"),
  banniere("Préparé pour l'hiver", "brouillon", "https://exemple.gn/b.png"),
];

// Filtre de statut : une valeur inconnue retombe sur « Toutes », jamais sur une liste vide surprise.
verifier("filtre tous", statutBanniereEquipeValide("tous"), "tous");
verifier("filtre publie", statutBanniereEquipeValide("publie"), "publie");
verifier("filtre brouillon", statutBanniereEquipeValide("brouillon"), "brouillon");
verifier("filtre inconnu = tous", statutBanniereEquipeValide("nimporte"), "tous");
verifier("filtre vide = tous", statutBanniereEquipeValide(""), "tous");
verifier("filtre absent = tous", statutBanniereEquipeValide(null), "tous");
verifier("filtre undefined = tous", statutBanniereEquipeValide(undefined), "tous");
verifier("libellé filtre toutes", LIBELLES_STATUT_BANNERE.tous, "Toutes");
verifier("libellé filtre publiées", LIBELLES_STATUT_BANNERE.publie, "Publiées");
verifier("libellé filtre brouillons", LIBELLES_STATUT_BANNERE.brouillon, "Brouillons");

// Libellé d'une bannière (pas d'un filtre).
verifier("statut publié", libelleStatutBanniereEquipe("publie"), "Publiée");
verifier("statut brouillon", libelleStatutBanniereEquipe("brouillon"), "Brouillon");
verifier("statut inconnu affiché tel quel", libelleStatutBanniereEquipe("autre"), "autre");

// Filtrage des bannières.
verifier("toutes les bannières", filtrerBannieresEquipe(bannieres, {}).length, 3);
verifier("bannières publiées", filtrerBannieresEquipe(bannieres, { statut: "publie" }).map((b) => b.titre), ["Rentrée des prix", "Livraison offerte"]);
verifier("bannières brouillons", filtrerBannieresEquipe(bannieres, { statut: "brouillon" }).map((b) => b.titre), ["Préparé pour l'hiver"]);
verifier("filtre inconnu = toutes", filtrerBannieresEquipe(bannieres, { statut: "nimporte" }).length, 3);
verifier("médias : avec image seulement", filtrerBannieresEquipe(bannieres, { seulementAvecImage: true }).map((b) => b.titre), ["Rentrée des prix", "Préparé pour l'hiver"]);
verifier("médias + filtre publiés", filtrerBannieresEquipe(bannieres, { statut: "publie", seulementAvecImage: true }).map((b) => b.titre), ["Rentrée des prix"]);
verifier("médias sans image : liste vide", filtrerBannieresEquipe([banniere("Sans image", "publie")], { seulementAvecImage: true }).length, 0);

// Groupes d'interrupteurs et états.
verifier("groupe site public", libelleGroupeFonctionnalite("public"), "Site public");
verifier("groupe commande", libelleGroupeFonctionnalite("commande"), "Commande");
verifier("groupe console restaurant", libelleGroupeFonctionnalite("restaurant"), "Console restaurant");
verifier("groupe inconnu affiché tel quel", libelleGroupeFonctionnalite("autre"), "autre");
verifier("groupe absent", libelleGroupeFonctionnalite(null), "Autres");
verifier("fonctionnalité active", libelleEtatFonctionnalite(true), "Active");
verifier("fonctionnalité coupée", libelleEtatFonctionnalite(false), "Coupée");

// Journal des nouveautés relié aux interrupteurs.
const catalogue: MiseAJourCatalogue[] = [
  { id: "zones", date: "2026-10-14", titre: "Zones desservies", resume: "Résumé des zones.", cle: "zones_livraison", verification: "Accueil." },
  { id: "argent", date: "2026-10-04", titre: "Paiement", resume: "Résumé du paiement.", sansInterrupteur: "Parcours de l'argent.", verification: "Suivi." },
  { id: "fantome", date: "2026-10-01", titre: "Interrupteur absent", resume: "Résumé.", cle: "cle_inconnue", verification: "Vérif." },
];
const fonctionnalites: FonctionnaliteEtat[] = [
  { cle: "zones_livraison", libelle: "Zones", description: "Zones par restaurant", groupe: "public", active: true, miseAJourLe: "2026-10-14T10:00:00Z" },
  { cle: "animations", libelle: "Animations", description: "Animations du site", groupe: "public", active: false, miseAJourLe: "2026-10-05T10:00:00Z" },
];
const fusion = fusionnerMisesAJour(catalogue, fonctionnalites);

verifier("journal : nombre d'entrées", fusion.length, 3);
verifier("journal : interrupteur trouvé", fusion[0].cle, "zones_livraison");
verifier("journal : état de l'interrupteur", fusion[0].active, true);
verifier("journal : groupe de l'interrupteur", fusion[0].groupe, "public");
verifier("journal : sans raison quand il y a un interrupteur", fusion[0].raisonSansInterrupteur, null);
verifier("journal : sans interrupteur = toujours active", fusion[1].active, null);
verifier("journal : raison du site conservée", fusion[1].raisonSansInterrupteur, "Parcours de l'argent.");
verifier("journal : interrupteur annoncé mais absent de la base", fusion[2].active, null);
verifier("journal : raison par défaut si le site n'en donne pas", fusion[2].raisonSansInterrupteur, "Cette fonctionnalité n'est pas encore enregistrée dans la base.");
verifier("journal : titre conservé", fusion[0].titre, "Zones desservies");
verifier("journal : date conservée", fusion[1].date, "2026-10-04");
verifier("journal : hors catalogue ignoré", fusionnerMisesAJour([], fonctionnalites).length, 0);

// Le catalogue du journal : des identifiants uniques. L'application affiche le journal et les interrupteurs dans la même
// liste : une clé répétée fait planter l'écran, et un identifiant de journal qui croiserait une clé d'interrupteur est
// précisément le cas qui a fait tomber l'application.
verifier("identifiants du catalogue uniques", new Set(MISES_A_JOUR.map((m) => m.id)).size, MISES_A_JOUR.length);
verifier("identifiants du catalogue non vides", MISES_A_JOUR.every((m) => m.id.trim().length > 0), true);
verifier("catalogue non vide", MISES_A_JOUR.length > 0, true);

// Réglages affichés : des clés uniques, des libellés lisibles.
verifier("nombre de réglages affichés", PARAMETRES_EQUIPE.length, 14);
verifier("clés de réglages uniques", new Set(PARAMETRES_EQUIPE.map((p) => p.cle)).size, PARAMETRES_EQUIPE.length);
verifier("tous les libellés sont remplis", PARAMETRES_EQUIPE.every((p) => p.libelle.trim().length > 0), true);
verifier("toutes les natures sont connues", PARAMETRES_EQUIPE.every((p) => ["duree", "montant", "nombre", "texte", "contact", "interrupteur"].includes(p.nature)), true);
verifier("le plafond de prix est un montant", PARAMETRES_EQUIPE.find((p) => p.cle === "prixPlatMaxGnf")?.nature, "montant");

// Ce qui reste sur le site : l'effet public et les rôles réservés.
verifier("lecture des bannières dans l'application", ACTIONS_EQUIPE_CONTENUS.lireBannieres, true);
verifier("lecture des médias dans l'application", ACTIONS_EQUIPE_CONTENUS.lireMedias, true);
verifier("création d'une bannière sur le site seulement", ACTIONS_EQUIPE_CONTENUS.creationBanniereSurLeSiteSeulement, true);
verifier("publication d'une bannière sur le site seulement", ACTIONS_EQUIPE_CONTENUS.publicationBanniereSurLeSiteSeulement, true);
verifier("suppression d'une bannière sur le site seulement", ACTIONS_EQUIPE_CONTENUS.suppressionBanniereSurLeSiteSeulement, true);
verifier("bascule d'un interrupteur sur le site seulement", ACTIONS_EQUIPE_CONTENUS.basculeInterrupteurSurLeSiteSeulement, true);
verifier("annonce de version sur le site seulement", ACTIONS_EQUIPE_CONTENUS.annonceVersionSurLeSiteSeulement, true);
verifier("modification des paramètres sur le site seulement", ACTIONS_EQUIPE_CONTENUS.modificationParametresSurLeSiteSeulement, true);
verifier("édition des pages et des textes sur le site seulement", ACTIONS_EQUIPE_CONTENUS.editionPagesEtTextesSurLeSiteSeulement, true);
verifier("édition du design sur le site seulement", ACTIONS_EQUIPE_CONTENUS.editionDesignSurLeSiteSeulement, true);

console.log(`${total - ko}/${total} tests passent`);
if (ko > 0) process.exit(1);
