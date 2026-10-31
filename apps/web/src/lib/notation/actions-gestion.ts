"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientServeur } from "@/lib/db/server";
import { livreurDuCompte } from "@/lib/livraison/livreur";
import { limiterNotation } from "@/lib/securite/limitation-debit";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import { verifierPermission } from "@/lib/system-admin/contexte";
import { modererAvis, noterClient, repondreAvis, signalerAvis, type ActionModeration, type Resultat } from "./gestion";

/** Actions d'avis hors client : réponse et note sur le client (restaurant), note sur le client (livreur), signalement, modération. */

async function limiter(): Promise<Resultat | null> {
  try {
    await limiterNotation();
    return null;
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof ErreurMetier ? erreur.message : "Réessayez dans un instant." };
  }
}

export async function repondreAvisAction(avisId: string, texte: string): Promise<Resultat> {
  const { membership, user: utilisateur } = await obtenirContexteRestaurant("/restaurant/avis");
  if (!estUuid(avisId)) return { ok: false, erreur: "Avis invalide." };
  const refus = await limiter();
  if (refus) return refus;
  const r = await repondreAvis({ restaurantId: membership.restaurant_id, avisId, utilisateurId: utilisateur.id, texte });
  revalidatePath("/restaurant/avis");
  return r;
}

export async function noterClientParRestaurantAction(orderId: string, note: number, etiquettes: string[]): Promise<Resultat> {
  const { membership, user: utilisateur } = await obtenirContexteRestaurant("/restaurant/commandes");
  if (!estUuid(orderId)) return { ok: false, erreur: "Commande invalide." };
  const refus = await limiter();
  if (refus) return refus;
  const r = await noterClient({ orderId, auteur: "restaurant", restaurantId: membership.restaurant_id, utilisateurId: utilisateur.id, saisie: { note, etiquettes } });
  revalidatePath("/restaurant/commandes");
  return r;
}

export async function noterClientParLivreurAction(orderId: string, note: number, etiquettes: string[]): Promise<Resultat> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { ok: false, erreur: "Connectez-vous." };
  const fiche = await livreurDuCompte(user.id);
  if (!fiche) return { ok: false, erreur: "Ce compte n'est pas un compte livreur." };
  if (!estUuid(orderId)) return { ok: false, erreur: "Commande invalide." };
  const refus = await limiter();
  if (refus) return refus;
  return noterClient({ orderId, auteur: "livreur", livreurId: fiche.id, utilisateurId: user.id, saisie: { note, etiquettes } });
}

export async function signalerAvisAction(avisId: string, motif: string): Promise<Resultat> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { ok: false, erreur: "Connectez-vous pour signaler un avis." };
  if (!estUuid(avisId)) return { ok: false, erreur: "Avis invalide." };
  const refus = await limiter();
  if (refus) return refus;
  return signalerAvis({ avisId, utilisateurId: user.id, motif });
}

const ACTIONS_MODERATION: ActionModeration[] = ["masquer_commentaire", "annuler_note", "retablir", "classer_sans_suite"];

export async function modererAvisAction(avisId: string, action: ActionModeration, motif: string): Promise<Resultat> {
  const contexte = await verifierPermission("commande.support");
  if (!estUuid(avisId) || !ACTIONS_MODERATION.includes(action)) return { ok: false, erreur: "Demande invalide." };
  const r = await modererAvis({ avisId, action, motif, adminId: contexte.utilisateurId });
  if (r.ok) {
    await journaliserActionSysteme(contexte, { action: `avis.${action}`, cibleType: "avis", cibleId: avisId, motif: motif.slice(0, 300) || undefined });
    revalidatePath("/system/avis");
  }
  return r;
}
