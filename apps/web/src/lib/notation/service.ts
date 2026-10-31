import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import {
  INTERVALLE_AVIS_MEME_RESTAURANT_JOURS,
  messageRefus,
  noteModifiable,
  prenomAffiche,
  raisonNotationImpossible,
  validerAvis,
  type AvisSaisi,
  type AvisValide,
} from "./regles";

/**
 * Service de notation (voir docs/NOTATION.md). Toutes les écritures passent ici, avec la clé de service : l'identité de l'auteur et
 * son droit de noter sont vérifiés côté serveur, jamais lus dans la requête du navigateur.
 */

export interface AvisExistant {
  note: number;
  etiquettes: string[];
  commentaire: string | null;
  modifiable: boolean;
}

export interface EtatNotationClient {
  notable: boolean;
  /** Pourquoi on ne peut pas (encore) noter : texte affichable, ou `null` si notable. */
  message: string | null;
  restaurantNom: string;
  restaurant: AvisExistant | null;
  /** Présent seulement si un livreur a effectué la livraison (livrée). */
  livreur: { nom: string; avis: AvisExistant | null } | null;
}

interface CommandeDuClient {
  id: string;
  restaurant_id: string;
  statut: string;
  est_test: boolean;
  saisie_par: string | null;
  mis_a_jour_le: string;
  restaurants: { nom: string } | null;
}

/** La commande portant ce jeton, SEULEMENT si elle appartient au compte connecté. */
async function commandeDuClient(jeton: string, utilisateurId: string): Promise<CommandeDuClient | null> {
  const { data } = await clientLivraison()
    .from("orders")
    .select("id, restaurant_id, statut, est_test, saisie_par, mis_a_jour_le, restaurants(nom)")
    .eq("jeton_suivi", jeton)
    .eq("client_user_id", utilisateurId)
    .maybeSingle();
  return (data as unknown as CommandeDuClient | null) ?? null;
}

async function livreurDeLaCommande(orderId: string): Promise<{ id: string; nom: string } | null> {
  const { data } = await clientLivraison()
    .from("livraisons")
    .select("livreur_id, statut, livreurs(nom)")
    .eq("order_id", orderId)
    .maybeSingle();
  const l = data as unknown as { livreur_id: string | null; statut: string; livreurs: { nom: string } | null } | null;
  if (!l || l.statut !== "livree" || !l.livreur_id) return null;
  return { id: l.livreur_id, nom: l.livreurs?.nom ?? "Votre livreur" };
}

function versAvisExistant(ligne: { note: number; etiquettes: string[]; commentaire: string | null; cree_le: string } | undefined, maintenant: Date): AvisExistant | null {
  if (!ligne) return null;
  return { note: ligne.note, etiquettes: ligne.etiquettes ?? [], commentaire: ligne.commentaire, modifiable: noteModifiable(ligne.cree_le, maintenant) };
}

export async function etatNotationClient(jeton: string, utilisateurId: string, maintenant = new Date()): Promise<EtatNotationClient | null> {
  const commande = await commandeDuClient(jeton, utilisateurId);
  if (!commande) return null;
  const restaurantNom = commande.restaurants?.nom ?? "le restaurant";
  const raison = raisonNotationImpossible({ statut: commande.statut, estTest: commande.est_test, clotureLe: commande.mis_a_jour_le, saisiePersonnel: commande.saisie_par !== null }, maintenant);
  if (raison) return { notable: false, message: messageRefus(raison), restaurantNom, restaurant: null, livreur: null };

  const [{ data: avis, error: erreurAvis }, livreur] = await Promise.all([
    clientLivraison().from("avis").select("cible, note, etiquettes, commentaire, cree_le").eq("order_id", commande.id).eq("auteur", "client"),
    livreurDeLaCommande(commande.id),
  ]);
  // Table des avis absente (migration non appliquée) ou panne : on ne propose pas un formulaire qui échouerait.
  if (erreurAvis) return { notable: false, message: null, restaurantNom, restaurant: null, livreur: null };
  const lignes = (avis ?? []) as { cible: string; note: number; etiquettes: string[]; commentaire: string | null; cree_le: string }[];
  return {
    notable: true,
    message: null,
    restaurantNom,
    restaurant: versAvisExistant(lignes.find((a) => a.cible === "restaurant"), maintenant),
    livreur: livreur ? { nom: livreur.nom, avis: versAvisExistant(lignes.find((a) => a.cible === "livreur"), maintenant) } : null,
  };
}

export type ResultatEnregistrement = { ok: true } | { ok: false; erreur: string };

/**
 * Enregistre la note du client sur le restaurant et, s'il y en a un, sur le livreur. Une note existante n'est modifiable que
 * pendant la fenêtre de modification ; passé ce délai elle reste telle quelle.
 */
