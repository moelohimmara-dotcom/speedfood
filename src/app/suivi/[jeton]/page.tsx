import { notFound } from "next/navigation";
import type { EtatDeriveCommande, LigneCommandeApercu } from "@/lib/contracts/commande";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { Badge, Card, Alert } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { libelleMode } from "@/lib/commande/mode";
import { PropositionCarte } from "./PropositionCarte";
import { PanneauPaiement } from "./PanneauPaiement";
import { RafraichissementAuto } from "./RafraichissementAuto";

/**
 * Suivi public d'une commande par jeton opaque (TDR.md §5, ADR-005).
 *
 * Confidentialité : cette page (et le type `SuiviCommande` qu'elle consomme)
 * n'expose ni le téléphone ni l'adresse du client. Le jeton de suivi n'est
 * jamais journalisé (ADR-005).
 */

const LIBELLES_ETAT: Record<EtatDeriveCommande, string> = {
  en_attente: "En attente du restaurant",
  attente_confirmation_client: "Votre avis est demandé",
  acceptee: "Acceptée, en préparation",
  prete: "Prête",
  terminee: "Terminée",
  refusee: "Refusée par le restaurant",
  annulee: "Annulée",
};

const DESCRIPTIONS_ETAT: Record<EtatDeriveCommande, string> = {
  en_attente:
    "Votre commande a bien été transmise. Elle n'est pas encore confirmée : le restaurant doit l'accepter.",
  attente_confirmation_client:
    "Le restaurant propose une modification (prix, frais ou conditions). Consultez-la ci-dessous : la commande ne sera préparée qu'après votre accord.",
  acceptee: "Le restaurant a accepté votre commande et la prépare. Vous pouvez la régler ci-dessous, directement auprès de lui.",
  prete: "Votre commande est prête. Retirez-la ou attendez la livraison selon le mode choisi.",
  terminee: "Cette commande est terminée. Merci !",
  refusee:
    "Le restaurant ne peut pas honorer cette commande. Aucun montant n'a été encaissé : tout règlement se fait directement avec le restaurant.",
  annulee:
    "Cette commande est annulée. Aucun montant n'a été encaissé : tout règlement se fait directement avec le restaurant.",
};

const TONS_BADGE: Record<EtatDeriveCommande, "succes" | "danger" | "neutre"> = {
  en_attente: "neutre",
  attente_confirmation_client: "neutre",
  acceptee: "succes",
  prete: "succes",
  terminee: "succes",
  refusee: "danger",
  annulee: "danger",
};

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function LigneRecap({ ligne }: { ligne: LigneCommandeApercu }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid var(--bordure)",
      }}
    >
      <span>
        {ligne.quantite} × {ligne.nom}
        {ligne.options.length > 0 ? (
          <span style={{ display: "block", color: "var(--secondaire)", fontSize: "0.8rem" }}>
            {ligne.options.map((o) => o.nom).join(", ")}
          </span>
        ) : null}
      </span>
      <strong style={{ whiteSpace: "nowrap" }}>
        {formaterGNF(ligne.prix * ligne.quantite)}
      </strong>
    </div>
  );
}

export default async function SuiviPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const suivi = await chargerSuiviParJeton(jeton);

  if (!suivi) {
    notFound();
  }

  const totalIndicatif = suivi.sousTotal + suivi.fraisLivraisonEstime;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>

      <h1 style={{ fontSize: "2rem", margin: "var(--space-3) 0 4px" }}>Suivi de votre commande</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-3)" }}>
        Référence <strong>{suivi.reference}</strong> · passée le {formaterDate(suivi.creeLe)}
      </p>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <Badge ton={TONS_BADGE[suivi.etatDerive]}>{LIBELLES_ETAT[suivi.etatDerive]}</Badge>
            <p style={{ margin: "10px 0 0" }}>{DESCRIPTIONS_ETAT[suivi.etatDerive]}</p>
          </div>
        </div>
      </Card>

      {suivi.propositionActive ? (
        <PropositionCarte
          jeton={jeton}
          proposition={suivi.propositionActive}
          sousTotalInitial={suivi.sousTotal}
          fraisInitial={suivi.fraisLivraisonEstime}
        />
      ) : null}

      <PanneauPaiement jeton={jeton} paiement={suivi.paiement} total={totalIndicatif} restaurant={suivi.restaurant.nom} />

      <Card style={{ marginTop: "var(--space-4)" }}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>{suivi.restaurant.nom}</p>
        <p style={{ margin: "0 0 4px", color: "var(--secondaire)", fontSize: "0.85rem" }}>
          {suivi.restaurant.horaires}
        </p>
        {suivi.restaurant.consignes ? (
          <p style={{ margin: "0 0 10px", color: "var(--secondaire)", fontSize: "0.85rem" }}>
            {suivi.restaurant.consignes}
          </p>
        ) : null}
        <Badge ton={suivi.restaurant.ouvert ? "succes" : "neutre"}>
          {suivi.restaurant.ouvert ? "Ouvert actuellement" : "Fermé actuellement"}
        </Badge>

        <div style={{ marginTop: "var(--space-3)" }}>
          {suivi.lignes.map((ligne, index) => (
            <LigneRecap key={`${ligne.nom}-${index}`} ligne={ligne} />
          ))}
        </div>

        <div style={{ marginTop: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Sous-total</span>
            <span>{formaterGNF(suivi.sousTotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Frais de livraison</span>
            <span>
              {suivi.mode === "livraison"
                ? `${formaterGNF(suivi.fraisLivraisonEstime)} (à confirmer avec le restaurant)`
                : formaterGNF(suivi.fraisLivraisonEstime)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total indicatif</span>
            <span>{formaterGNF(totalIndicatif)}</span>
          </div>
          <p style={{ margin: "8px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
            {suivi.mode === "livraison" ? "Livraison demandée" : libelleMode(suivi.mode, suivi.tableNumero)} · montants
            indicatifs : aucun paiement n&apos;est encaissé par Speedfood et aucun frais de livraison
            n&apos;est calculé automatiquement.
          </p>
        </div>
      </Card>

      {suivi.historiqueStatuts.length > 0 ? (
        <Card style={{ marginTop: "var(--space-4)" }}>
          <p style={{ marginTop: 0, fontWeight: 700 }}>Historique</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--secondaire)" }}>
            {suivi.historiqueStatuts.map((evenement, index) => (
              <li key={`${evenement.horodatage}-${index}`}>
                {LIBELLES_ETAT[evenement.statutSuivant] ?? evenement.statutSuivant} ·{" "}
                {formaterDate(evenement.horodatage)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {suivi.etatDerive !== "en_attente" && suivi.etatDerive !== "refusee" && suivi.etatDerive !== "annulee" && suivi.paiement.statut !== "recu" ? (
        <p style={{ marginTop: "var(--space-3)" }}>
          <a href={`/suivi/${jeton}/recu`} className="lien-texte">
            Voir le récapitulatif imprimable de ma commande
          </a>
        </p>
      ) : null}

      <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
        Conservez ce lien : c&apos;est la clé de suivi de votre commande. Ne le partagez pas.
      </Alert>

      <RafraichissementAuto />
    </main>
  );
}
