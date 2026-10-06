"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { verifierPermission, type ContexteSysteme } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { estRoleSysteme, type RoleSysteme } from "./permissions";
import { decrireHabilitation, validerCible, validerHabilitation } from "./paliers";

/**
 * Attribution et retrait des habilitations par paliers (`acces_paliers`), écran `/system/acces/paliers` — réservé à
 * `super_admin` (permission `systeme.roles`). Lectures et écritures de `acces_paliers` passent par la SESSION du super
 * administrateur : la RLS (écriture super_admin seulement, `accorde_par` = lui-même) s'applique en dernière ligne de défense.
 * Le service-role ne sert qu'à lire les rôles et les e-mails (comme `roles.ts`), jamais à écrire une habilitation.
 *
 * Chaque attribution et chaque retrait est journalisé (`acces.palier_attribution`, `acces.palier_retrait`). Si la trace ne
 * peut pas être écrite, le changement est annulé : pas d'habilitation sans trace.
 */

export interface EtatActionPalier {
  erreur?: string;
  succes?: string;
}

export interface HabilitationAffichee {
  id: string;
  actif: string;
  palier: number;
  plafond: boolean;
  expireLe: string | null;
  creeLe: string;
  /** Expirée : ignorée par le calcul du palier (gardée pour mémoire jusqu'à son retrait). */
  expiree: boolean;
}

export interface PersonneAvecPaliers {
  utilisateurId: string;
  email: string;
  /** `null` : la personne n'a plus de rôle système (ses habilitations sont alors sans effet). */
  role: RoleSysteme | null;
  habilitations: HabilitationAffichee[];
}

export interface VueAccesPaliers {
  personnes: PersonneAvecPaliers[];
  /** Faux si `acces_paliers` n'a pas pu être lue (table absente, erreur) : l'écran l'explique. */
  lisible: boolean;
}

export async function listerAccesPaliers(): Promise<VueAccesPaliers> {
  const contexte = await verifierPermission("systeme.roles");
  const admin = creerClientAdmin();

  const [{ data: memberships }, { data: lignes, error: erreurPaliers }] = await Promise.all([
    admin.from("system_admin_memberships").select("utilisateur_id, role, cree_le").order("cree_le", { ascending: true }),
    contexte.supabase
      .from("acces_paliers")
      .select("id, utilisateur_id, actif, palier, plafond, expire_le, cree_le")
      .order("cree_le", { ascending: true }),
  ]);

  const roles = new Map<string, RoleSysteme>();
  for (const m of memberships ?? []) {
    if (estRoleSysteme(m.role)) roles.set(m.utilisateur_id, m.role);
  }

  // Personnes à afficher : celles qui ont un rôle système, puis celles qui ont encore des habilitations sans rôle.
  const ids = [...roles.keys()];
  for (const l of lignes ?? []) if (!ids.includes(l.utilisateur_id)) ids.push(l.utilisateur_id);

  const maintenant = Date.now();
  const personnes: PersonneAvecPaliers[] = [];
  for (const utilisateurId of ids) {
    const { data } = await admin.auth.admin.getUserById(utilisateurId);
    personnes.push({
      utilisateurId,
      email: data?.user?.email ?? "(compte sans e-mail)",
      role: roles.get(utilisateurId) ?? null,
      habilitations: (lignes ?? [])
        .filter((l) => l.utilisateur_id === utilisateurId)
        .map((l) => ({
          id: l.id,
          actif: l.actif,
          palier: l.palier,
          plafond: l.plafond,
          expireLe: l.expire_le,
          creeLe: l.cree_le,
          expiree: l.expire_le !== null && Date.parse(l.expire_le) <= maintenant,
        })),
    });
  }

  return { personnes, lisible: !erreurPaliers && Boolean(lignes) };
}

/** Rôle système actuel d'un compte, relu en base (jamais pris du navigateur). `undefined` : lecture impossible. */
async function lireRole(utilisateurId: string): Promise<string | null | undefined> {
  const { data, error } = await creerClientAdmin()
    .from("system_admin_memberships")
    .select("role")
    .eq("utilisateur_id", utilisateurId)
    .maybeSingle();
  if (error) return undefined;
  return data?.role ?? null;
}

/** Trace d'audit ; en cas d'échec, `annuler` remet l'état d'avant et l'erreur est renvoyée telle quelle. */
async function journaliserOuAnnuler(
  contexte: ContexteSysteme,
  trace: Parameters<typeof journaliserActionSysteme>[1],
  annuler: () => PromiseLike<unknown>
): Promise<string | null> {
  try {
    await journaliserActionSysteme(contexte, trace);
    return null;
  } catch (erreur) {
    await annuler();
    return erreur instanceof ErreurMetier ? erreur.message : "L'action n'a pas pu être journalisée. Par prudence, elle est annulée.";
  }
}

