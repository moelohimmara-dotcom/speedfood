import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientLivraison } from "./lecture";
import {
  expirationLien,
  genererJetonActivation,
  hacherJetonActivation,
  jetonActivationPlausible,
  peutQuitterLeTravail,
  transitionCycleAutorisee,
  validerDossier,
  estCycleLivreur,
  type CycleLivreur,
  type DossierSaisi,
  type FicheLivreurValide,
} from "./livreurs-regles";

/**
 * Fiches livreurs : création, lien d'activation, activation par le livreur, approbation, suspension, archivage
 * (voir docs/LIVREURS.md). Tout passe par la clé de service ; l'appelant a déjà vérifié QUI agit. Les changements de cycle sont
 * conditionnels (l'état de départ est vérifié dans la mise à jour) : deux actions simultanées ne s'écrasent pas.
 */

export type Resultat<T extends object = object> = ({ ok: true } & T) | { ok: false; message: string };
const refuser = (message: string): { ok: false; message: string } => ({ ok: false, message });

export interface ReglagesLivreurs {
  approbationRequise: boolean;
  pieceRequise: boolean;
  urgenceRequise: boolean;
  lienValiditeJours: number;
}

const REGLAGES_DEFAUT: ReglagesLivreurs = { approbationRequise: true, pieceRequise: false, urgenceRequise: false, lienValiditeJours: 7 };

export async function lireReglagesLivreurs(db: SupabaseClient = clientLivraison()): Promise<ReglagesLivreurs> {
  const { data, error } = await db
    .from("parametres_livraison")
    .select("livreur_approbation_requise, livreur_piece_requise, livreur_urgence_requise, livreur_lien_validite_jours")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return REGLAGES_DEFAUT;
  return {
    approbationRequise: data.livreur_approbation_requise !== false,
    pieceRequise: data.livreur_piece_requise === true,
    urgenceRequise: data.livreur_urgence_requise === true,
    lienValiditeJours: Number(data.livreur_lien_validite_jours) || 7,
  };
}

/** Numéros déjà portés par une fiche non archivée. */
export async function telephonesDesFiches(db: SupabaseClient = clientLivraison()): Promise<Set<string>> {
  const { data } = await db.from("livreurs").select("telephone").not("telephone", "is", null).neq("cycle", "archive").limit(5000);
  return new Set(((data ?? []) as Array<{ telephone: string }>).map((l) => l.telephone));
}

export interface LienCree {
  livreurId: string;
  /** Jeton en clair : montré une seule fois, jamais stocké. */
  jeton: string;
  expireLe: string;
}

/** Génère un lien d'activation (les précédents cessent de marcher) et passe la fiche « créée » à « invitée ». */
export async function genererLien(livreurId: string, auteurId: string | null, db: SupabaseClient = clientLivraison()): Promise<Resultat<{ lien: LienCree }>> {
  const { data: l } = await db.from("livreurs").select("id, cycle, utilisateur_id").eq("id", livreurId).maybeSingle();
  if (!l) return refuser("Fiche introuvable.");
  if (!estCycleLivreur(l.cycle as string) || !["cree", "invite"].includes(l.cycle as string)) {
    return refuser("Un lien d'activation ne se génère que pour une fiche créée ou invitée.");
  }
  if (l.utilisateur_id) return refuser("Cette fiche est déjà liée à un compte.");

  const reglages = await lireReglagesLivreurs(db);
  const maintenant = new Date();
  const jeton = genererJetonActivation();
  const empreinte = await hacherJetonActivation(jeton);
  const expireLe = expirationLien(maintenant, reglages.lienValiditeJours);

  // Les anciens liens non utilisés expirent tout de suite.
  await db.from("livreur_invitations").update({ expire_le: maintenant.toISOString() }).eq("livreur_id", livreurId).is("utilise_le", null).gt("expire_le", maintenant.toISOString());
  const { error } = await db.from("livreur_invitations").insert({ livreur_id: livreurId, empreinte, expire_le: expireLe, cree_par: auteurId });
  if (error) return refuser("Impossible de créer le lien. Réessayez.");
  await db.from("livreurs").update({ cycle: "invite" }).eq("id", livreurId).in("cycle", ["cree", "invite"]);
  return { ok: true, lien: { livreurId, jeton, expireLe } };
}

