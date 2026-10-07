"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { verifierPermission } from "@/lib/system-admin/contexte";
import { verifierPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO } from "@/lib/system-admin/paliers";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import { validerValeurJeton, verifierContraste, CONTRASTE_AA_TEXTE, type Groupe, type EntreeHistorique } from "@/lib/studio/jetons";
import { lireJetons } from "@/lib/studio/jetons-lecture";
import { ErreurMetier } from "@/lib/contracts/erreurs";

/**
 * Écriture des jetons de design (palier 4, phase 1). Clé de service, `parametres.editer` + palier 2
 * (Éditeur) exigés, et le trigger `fn_garde_jetons_design` refuse en base toute écriture qui ne
 * vient pas du rôle de service.
 *
 * DEUX RÈGLES DE CONCEPTION.
 *
 * 1. Le client n'est jamais le juge. L'aperçu et le contrôle de contraste tournent dans le
 *    navigateur pour être immédiats ; ici on REVALIDE tout. Un appel direct avec une valeur
 *    malveillante échoue aussi sûrement qu'un clic.
 *
 * 2. Le contraste est un REFUS, pas une correction automatique (décision de la propriétaire,
 *    7 octobre 2026). On ne choisit pas à sa place : si la combinaison est illisible, on donne le
 *    rapport exact et la valeur reste la sienne.
 */

export interface ResultatJeton {
  ok: boolean;
  message?: string;
  /** Message d'erreur attaché à un jeton précis, pour l'afficher sous le bon champ. */
  cleEnErreur?: string;
  /**
   * Clé réellement écrite. L'interface ne marque « personnalisé » que sur cette réponse, jamais
   * sur le simple fait d'avoir cliqué : un enregistrement REFUSÉ ne change rien.
   */
  cleEnregistree?: string;
  /**
   * Jetons dont la ligne a été SUPPRIMÉE (retour à la valeur du code). L'interface en a besoin pour
   * remettre sa référence à jour, sinon « Enregistrer » resterait gris sur une valeur que le
   * serveur ne connaît plus.
   */
  clesRétablies?: string[];
  /** Clé restaurée depuis l'historique, pour le message du panneau. */
  cleRestaurée?: string;
}

const MAX_LONGUEUR_LIBELLE = 80;

/** Un jeton ne peut être écrit que si sa clé est connue du catalogue lu en base. */
async function verifierCleConnue(portee: "site" | "restaurant", cle: string): Promise<{ groupe: Groupe; libelle: string } | null> {
  const connus = await lireJetons(portee, null);
  return connus.find((j) => j.cle === cle) ?? null;
}

/**
 * La clé de la couleur de texte qui accompagne ce fond. Un fond sombre prend la surface, un fond
 * clair prend l'encre — même raisonnement que dans reglages.ts.
 */
function cleDeTextePourFond(cleFond: string): string {
  const sombres = new Set(["couleur.rouge", "couleur.rouge-fonce", "couleur.encre", "couleur.danger"]);
  return sombres.has(cleFond) ? "couleur.surface" : "couleur.encre";
}

/**
 * Journalise un changement. Appelé par chaque action qui écrit : c'est la seule façon d'avoir un
 * historique complet. Un échec ici n'annule PAS l'écriture déjà faite — l'historique est un
 * complément, pas une condition.
 */
