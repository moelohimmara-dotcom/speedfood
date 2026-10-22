import { repondre } from "@/lib/api/v1";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { groupesNavPourRole, permissionsDuRole } from "@/lib/system-admin/permissions";

/** Sections de l'espace admin qui ont déjà leur écran natif dans l'application ; les autres s'ouvrent sur le site (`/system/...`). */
const SECTIONS_NATIVES = ["/system/repartition"];

/**
 * Qui suis-je dans l'équipe Speedfood : rôle, permissions et menu du compte connecté (les mêmes familles et sections que le site `/system`, déjà filtrées par
 * permission). L'application n'affiche que ce menu ; le serveur revérifie de toute façon chaque appel. Un compte sans rôle système reçoit le même refus qu'une
 * permission manquante.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, null);
  if (!auth.ok) return auth.reponse;
  const { role } = auth.contexte;
  return repondre({
    ok: true,
    role,
    permissions: permissionsDuRole(role),
    groupes: groupesNavPourRole(role).map((g) => ({
      libelle: g.libelle,
      entrees: g.entrees.map((e) => ({ chemin: e.href, libelle: e.libelle, natif: SECTIONS_NATIVES.includes(e.href) })),
    })),
  });
}

export const dynamic = "force-dynamic";
