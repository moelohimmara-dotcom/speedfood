import type { ApercuCommandeRestaurant } from "@speedfood/shared/contracts/commande";
import type { ReponseCommandesRestaurant } from "@speedfood/shared/contracts/restaurant-commandes";
import { libelleStatutPaiement, lienWhatsAppVers, texteRecuWhatsApp } from "@speedfood/shared/paiement/regles";
import { texteDocumentWhatsApp } from "../paiement/documents-regles";

/**
 * Projection des commandes du restaurant pour l'application : UNE seule définition, partagée par la route du site et par l'API unique (aucune règle recopiée).
 * Sans dépendance serveur (ni `server-only`, ni alias `@/`) : testable seule.
 *
 * Paiement et documents : le libellé du statut, les numéros de reçu et de facture, et les liens WhatsApp (texte prérempli, que le restaurateur envoie lui-même)
 * sont composés ICI, avec les mêmes règles que la console du site. Le jeton du reçu (clé de lecture d'un document) n'est jamais envoyé à l'application : seul le
 * lien WhatsApp qui le contient l'est, et seulement vers le client de la commande.
 */
export function projeterCommandesRestaurant(entree: {
  commandes: ApercuCommandeRestaurant[];
  documents: ReadonlyArray<{ order_id: string; type: string; numero: string }>;
  restaurant: { id: string; nom: string; ouvert: boolean; accepte_commandes: boolean } | null;
  /** Origine PUBLIQUE DU SITE (la page `/recu/…` vit sur le site, pas sur l'API). */
  origine: string;
}): ReponseCommandesRestaurant {
  const { commandes, documents, restaurant, origine } = entree;
  const numero = (id: string, type: "recu" | "facture") => documents.find((d) => d.order_id === id && d.type === type)?.numero ?? null;
  const nomRestaurant = restaurant?.nom ?? "Votre restaurant";
  return {
    ok: true,
    restaurant: restaurant ? { id: restaurant.id, nom: restaurant.nom, ouvert: restaurant.ouvert, accepteCommandes: restaurant.accepte_commandes } : null,
    commandes: commandes.map((c) => {
      const { jetonRecu, ...sansJeton } = c;
      const total = c.sousTotal + c.fraisLivraisonEstime;
      const paiementVisible = ["acceptee", "prete", "terminee"].includes(c.etatDerive);
      const recu = numero(c.id, "recu");
      const facture = numero(c.id, "facture");
      const lienRecu = `${origine}/recu/${jetonRecu}`;
      return {
        ...sansJeton,
        paiementVisible,
        paiementLibelle: libelleStatutPaiement(c.paiementStatut, c.paiementMode),
        documents: { recu, facture },
        lienRecuWhatsApp: paiementVisible
          ? lienWhatsAppVers(c.clientTelephone, texteRecuWhatsApp({ restaurant: nomRestaurant, reference: c.reference, total, statut: c.paiementStatut, lien: lienRecu }))
          : null,
        lienFactureWhatsApp: facture
          ? lienWhatsAppVers(c.clientTelephone, texteDocumentWhatsApp({ type: "facture", numero: facture, restaurant: nomRestaurant, total, lien: `${lienRecu}?doc=facture` }))
          : null,
      };
    }),
  };
}