async function journaliserChangementJeton(params: {
  cle: string;
  valeurAvant: string | null;
  valeurApres: string;
  action: "creation" | "modification" | "suppression";
  auteurId: string;
}): Promise<void> {
  try {
    await creerClientAdmin().from("design_tokens_historique").insert({
      portee: "site",
      restaurant_id: null,
      cle: params.cle,
      valeur_avant: params.valeurAvant,
      valeur_apres: params.valeurApres,
      action: params.action,
      auteur_id: params.auteurId,
    });
  } catch {
    // Table d'historique absente (migration pas appliquée) : l'écriture du jeton reste valide,
    // seule la trace est perdue. Refuser l'enregistrement serait bien pire.
  }
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

    // Le dégradé est stocké mais pas éditable : c'est une valeur unique, hors couleur, reconstruite
    // par cssDepuisJetons à partir des couleurs elles-mêmes.
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
    // `upsert` avec `onConflict: "portee,restaurant_id,cle"` ne fonctionne PAS ici et l'a fait
    // échouer à chaque clic : l'unicité est portée par un index sur une expression
    // (`portee, coalesce(restaurant_id, …), cle`, nécessaire parce qu'en PostgreSQL NULL <> NULL),
    // et `ON CONFLICT` exige un index sur exactement les colonnes citées. PostgreSQL répondait
    // « 42P10 : there is no unique or exclusion constraint matching the ON CONFLICT specification ».
    const admin = creerClientAdmin();
    const commun = {
      valeur: v,
      libelle: connu.libelle.slice(0, MAX_LONGUEUR_LIBELLE),
      groupe: connu.groupe,
      mis_a_jour_le: new Date().toISOString(),
    };
    const cible = admin.from("design_tokens").update(commun).eq("cle", cle).eq("portee", portee);
    const requete = restaurantId ? cible.eq("restaurant_id", restaurantId) : cible.is("restaurant_id", null);
    // `.select()` est indispensable : sans lui PostgREST renvoie `data: null`, et on ne peut pas
    // savoir si l'UPDATE a touché une ligne — donc pas décider s'il faut INSERT.
    const { data: modifiees, error: erreurUpdate } = await requete.select("cle");

    if (erreurUpdate) {
      return { ok: false, cleEnErreur: cle, message: "Le jeton n'a pas pu être enregistré, réessayez dans un instant." };
    }

    let valeurAvant: string | null = null;
    let action: "creation" | "modification" = "creation";

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
      valeurAvant = null;
      action = "creation";
    } else {
      // La valeur d'avant est celle du CODE, pas celle du serveur : la ligne existe toujours
      // (semence), donc la lire ne donnerait jamais rien à l'historique.
      const code = await lireJetons(portee, restaurantId);
      valeurAvant = code.find((j) => j.cle === cle)?.valeur ?? null;
      action = "modification";
    }

    await journaliserChangementJeton({ cle, valeurAvant, valeurApres: v, action, auteurId: contexte.utilisateurId });

    await journaliserActionSysteme(contexte, {
      action: "design.jeton_modification",
      cibleType: "design_token",
      cibleId: cle,
      motif: `${cle} = ${v}`,
    });

    revalidatePath("/system/design");
    // Le CSS des jetons est dans le layout racine.
    revalidatePath("/", "layout");
    return { ok: true, cleEnregistree: cle, message: "Enregistré. Le site est à jour." };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}

/**
 * Remet un jeton à sa valeur du code : supprime la ligne, le repli reprend le relais.
 * C'est le « Rétablir » d'une ligne.
 */
