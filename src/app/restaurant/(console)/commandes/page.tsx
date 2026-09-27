import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { Card, Alert } from "@/components/ui";
import { CommandeCarte } from "./CommandeCarte";

/**
 * Console restaurant — commandes (bloc 7).
 *
 * Lecture via la session du membre : la RLS `membres_lecture_leurs_commandes`
 * garantit que le restaurant ne voit que ses propres commandes. Les actions
 * (accepter/refuser/prête/terminée/annuler, proposition révisée) sont dans
 * CommandeCarte et validées côté serveur.
 */
export default async function CommandesPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");

  let commandes: Awaited<ReturnType<typeof chargerApercusCommandes>> = [];
  let erreurChargement: string | null = null;
  try {
    commandes = await chargerApercusCommandes(supabase, membership.restaurant_id);
  } catch (erreur) {
    erreurChargement =
      erreur instanceof ErreurMetier
        ? erreur.message
        : "Impossible de charger les commandes. Réessayez dans un instant.";
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Commandes</h1>

      {erreurChargement ? (
        <Alert ton="danger">{erreurChargement}</Alert>
      ) : commandes.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Aucune commande pour l&apos;instant. Vos commandes clients apparaîtront ici dès qu&apos;un
            client en passera une.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {commandes.map((commande) => (
            <CommandeCarte key={commande.id} commande={commande} />
          ))}
        </div>
      )}
    </div>
  );
}