export async function enregistrerAvisClient(args: {
  jeton: string;
  utilisateurId: string;
  restaurant: Omit<AvisSaisi, "auteur" | "cible">;
  livreur?: Omit<AvisSaisi, "auteur" | "cible"> | null;
  maintenant?: Date;
}): Promise<ResultatEnregistrement> {
  const maintenant = args.maintenant ?? new Date();
  const commande = await commandeDuClient(args.jeton, args.utilisateurId);
  if (!commande) return { ok: false, erreur: "Commande introuvable." };
  const raison = raisonNotationImpossible({ statut: commande.statut, estTest: commande.est_test, clotureLe: commande.mis_a_jour_le, saisiePersonnel: commande.saisie_par !== null }, maintenant);
  if (raison) return { ok: false, erreur: messageRefus(raison) };

  const resto = validerAvis({ ...args.restaurant, auteur: "client", cible: "restaurant" });
  if (!resto.ok) return { ok: false, erreur: resto.erreur };

  let livreurId: string | null = null;
  let avisLivreur: AvisValide | null = null;
  if (args.livreur) {
    const livreur = await livreurDeLaCommande(commande.id);
    if (!livreur) return { ok: false, erreur: "Aucun livreur n'a livré cette commande." };
    const v = validerAvis({ ...args.livreur, auteur: "client", cible: "livreur" });
    if (!v.ok) return { ok: false, erreur: v.erreur };
    livreurId = livreur.id;
    avisLivreur = v.avis;
  }

  const db = clientLivraison();
  // Prénom affiché : le pseudo du compte (jamais l'e-mail ni le téléphone).
  const { data: profil } = await db.from("client_profils").select("pseudo").eq("utilisateur_id", args.utilisateurId).maybeSingle();
  const prenom = prenomAffiche((profil as { pseudo?: string } | null)?.pseudo ?? "");

  // Anti-bourrage : un compte ne note un même restaurant qu'une fois par période (une note déjà donnée pour CETTE commande reste modifiable).
  const { data: dejaCetteCommande } = await db.from("avis").select("id").eq("order_id", commande.id).eq("cible", "restaurant").eq("auteur", "client").maybeSingle();
  if (!dejaCetteCommande) {
    const depuis = new Date(maintenant.getTime() - INTERVALLE_AVIS_MEME_RESTAURANT_JOURS * 86_400_000).toISOString();
    const { count } = await db
      .from("avis")
      .select("id", { count: "exact", head: true })
      .eq("auteur_utilisateur_id", args.utilisateurId)
      .eq("restaurant_id", commande.restaurant_id)
      .eq("cible", "restaurant")
      .eq("auteur", "client")
      .gte("cree_le", depuis);
    if ((count ?? 0) > 0) return { ok: false, erreur: `Vous avez déjà donné un avis sur ce restaurant ces ${INTERVALLE_AVIS_MEME_RESTAURANT_JOURS} derniers jours.` };
  }

  const poser = async (cible: "restaurant" | "livreur", avis: AvisValide): Promise<string | null> => {
    const { data: existant } = await db
      .from("avis")
      .select("id, cree_le")
      .eq("order_id", commande.id)
      .eq("cible", cible)
      .eq("auteur", "client")
      .maybeSingle();
    const e = existant as { id: string; cree_le: string } | null;
    if (e) {
      if (!noteModifiable(e.cree_le, maintenant)) return "Cette note ne peut plus être modifiée.";
      const { error } = await db
        .from("avis")
        .update({ note: avis.note, etiquettes: avis.etiquettes, commentaire: avis.commentaire, modifie_le: maintenant.toISOString() })
        .eq("id", e.id);
      return error ? "Enregistrement impossible, réessayez." : null;
    }
    const { error } = await db.from("avis").insert({
      order_id: commande.id,
      cible,
      auteur: "client",
      restaurant_id: commande.restaurant_id,
      livreur_id: cible === "livreur" ? livreurId : null,
      auteur_utilisateur_id: args.utilisateurId,
      note: avis.note,
      etiquettes: avis.etiquettes,
      commentaire: avis.commentaire,
      prenom_affiche: cible === "restaurant" ? prenom : null,
      est_test: commande.est_test,
    });
    return error ? "Enregistrement impossible, réessayez." : null;
  };

  const erreurResto = await poser("restaurant", resto.avis);
  if (erreurResto) return { ok: false, erreur: erreurResto };
  if (avisLivreur) {
    const erreurLivreur = await poser("livreur", avisLivreur);
    if (erreurLivreur) return { ok: false, erreur: erreurLivreur };
  }
  return { ok: true };
}
