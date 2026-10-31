"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  approuverRestaurantAction,
  demanderCorrectionAction,
  suspendreRestaurantAction,
  reactiverRestaurantAction,
  type EtatActionRestaurant,
} from "@/lib/system-admin/restaurants";
import type { PointBloquant, SortieDecision } from "@/lib/system-admin/decision-restaurant";
import { Pastille } from "@/components/admin/blocs";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionRestaurant = {};

interface Props {
  restaurantId: string;
  /** Ce qu'il faut proposer, déjà décidé côté serveur (`decision`). */
  sortie: SortieDecision;
  /** Points obligatoires manquants du dossier. */
  bloquants: PointBloquant[];
}

/**
 * Décision de modération (refonte du 17 octobre 2026). Une seule action principale selon l'état : régler le point qui bloque, approuver, ou réactiver.
 * « Demander une correction » vient ensuite ; la suspension reste à l'écart dans « Plus d'actions ». Aucun bouton grisé sans solution : tant qu'un point
 * bloque, « Approuver » n'apparaît pas et le moyen de régler le point est proposé. Le serveur revérifie tout (droits, motif, conditions).
 *
 * Les deux actions qui demandent un motif passent par une fenêtre du design system (`ad-dialogue`) : elle ne se ferme qu'une fois l'action confirmée
 * par le serveur, pour qu'un refus (motif vide, droits insuffisants) reste lisible.
 */
export function ActionsModeration({ restaurantId, sortie, bloquants }: Props) {
  const [enTransition, demarrerTransition] = useTransition();
  const dialogueCorrection = useRef<HTMLDialogElement>(null);
  const dialogueSuspension = useRef<HTMLDialogElement>(null);
  // Valeurs contrôlées : après une erreur, ce que l'administrateur a écrit ne doit pas disparaître.
  const [motifCorrection, setMotifCorrection] = useState("");
  const [motifSuspension, setMotifSuspension] = useState("");

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

  const boutonCorrection = (
    <Button type="button" variante="secondary" pleineLargeur aria-haspopup="dialog" onClick={() => dialogueCorrection.current?.showModal()}>
      Demander une correction
    </Button>
  );
  const aDesActionsSecondaires = sortie.correctionDansPlus || sortie.suspensionVisible;

  return (
    <div className="ad-decision">
      <div className="ad-decision-entete">
        <Pastille ton={sortie.etat.ton}>{sortie.etat.libelle}</Pastille>
        <p className="ad-decision-etat">{sortie.phrase}</p>
      </div>

      {etatApprobation.erreur ? <Alert ton="danger">{etatApprobation.erreur}</Alert> : null}

      {sortie.action === "reactiver" ? (
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
      ) : null}

      {sortie.action === "regler" && sortie.premierBlocage ? (
        <div className="ad-decision-groupe">
          <div className="ad-decision-blocage" role="group" aria-labelledby="titre-blocage">
            <h3 id="titre-blocage">
              {bloquants.length} point{bloquants.length > 1 ? "s" : ""} à régler avant d&apos;approuver
            </h3>
            <ul>
              {bloquants.map((p) => (
                <li key={p.cle}>
                  <strong>{p.libelle}</strong>
                  <span>{p.detail}</span>
                </li>
              ))}
            </ul>
            <a className="btn btn-primary btn-block" href={sortie.premierBlocage.href}>
              {sortie.premierBlocage.cta}
            </a>
          </div>
          <p className="ad-decision-aide">« Approuver et publier » apparaît dès que {bloquants.length > 1 ? "ces points sont réglés" : "ce point est réglé"}.</p>
        </div>
      ) : null}

      {sortie.action === "approuver" ? (
        <div className="ad-decision-groupe">
          <form action={actionApprobation}>
            <input type="hidden" name="restaurant_id" value={restaurantId} />
            <Button type="submit" pleineLargeur disabled={approbationEnCours}>
              {approbationEnCours ? "Approbation…" : "Approuver et publier"}
            </Button>
          </form>
          <p className="ad-decision-aide">Le restaurant devient visible et peut recevoir des commandes.</p>
        </div>
      ) : null}

      {sortie.correctionVisible ? (
        <div className="ad-decision-groupe">
          {boutonCorrection}
          <p className="ad-decision-aide">Le restaurateur voit votre message et corrige sa fiche.</p>
        </div>
      ) : null}

      {aDesActionsSecondaires ? (
        <details className="ad-decision-plus">
          <summary>Plus d&apos;actions</summary>
          <div className="ad-decision-plus-corps">
            {sortie.correctionDansPlus ? boutonCorrection : null}
            {sortie.suspensionVisible ? (
              <div className="ad-decision-sensible">
                <Button type="button" variante="danger" pleineLargeur aria-haspopup="dialog" onClick={() => dialogueSuspension.current?.showModal()}>
                  Suspendre…
                </Button>
                <p className="ad-decision-aide">Retire le restaurant du catalogue. Un motif est obligatoire et reste dans le journal.</p>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

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
