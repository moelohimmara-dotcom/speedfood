"use client";

import { useState, useTransition } from "react";
import type { ApercuCommandeRestaurant, EtatDeriveCommande } from "@/lib/contracts/commande";
import {
  confirmerPaiementAction,
  emettreDocumentAction,
  traiterCommandeAction,
  type ActionStatutCommande,
} from "@/lib/commande/actions-restaurant";
import { LIBELLES_MODE, libelleStatutPaiement, lienWhatsAppVers, texteRecuWhatsApp } from "@/lib/paiement/regles";
import { libelleMode } from "@/lib/commande/mode";
import { texteDocumentWhatsApp } from "@/lib/paiement/documents-regles";
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
  restaurantNom = "Votre restaurant",
  documents = {},
}: {
  commande: ApercuCommandeRestaurant;
  age?: string;
  /** Minutes d'attente quand la commande « à traiter » dépasse le seuil de retard. */
  retardMinutes?: number | null;
  restaurantNom?: string;
  /** Numéros des documents déjà établis pour cette commande. */
  documents?: { recu?: string; facture?: string };
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
  const paiementVisible = commande.etatDerive === "acceptee" || commande.etatDerive === "prete" || commande.etatDerive === "terminee";

  function confirmerPaiement(decision: "recu" | "non_recu", confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) {
      return;
    }
    setErreur(null);
    demarrer(async () => {
      const resultat = await confirmerPaiementAction(commande.id, decision);
      if (!resultat.ok) {
        setErreur(resultat.erreur.message);
      }
    });
  }

  function emettre(type: "recu" | "facture") {
    setErreur(null);
    demarrer(async () => {
      const resultat = await emettreDocumentAction(commande.id, type);
      if (!resultat.ok) {
        setErreur(resultat.erreur.message);
      }
    });
  }

  function envoyerFactureWhatsApp() {
    const lien = `${window.location.origin}/suivi/${commande.jetonSuivi}/recu?doc=facture`;
    const message = texteDocumentWhatsApp({ type: "facture", numero: documents.facture ?? "", restaurant: restaurantNom, total, lien });
    const url = lienWhatsAppVers(commande.clientTelephone, message);
    if (!url) {
      setErreur("Le numéro du client n'est pas utilisable pour WhatsApp.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /** Ouvre WhatsApp vers le client avec le lien de son reçu : le restaurateur appuie lui-même sur « Envoyer » (aucun envoi automatique). */
  function envoyerRecuWhatsApp() {
    const lien = `${window.location.origin}/suivi/${commande.jetonSuivi}/recu`;
    const message = texteRecuWhatsApp({ restaurant: restaurantNom, reference: commande.reference, total, statut: commande.paiementStatut, lien });
    const url = lienWhatsAppVers(commande.clientTelephone, message);
    if (!url) {
      setErreur("Le numéro du client n'est pas utilisable pour WhatsApp.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

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
            {libelleMode(commande.mode, commande.tableNumero)}
          </p>
        </div>
        <div style={{ textAlign: "right", marginLeft: "auto" }}>
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

      {paiementVisible ? (
        <div className="cmd-paiement">
          <p className="cmd-paiement-titre">Paiement</p>
          <p className="cmd-paiement-detail">
            {libelleStatutPaiement(commande.paiementStatut, commande.paiementMode)}
            {commande.paiementMode && commande.paiementMode !== "especes" ? ` · ${LIBELLES_MODE[commande.paiementMode]}` : ""}
            {commande.paiementReference ? ` · réf. ${commande.paiementReference}` : ""}
            {commande.paiementRecuLe ? ` · le ${formaterDate(commande.paiementRecuLe)}` : ""}
            {documents.recu ? ` · reçu ${documents.recu}` : ""}
          </p>
          {commande.paiementStatut === "declare" ? (
            <p className="cmd-paiement-detail">Comparez avec le SMS de confirmation de votre opérateur avant de valider.</p>
          ) : null}
          <div className="cmd-paiement-actions">
            {commande.paiementStatut === "declare" ? (
              <>
                <Button type="button" disabled={enCours} onClick={() => confirmerPaiement("recu")}>
                  Paiement reçu
                </Button>
                <Button
                  type="button"
                  variante="secondary"
                  disabled={enCours}
                  onClick={() => confirmerPaiement("non_recu", "Le client sera prévenu que vous n'avez pas retrouvé son paiement. Continuer ?")}
                >
                  Pas reçu
                </Button>
              </>
            ) : null}
            {commande.paiementStatut === "especes" ? (
              <Button type="button" disabled={enCours} onClick={() => confirmerPaiement("recu")}>
                Espèces encaissées
              </Button>
            ) : null}
            {commande.paiementStatut === "non_demande" || commande.paiementStatut === "non_recu" ? (
              <Button type="button" variante="secondary" disabled={enCours} onClick={() => confirmerPaiement("recu", "Marquer cette commande comme payée ?")}>
                Marquer comme payée
              </Button>
            ) : null}
            <Button type="button" variante="secondary" onClick={envoyerRecuWhatsApp}>
              {commande.paiementStatut === "recu" ? "Envoyer le reçu sur WhatsApp" : "Envoyer le récapitulatif sur WhatsApp"}
            </Button>
            {commande.paiementStatut === "recu" && !documents.recu ? (
              <Button type="button" variante="secondary" disabled={enCours} onClick={() => emettre("recu")}>
                Établir le reçu numéroté
              </Button>
            ) : null}
            {documents.facture ? (
              <Button type="button" variante="secondary" onClick={envoyerFactureWhatsApp}>
                Envoyer la facture {documents.facture} sur WhatsApp
              </Button>
            ) : (
              <Button type="button" variante="secondary" disabled={enCours} onClick={() => emettre("facture")}>
                Établir une facture
              </Button>
            )}
          </div>
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
            {commande.mode === "livraison" ? "Marquer livrée" : commande.mode === "sur_place" ? "Marquer servie" : "Marquer remise au client"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
