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
import { BlocLivraison } from "./BlocLivraison";
import { NoterClient } from "@/components/notation/NoterClient";
import { noterClientParRestaurantAction } from "@/lib/notation/actions-gestion";
import type { VueLivraison } from "@/lib/livraison/vues";
import { useConfirmation } from "@/components/console/ConsoleProviders";

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

/** Petit pictogramme de téléphone, tracé à la main comme les autres icônes du site. */
function IconeTelephone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
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
  livraison = null,
  noteClient = null,
  notationDisponible = true,
  surPlace = null,
}: {
  commande: ApercuCommandeRestaurant;
  age?: string;
  /** Minutes d'attente quand la commande « à traiter » dépasse le seuil de retard. */
  retardMinutes?: number | null;
  restaurantNom?: string;
  /** Numéros des documents déjà établis pour cette commande. */
  documents?: { recu?: string; facture?: string };
  /** Livraison de la commande (si elle a été créée à l'acceptation) : remplace le bouton « Marquer livrée ». */
  livraison?: VueLivraison | null;
  /** Note privée déjà donnée au client pour cette commande. */
  noteClient?: { note: number; etiquettes: string[] } | null;
  notationDisponible?: boolean;
  /** Numéro d'appel du comptoir et convive sans compte (commande sur place). */
  surPlace?: { numeroAppel: number | null; invite: boolean } | null;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [propositionOuverte, setPropositionOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();
  const confirmer = useConfirmation();

  async function traiter(action: ActionStatutCommande, confirmation?: string) {
    if (confirmation) {
      const reponse = await confirmer({ titre: "Confirmer cette action ?", message: <p>{confirmation}</p>, libelleAction: "Confirmer" });
      if (!reponse.confirme) return;
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

  async function confirmerPaiement(decision: "recu" | "non_recu", confirmation?: string) {
    if (confirmation) {
      const reponse = await confirmer({ titre: "Confirmer ce paiement ?", message: <p>{confirmation}</p>, libelleAction: "Confirmer" });
      if (!reponse.confirme) return;
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
    const lien = `${window.location.origin}/recu/${commande.jetonRecu}?doc=facture`;
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
    const lien = `${window.location.origin}/recu/${commande.jetonRecu}`;
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
      <div className="cmd-entete">
        <div>
          <div className="cmd-ref-ligne">
            <strong className="cmd-reference">{commande.reference}</strong>
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
            {surPlace?.numeroAppel ? <span className="salle-etat">N° {surPlace.numeroAppel}</span> : null}
            {surPlace?.invite ? <span className="salle-etat" title="Convive sans compte : vérifiez qu'il est bien sur place">Sans compte</span> : null}
            {commande.estTest ? <span className="commande-test-pastille" title="Commande de test : exclue des chiffres">Test</span> : null}
          </div>
          <p className="cmd-meta">
            {age ? `${age} · ` : ""}{formaterDate(commande.creeLe)} ·{" "}
            {libelleMode(commande.mode, commande.tableNumero)}
          </p>
        </div>
        <div className="cmd-montants">
          <p className="cmd-total">{formaterGNF(total)}</p>
          {commande.mode === "livraison" ? (
            <p className="cmd-frais">
              dont frais de livraison {formaterGNF(commande.fraisLivraisonEstime)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="cmd-client">
        <p className="cmd-client-nom">{commande.clientNom}</p>
        <p className="cmd-client-tel">
          <a href={`tel:${commande.clientTelephone}`} className="cmd-appel">{commande.clientTelephone}</a>
        </p>
        {commande.clientAdresse ? (
          <p className="cmd-client-adresse">
            {commande.clientAdresse}
          </p>
        ) : null}
        {/* Appel explicite : sur téléphone le lien `tel:` ci-dessus suffit, mais sur ordinateur
            il ne fait rien. Un bouton visible évite au restaurateur de chercher le numéro. */}
        <div className="cmd-contact-actions">
          <a className="cmd-contact" href={`tel:${commande.clientTelephone}`}>
            <IconeTelephone />
            Appeler le client
          </a>
        </div>
      </div>

      <div className="cmd-lignes">
        {commande.lignes.map((ligne, index) => (
          <div key={`${ligne.nom}-${index}`} className="cmd-ligne">
            <span>
              {ligne.quantite} × {ligne.nom}
              {ligne.options.length > 0 ? (
                <span className="cmd-ligne-options">
                  {ligne.options.map((o) => o.nom).join(", ")}
                </span>
              ) : null}
            </span>
            <strong className="cmd-ligne-prix">{formaterGNF(ligne.prix * ligne.quantite)}</strong>
          </div>
        ))}
      </div>

      {commande.propositionActive ? (
        <div className="cmd-proposition">
          <p className="cmd-prop-titre">
            Proposition envoyée au client (version {commande.propositionActive.version})
          </p>
          <p className="cmd-prop-texte">
            Nouveau sous-total {formaterGNF(commande.propositionActive.nouveauSousTotal)} ·
            {" "}nouveaux frais {formaterGNF(commande.propositionActive.nouveauxFraisLivraison)}
          </p>
          {commande.propositionActive.conditionsModifiees ? (
            <p className="cmd-prop-texte">
              {commande.propositionActive.conditionsModifiees}
            </p>
          ) : null}
          <p className="cmd-prop-aide">
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
          {commande.paiementMode === "speedfood" ? (
            <p className="cmd-paiement-detail">
              {commande.paiementStatut === "recu"
                ? "Le client a payé en ligne. Vous serez payé sur votre compte mobile money dès que la commande sera remise."
                : "Le client règle en ligne : rien à encaisser ni à confirmer, la confirmation vient du prestataire de paiement."}
            </p>
          ) : null}
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
            {(commande.paiementStatut === "non_demande" || commande.paiementStatut === "non_recu") && commande.paiementMode !== "speedfood" ? (
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
        <Alert ton="danger" className="cmd-erreur">
          {erreur}
        </Alert>
      ) : null}

      {propositionOuverte ? (
        <div className="cmd-formulaire">
          <FormulaireProposition
            commandeId={commande.id}
            sousTotalActuel={commande.sousTotal}
            fraisActuels={commande.fraisLivraisonEstime}
            derniereProposition={commande.propositions[0] ?? undefined}
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

      {notationDisponible && commande.etatDerive === "terminee" && !commande.estTest ? (
        <NoterClient initial={noteClient} enregistrer={(note, etiquettes) => noterClientParRestaurantAction(commande.id, note, etiquettes)} />
      ) : null}

      {livraison && ["acceptee", "prete"].includes(commande.etatDerive) ? (
        <BlocLivraison livraison={livraison} commandePrete={commande.etatDerive === "prete"} />
      ) : null}

      {commande.etatDerive === "prete" && !livraison ? (
        <div className="cmd-actions">
          <Button type="button" className="cmd-principale" disabled={enCours} onClick={() => traiter("terminee")}>
            {commande.mode === "livraison" ? "Marquer livrée" : commande.mode === "sur_place" ? "Marquer servie" : "Marquer remise au client"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
