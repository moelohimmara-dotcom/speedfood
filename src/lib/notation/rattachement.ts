import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import { messageRefus, raisonNotationImpossible } from "./regles";

/**
 * Rattachement d'une commande passée SANS compte (convive à table) au compte de la personne qui détient le lien de suivi, pour qu'elle
 * puisse la noter. Le lien de suivi est la clé de la commande : le détenir suffit à la revendiquer, une seule fois, tant qu'aucun compte n'y est
 * rattaché. Un membre du restaurant (ou un administrateur) ne peut pas noter sa propre commande : conflit d'intérêts.
 */

export type EtatRattachement = "sans_objet" | "non_connecte" | "rattachable" | "deja_a_vous";

interface CommandeBrute {
  id: string;
  restaurant_id: string;
  client_user_id: string | null;
  statut: string;
  est_test: boolean;
  saisie_par: string | null;
  mis_a_jour_le: string;
}

async function commandeParJeton(jeton: string): Promise<CommandeBrute | null> {
  const { data } = await clientLivraison().from("orders").select("id, restaurant_id, client_user_id, statut, est_test, saisie_par, mis_a_jour_le").eq("jeton_suivi", jeton).maybeSingle();
  return (data as CommandeBrute | null) ?? null;
}

async function estDeLEquipe(restaurantId: string, utilisateurId: string): Promise<boolean> {
  const db = clientLivraison();
  const [{ data: membre }, { data: admin }] = await Promise.all([
    db.from("restaurant_memberships").select("utilisateur_id").eq("restaurant_id", restaurantId).eq("utilisateur_id", utilisateurId).maybeSingle(),
    db.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", utilisateurId).maybeSingle(),
  ]);
  return membre !== null || admin !== null;
}

/**
 * Ce que la page de suivi doit proposer pour NOTER cette commande :
 * - `sans_objet` : pas notable (pas terminée, test, délai dépassé) ou commande d'un autre compte ;
 * - `non_connecte` : le visiteur n'a pas de session (invitation à se connecter) ;
 * - `rattachable` : commande sans compte, visiteur connecté : il peut la rattacher à son compte ;
 * - `deja_a_vous` : la commande est déjà à lui (le formulaire de notation s'affiche).
 */
export async function etatRattachement(jeton: string, utilisateurId: string | null, maintenant = new Date()): Promise<EtatRattachement> {
  const c = await commandeParJeton(jeton);
  if (!c) return "sans_objet";
  if (raisonNotationImpossible({ statut: c.statut, estTest: c.est_test, clotureLe: c.mis_a_jour_le, saisiePersonnel: c.saisie_par !== null }, maintenant)) return "sans_objet";
  if (utilisateurId === null) return "non_connecte";
  if (c.client_user_id === utilisateurId) return "deja_a_vous";
  if (c.client_user_id !== null) return "sans_objet";
  return (await estDeLEquipe(c.restaurant_id, utilisateurId)) ? "sans_objet" : "rattachable";
}

export type ResultatRattachement = { ok: true } | { ok: false; erreur: string };

export async function rattacherCommande(args: { jeton: string; utilisateurId: string; maintenant?: Date }): Promise<ResultatRattachement> {
  const maintenant = args.maintenant ?? new Date();
  const c = await commandeParJeton(args.jeton);
  if (!c) return { ok: false, erreur: "Commande introuvable." };
  const raison = raisonNotationImpossible({ statut: c.statut, estTest: c.est_test, clotureLe: c.mis_a_jour_le, saisiePersonnel: c.saisie_par !== null }, maintenant);
  if (raison) return { ok: false, erreur: messageRefus(raison) };
  if (c.client_user_id === args.utilisateurId) return { ok: true };
  if (c.client_user_id !== null) return { ok: false, erreur: "Cette commande est déjà rattachée à un compte." };
  if (await estDeLEquipe(c.restaurant_id, args.utilisateurId)) {
    return { ok: false, erreur: "Vous faites partie de l'équipe de ce restaurant : vous ne pouvez pas noter sa commande." };
  }
  // Rattachement conditionnel : deux personnes qui détiennent le lien ne peuvent pas se la disputer, la première gagne.
  const { data, error } = await clientLivraison().from("orders").update({ client_user_id: args.utilisateurId }).eq("id", c.id).is("client_user_id", null).select("id");
  if (error || !data || data.length === 0) return { ok: false, erreur: "Cette commande vient d'être rattachée à un autre compte." };
  return { ok: true };
}