export async function attribuerPalierAction(_etatPrecedent: EtatActionPalier, formData: FormData): Promise<EtatActionPalier> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { erreur: "L'e-mail est obligatoire." };

  // Validation complète AVANT tout accès : palier 5 refusé, actif du catalogue, expiration future.
  const validation = validerHabilitation({
    actif: String(formData.get("actif") ?? ""),
    palier: String(formData.get("palier") ?? ""),
    type: String(formData.get("type") ?? ""),
    expiration: String(formData.get("expiration") ?? ""),
    maintenant: Date.now(),
  });
  if (!validation.ok) return { erreur: validation.erreur };
  const habilitation = validation.valeur;

  let contexte;
  try {
    contexte = await verifierPermission("systeme.roles");
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Action refusée." };
  }
  const { supabase, utilisateurId: acteurId } = contexte;

  const { data: trouve, error: erreurRecherche } = await supabase.rpc("fn_trouver_utilisateur_par_email", { p_email: email });
  if (erreurRecherche) return { erreur: "Impossible de rechercher ce compte. Réessayez dans un instant." };
  const cible = trouve?.[0];
  if (!cible) return { erreur: "Aucun compte Speedfood n'existe avec cet e-mail." };

  const role = await lireRole(cible.id);
  if (role === undefined) return { erreur: "Impossible de lire le rôle de cette personne. Réessayez dans un instant." };
  const refusCible = validerCible(role);
  if (refusCible) return { erreur: refusCible };

  // État d'avant (même personne, même actif, même type) : pour l'annulation si la trace d'audit échoue.
  const { data: precedente, error: erreurLecture } = await supabase
    .from("acces_paliers")
    .select("id, palier, expire_le, accorde_par, cree_le")
    .eq("utilisateur_id", cible.id)
    .eq("actif", habilitation.actif)
    .eq("plafond", habilitation.plafond)
    .maybeSingle();
  if (erreurLecture) return { erreur: "Les habilitations n'ont pas pu être lues. Réessayez dans un instant." };

  const { data: ecrite, error: erreurEcriture } = await supabase
    .from("acces_paliers")
    .upsert(
      {
        utilisateur_id: cible.id,
        actif: habilitation.actif,
        palier: habilitation.palier,
        plafond: habilitation.plafond,
        expire_le: habilitation.expire_le,
        accorde_par: acteurId,
      },
      { onConflict: "utilisateur_id,actif,plafond" }
    )
    .select("id")
    .single();
  if (erreurEcriture || !ecrite) return { erreur: "Impossible d'enregistrer cette habilitation. Réessayez dans un instant." };

  const description = decrireHabilitation(habilitation);
  const erreurTrace = await journaliserOuAnnuler(
    contexte,
    {
      action: "acces.palier_attribution",
      cibleType: "utilisateur",
      cibleId: cible.id,
      motif: `${precedente ? "Remplacement : " : ""}${description} pour ${email}`,
    },
    () =>
      precedente
        ? supabase
            .from("acces_paliers")
            .update({ palier: precedente.palier, expire_le: precedente.expire_le, accorde_par: acteurId })
            .eq("id", precedente.id)
        : supabase.from("acces_paliers").delete().eq("id", ecrite.id)
  );
  if (erreurTrace) return { erreur: erreurTrace };

  revalidatePath("/system/acces/paliers");
  return { succes: `${description} : enregistré pour ${email}.` };
}

export async function retirerPalierAction(id: string): Promise<EtatActionPalier> {
  let contexte;
  try {
    contexte = await verifierPermission("systeme.roles");
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Action refusée." };
  }
  const { supabase } = contexte;

  // La ligne est relue en base (jamais décrite par le navigateur) pour la trace d'audit et une éventuelle annulation.
  const { data: ligne, error: erreurLecture } = await supabase
    .from("acces_paliers")
    .select("id, utilisateur_id, actif, palier, plafond, expire_le, accorde_par, cree_le")
    .eq("id", id)
    .maybeSingle();
  if (erreurLecture) return { erreur: "Les habilitations n'ont pas pu être lues. Réessayez dans un instant." };
  if (!ligne) return { erreur: "Cette habilitation n'existe plus." };

  const { error: erreurSuppression } = await supabase.from("acces_paliers").delete().eq("id", id);
  if (erreurSuppression) return { erreur: "Impossible de retirer cette habilitation. Réessayez dans un instant." };

  const { data: compte } = await creerClientAdmin().auth.admin.getUserById(ligne.utilisateur_id);
  const erreurTrace = await journaliserOuAnnuler(
    contexte,
    {
      action: "acces.palier_retrait",
      cibleType: "utilisateur",
      cibleId: ligne.utilisateur_id,
      motif: `Retrait : ${decrireHabilitation(ligne)} pour ${compte?.user?.email ?? ligne.utilisateur_id}`,
    },
    // Annulation : la ligne est remise, signée par le super administrateur courant (exigence de la RLS).
    () =>
      supabase.from("acces_paliers").insert({
        utilisateur_id: ligne.utilisateur_id,
        actif: ligne.actif,
        palier: ligne.palier,
        plafond: ligne.plafond,
        expire_le: ligne.expire_le,
        accorde_par: contexte.utilisateurId,
      })
  );
  if (erreurTrace) return { erreur: erreurTrace };

  revalidatePath("/system/acces/paliers");
  return { succes: "Habilitation retirée." };
}
