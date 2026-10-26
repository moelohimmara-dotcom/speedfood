import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { validerImage } from "@/lib/storage/images";
import {
  DELAI_REPONSE_HEURES,
  LIBELLE_ETAT_CANDIDAT,
  cheminImageCandidature,
  etatPourCandidat,
  lireQuartierId,
  reponseAttendueLe,
  validerCandidature,
  type EtatCandidat,
} from "./candidature";

/**
 * Candidature d'un restaurateur déposée depuis l'application (lot R1). Tout passe par le client d'administration (la table et le dépôt `candidatures` n'ont aucun accès
 * direct) ; l'identité vient du jeton vérifié par la route, jamais du corps de la requête.
 */

const BUCKET = "candidatures";
const db = () => creerClientAdmin() as unknown as SupabaseClient;

export interface VueCandidature {
  id: string;
  etat: EtatCandidat;
  libelleEtat: string;
  nom: string;
  deposeeLe: string;
  delaiHeures: number;
  reponseAttendueLe: string | null;
  /** Affiché seulement quand la demande est refusée. */
  motifRefus: string | null;
  aLogo: boolean;
  aPhoto: boolean;
  nombrePlats: number;
}

type Ligne = Record<string, unknown>;

function vue(l: Ligne): VueCandidature {
  const etat = etatPourCandidat(String(l.statut));
  const plats = Array.isArray(l.menu_brouillon) ? l.menu_brouillon.length : 0;
  return {
    id: String(l.id),
    etat,
    libelleEtat: LIBELLE_ETAT_CANDIDAT[etat],
    nom: String(l.organisation),
    deposeeLe: String(l.cree_le),
    delaiHeures: DELAI_REPONSE_HEURES,
    reponseAttendueLe: reponseAttendueLe(String(l.cree_le)),
    motifRefus: etat === "refusee" && typeof l.motif_refus === "string" ? l.motif_refus : null,
    aLogo: typeof l.logo_chemin === "string",
    aPhoto: typeof l.photo_chemin === "string",
    nombrePlats: plats,
  };
}

const COLONNES = "id, statut, organisation, cree_le, motif_refus, logo_chemin, photo_chemin, menu_brouillon";

/** La candidature la plus récente du compte (ouverte, ou refusée en dernier), ou null. */
export async function lireCandidature(utilisateurId: string): Promise<VueCandidature | null> {
  const { data } = await db().from("referencement_demandes").select(COLONNES).eq("utilisateur_id", utilisateurId).order("cree_le", { ascending: false }).limit(1).maybeSingle();
  return data ? vue(data as Ligne) : null;
}

export type ResultatDepot = { ok: true; candidature: VueCandidature } | { ok: false; code: "VALIDATION" | "CONFLIT_ETAT" | "ERREUR_SERVEUR"; message: string };

/** Dépose la candidature. Une seule demande ouverte par compte : la précédente doit avoir été refusée. */
export async function deposerCandidature(utilisateurId: string, corps: unknown): Promise<ResultatDepot> {
  const quartierId = lireQuartierId(corps);
  if (!quartierId) return { ok: false, code: "VALIDATION", message: "Choisissez le quartier de votre restaurant." };

  const admin = db();
  const { data: utilisateur } = await admin.auth.admin.getUserById(utilisateurId);
  const email = utilisateur?.user?.email;
  if (!email) return { ok: false, code: "VALIDATION", message: "Votre compte n'a pas d'adresse e-mail : l'équipe n'aurait pas de quoi vous répondre." };

  const { data: quartier } = await admin.from("neighborhoods").select("nom, actif, communes(nom)").eq("id", quartierId).maybeSingle();
  const q = quartier as { nom: string; actif: boolean; communes: { nom: string } | { nom: string }[] | null } | null;
  const commune = Array.isArray(q?.communes) ? q?.communes[0]?.nom : q?.communes?.nom;
  if (!q || !q.actif || !commune) return { ok: false, code: "VALIDATION", message: "Ce quartier n'est pas reconnu. Choisissez-le dans la liste." };

  const verifiee = validerCandidature(corps, { commune, quartier: q.nom, email });
  if (!verifiee.ok) return { ok: false, code: "VALIDATION", message: verifiee.erreur };
  const { demande: d, horaires, moyensPaiement, services, plats } = verifiee.candidature;

  const { data, error } = await admin
    .from("referencement_demandes")
    .insert({
      type_etablissement: d.type,
      organisation: d.organisation,
      commune: d.commune,
      quartier: d.quartier,
      indications: d.indications,
      categories: d.categories,
      specialites: d.specialites,
      responsable_prenom: d.prenom,
      responsable_nom: d.nom,
      contact_email: d.email,
      contact_telephone: d.telephone,
      utilisateur_id: utilisateurId,
      origine: "application",
      horaires,
      moyens_paiement: moyensPaiement,
      services,
      menu_brouillon: plats.length > 0 ? plats : null,
    })
    .select(COLONNES)
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, code: "CONFLIT_ETAT", message: "Vous avez déjà une demande en cours : suivez-la depuis votre espace." };
    console.error("candidature_echec", error.code);
    return { ok: false, code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer votre demande pour le moment. Réessayez dans un instant." };
  }
  return { ok: true, candidature: vue(data as Ligne) };
}

/**
 * Logo ou photo de la candidature ouverte du compte, dans le dépôt PRIVÉ. Mêmes contrôles que partout (type, 5 Mo, signature réelle des octets) ; le nom est généré
 * côté serveur ; l'ancien fichier est supprimé une fois le nouveau rattaché. Les images ne deviennent publiques que si l'équipe accepte et crée l'établissement.
 */
export async function ajouterImageCandidature(utilisateurId: string, type: unknown, fichier: File | null): Promise<ResultatDepot> {
  if (type !== "logo" && type !== "photo") return { ok: false, code: "VALIDATION", message: "Type d'image inconnu." };
  const admin = db();
  const { data: ouverte } = await admin
    .from("referencement_demandes")
    .select("id, logo_chemin, photo_chemin")
    .eq("utilisateur_id", utilisateurId)
    .neq("statut", "refusee")
    .neq("statut", "creee")
    .maybeSingle();
  if (!ouverte) return { ok: false, code: "CONFLIT_ETAT", message: "Aucune demande ouverte : déposez d'abord votre demande." };

  let extension: string;
  try {
    ({ extension } = await validerImage(fichier));
  } catch (erreur) {
    return { ok: false, code: "VALIDATION", message: erreur instanceof ErreurMetier ? erreur.message : "Image invalide." };
  }
  const chemin = cheminImageCandidature(utilisateurId, type, extension, randomUUID());
  const { error: televersement } = await admin.storage.from(BUCKET).upload(chemin, fichier as File, { contentType: (fichier as File).type, upsert: false });
  if (televersement) return { ok: false, code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer l'image. Réessayez dans un instant." };

  const colonne = type === "logo" ? "logo_chemin" : "photo_chemin";
  const ancien = (ouverte as Ligne)[colonne];
  const { data, error } = await admin.from("referencement_demandes").update({ [colonne]: chemin }).eq("id", (ouverte as Ligne).id).select(COLONNES).single();
  if (error) {
    await admin.storage.from(BUCKET).remove([chemin]);
    return { ok: false, code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer l'image. Réessayez dans un instant." };
  }
  if (typeof ancien === "string") await admin.storage.from(BUCKET).remove([ancien]);
  return { ok: true, candidature: vue(data as Ligne) };
}
