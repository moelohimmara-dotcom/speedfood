import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { texteDocumentWhatsApp } from "@/lib/paiement/documents-regles";
import { libelleStatutPaiement, lienWhatsAppVers, texteRecuWhatsApp } from "@/lib/paiement/regles";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/**
 * Commandes du restaurant du compte pour l'application : toutes celles qui attendent une action, plus un historique récent (20). Lecture avec l'identité du
 * membre : la RLS décide de ce qui est visible.
 *
 * Paiement et documents : le libellé du statut, les numéros de reçu et de facture, et les liens WhatsApp (texte prérempli, que le restaurateur envoie lui-même)
 * sont composés ICI, avec les mêmes règles que la console du site. Le jeton du reçu (clé de lecture d'un document) n'est jamais envoyé à l'application : seul le
 * lien WhatsApp qui le contient l'est, et seulement vers le client de la commande.
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { supabase, restaurantId } = auth.contexte;
  const origine = new URL(request.url).origin;
  try {
    const [commandes, restaurant] = await Promise.all([
      chargerApercusCommandes(supabase, restaurantId, { historique: 20 }),
      supabase.from("restaurants").select("id, nom, ouvert, accepte_commandes").eq("id", restaurantId).maybeSingle(),
    ]);
    const ids = commandes.map((c) => c.id);
    const { data: documents } = ids.length
      ? await supabase.from("documents_commande").select("order_id, type, numero").eq("restaurant_id", restaurantId).in("order_id", ids).limit(200)
      : { data: [] as { order_id: string; type: string; numero: string }[] };
    const numero = (id: string, type: "recu" | "facture") => (documents ?? []).find((d) => d.order_id === id && d.type === type)?.numero ?? null;
    const nomRestaurant = restaurant.data?.nom ?? "Votre restaurant";

    return repondre({
      ok: true,
      restaurant: restaurant.data ? { id: restaurant.data.id, nom: restaurant.data.nom, ouvert: restaurant.data.ouvert, accepteCommandes: restaurant.data.accepte_commandes } : null,
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
    });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible de charger les commandes. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
