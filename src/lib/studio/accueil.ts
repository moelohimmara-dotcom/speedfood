import { SLUG_ACCUEIL, TYPES_ACCUEIL, validerPage, type PageBlocs, type ResultatValidation } from "./registre";

/**
 * Accueil en blocs (Studio, palier 3, tâche 9). Module PUR : disposition par défaut, décision d'affichage de `/` et règle du
 * titre de page (h1). La page d'accueil d'origine (`src/app/page.tsx`) reste TOUJOURS le repli.
 */

/**
 * Disposition par défaut = les sections de la page d'origine, dans le même ordre, sans aucun réglage. Point de départ de
 * l'édition : elle rend le même contenu que le repli (preuve : test de parité du bout en bout).
 */
export function pageAccueilParDefaut(): PageBlocs {
  return { content: TYPES_ACCUEIL.map((type) => ({ type, props: {} })), root: { props: {} } } as PageBlocs;
}

/** Page publiée telle que lue (document NON validé). */
export interface PageAccueilLue {
  format: string;
  blocs: unknown;
  titre: string;
}

export interface EntreeDecisionAccueil {
  /** Interrupteur d'urgence `accueil_en_blocs`. */
  interrupteurActif: boolean;
  /** Page `accueil` publiée (null : absente, en brouillon seulement, ou lecture en échec). */
  publiee: PageAccueilLue | null;
  /** Aperçu demandé (`?apercu=1`) ET autorisé (équipe avec `contenu.editer`) ; sinon `null`. */
  apercu: { page: (PageAccueilLue & { enLigne: boolean }) | null } | null;
}

export type DecisionAccueil =
  | { mode: "repli"; raison: string }
  | { mode: "blocs"; page: PageBlocs; titre: string }
  | { mode: "apercu"; page: PageBlocs; titre: string; enLigne: boolean }
  | { mode: "apercu-invalide"; erreurs: string[]; enLigne: boolean };

/**
 * Quelle version de l'accueil afficher ? Les blocs seulement si : l'interrupteur est actif, une page `accueil` de format
 * `blocs` est publiée et son JSON publié est valide (y compris la règle « sections d'accueil seulement sur `accueil` »). Tout
 * autre cas : le repli. Aperçu autorisé : le brouillon de l'équipe, quel que soit l'interrupteur, ou la liste de ses erreurs.
 */
export function decider(entree: EntreeDecisionAccueil): DecisionAccueil {
  if (entree.apercu?.page && entree.apercu.page.format === "blocs") {
    const { page } = entree.apercu;
    const validation: ResultatValidation = validerPage(page.blocs, { slug: SLUG_ACCUEIL });
    return validation.ok
      ? { mode: "apercu", page: validation.page, titre: page.titre, enLigne: page.enLigne }
      : { mode: "apercu-invalide", erreurs: validation.erreurs, enLigne: page.enLigne };
  }
  if (!entree.interrupteurActif) return { mode: "repli", raison: "interrupteur coupé" };
  const publiee = entree.publiee;
  if (!publiee) return { mode: "repli", raison: "aucune page publiée" };
  if (publiee.format !== "blocs") return { mode: "repli", raison: "page de format texte" };
  const validation = validerPage(publiee.blocs, { slug: SLUG_ACCUEIL });
  if (!validation.ok) return { mode: "repli", raison: "document publié invalide" };
  return { mode: "blocs", page: validation.page, titre: publiee.titre };
}

/**
 * Titre de page (h1) d'un accueil en blocs : il y en a TOUJOURS exactement un sur chaque type d'écran. L'accroche porte le h1
 * de l'accueil. Sans elle, un h1 visuellement masqué (titre de la page) la remplace ; si l'accroche n'est affichée que sur un
 * type d'écran, le h1 masqué couvre l'autre.
 */
export type PlanTitre = { masque: false } | { masque: true; visibilite?: "mobile" | "bureau" };

export function planTitre(page: PageBlocs): PlanTitre {
  const accroche = page.content.find((b) => b.type === "AccueilAccroche");
  if (!accroche) return { masque: true };
  const visibilite = accroche.props.reglages?.visibilite;
  if (visibilite === "mobile") return { masque: true, visibilite: "bureau" };
  if (visibilite === "bureau") return { masque: true, visibilite: "mobile" };
  return { masque: false };
}
