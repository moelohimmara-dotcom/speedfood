"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enregistrerDecisionRemboursementAction } from "@/lib/system-admin/remboursement-decisions";
import {
  ISSUES_DECISION,
  LIBELLE_ISSUE,
  moyensDisponibles,
  AVERTISSEMENT_CODE_MARCHAND,
  type IssueDecision,
  type ModeOrigine,
} from "@/lib/paiement/en-ligne/remboursement-decision";
import { Alert, Button } from "@/components/ui";
import { useNotification } from "@/components/console/ConsoleProviders";

interface Props {
  identifiant: string;
  modeOrigine: ModeOrigine;
  especesAutorise: boolean;
  totalLibelle: string;
  /** Une décision existe déjà : la nouvelle la REMPLACERA (la précédente reste dans l'historique). */
  remplaceUneDecision: boolean;
}

/**
 * Formulaire de la décision humaine (super administrateur). La liste des moyens vient de la même fonction pure que celle du serveur, mais le
 * serveur la rejoue : modifier la page n'ouvre aucun moyen interdit. Enregistrer ne déplace AUCUN argent.
 */
export function FormulaireDecision({ identifiant, modeOrigine, especesAutorise, totalLibelle, remplaceUneDecision }: Props) {
  const router = useRouter();
  const notifier = useNotification();
  const [issue, setIssue] = useState<IssueDecision>("rembourser_total");
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState("mobile_money_manuel");
  const [motif, setMotif] = useState("");
  const [avis, setAvis] = useState("");
  const [reconnait, setReconnait] = useState(false);
  const [aConfirmer, setAConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();

  const moyens = moyensDisponibles({ modeOrigine, especesAutorise, issue });
  const choisi = moyens.find((m) => m.moyen === moyen);
  const moyenValide = choisi?.disponible ? moyen : (moyens.find((m) => m.disponible)?.moyen ?? "");

  function changerIssue(valeur: IssueDecision) {
    setIssue(valeur);
    setAConfirmer(false);
    const proposes = moyensDisponibles({ modeOrigine, especesAutorise, issue: valeur });
    if (!proposes.find((m) => m.moyen === moyen)?.disponible) setMoyen(proposes.find((m) => m.disponible)?.moyen ?? "");
  }

  function enregistrer() {
    demarrer(async () => {
      const brut = montant.replace(/\s/g, "");
      const r = await enregistrerDecisionRemboursementAction(identifiant, {
        issue,
        montantGnf: issue === "rembourser_partiel" ? (brut === "" ? null : Number(brut)) : null,
        moyen: moyenValide,
        motif,
        referenceAvis: avis,
        reconnaitArgentChezRestaurant: reconnait,
      });
      if (r.erreur) notifier("erreur", r.erreur);
      else if (r.succes) {
        notifier("succes", r.succes);
        setMotif("");
        setAvis("");
        setMontant("");
        setReconnait(false);
      }
      setAConfirmer(false);
      router.refresh();
    });
  }

  return (
    <fieldset className="dossier-remb-formulaire">
      <legend>{remplaceUneDecision ? "Enregistrer une nouvelle décision (elle remplace la précédente)" : "Enregistrer la décision"}</legend>
      <p className="ad-secondaire">Enregistrer une décision ne déplace aucun argent. Elle autorise l&apos;étape suivante, que vous confirmerez séparément. Une décision ne se modifie jamais : pour corriger, enregistrez-en une nouvelle.</p>

      {modeOrigine === "code_marchand" ? <Alert ton="info">{AVERTISSEMENT_CODE_MARCHAND}</Alert> : null}

      <label htmlFor="dossier-remb-issue">Issue</label>
      <select id="dossier-remb-issue" value={issue} onChange={(e) => changerIssue(e.target.value as IssueDecision)}>
        {ISSUES_DECISION.map((i) => (
          <option key={i} value={i}>
            {LIBELLE_ISSUE[i]}
          </option>
        ))}
      </select>

      {issue === "rembourser_partiel" ? (
        <>
          <label htmlFor="dossier-remb-montant">Montant à rembourser, en GNF entiers (total payé : {totalLibelle})</label>
          <input id="dossier-remb-montant" type="text" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} autoComplete="off" />
        </>
      ) : issue === "rembourser_total" ? (
        <p className="ad-secondaire">Montant : {totalLibelle} (le total payé, lu par le serveur).</p>
      ) : null}

      <label htmlFor="dossier-remb-moyen">Moyen de remboursement</label>
      <select id="dossier-remb-moyen" value={moyenValide} onChange={(e) => setMoyen(e.target.value)}>
        {moyens.map((m) => (
          <option key={m.moyen} value={m.moyen} disabled={!m.disponible}>
            {m.libelle}
            {m.disponible ? "" : " (non disponible)"}
          </option>
        ))}
      </select>
      <ul className="dossier-remb-notes">
        {moyens
          .filter((m) => !m.disponible && m.raison && m.moyen !== "aucun" && !(issue === "ne_pas_rembourser"))
          .map((m) => (
            <li key={m.moyen}>
              {m.libelle} : {m.raison}
            </li>
          ))}
      </ul>

      {modeOrigine === "code_marchand" ? (
        <label className="case-parametre">
          <input type="checkbox" checked={reconnait} onChange={(e) => setReconnait(e.target.checked)} />
          J&apos;ai compris que l&apos;argent est chez le restaurant et que Speedfood ne le détient pas.
        </label>
      ) : null}

      <label htmlFor="dossier-remb-motif">Motif de la décision</label>
      <input id="dossier-remb-motif" type="text" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} autoComplete="off" />

      <label htmlFor="dossier-remb-avis">Référence de l&apos;avis juridique</label>
      <input id="dossier-remb-avis" type="text" value={avis} onChange={(e) => setAvis(e.target.value)} maxLength={200} autoComplete="off" placeholder="Par exemple : avis du conseil du 12 novembre, point 3" />
      <p className="ad-secondaire">Obligatoire si la décision diffère de la règle automatique, s&apos;il n&apos;y a aucune règle applicable, ou pour des espèces. Facultative seulement si la décision est identique à une conclusion automatique définie.</p>

      {aConfirmer ? (
        <div className="dossier-remb-confirmation" role="group" aria-label="Confirmation">
          <p>
            Confirmer : <strong>{LIBELLE_ISSUE[issue]}</strong>
            {issue === "rembourser_partiel" ? ` (${montant || "?"} GNF)` : ""}. Aucun argent ne bouge à cette étape.
          </p>
          <div className="paiement-admin-boutons">
            <Button type="button" disabled={enCours} onClick={enregistrer}>
              Oui, enregistrer
            </Button>
            <Button type="button" variante="secondary" disabled={enCours} onClick={() => setAConfirmer(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" disabled={enCours || moyenValide === ""} onClick={() => setAConfirmer(true)}>
          Enregistrer la décision
        </Button>
      )}
    </fieldset>
  );
}
