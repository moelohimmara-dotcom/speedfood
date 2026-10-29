import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { apresTransitionCommande } from "@/lib/livraison/apres-commande";
import { estJetonValide } from "./jetons";
import { enregistrerEvenementStatut } from "./transitions";

/**
 * Annulation d'une commande par le client (porteur du jeton de suivi), possible UNIQUEMENT tant que le restaurant n'a pas répondu (statut `en_attente`) : rien n'est
 * encore préparé, donc aucune perte pour lui. Ensuite, le client appelle l'assistance.
 *
 * L'écriture est conditionnelle (`statut = 'en_attente'` dans la même requête) : si le restaurant accepte au même instant, une seule des deux actions l'emporte et le
 * client reçoit un message clair, jamais une commande acceptée puis annulée sans qu'il le sache. La transition est aussi validée par le trigger de base
 * (`fn_valider_transition_commande`). Acteur historisé : `client:<référence>` (aucun jeton ni donnée personnelle).
 */
export async function annulerParClient(jeton: unknown): Promise<{ reference: string }> {
  if (!estJetonValide(jeton)) {
    throw new ErreurMetier("VALIDATION", "Lien de suivi invalide.");
  }
  const db = creerClientAdmin();

  const { data: commande, error } = await db.from("orders").select("id, reference, statut").eq("jeton_suivi", jeton).maybeSingle();
  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible d'annuler pour le moment. Réessayez.");
  }
  if (!commande) {
    throw new ErreurMetier("INTROUVABLE", "Commande introuvable.");
  }
  // Déjà annulée (double appui, nouvel essai) : même réponse qu'un succès, rien n'est réécrit.
  if (commande.statut === "annulee") {
    return { reference: commande.reference };
  }
  if (commande.statut !== "en_attente") {
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      "Le restaurant a déjà répondu à votre commande : elle ne peut plus être annulée ici. Appelez l'assistance Speedfood."
    );
  }

  const { data: modifiees, error: erreurMaj } = await db
    .from("orders")
    .update({ statut: "annulee" })
    .eq("id", commande.id)
    .eq("statut", "en_attente")
    .select("id");
  if (erreurMaj) {
    throw new ErreurMetier("CONFLIT_ETAT", "La commande a changé d'état entre-temps. Rechargez l'écran et réessayez.");
  }
  if (!modifiees || modifiees.length === 0) {
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      "Le restaurant vient de répondre à votre commande : elle ne peut plus être annulée ici. Appelez l'assistance Speedfood."
    );
  }

  await enregistrerEvenementStatut(db, {
    commandeId: commande.id,
    statutPrecedent: "en_attente",
    statutSuivant: "annulee",
    acteur: `client:${commande.reference}`,
  });
  // Livraison annulée, remboursement du paiement en ligne s'il y en a un, notification au client : ne fait jamais échouer l'annulation.
  await apresTransitionCommande(commande.id, "annulee");
  return { reference: commande.reference };
}
