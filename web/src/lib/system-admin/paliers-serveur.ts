import "server-only";
import { notFound } from "next/navigation";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { obtenirContexteSysteme, type ContexteSysteme } from "./contexte";
import type { Permission } from "./permissions";
import {
  MESSAGE_DROITS_ILLISIBLES,
  deciderAcces,
  explicationPalier,
  lectureNecessaire,
  type DecisionAcces,
  type LectureHabilitations,
  type Palier,
} from "./paliers";

/**
 * Contrôle serveur des paliers (Studio, palier 2). La décision est celle, pure et testée, de `paliers.ts` ; ici on lit
 * seulement les habilitations de la personne connectée, avec SA session (RLS de `acces_paliers` : ses propres lignes).
 *
 * Échec FERMÉ : si la lecture échoue (erreur base, table absente), l'action est refusée et la page répond 404. Seul le
 * `super_admin` n'a besoin d'aucune lecture (préréglage seul, palier 5 sur tout) : une panne ne le bloque jamais.
 *
 * Ces contrôles s'AJOUTENT aux permissions (`verifierPermission`, `exigerPermissionPage`), ils ne les remplacent pas.
 * Masquer un bouton dans l'interface n'est qu'un confort : ces fonctions sont la seule autorité.
 */

export interface OptionsPalier {
  /** Permission actuelle exigée aussi (double contrôle) ; facultative si l'appelant l'a déjà vérifiée. */
  permission?: Permission;
  /** Contexte déjà chargé par l'appelant, pour éviter de relire la session. */
  contexte?: ContexteSysteme;
}

export type ContexteAvecPalier = ContexteSysteme & { palier: Palier };

/** Lit les habilitations de la personne connectée. Toute erreur (y compris une exception) donne `ok: false`. */
export async function lireHabilitations(contexte: ContexteSysteme): Promise<LectureHabilitations> {
  try {
    const { data, error } = await contexte.supabase
      .from("acces_paliers")
      .select("actif, palier, plafond, expire_le")
      .eq("utilisateur_id", contexte.utilisateurId);
    if (error || !data) return { ok: false };
    return { ok: true, habilitations: data };
  } catch {
    return { ok: false };
  }
}

async function decider(actif: string, minimum: Palier, options: OptionsPalier): Promise<{ contexte: ContexteSysteme; decision: DecisionAcces }> {
  const contexte = options.contexte ?? (await obtenirContexteSysteme());
  const lecture = lectureNecessaire(contexte.role) ? await lireHabilitations(contexte) : null;
  const decision = deciderAcces({
    role: contexte.role,
    permission: options.permission,
    actif,
    minimum,
    lecture,
    maintenant: Date.now(),
  });
  return { contexte, decision };
}

/**
 * Variante « page » : renvoie le contexte et le palier effectif (pour adapter l'interface), ou 404 si le palier est
 * insuffisant ou illisible (aucune fuite sur l'existence de la section, comme `exigerPermissionPage`).
 */
export async function exigerPalier(actif: string, minimum: Palier, options: OptionsPalier = {}): Promise<ContexteAvecPalier> {
  const { contexte, decision } = await decider(actif, minimum, options);
  if (!decision.autorise) notFound();
  return { ...contexte, palier: decision.palier };
}

/**
 * Variante « Server Action » : lève `ErreurMetier("NON_AUTORISE")` avec un message en français si l'action n'est pas
 * permise (habilitations illisibles comprises), sinon renvoie le contexte et le palier effectif.
 */
export async function verifierPalier(actif: string, minimum: Palier, options: OptionsPalier = {}): Promise<ContexteAvecPalier> {
  const { contexte, decision } = await decider(actif, minimum, options);
  if (decision.autorise) return { ...contexte, palier: decision.palier };
  if (decision.raison === "illisible") throw new ErreurMetier("NON_AUTORISE", MESSAGE_DROITS_ILLISIBLES);
  if (decision.raison === "permission") {
    throw new ErreurMetier("NON_AUTORISE", "Votre rôle système ne permet pas cette action.", { permission: "Accès refusé pour ce rôle." });
  }
  throw new ErreurMetier("NON_AUTORISE", explicationPalier(decision.palier, minimum), { palier: "Palier insuffisant." });
}