export interface FicheCreee {
  livreurId: string;
  fiche: FicheLivreurValide;
  lien: LienCree;
}

/** Crée une fiche et son premier lien d'activation. Refuse un téléphone déjà porté par une fiche non archivée. */
export async function creerFicheEtLien(fiche: FicheLivreurValide, auteurId: string, db: SupabaseClient = clientLivraison()): Promise<Resultat<{ creee: FicheCreee }>> {
  const { data, error } = await db
    .from("livreurs")
    .insert({ nom: fiche.nom, telephone: fiche.telephone, vehicule: fiche.vehicule, email_invitation: fiche.email, cycle: "cree", statut: "hors_ligne", simule: false })
    .select("id")
    .single();
  if (error || !data) {
    return refuser(error?.code === "23505" ? "Ce numéro a déjà une fiche livreur." : "Impossible de créer la fiche. Réessayez.");
  }
  const lien = await genererLien(data.id as string, auteurId, db);
  if (!lien.ok) return lien;
  return { ok: true, creee: { livreurId: data.id as string, fiche, lien: lien.lien } };
}

/**
 * Activation par le livreur : le lien ouvert dans SON compte lie la fiche à ce compte. Le message d'échec ne distingue pas
 * « inconnu », « expiré » et « déjà utilisé » (on ne renseigne pas quelqu'un qui devine des liens).
 */
export async function activerCompte(jeton: string, utilisateurId: string, dossier: DossierSaisi, db: SupabaseClient = clientLivraison()): Promise<Resultat<{ cycle: CycleLivreur }>> {
  const invalide = "Ce lien est invalide ou a expiré. Demandez-en un nouveau à Speedfood.";
  if (!jetonActivationPlausible(jeton)) return refuser(invalide);
  const empreinte = await hacherJetonActivation(jeton);
  const maintenantIso = new Date().toISOString();

  const { data: invitation } = await db
    .from("livreur_invitations")
    .select("id, livreur_id")
    .eq("empreinte", empreinte)
    .is("utilise_le", null)
    .gt("expire_le", maintenantIso)
    .maybeSingle();
  if (!invitation) return refuser(invalide);

  const { data: deja } = await db.from("livreurs").select("id").eq("utilisateur_id", utilisateurId).maybeSingle();
  if (deja) return refuser("Ce compte est déjà lié à une fiche livreur.");

  const { data: fiche } = await db.from("livreurs").select("id, cycle, utilisateur_id").eq("id", invitation.livreur_id).maybeSingle();
  if (!fiche || fiche.cycle !== "invite" || fiche.utilisateur_id) return refuser(invalide);

  const reglages = await lireReglagesLivreurs(db);
  const controle = validerDossier(dossier, { pieceRequise: reglages.pieceRequise, urgenceRequise: reglages.urgenceRequise });
  if (!controle.ok) return refuser(controle.erreur);

  // Le lien est consommé D'ABORD (conditionnel) : deux ouvertures simultanées ne lient pas deux comptes.
  const { data: consomme } = await db.from("livreur_invitations").update({ utilise_le: maintenantIso }).eq("id", invitation.id).is("utilise_le", null).select("id");
  if (!consomme || consomme.length === 0) return refuser(invalide);

  const cycle: CycleLivreur = reglages.approbationRequise ? "candidat" : "actif";
  const { data: lie, error } = await db
    .from("livreurs")
    .update({ utilisateur_id: utilisateurId, cycle, ...(cycle === "actif" ? { approuve_le: maintenantIso } : {}) })
    .eq("id", fiche.id)
    .eq("cycle", "invite")
    .select("id");
  if (error || !lie || lie.length === 0) return refuser("Impossible d'activer le compte. Demandez un nouveau lien.");

  const d = controle.dossier;
  if (d.pieceType || d.urgenceTelephone) {
    await db.from("livreur_dossiers").upsert(
      { livreur_id: fiche.id, piece_type: d.pieceType, piece_numero: d.pieceNumero, urgence_nom: d.urgenceNom, urgence_telephone: d.urgenceTelephone, consentement_le: maintenantIso },
      { onConflict: "livreur_id" }
    );
  }
  return { ok: true, cycle };
}

