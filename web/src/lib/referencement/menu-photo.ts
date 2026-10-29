import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { analyserReponseModele } from "@/lib/menu/chefMenu";
import { lireMenuAvecIA } from "@/lib/menu/chefIaModele";
import { limiterChefIaCandidat } from "@/lib/securite/limitation-debit";
import { validerImage } from "@/lib/storage/images";
import { PRIX_PLAT_MAX_GNF, platsDepuisLecture, type LectureMenu } from "./candidature";

export type ResultatLectureMenu = { ok: true; lecture: LectureMenu } | { ok: false; code: "VALIDATION" | "TROP_DE_REQUETES" | "ERREUR_SERVEUR"; message: string };

/**
 * « Photographier le menu » d'une candidature : le moteur du Chef IA (`docs/CHEF-IA.md`) lit la photo, qui n'est NI conservée NI envoyée ailleurs que chez le modèle ; seule la liste
 * de plats revient à l'application, qui la fait relire avant d'en ajouter quoi que ce soit au brouillon. Plafond par compte et par jour : le quota Workers AI est celui du projet.
 */
export async function lireMenuCandidat(utilisateurId: string, fichier: File | null): Promise<ResultatLectureMenu> {
  try {
    await validerImage(fichier);
  } catch (erreur) {
    return { ok: false, code: "VALIDATION", message: erreur instanceof ErreurMetier ? erreur.message : "Cette photo n'a pas pu être lue." };
  }
  const image = fichier as File;
  try {
    await limiterChefIaCandidat(utilisateurId);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") {
      return { ok: false, code: "TROP_DE_REQUETES", message: "Vous avez déjà analysé plusieurs photos aujourd'hui. Saisissez les plats à la main, ou réessayez demain." };
    }
    return { ok: false, code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." };
  }

  let reponse: string;
  try {
    reponse = await lireMenuAvecIA(`data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`);
  } catch (erreur) {
    return { ok: false, code: "ERREUR_SERVEUR", message: erreur instanceof ErreurMetier ? erreur.message : "La photo n'a pas pu être analysée. Saisissez les plats à la main." };
  }

  const analyse = analyserReponseModele(reponse, { prixMax: PRIX_PLAT_MAX_GNF, sections: [] });
  return { ok: true, lecture: platsDepuisLecture({ plats: analyse.plats.map((p) => ({ nom: p.nom, prix: p.prix })), refuses: analyse.refuses, etat: analyse.etat }) };
}
