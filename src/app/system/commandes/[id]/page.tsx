import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirCommandeAdmin, type PropositionRevisseeAdmin } from "@/lib/system-admin/commandes";
import type { StatutProposition } from "@/lib/contracts/commande";
import { Card, Badge } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { formaterDateCourte, formaterEcheance } from "../../formatage";
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

const LIBELLES_STATUT_PROPOSITION: Record<StatutProposition, string> = {
  en_attente: "En attente de réponse client",
  acceptee: "Acceptée par le client",
  refusee: "Refusée par le client",
  expiree: "Expirée",
};

const TONS_STATUT_PROPOSITION: Record<StatutProposition, "succes" | "danger" | "neutre"> = {
  en_attente: "neutre",
  acceptee: "succes",
  refusee: "danger",
  expiree: "neutre",
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
      <LienRetour href="/system/commandes">Retour aux commandes</LienRetour>

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
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Propositions révisées</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--secondaire)", marginTop: 0 }}>
          Historique complet des versions proposées par le restaurant — lecture seule : les
          propositions sont immuables, seule la réponse du client les fait évoluer.
        </p>
        {commande.propositions.length === 0 ? (
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune proposition révisée.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {commande.propositions.map((proposition) => (
              <LigneProposition key={proposition.version} proposition={proposition} />
            ))}
          </div>
        )}
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

function formaterMontant(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

/** Une version de proposition — bloc d'affichage pur, lecture seule. */
function LigneProposition({ proposition }: { proposition: PropositionRevisseeAdmin }) {
  return (
    <div
      style={{
        border: "1px solid var(--bordure)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong>Version {proposition.version}</strong>
        <Badge ton={TONS_STATUT_PROPOSITION[proposition.statut]}>
          {LIBELLES_STATUT_PROPOSITION[proposition.statut]}
        </Badge>
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem" }}>
        <strong>Sous-total :</strong> {formaterMontant(proposition.sousTotalPrecedent)} →{" "}
        {formaterMontant(proposition.nouveauSousTotal)}
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem" }}>
        <strong>Frais de livraison :</strong>{" "}
        {proposition.fraisLivraisonPrecedent === null
          ? formaterMontant(proposition.nouveauxFraisLivraison)
          : `${formaterMontant(proposition.fraisLivraisonPrecedent)} → ${formaterMontant(proposition.nouveauxFraisLivraison)}`}
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem" }}>
        <strong>Conditions :</strong>{" "}
        {proposition.conditionsModifiees ? proposition.conditionsModifiees : "—"}
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>
        Échéance : {formaterEcheance(proposition.expireLe)} · Créée le{" "}
        {formaterDateCourte(proposition.creeLe)}
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>
        Réponse :{" "}
        {proposition.reponduLe
          ? `le ${formaterDateCourte(proposition.reponduLe)}`
          : "en attente de réponse client"}
      </p>
    </div>
  );
}
