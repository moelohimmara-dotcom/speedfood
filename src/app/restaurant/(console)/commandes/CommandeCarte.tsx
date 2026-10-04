"use client";

import { useState, useTransition } from "react";
import type { ApercuCommandeRestaurant, EtatDeriveCommande } from "@/lib/contracts/commande";
import {
  traiterCommandeAction,
  type ActionStatutCommande,
} from "@/lib/commande/actions-restaurant";
import { Button, Card, Badge, Alert } from "@/components/ui";
import { FormulaireProposition } from "./FormulaireProposition";

const LIBELLES_ETAT: Record<EtatDeriveCommande, string> = {
  en_attente: "À traiter",
  attente_confirmation_client: "Modification proposée",
  acceptee: "Acceptée",
  prete: "Prête",
  terminee: "Terminée",
  refusee: "Refusée",
  annulee: "Annulée",
};

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Carte d'une commande dans la console restaurant : coordonnées client
 * (nécessaires à la livraison), lignes, montants, proposition active et actions
 * de la machine à états. Les transitions sont validées côté serveur
 * (src/lib/commande/actions-restaurant.ts) ; cette carte n'est qu'un affichage.
 */
export function CommandeCarte({
  commande,
  age,
  retardMinutes = null,
}: {
  commande: ApercuCommandeRestaurant;
  age?: string;
  /** Minutes d'attente quand la commande « à traiter » dépasse le seuil de retard. */
  retardMinutes?: number | null;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [propositionOuverte, setPropositionOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();

  function traiter(action: ActionStatutCommande, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) {
      return;
    }
    setErreur(null);
    demarrer(async () => {
      const resultat = await traiterCommandeAction(commande.id, action);
      if (!resultat.ok) {
        setErreur(resultat.erreur.message);
      }
    });
  }

  const total = commande.sousTotal + commande.fraisLivraisonEstime;

  return (
    <Card className={`cmd-carte cmd-carte-${commande.etatDerive}${retardMinutes !== null ? " cmd-carte-retard" : ""}`}>
      {retardMinutes !== null ? (
        <p className="cmd-retard" role="note">
          En attente depuis {retardMinutes} min : le client attend votre réponse.
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: "1.1rem" }}>{commande.reference}</strong>
            <Badge
              ton={
                commande.etatDerive === "refusee" || commande.etatDerive === "annulee"
                  ? "danger"
                  : commande.etatDerive === "en_attente" ||
                      commande.etatDerive === "attente_confirmation_client"
                    ? "neutre"
                    : "succes"
              }
            >
              {LIBELLES_ETAT[commande.etatDerive]}
            </Badge>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
            {age ? `${age} · ` : ""}{formaterDate(commande.creeLe)} ·{" "}
            {commande.mode === "livraison" ? "Livraison" : "Retrait sur place"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{formaterGNF(total)}</p>
          {commande.mode === "livraison" ? (
            <p style={{ margin: 0, color: "var(--secondaire)", fontSize: "0.8rem" }}>
              dont frais de livraison {formaterGNF(commande.fraisLivraisonEstime)}
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: "var(--space-3)" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{commande.clientNom}</p>
        <p style={{ margin: "2px 0 0", fontSize: "0.9rem" }}>
          <a href={`tel:${commande.clientTelephone}`} className="cmd-appel">{commande.clientTelephone}</a>
        </p>
        {commande.clientAdresse ? (
          <p style={{ margin: "2px 0 0", color: "var(--secondaire)", fontSize: "0.9rem" }}>
            {commande.clientAdresse}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: "var(--space-3)" }}>
        {commande.lignes.map((ligne, index) => (
          <div
            key={`${ligne.nom}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "4px 0",
              borderBottom: "1px solid var(--bordure)",
              fontSize: "0.95rem",
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
            <strong style={{ whiteSpace: "nowrap" }}>{formaterGNF(ligne.prix * ligne.quantite)}</strong>
          </div>
        ))}
      </div>

      {commande.propositionActive ? (
        <div
          style={{
            marginTop: "var(--space-3)",
            border: "1px solid var(--orange)",
            borderRadius: "var(--radius-md)",
            padding: 12,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>
            Proposition envoyée au client (version {commande.propositionActive.version})
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            Nouveau sous-total {formaterGNF(commande.propositionActive.nouveauSousTotal)} ·
            {" "}nouveaux frais {formaterGNF(commande.propositionActive.nouveauxFraisLivraison)}
          </p>
          {commande.propositionActive.conditionsModifiees ? (
            <p style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
              {commande.propositionActive.conditionsModifiees}
            </p>
          ) : null}
          <p style={{ margin: "6px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
            En attente de la réponse du client
            {commande.propositionActive.expireLe
              ? `, jusqu'au ${formaterDate(commande.propositionActive.expireLe)}`
              : ""}
            . Aucune préparation avant son accord.
          </p>
        </div>
      ) : null}

      {erreur ? (
        <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
          {erreur}
        </Alert>
      ) : null}

      {propositionOuverte ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <FormulaireProposition
            commandeId={commande.id}
            sousTotalActuel={commande.sousTotal}
            fraisActuels={commande.fraisLivraisonEstime}
            onFermer={() => setPropositionOuverte(false)}
          />
        </div>
      ) : null}

      {commande.etatDerive === "en_attente" ? (
        <div className="cmd-actions">
          <Button type="button" className="cmd-principale" disabled={enCours} onClick={() => traiter("accepter")}>
            Accepter la commande
          </Button>
          <div className="cmd-secondaires">
            <Button
              type="button"
              variante="secondary"
              disabled={enCours}
              onClick={() => setPropositionOuverte((ouvert) => !ouvert)}
            >
              Proposer une modification
            </Button>
            <Button
              type="button"
              variante="danger"
              disabled={enCours}
              onClick={() => traiter("refuser", `Refuser la commande ${commande.reference} ?`)}
            >
              Refuser
            </Button>
            <Button
              type="button"
              variante="secondary"
              disabled={enCours}
              onClick={() => traiter("annuler", `Annuler la commande ${commande.reference} ?`)}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {commande.etatDerive === "attente_confirmation_client" ? (
        <div className="cmd-actions">
          <div className="cmd-secondaires">
            <Button
              type="button"
              variante="secondary"
              disabled={enCours}
              onClick={() => traiter("annuler", `Annuler la commande ${commande.reference} ?`)}
            >
              Annuler la commande
            </Button>
          </div>
        </div>
      ) : null}

      {commande.etatDerive === "acceptee" ? (
        <div className="cmd-actions">
          <Button type="button" className="cmd-principale" disabled={enCours} onClick={() => traiter("prete")}>
            Marquer prête
          </Button>
          <div className="cmd-secondaires">
            <Button
              type="button"
              variante="secondary"
              disabled={enCours}
              onClick={() => traiter("annuler", `Annuler la commande ${commande.reference} ?`)}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {commande.etatDerive === "prete" ? (
        <div className="cmd-actions">
          <Button type="button" className="cmd-principale" disabled={enCours} onClick={() => traiter("terminee")}>
            {commande.mode === "livraison" ? "Marquer livrée" : "Marquer remise au client"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
