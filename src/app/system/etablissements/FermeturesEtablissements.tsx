"use client";

import { useActionState, useRef, useState } from "react";
import {
  fermerEtablissementAction,
  leverFermetureAction,
  type EtatActionEtablissement,
} from "@/lib/system-admin/etablissements-actions";
import { Button, Alert } from "@/components/ui";
import { ListeChoix } from "@/components/ui/ListeChoix";

/**
 * Lot L6 — fermeture et suspension d'un établissement.
 *
 * Action visible par le public : la fenêtre demande un motif écrit, une durée, le message affiché
 * aux clients, la reprise planifiée, et une confirmation explicite. Elle ne se ferme qu'une fois
 * l'action acceptée par le serveur : un refus (motif trop court, droits insuffisants) reste lisible.
 */

export interface FermetureAffichee {
  id: string;
  type: "suspension" | "fermeture";
  motif: string;
  messagePublic: string;
  dureeHeures: number;
  /** Reprise planifiée, au format ISO (null = décidée à la main). */
  repriseLe: string | null;
  /** État calculé : active, reprise_prevue, expiree, levee. */
  etat: string;
}

export interface LigneEtablissement {
  id: string;
  nom: string;
  quartier: string;
  ouvert: boolean;
  accepteCommandes: boolean;
  fermetureActive: FermetureAffichee | null;
  fermeturesPassees: number;
}

export interface ValeursFermeture {
  /** Durée proposée pour une suspension, en heures. */
  dureeSuspension: number;
  /** Durée proposée pour une fermeture, en heures. */
  dureeFermeture: number;
  /** Message clients proposé pour une suspension. */
  messageSuspension: string;
  /** Message clients proposé pour une fermeture. */
  messageFermeture: string;
}

const ETAT_INITIAL: EtatActionEtablissement = {};

