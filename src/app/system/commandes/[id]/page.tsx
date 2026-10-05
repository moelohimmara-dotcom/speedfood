import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirCommandeAdmin, type PropositionRevisseeAdmin } from "@/lib/system-admin/commandes";
import type { StatutProposition } from "@/lib/contracts/commande";
import { Badge } from "@/components/ui";
import { PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { formaterDateCourte, formaterEcheance } from "../../formatage";
import { RevelerCoordonnees } from "./RevelerCoordonnees";
import { ActionSupportStatut } from "./ActionSupportStatut";

export const metadata = { title: "Commande (administration)" };

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
      <PageHeader
        titre={commande.reference}
        retour={{ href: "/system/commandes", libelle: "Toutes les commandes" }}
        description={`${commande.restaurantNom} · ${commande.mode === "livraison" ? "livraison" : commande.mode === "sur_place" ? "à table" : "retrait"} · ${commande.sousTotal.toLocaleString("fr-FR")} GNF`}
        actions={<Pastille ton="neutre">{LIBELLES_STATUT[commande.statut] ?? commande.statut}</Pastille>}
      />

      <div className="ad-grille-deux" style={{ marginTop: 0 }}>
        <div className="ad-pile">
          <Panneau titre="Détails">
            <dl className="ad-donnees">
              <dt>Restaurant</dt>
              <dd>{commande.restaurantNom}</dd>
              <dt>Client</dt>
              <dd>{commande.clientNom}</dd>
              <dt>Mode</dt>
              <dd>{commande.mode === "livraison" ? "Livraison" : commande.mode === "sur_place" ? "À table" : "Retrait"}</dd>
              <dt>Montant</dt>
              <dd>{commande.sousTotal.toLocaleString("fr-FR")} GNF</dd>
            </dl>
            <div style={{ marginTop: "var(--space-4)" }}>
              <RevelerCoordonnees
                commandeId={commande.id}
                telephoneAffiche={commande.telephoneAffiche}
                adresseAffichee={commande.adresseAffichee}
              />
            </div>
          </Panneau>

          <Panneau titre="Propositions révisées">
            <p style={{ fontSize: "0.85rem", color: "var(--secondaire)", marginTop: 0 }}>
              Historique complet des versions proposées par le restaurant. Lecture seule : les propositions sont immuables, seule
              la réponse du client les fait évoluer.
            </p>
            {commande.propositions.length === 0 ? (
              <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune proposition révisée.</p>
            ) : (
              <div className="ad-pile" style={{ gap: 10 }}>
                {commande.propositions.map((proposition) => (
                  <LigneProposition key={proposition.version} proposition={proposition} />
                ))}
              </div>
            )}
          </Panneau>
        </div>

        <div className="ad-pile">
          <Panneau titre="Historique">
            {commande.historique.length === 0 ? (
              <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucun événement.</p>
            ) : (
              <ol className="ad-chronologie">
                {commande.historique.map((e, index) => (
                  <li key={index}>
                    <strong>
                      {e.statutPrecedent ? `${LIBELLES_STATUT[e.statutPrecedent]} → ` : ""}
                      {LIBELLES_STATUT[e.statutSuivant]}
                    </strong>
                    <span>
                      par {e.acteur} le {new Date(e.horodatage).toLocaleString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panneau>

          <Panneau titre="Action de support">
            <p style={{ fontSize: "0.85rem", color: "var(--secondaire)", marginTop: 0 }}>
              Réservée à une procédure de support explicite (motif obligatoire, journalisée). Ce n&apos;est pas l&apos;action
              normale du restaurant.
            </p>
            <ActionSupportStatut commandeId={commande.id} statutActuel={commande.statut} />
          </Panneau>
        </div>
      </div>
    </div>
  );
}

function formaterMontant(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

/** Une version de proposition — bloc d'affichage pur, lecture seule. */
function LigneProposition({ proposition }: { proposition: PropositionRevisseeAdmin }) {
  return (
    <div className="ad-version">
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
