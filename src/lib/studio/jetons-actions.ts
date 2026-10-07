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
  /**
   * Clé du jeton réellement écrit. L'interface ne marque « personnalisé » que sur cette réponse,
   * jamais sur le simple fait d'avoir cliqué : un enregistrement REFUSÉ ne change rien, et l'afficher
   * comme personnalisé mentirait sur l'état du site.
   */
  cleEnregistree?: string;
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

    // ÉCRITURE EN DEUX TEMPS, volontairement (correction du 7 octobre 2026).
    //
    // `upsert` avec `onConflict: "portee,restaurant_id,cle"` ne fonctionne PAS ici, et l'a fait
    // échouer silencieusement à chaque clic : l'unicité est portée par un index sur une expression
    // (`portee, coalesce(restaurant_id, …), cle`, nécessaire parce qu'en PostgreSQL NULL <> NULL),
    // et `ON CONFLICT` exige un index sur exactement les colonnes citées. PostgreSQL répondait
    // « 42P10 : there is no unique or exclusion constraint matching the ON CONFLICT specification »,
    // que l'action transformait en « le jeton n'a pas pu être enregistré ».
    //
    // UPDATE d'abord, INSERT seulement si rien n'a été modifié : deux requêtes explicites, pas de
    // dépendance à une inférence d'index, et surtout aucune modification du schéma en production.
    const admin = creerClientAdmin();
    const commun = {
      valeur: v,
      libelle: connu.libelle.slice(0, MAX_LONGUEUR_LIBELLE),
      groupe: connu.groupe,
      mis_a_jour_le: new Date().toISOString(),
    };
    const cible = admin.from("design_tokens").update(commun).eq("cle", cle).eq("portee", portee);
    // `.select()` est indispensable : sans lui, PostgREST renvoie `data: null` et on ne peut pas
    // savoir si l'UPDATE a touché une ligne — donc pas décider s'il faut INSERT.
    const requete = restaurantId ? cible.eq("restaurant_id", restaurantId) : cible.is("restaurant_id", null);
    const { data: modifiees, error: erreurUpdate } = await requete.select("cle");

    if (erreurUpdate) {
      return { ok: false, cleEnErreur: cle, message: "Le jeton n'a pas pu être enregistré, réessayez dans un instant." };
    }

    if (!modifiees || modifiees.length === 0) {
      const { error: erreurInsert } = await admin.from("design_tokens").insert({
        portee,
        restaurant_id: restaurantId,
        cle,
        ...commun,
      });
      if (erreurInsert) {
        return { ok: false, cleEnErreur: cle, message: "Le jeton n'a pas pu être enregistré, réessayez dans un instant." };
      }
    }

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
    return { ok: true, cleEnregistree: cle, message: "Enregistré. Le site est à jour." };
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
    return { ok: true, cleEnregistree: cle, message: "Revenu à la valeur actuelle." };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}
