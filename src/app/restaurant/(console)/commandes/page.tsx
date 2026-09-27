import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card, Badge } from "@/components/ui";

const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  prete: "Prête",
  terminee: "Terminée",
  annulee: "Annulée",
};

export default async function CommandesPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");

  const { data: commandes } = await supabase
    .from("orders")
    .select("id, reference, client_nom, mode, sous_total, statut, cree_le")
    .eq("restaurant_id", membership.restaurant_id)
    .order("cree_le", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Commandes</h1>

      {!commandes || commandes.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Aucune commande pour l&apos;instant. Vos commandes clients apparaîtront ici dès que la
            prise de commande sera activée.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {commandes.map((commande) => (
            <Card key={commande.id} style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>{commande.reference}</strong>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>
                  {commande.client_nom} · {commande.mode === "livraison" ? "Livraison" : "Retrait"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge ton="neutre">{LIBELLES_STATUT[commande.statut] ?? commande.statut}</Badge>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {commande.sous_total.toLocaleString("fr-FR")} GNF
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