export function FermeturesEtablissements({
  lignes,
  valeurs,
  peutAgir,
}: {
  lignes: LigneEtablissement[];
  valeurs: ValeursFermeture;
  peutAgir: boolean;
}) {
  const dialogueFermeture = useRef<HTMLDialogElement>(null);
  const dialogueLevee = useRef<HTMLDialogElement>(null);
  const [etatFermeture, actionFermeture, fermetureEnCours] = useActionState(
    fermerEtablissementAction,
    ETAT_INITIAL
  );
  const [etatLevee, actionLevee, leveeEnCours] = useActionState(leverFermetureAction, ETAT_INITIAL);

  const [cible, setCible] = useState<LigneEtablissement | null>(null);
  const [type, setType] = useState<"suspension" | "fermeture">("suspension");
  const [message, setMessage] = useState(valeurs.messageSuspension);
  const [messageEdite, setMessageEdite] = useState(false);
  const [duree, setDuree] = useState(String(valeurs.dureeSuspension));

  function ouvrirFermeture(ligne: LigneEtablissement) {
    setCible(ligne);
    setType("suspension");
    setDuree(String(valeurs.dureeSuspension));
    setMessage(valeurs.messageSuspension);
    setMessageEdite(false);
    dialogueFermeture.current?.showModal();
  }

  function changerType(valeur: string) {
    const nouveau = valeur === "fermeture" ? "fermeture" : "suspension";
    setType(nouveau);
    setDuree(String(nouveau === "fermeture" ? valeurs.dureeFermeture : valeurs.dureeSuspension));
    // Le message proposé suit le type tant que l'administrateur ne l'a pas réécrit.
    if (!messageEdite) {
      setMessage(nouveau === "fermeture" ? valeurs.messageFermeture : valeurs.messageSuspension);
    }
  }

  function ouvrirLevee(ligne: LigneEtablissement) {
    setCible(ligne);
    dialogueLevee.current?.showModal();
  }

  if (!peutAgir) {
    return (
      <p className="ad-aide-champ">
        Votre rôle système permet de consulter les établissements, mais pas de les fermer ni de suspendre.
      </p>
    );
  }

  return (
    <>
      {etatFermeture.succes ? <Alert ton="succes">{etatFermeture.succes}</Alert> : null}
      {etatFermeture.erreur ? <Alert ton="danger">{etatFermeture.erreur}</Alert> : null}
      {etatLevee.succes ? <Alert ton="succes">{etatLevee.succes}</Alert> : null}
      {etatLevee.erreur ? <Alert ton="danger">{etatLevee.erreur}</Alert> : null}

      <ul className="ad-liste ad-liste-simple">
        {lignes.map((ligne) => (
          <li key={ligne.id} className="ad-case-ligne">
            <div>
              <p className="ad-liste-titre">{ligne.nom}</p>
              <p className="ad-liste-meta">
                {ligne.quartier || "Quartier non renseigné"}
                {ligne.fermetureActive
                  ? ` · ${ligne.fermetureActive.type === "fermeture" ? "fermé" : "commandes en pause"}`
                  : ligne.ouvert
                    ? " · ouvert"
                    : " · fermé"}
                {ligne.fermeturesPassees > 0 ? ` · ${ligne.fermeturesPassees} fermeture(s) passée(s)` : ""}
              </p>
              {ligne.fermetureActive ? (
                <p className="ad-liste-texte">
                  Motif : {ligne.fermetureActive.motif}. Message aux clients : {ligne.fermetureActive.messagePublic}
                </p>
              ) : null}
            </div>
            <div className="ad-actions-ligne">
              {ligne.fermetureActive ? (
                <Button type="button" variante="secondary" onClick={() => ouvrirLevee(ligne)}>
                  Lever la fermeture…
                </Button>
              ) : (
                <Button type="button" variante="danger" onClick={() => ouvrirFermeture(ligne)}>
                  Fermer ou suspendre…
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <dialog ref={dialogueFermeture} className="ad-dialogue" aria-labelledby="titre-fermeture">
        <form action={actionFermeture} className="ad-dialogue-corps">
          <h2 id="titre-fermeture">Fermer ou suspendre {cible?.nom ?? "cet établissement"} ?</h2>
          <input type="hidden" name="restaurant_id" value={cible?.id ?? ""} />

          <Alert ton="danger">
            <strong>Action visible par les clients.</strong> L&apos;établissement cesse d&apos;accepter les commandes et
            le message ci-dessous s&apos;affiche sur sa fiche publique. Un motif écrit est obligatoire et reste
            dans le journal d&apos;audit.
          </Alert>

          <div className="field ad-dialogue-champ">
            <label htmlFor="type-fermeture">Type de décision</label>
            <ListeChoix
              nom="type_fermeture"
              options={[
                { valeur: "suspension", libelle: "Suspension (commandes en pause, reprise planifiée)" },
                { valeur: "fermeture", libelle: "Fermeture (établissement fermé aux clients)" },
              ]}
              valeur={type}
              onChange={changerType}
              placeholder="Type de décision"
              libelleAccessible="Type de décision"
              idEtiquette="type-fermeture"
            />
          </div>

          <div className="field ad-dialogue-champ">
            <label htmlFor="motif-fermeture">Motif (obligatoire, 5 caractères minimum)</label>
            <textarea id="motif-fermeture" name="motif" rows={3} maxLength={1000} required />
          </div>

          <div className="field ad-dialogue-champ">
            <label htmlFor="duree-fermeture">Durée (heures)</label>
            <input
              id="duree-fermeture"
              name="duree_heures"
              type="number"
              min={1}
              max={8760}
              required
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
            />
            <span className="ad-aide-champ">
              Valeur proposée : {type === "fermeture" ? valeurs.dureeFermeture : valeurs.dureeSuspension} h.
            </span>
          </div>

          <div className="field ad-dialogue-champ">
            <label htmlFor="message-fermeture">Message affiché aux clients (obligatoire)</label>
            <textarea
              id="message-fermeture"
              name="message_public"
              rows={3}
              maxLength={500}
              required
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setMessageEdite(true);
              }}
            />
          </div>

          <div className="field ad-dialogue-champ">
            <label htmlFor="reprise-fermeture">Reprise planifiée (facultatif)</label>
            <input id="reprise-fermeture" name="reprise_le" type="datetime-local" />
            <span className="ad-aide-champ">
              Laissez vide pour que la reprise soit calculée à partir de la durée.
            </span>
          </div>

          <div className="field ad-dialogue-champ">
            <label htmlFor="confirmation-fermeture">
              <input id="confirmation-fermeture" type="checkbox" name="confirmation" value="oui" />
              Je confirme la fermeture : les clients verront ce message.
            </label>
          </div>

          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogueFermeture.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" variante="danger" disabled={fermetureEnCours}>
              {fermetureEnCours ? "Application…" : "Fermer ou suspendre"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog ref={dialogueLevee} className="ad-dialogue" aria-labelledby="titre-levee">
        <form action={actionLevee} className="ad-dialogue-corps">
          <h2 id="titre-levee">Lever la fermeture de {cible?.nom ?? "cet établissement"} ?</h2>
          <input type="hidden" name="restaurant_id" value={cible?.id ?? ""} />
          <Alert ton="info">
            L&apos;établissement retrouve l&apos;état qu&apos;il avait avant la décision : il accepte de nouveau les
            commandes et son message public disparaît. Un motif est demandé pour le journal.
          </Alert>
          <div className="field ad-dialogue-champ">
            <label htmlFor="motif-levee">Motif de la levée (obligatoire)</label>
            <textarea id="motif-levee" name="motif_levee" rows={3} maxLength={1000} required />
          </div>
          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={() => dialogueLevee.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" disabled={leveeEnCours}>
              {leveeEnCours ? "Levée…" : "Lever la fermeture"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