async function changerCycle(
  livreurId: string,
  vers: CycleLivreur,
  options: { auteurId: string; motif?: string; depuis?: CycleLivreur[] }
): Promise<Resultat> {
  const db = clientLivraison();
  const { data: l } = await db.from("livreurs").select("id, cycle, statut").eq("id", livreurId).maybeSingle();
  if (!l || !estCycleLivreur(l.cycle as string)) return refuser("Fiche introuvable.");
  const de = l.cycle as CycleLivreur;
  if (options.depuis && !options.depuis.includes(de)) return refuser("Cette action ne s'applique pas à l'état actuel de la fiche.");
  if (!transitionCycleAutorisee(de, vers)) return refuser("Ce changement n'est pas possible depuis l'état actuel.");
  if ((vers === "suspendu" || vers === "archive") && !peutQuitterLeTravail(l.statut as "hors_ligne" | "disponible" | "en_course")) {
    return refuser("Ce livreur est en course : terminez ou réaffectez la course d'abord.");
  }
  const maintenantIso = new Date().toISOString();
  const patch: Record<string, unknown> = { cycle: vers, motif_cycle: options.motif?.slice(0, 300) ?? null };
  if (vers === "actif" && de === "candidat") {
    patch.approuve_le = maintenantIso;
    patch.approuve_par = options.auteurId;
  }
  // Un livreur qui quitte le travail disparaît des offres : hors ligne et offres en attente expirées.
  if (vers === "suspendu" || vers === "archive") patch.statut = "hors_ligne";
  const { data: change } = await db.from("livreurs").update(patch).eq("id", livreurId).eq("cycle", de).select("id");
  if (!change || change.length === 0) return refuser("La fiche a changé entre-temps. Rechargez la page.");
  if (vers === "suspendu" || vers === "archive") {
    await db.from("livraison_offres").update({ statut: "expiree", repondu_le: maintenantIso }).eq("livreur_id", livreurId).eq("statut", "en_attente");
    await db.from("livreur_invitations").update({ expire_le: maintenantIso }).eq("livreur_id", livreurId).is("utilise_le", null);
  }
  return { ok: true };
}

export const approuverLivreur = (livreurId: string, auteurId: string, motif?: string) => changerCycle(livreurId, "actif", { auteurId, motif, depuis: ["candidat"] });
export const refuserLivreur = (livreurId: string, auteurId: string, motif: string) => changerCycle(livreurId, "archive", { auteurId, motif, depuis: ["candidat", "invite", "cree"] });
export const suspendreLivreur = (livreurId: string, auteurId: string, motif: string) => changerCycle(livreurId, "suspendu", { auteurId, motif, depuis: ["actif"] });
export const reactiverLivreur = (livreurId: string, auteurId: string) => changerCycle(livreurId, "actif", { auteurId, depuis: ["suspendu"] });
export const archiverLivreur = (livreurId: string, auteurId: string, motif: string) => changerCycle(livreurId, "archive", { auteurId, motif, depuis: ["cree", "invite", "actif", "suspendu"] });

/** Nom de la fiche à laquelle correspond un lien valide (pour l'afficher avant l'activation) ; `null` si le lien ne marche pas. */
export async function fichePourJeton(jeton: string, db: SupabaseClient = clientLivraison()): Promise<{ nom: string } | null> {
  if (!jetonActivationPlausible(jeton)) return null;
  const empreinte = await hacherJetonActivation(jeton);
  const { data } = await db
    .from("livreur_invitations")
    .select("livreurs(nom, cycle, utilisateur_id)")
    .eq("empreinte", empreinte)
    .is("utilise_le", null)
    .gt("expire_le", new Date().toISOString())
    .maybeSingle();
  const l = (data as unknown as { livreurs: { nom: string; cycle: string; utilisateur_id: string | null } | { nom: string; cycle: string; utilisateur_id: string | null }[] | null } | null)?.livreurs;
  const fiche = Array.isArray(l) ? l[0] : l;
  return fiche && fiche.cycle === "invite" && !fiche.utilisateur_id ? { nom: fiche.nom } : null;
}
