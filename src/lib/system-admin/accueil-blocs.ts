"use server";

import { revalidatePath } from "next/cache";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { invaliderCache } from "@/lib/cms/cache";
import type { Json } from "@/lib/db/database.types";
import { pageAccueilParDefaut } from "@/lib/studio/accueil";
import { AVERTISSEMENTS_TRACE, finaliserEcriture } from "@/lib/studio/apres-ecriture";
import { SLUG_ACCUEIL, validerPage } from "@/lib/studio/registre";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { MINIMUMS_STUDIO } from "./paliers";
import { verifierPalier } from "./paliers-serveur";

/**
 * « Créer l'accueil en blocs » (Studio, palier 3, tâche 9) : crée la page `accueil` (format `blocs`, titre « Accueil ») dont le
 * BROUILLON contient la disposition par défaut, c'est-à-dire les sections de la page d'accueil actuelle dans l'ordre actuel.
 * Rien n'est publié : la page d'origine reste affichée tant que la page n'est pas publiée (palier 2, éditeur de pages).
 *
 * Droits : `contenu.editer` puis palier ≥ 1 sur `contenu:pages` (comme toute création de page), écriture avec la SESSION
 * (RLS et triggers s'appliquent). Si une page `accueil` existe déjà (quel que soit son format ou son état), rien n'est créé :
 * l'identifiant de la page existante est renvoyé pour proposer de l'ouvrir.
 */
export interface EtatCreationAccueil {
  ok: boolean;
  erreur?: string;
  /** Page créée, ou page `accueil` déjà existante. */
  id?: string;
  existe?: boolean;
  /** Format de la page existante (une page de texte ne s'ouvre pas dans l'éditeur de blocs). */
  format?: "texte" | "blocs";
  avertissement?: string;
}

export async function creerAccueilBlocsAction(): Promise<EtatCreationAccueil> {
  try {
    const contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.brouillon, { contexte });

    const { data: existante, error: erreurLecture } = await contexte.supabase
      .from("content_pages")
      .select("id, format")
      .eq("slug", SLUG_ACCUEIL)
      .maybeSingle();
    if (erreurLecture) return { ok: false, erreur: "La page n'a pas pu être vérifiée, réessayez dans un instant." };
    if (existante) {
      return {
        ok: false,
        existe: true,
        id: existante.id,
        format: existante.format === "blocs" ? "blocs" : "texte",
        erreur: "Une page d'accueil existe déjà : elle n'est pas remplacée.",
      };
    }

    // La disposition par défaut est validée comme n'importe quel brouillon avant d'être écrite.
    const document = pageAccueilParDefaut();
    const validation = validerPage(document, { slug: SLUG_ACCUEIL });
    if (!validation.ok) return { ok: false, erreur: "La disposition par défaut de l'accueil n'est pas valide." };

    const { data, error } = await contexte.supabase
      .from("content_pages")
      .insert({
        slug: SLUG_ACCUEIL,
        titre: "Accueil",
        contenu: "",
        statut: "brouillon",
        format: "blocs",
        blocs_brouillon: validation.page as unknown as Json,
        auteur_id: contexte.utilisateurId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, existe: true, erreur: "Une page d'accueil existe déjà : elle n'est pas remplacée." };
      if (error.code === "42501") return { ok: false, erreur: "La base de données a refusé l'action : vos droits sont insuffisants." };
      return { ok: false, erreur: "Impossible de créer la page d'accueil." };
    }

    const fin = await finaliserEcriture(
      {
        invalider: () => invaliderCache([`page:${SLUG_ACCUEIL}`]),
        journaliser: () =>
          journaliserActionSysteme(contexte, {
            action: "contenu.page_creation",
            cibleType: "content_page",
            cibleId: data.id,
            motif: `${SLUG_ACCUEIL} (blocs, disposition par défaut)`,
          }),
      },
      AVERTISSEMENTS_TRACE.creation
    );
    revalidatePath("/system/contenu/pages");
    return { ok: true, id: data.id, format: "blocs", ...fin };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.message };
    throw erreur;
  }
}
