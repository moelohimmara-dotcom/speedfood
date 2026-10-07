"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { verifierPermission } from "@/lib/system-admin/contexte";
import { verifierPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO } from "@/lib/system-admin/paliers";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import { validerValeurJeton, verifierContraste, CONTRASTE_AA_TEXTE, type Groupe } from "@/lib/studio/jetons";
import { lireJetons } from "@/lib/studio/jetons-lecture";
import { ErreurMetier } from "@/lib/contracts/erreurs";

/**
 * Enregistrement des jetons de design (palier 4, phase 1). Action serveur : la clé de service écrit,
 * `parametres.editer` + palier 2 (Éditeur) sont exigés, et le trigger `fn_garde_jetons_design`
 * refuse en base toute écriture qui ne vient pas du rôle de service.
 *
 * DEUX RÈGLES DE CONCEPTION, à lire avant de modifier.
 *
 * 1. Le client n'est jamais le juge. L'aperçu et le contrôle de contraste tournent dans le
 *    navigateur pour être immédiats, mais ici on REVALIDE tout : un appel direct à cette action
 *    avec une valeur malveillante doit être refusé aussi sûrement qu'un clic sur un bouton.
 *
 * 2. Le contraste est un REFUS, pas une correction automatique (décision de la propriétaire,
 *    7 octobre 2026). On ne choisit pas à sa place : si la combinaison est illisible, on le dit et
 *    on donne le rapport exact, mais la valeur reste la sienne. Une correction silencieuse
 *    produirait un site différent de ce qu'on croit avoir choisi.
 */

export interface ResultatJeton {
  ok: boolean;
  message?: string;
  /** Message d'erreur attaché à un jeton précis, pour l'afficher sous le bon champ. */
  cleEnErreur?: string;
}

const MAX_LONGUEUR_LIBELLE = 80;

/** Un jeton ne peut être écrit que si sa clé est connue du catalogue lu en base. */
async function verifierCleConnue(portee: "site" | "restaurant", cle: string): Promise<{ groupe: Groupe; libelle: string } | null> {
  const connus = await lireJetons(portee, null);
  return connus.find((j) => j.cle === cle) ?? null;
}

export async function enregistrerJetonAction(_etat: ResultatJeton, formData: FormData): Promise<ResultatJeton> {
  const cle = String(formData.get("cle") ?? "");
  const valeur = String(formData.get("valeur") ?? "");
  const portee = String(formData.get("portee") ?? "site") === "restaurant" ? "restaurant" : "site";
  const restaurantId = portee === "restaurant" ? String(formData.get("restaurant_id") ?? "") || null : null;

  if (!cle || cle.length > 64) return { ok: false, cleEnErreur: cle, message: "Jeton non identifié." };
  if (portee === "restaurant" && !restaurantId) return { ok: false, message: "Restaurant non identifié." };

  try {
    const contexte = await verifierPermission("parametres.editer");
    await verifierPalier("parametres", MINIMUMS_STUDIO.publier, { contexte });

    const connu = await verifierCleConnue(portee, cle);
    if (!connu) return { ok: false, cleEnErreur: cle, message: "Ce jeton n'existe pas." };

    // Le dégradé de marque est stocké mais n'est pas éditable : c'est une valeur unique, hors
    // couleur, reconstruite par cssDepuisJetons à partir des couleurs elles-mêmes.
    if (cle === "couleur.gradient-marque") {
      return { ok: false, cleEnErreur: cle, message: "Le dégradé de marque se change couleur par couleur, pas directement." };
    }

    const v = valeur.trim();
    const erreurFormat = validerValeurJeton(connu.groupe, v);
    if (erreurFormat) return { ok: false, cleEnErreur: cle, message: erreurFormat };

    // Contraste : vérifié AVANT l'écriture, pas à l'affichage. Le client ne juge jamais.
    if (connu.groupe === "couleurs") {
      const tous = await lireJetons(portee, restaurantId);
      const candidat = new Map(tous.map((j) => [j.cle, j.valeur]));
      const texte = candidat.get(cleDeTextePourFond(cle)) ?? "#ffffff";
      const couple = verifierContraste(v, texte);
      if (!couple.conforme) {
        return {
          ok: false,
          cleEnErreur: cle,
          message: `Texte sur ce fond : ${couple.rapport} : 1, il faut au moins ${CONTRASTE_AA_TEXTE} : 1 pour du texte courant. Choisissez un fond plus clair ou plus foncé.`,
        };
      }
    }

    const admin = creerClientAdmin();
    const { error } = await admin.from("design_tokens").upsert(
      {
        portee,
        restaurant_id: restaurantId,
        cle,
        valeur: v,
        libelle: connu.libelle.slice(0, MAX_LONGUEUR_LIBELLE),
        groupe: connu.groupe,
        mis_a_jour_le: new Date().toISOString(),
      },
      { onConflict: "portee,restaurant_id,cle" }
    );
    if (error) return { ok: false, cleEnErreur: cle, message: "Le jeton n'a pas pu être enregistré, réessayez dans un instant." };

    await journaliserActionSysteme(contexte, {
      action: "design.jeton_modification",
      cibleType: "design_token",
      cibleId: cle,
      motif: `${cle} = ${v}`,
    });

    revalidatePath("/system/design");
    // Le CSS des jetons est dans le layout racine : revalider le layout pour que la prochaine
    // réponse serve la nouvelle valeur. Le TTL de la Cache API borne le délai si cela ne suffit pas.
    revalidatePath("/", "layout");
    return { ok: true, message: "Enregistré. Le site est à jour." };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}

/**
 * La clé de la couleur de texte qui accompagne ce fond. Reprend le raisonnement de `FONDS`
 * dans reglages.ts : un fond sombre prend la surface, un fond clair prend l'encre.
 */
function cleDeTextePourFond(cleFond: string): string {
  const sombres = new Set(["couleur.rouge", "couleur.rouge-fonce", "couleur.encre", "couleur.danger"]);
  return sombres.has(cleFond) ? "couleur.surface" : "couleur.encre";
}

/**
 * Remet un jeton à sa valeur du code : supprime la ligne de la base, le repli reprend le relais.
 * C'est ce que fait le bouton « Rétablir » de chaque ligne.
 */
export async function reinitialiserJetonAction(_etat: ResultatJeton, formData: FormData): Promise<ResultatJeton> {
  const cle = String(formData.get("cle") ?? "");
  const portee = String(formData.get("portee") ?? "site") === "restaurant" ? "restaurant" : "site";
  const restaurantId = portee === "restaurant" ? String(formData.get("restaurant_id") ?? "") || null : null;
  if (!cle) return { ok: false, message: "Jeton non identifié." };

  try {
    const contexte = await verifierPermission("parametres.editer");
    await verifierPalier("parametres", MINIMUMS_STUDIO.publier, { contexte });

    const requete = creerClientAdmin().from("design_tokens").delete().eq("cle", cle).eq("portee", portee);
    const { error } = restaurantId ? await requete.eq("restaurant_id", restaurantId) : await requete.is("restaurant_id", null);
    if (error) return { ok: false, cleEnErreur: cle, message: "Le jeton n'a pas pu être remis, réessayez." };

    await journaliserActionSysteme(contexte, {
      action: "design.jeton_reinitialisation",
      cibleType: "design_token",
      cibleId: cle,
    });

    revalidatePath("/system/design");
    revalidatePath("/", "layout");
    return { ok: true, message: "Revenu à la valeur actuelle." };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}