export async function reinitialiserJetonAction(_etat: ResultatJeton, formData: FormData): Promise<ResultatJeton> {
  const cle = String(formData.get("cle") ?? "");
  const portee = String(formData.get("portee") ?? "site") === "restaurant" ? "restaurant" : "site";
  const restaurantId = portee === "restaurant" ? String(formData.get("restaurant_id") ?? "") || null : null;
  if (!cle) return { ok: false, message: "Jeton non identifié." };

  try {
    const contexte = await verifierPermission("parametres.editer");
    await verifierPalier("parametres", MINIMUMS_STUDIO.publier, { contexte });

    const admin = creerClientAdmin();
    const connu = await verifierCleConnue(portee, cle);
    const { data: supprime } = await admin.from("design_tokens").select("valeur").eq("cle", cle).eq("portee", portee);
    let valeursAvant = supprime?.length ? String(supprime[0].valeur) : null;
    if (valeursAvant === null && connu) {
      valeursAvant = (await lireJetons(portee, restaurantId)).find((j) => j.cle === cle)?.valeur ?? null;
    }

    const requete = admin.from("design_tokens").delete().eq("cle", cle).eq("portee", portee);
    const { error } = restaurantId ? await requete.eq("restaurant_id", restaurantId) : await requete.is("restaurant_id", null);
    if (error) return { ok: false, cleEnErreur: cle, message: "Le jeton n'a pas pu être remis, réessayez." };

    // La valeur « après » d'une suppression est celle du CODE : c'est ce que le site affichera
    // une fois la ligne retirée. `lireJetons` la donne, car elle applique déjà le repli.
    const valeurCode = connu ? (await lireJetons(portee, restaurantId)).find((j) => j.cle === cle)?.valeur ?? null : null;
    if (connu && valeursAvant !== null && valeurCode !== null) {
      await journaliserChangementJeton({
        cle,
        valeurAvant: valeursAvant,
        valeurApres: valeurCode,
        action: "suppression",
        auteurId: contexte.utilisateurId,
      });
    }

    await journaliserActionSysteme(contexte, {
      action: "design.jeton_reinitialisation",
      cibleType: "design_token",
      cibleId: cle,
    });

    revalidatePath("/system/design");
    revalidatePath("/", "layout");
    return { ok: true, cleEnregistree: cle, clesRétablies: [cle], message: "Revenu à la valeur actuelle." };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}

/**
 * « Revenir aux valeurs actuelles » : remet **le site public** à ses valeurs d'origine.
 *
 * Correction du 7 octobre 2026 : ce bouton ne faisait qu'annuler l'écran ; le site gardait la
 * couleur enregistrée, alors que l'intitule promettait un retour. Pour être honnête, il ne
 * devait exister qu'en version locale, ou il devait écrire. Il écrit.
 *
 * Ne supprime que les lignes dont la valeur DIFFÈRE de celle du code.
 */
export async function reinitialiserTousJetonsAction(_etat: ResultatJeton, _formData: FormData): Promise<ResultatJeton> {
  try {
    const contexte = await verifierPermission("parametres.editer");
    await verifierPalier("parametres", MINIMUMS_STUDIO.publier, { contexte });

    const connus = await lireJetons("site");
    const personnalises = connus.filter((j) => j.personnalise);

    if (personnalises.length === 0) {
      return { ok: true, clesRétablies: [], message: "Le site est déjà à ses valeurs d'origine." };
    }

    const cles = personnalises.map((j) => j.cle);
    const { error } = await creerClientAdmin()
      .from("design_tokens")
      .delete()
      .eq("portee", "site")
      .is("restaurant_id", null)
      .in("cle", cles);
    if (error) return { ok: false, message: "Le retour aux valeurs d'origine a échoué, réessayez dans un instant." };

    for (const j of personnalises) {
      await journaliserChangementJeton({
        cle: j.cle,
        valeurAvant: j.valeur,
        valeurApres: j.valeur,
        action: "suppression",
        auteurId: contexte.utilisateurId,
      });
    }

    await journaliserActionSysteme(contexte, {
      action: "design.jetons_retour_origine",
      cibleType: "design_token",
      cibleId: cles.join(", "),
      motif: `${cles.length} jeton(s) remis à la valeur d'origine`,
    });

    revalidatePath("/system/design");
    revalidatePath("/", "layout");
    return {
      ok: true,
      clesRétablies: cles,
      message:
        personnalises.length === 1
          ? "1 réglage remis à sa valeur d'origine. Le site est à jour."
          : `${personnalises.length} réglages remis à leurs valeurs d'origine. Le site est à jour.`,
    };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}

/**
 * Ré-export du type d'entrée d'historique. Il est DÉFINI dans le module pur `jetons` (les
 * composants client lisent l'historique et ne peuvent pas importer ce fichier, `server-only`),
 * et redonné ici pour que l'appelant serveur n'ait qu'un import à faire.
 */
export type { EntreeHistorique } from "./jetons";

/** Les changements récents, du plus récent au plus ancien. Alimente le panneau « Historique ». */
export async function listerHistoriqueJeton(limite = 30): Promise<EntreeHistorique[]> {
  const { data, error } = await creerClientAdmin()
    .from("design_tokens_historique")
    .select("id, cle, valeur_avant, valeur_apres, action, cree_le")
    .eq("portee", "site")
    .order("cree_le", { ascending: false })
    .limit(Math.max(1, Math.min(200, limite)));
  if (error || !data) return [];

  const noms = new Map((await lireJetons("site")).map((j) => [j.cle, { libelle: j.libelle, groupe: j.groupe }]));
  return data.map((d) => ({
    id: d.id,
    cle: d.cle,
    libelle: noms.get(d.cle)?.libelle ?? d.cle,
    groupe: (noms.get(d.cle)?.groupe ?? "couleurs") as Groupe,
    valeurAvant: d.valeur_avant,
    valeurApres: d.valeur_apres,
    action: d.action as EntreeHistorique["action"],
    creeLe: d.cree_le,
  }));
}

/**
 * Restaure un jeton à la valeur qu'il avait AVANT le changement enregistré.
 *
 * La valeur vient du JOURNAL, pas du code : revenir sur « Mangue passée à #5d8ebb » remet
 * #ffc247, mais revenir sur « Mangue revenue à sa valeur d'origine » doit remettre la valeur
 * personnalisée d'avant, pas l'originale du site.
 *
 * La restauration est elle-même journalisée : l'historique reste exact et « revenir » reste
 * réversible, au lieu de laisser un trou dans l'histoire.
 */
export async function restaurerDepuisHistoriqueAction(_etat: ResultatJeton, formData: FormData): Promise<ResultatJeton> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Changement non identifié." };

  try {
    const contexte = await verifierPermission("parametres.editer");
    await verifierPalier("parametres", MINIMUMS_STUDIO.publier, { contexte });

    const admin = creerClientAdmin();
    const { data: entree, error: erreurLecture } = await admin
      .from("design_tokens_historique")
      .select("cle, valeur_avant, valeur_apres")
      .eq("id", id)
      .maybeSingle();
    if (erreurLecture || !entree) return { ok: false, message: "Ce changement n'existe plus." };

    const cle = entree.cle;
    const connu = await verifierCleConnue("site", cle);
    if (!connu) return { ok: false, message: "Ce jeton n'existe plus." };

    const { data: actuelle } = await admin
      .from("design_tokens")
      .select("valeur")
      .eq("cle", cle)
      .eq("portee", "site")
      .is("restaurant_id", null)
      .maybeSingle();
    const valeurCourante = actuelle?.valeur ?? null;
    const cible = entree.valeur_avant;

    if (cible === null) {
      // Avant ce changement, le jeton n'existait pas : on le supprime, comme on l'avait trouvé.
      const { error } = await admin.from("design_tokens").delete().eq("cle", cle).eq("portee", "site").is("restaurant_id", null);
      if (error) return { ok: false, message: "La restauration a échoué, réessayez." };
    } else {
      const erreurValeur = validerValeurJeton(connu.groupe, cible);
      if (erreurValeur) return { ok: false, message: `La valeur à rétablir n'est plus acceptable : ${erreurValeur}` };

      // UPDATE puis INSERT si besoin : meme raison que dans enregistrerJetonAction.
      const { data: modifiees, error: erreurUpdate } = await admin
        .from("design_tokens")
        .update({ valeur: cible, mis_a_jour_le: new Date().toISOString() })
        .eq("cle", cle)
        .eq("portee", "site")
        .is("restaurant_id", null)
        .select("cle");
      if (erreurUpdate) return { ok: false, message: "La restauration a échoué, réessayez." };
      if (!modifiees || modifiees.length === 0) {
        const { error: erreurInsert } = await admin.from("design_tokens").insert({
          portee: "site",
          restaurant_id: null,
          cle,
          valeur: cible,
          libelle: connu.libelle.slice(0, MAX_LONGUEUR_LIBELLE),
          groupe: connu.groupe,
          mis_a_jour_le: new Date().toISOString(),
        });
        if (erreurInsert) return { ok: false, message: "La restauration a échoué, réessayez." };
      }
    }

    await journaliserChangementJeton({
      cle,
      valeurAvant: valeurCourante,
      valeurApres: cible ?? entree.valeur_apres,
      action: cible === null ? "suppression" : "modification",
      auteurId: contexte.utilisateurId,
    });

    await journaliserActionSysteme(contexte, {
      action: "design.jeton_restauration",
      cibleType: "design_token",
      cibleId: cle,
      motif: cible === null ? "retour à la valeur du code" : "retour à la valeur précédente",
    });

    revalidatePath("/system/design");
    revalidatePath("/", "layout");
    return {
      ok: true,
      cleEnregistree: cle,
      clesRétablies: cible === null ? [cle] : [],
      cleRestaurée: cle,
      message:
        cible === null ? `${connu.libelle} : retour à sa valeur d'origine.` : `${connu.libelle} remis à sa valeur précédente.`,
    };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, message: erreur.message };
    return { ok: false, message: "Action refusée." };
  }
}
