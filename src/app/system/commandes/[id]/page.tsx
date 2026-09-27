import { notFound } from "next/navigation";
import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirCommandeAdmin } from "@/lib/system-admin/commandes";
import { Card, Badge } from "@/components/ui";
import { RevelerCoordonnees } from "./RevelerCoordonnees";
import { ActionSupportStatut } from "./ActionSupportStatut";

const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  prete: "Prête",
  terminee: "Terminée",
  annulee: "Annulée",
};

export default async function CommandeDetailSystemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerPermissionPage("commande.consulter");
  const { id } = await params;

  const commande = await obtenirCommandeAdmin(id);
  if (!commande) {
    notFound();
  }

  return (
    <div>
      <Link href="/system/commandes" style={{ color: "var(--secondaire)", fontWeight: 700, fontSize: "0.9rem" }}>
        ← Retour aux commandes
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "var(--space-3) 0 var(--space-5)" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{commande.reference}</h1>
        <Badge ton="neutre">{LIBELLES_STATUT[commande.statut] ?? commande.statut}</Badge>
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Détails</h2>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Restaurant :</strong> {commande.restaurantNom}
        </p>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Client :</strong> {commande.clientNom}
        </p>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Mode :</strong> {commande.mode === "livraison" ? "Livraison" : "Retrait"}
        </p>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Montant :</strong> {commande.sousTotal.toLocaleString("fr-FR")} GNF
        </p>
        <RevelerCoordonnees
          commandeId={commande.id}
          telephoneAffiche={commande.telephoneAffiche}
          adresseAffichee={commande.adresseAffichee}
        />
      </Card>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Historique des transitions</h2>
        {commande.historique.length === 0 ? (
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucun événement.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {commande.historique.map((e, index) => (
              <div key={index} style={{ fontSize: "0.85rem" }}>
                <strong>
                  {e.statutPrecedent ? `${LIBELLES_STATUT[e.statutPrecedent]} → ` : ""}
                  {LIBELLES_STATUT[e.statutSuivant]}
                </strong>{" "}
                <span style={{ color: "var(--secondaire)" }}>
                  par {e.acteur} le {new Date(e.horodatage).toLocaleString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Action de support</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--secondaire)", marginBottom: "var(--space-3)" }}>
          Réservée à une procédure de support explicite (motif obligatoire, journalisée) — ce n&apos;est
          pas l&apos;action normale du restaurant.
        </p>
        <ActionSupportStatut commandeId={commande.id} statutActuel={commande.statut} />
      </Card>
    </div>
  );
}
