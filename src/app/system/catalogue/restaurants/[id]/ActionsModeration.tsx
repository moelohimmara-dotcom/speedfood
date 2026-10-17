"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  approuverRestaurantAction,
  demanderCorrectionAction,
  suspendreRestaurantAction,
  reactiverRestaurantAction,
  type EtatActionRestaurant,
} from "@/lib/system-admin/restaurants";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionRestaurant = {};

interface Props {
  restaurantId: string;
  publie: boolean;
  suspendu: boolean;
  aUneCorrectionEnCours: boolean;
  /** Points obligatoires manquants du dossier : l'approbation est alors bloquée. */
  bloquants?: string[];
}

/**
 * Décision de modération. Les deux actions qui demandent un motif passent par une fenêtre du design system
 * (`ad-dialogue`, même grammaire que la suppression d'un compte) : la fenêtre reste ouverte tant que l'action n'a pas
 * abouti, pour qu'un refus du serveur (motif vide, droits insuffisants) reste lisible. Le formulaire ne se referme plus
 * à l'envoi — c'était le défaut : une demande refusée passait pour un succès.
 */
export function ActionsModeration({ restaurantId, publie, suspendu, aUneCorrectionEnCours, bloquants = [] }: Props) {
  const [enTransition, demarrerTransition] = useTransition();
  const dialogueCorrection = useRef<HTMLDialogElement>(null);
  const dialogueSuspension = useRef<HTMLDialogElement>(null);
  // Valeurs contrôlées : après une erreur, ce que l'administrateur a écrit ne doit pas disparaître.
  const [motifCorrection, setMotifCorrection] = useState("");
  const [motifSuspension, setMotifSuspension] = useState("");

  // La fenêtre ne se ferme qu'une fois l'action confirmée par le serveur. Avant, le formulaire se refermait à
  // l'envoi et le message d'erreur s'affichait dans une fenêtre déjà retirée de l'écran : une demande refusée
  // (motif vide, droits insuffisants) passait pour un succès.
  const [etatApprobation, actionApprobation, approbationEnCours] = useActionState(approuverRestaurantAction, etatInitial);
  const [etatCorrection, actionCorrection, correctionEnCours] = useActionState(
    async (etat: EtatActionRestaurant, formData: FormData) => {
      const resultat = await demanderCorrectionAction(etat, formData);
      if (!resultat.erreur) {
        dialogueCorrection.current?.close();
        setMotifCorrection("");
      }
      return resultat;
    },
    etatInitial
  );
  const [etatSuspension, actionSuspension, suspensionEnCours] = useActionState(
    async (etat: EtatActionRestaurant, formData: FormData) => {
      const resultat = await suspendreRestaurantAction(etat, formData);
      if (!resultat.erreur) {
        dialogueSuspension.current?.close();
        setMotifSuspension("");
      }
      return resultat;
    },
    etatInitial
  );

  const peutApprouver = bloquants.length === 0;

  return (
    <div className="ad-decision">
      {etatApprobation.erreur ? <Alert ton="danger">{etatApprobation.erreur}</Alert> : null}

      {suspendu ? (
        <div className="ad-decision-groupe">
          <Button
            type="button"
            pleineLargeur
            disabled={enTransition}
            onClick={() => demarrerTransition(() => reactiverRestaurantAction(restaurantId))}
          >
            {enTransition ? "Réactivation…" : "Réactiver ce restaurant"}
          </Button>
          <p className="ad-decision-aide">Le restaurant redevient visible des clients.</p>
        </div>
      ) : (
        <>
          {!publie || aUneCorrectionEnCours ? (
            <div className="ad-decision-groupe">
              <form action={actionApprobation}>
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <Button
                  type="submit"
                  pleineLargeur
                  disabled={approbationEnCours || !peutApprouver}
                  aria-describedby="aide-approbation"
                >
                  {approbationEnCours ? "Approbation…" : "Approuver et publier"}
                </Button>
              </form>
              <p className="ad-decision-aide" id="aide-approbation">
                {peutApprouver
                  ? "Le restaurant devient visible et peut recevoir des commandes."
                  : `Pour approuver, il manque : ${bloquants.join(", ")}.`}
              </p>
            </div>
          ) : null}

          <div className="ad-decision-groupe">
            <Button
              type="button"
              variante="secondary"
              pleineLargeur
              aria-haspopup="dialog"
              onClick={() => dialogueCorrection.current?.showModal()}
            >
              Demander une correction
            </Button>
            <p className="ad-decision-aide">Le restaurateur voit votre message et corrige sa fiche.</p>
          </div>

          <div className="ad-decision-sensible">
            <h3>Zone sensible</h3>
            <Button
              type="button"
              variante="danger"
              pleineLargeur
              aria-haspopup="dialog"
              onClick={() => dialogueSuspension.current?.showModal()}
            >
              Suspendre
            </Button>
            <p className="ad-decision-aide">Retire le restaurant du catalogue. Un motif est obligatoire et reste dans le journal.</p>
          </div>
        </>
      )}

      <dialog ref={dialogueCorrection} className="ad-dialogue" aria-labelledby="titre-correction">
        <form action={actionCorrection} className="ad-dialogue-corps">
          <h2 id="titre-correction">Demander une correction</h2>
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <Alert ton="info">
            Le restaurateur reçoit votre message et corrige sa fiche. Son restaurant reste en ligne s&apos;il l&apos;était
            déjà.
          </Alert>
          <div className="field ad-dialogue-champ">
            <label htmlFor="motif-correction">Ce qui doit être corrigé</label>
            <textarea
              id="motif-correction"
              name="motif"
              rows={3}
              maxLength={1000}
              required
              value={motifCorrection}
              onChange={(e) => setMotifCorrection(e.target.value)}
            />
          </div>
          {etatCorrection.erreur ? <Alert ton="danger">{etatCorrection.erreur}</Alert> : null}
          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogueCorrection.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" disabled={correctionEnCours}>
              {correctionEnCours ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog ref={dialogueSuspension} className="ad-dialogue" aria-labelledby="titre-suspension">
        <form action={actionSuspension} className="ad-dialogue-corps">
          <h2 id="titre-suspension">Suspendre ce restaurant ?</h2>
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <Alert ton="danger">
            <strong>Suspension.</strong> Le restaurant disparaît du catalogue et ne reçoit plus de commande. Le motif reste
            dans le journal d&apos;audit et lui sera demandé pour toute réactivation.
          </Alert>
          <div className="field ad-dialogue-champ">
            <label htmlFor="motif-suspension">Motif de la suspension</label>
            <textarea
              id="motif-suspension"
              name="motif"
              rows={3}
              maxLength={1000}
              required
              value={motifSuspension}
              onChange={(e) => setMotifSuspension(e.target.value)}
            />
          </div>
          {etatSuspension.erreur ? <Alert ton="danger">{etatSuspension.erreur}</Alert> : null}
          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogueSuspension.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" variante="danger" disabled={suspensionEnCours}>
              {suspensionEnCours ? "Suspension…" : "Suspendre le restaurant"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}