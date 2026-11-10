"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { creerReservationAction, type EtatReservation } from "@/lib/reservation/actions";
import { creneauxDuJour, joursReservables } from "@/lib/reservation/creneaux";
import { nombrePersonnesMaximum, recapitulatifReservation, validerFormulaireReservation, type ChampReservation } from "@/lib/reservation/formulaire";

const etatInitial: EtatReservation = {};

interface Props {
  restaurantId: string;
  restaurantNom: string;
  /** Plus grand groupe annoncé par l'API. */
  nbPersonnesMax: number;
  /** Instant de référence donné par le SERVEUR (jamais l'horloge du navigateur) : les jours et créneaux se calculent à partir de lui, en UTC. */
  maintenantIso: string;
  nomInitial: string;
  telephoneInitial: string;
}

/**
 * Formulaire « Réserver une table » en deux temps : on remplit, on relit le récapitulatif, puis un seul envoi. Les jours et les heures sont ceux de Conakry (= UTC) ;
 * le serveur revérifie tout avant d'appeler l'API. Un résultat incertain ne propose jamais de renvoyer : on renvoie vers « Mes réservations ».
 */
export function FormulaireReservation({ restaurantId, restaurantNom, nbPersonnesMax, maintenantIso, nomInitial, telephoneInitial }: Props) {
  const maintenant = useMemo(() => new Date(maintenantIso), [maintenantIso]);
  const jours = useMemo(() => joursReservables(maintenant), [maintenant]);
  const max = nombrePersonnesMaximum(nbPersonnesMax);

  const [jour, setJour] = useState(jours[0]?.valeur ?? "");
  const [heure, setHeure] = useState("");
  const [nbPersonnes, setNbPersonnes] = useState("2");
  const [nom, setNom] = useState(nomInitial);
  const [telephone, setTelephone] = useState(telephoneInitial);
  const [note, setNote] = useState("");
  const [etape, setEtape] = useState<"saisie" | "recapitulatif">("saisie");
  const [erreurs, setErreurs] = useState<Partial<Record<ChampReservation, string>>>({});
  const [etat, action, enCours] = useActionState(creerReservationAction, etatInitial);

  const heures = useMemo(() => creneauxDuJour(jour, maintenant), [jour, maintenant]);
  const verdict = validerFormulaireReservation({ restaurantId, jour, heure, nbPersonnes, nom, telephone, note }, maintenant, max);

  function continuer() {
    if (!verdict.ok) {
      setErreurs(verdict.erreurs);
      return;
    }
    setErreurs({});
    setEtape("recapitulatif");
  }

  if (jours.length === 0) {
    return <Alert ton="info">Aucun créneau n&apos;est disponible pour le moment. Réessayez un peu plus tard.</Alert>;
  }

  if (etape === "recapitulatif" && verdict.ok) {
    const recap = recapitulatifReservation(verdict.demande, restaurantNom);
    return (
      <form action={action} className="reservation-formulaire">
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <input type="hidden" name="jour" value={jour} />
        <input type="hidden" name="heure" value={heure} />
        <input type="hidden" name="nbPersonnes" value={nbPersonnes} />
        <input type="hidden" name="nom" value={nom} />
        <input type="hidden" name="telephone" value={telephone} />
        <input type="hidden" name="note" value={note} />
        <div className="reservation-recap">
          <p className="reservation-recap-demande">{recap.demande}</p>
          <p className="reservation-recap-suite">{recap.suite}</p>
          <p className="reservation-recap-note">
            Téléphone : {verdict.demande.telephone}
            {verdict.demande.note ? ` · Note : ${verdict.demande.note}` : ""}
          </p>
        </div>
        {etat.erreur ? <Alert ton={etat.incertain ? "info" : "danger"}>{etat.erreur}</Alert> : null}
        <div className="reservation-actions">
          {etat.incertain ? (
            <Link href="/compte/reservations" className="btn btn-primary">
              Voir mes réservations
            </Link>
          ) : (
            <>
              <Button type="submit" disabled={enCours}>
                {enCours ? "Envoi en cours…" : "Envoyer la demande"}
              </Button>
              <Button type="button" variante="secondary" disabled={enCours} onClick={() => setEtape("saisie")}>
                Modifier
              </Button>
            </>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="reservation-formulaire" role="group" aria-label="Demande de réservation">
      <div className="reservation-grille">
        <div className={`field${erreurs.jour ? " has-error" : ""}`}>
          <label htmlFor="reservation-jour">Jour</label>
          <select
            id="reservation-jour"
            value={jour}
            onChange={(e) => {
              setJour(e.target.value);
              setHeure("");
            }}
          >
            {jours.map((j) => (
              <option key={j.valeur} value={j.valeur}>
                {j.libelle}
              </option>
            ))}
          </select>
          {erreurs.jour ? <span className="field-error">{erreurs.jour}</span> : null}
        </div>
        <div className={`field${erreurs.heure ? " has-error" : ""}`}>
          <label htmlFor="reservation-heure">Heure</label>
          <select id="reservation-heure" value={heure} onChange={(e) => setHeure(e.target.value)} aria-describedby="reservation-heure-aide">
            <option value="">Choisir…</option>
            {heures.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          {erreurs.heure ? <span className="field-error">{erreurs.heure}</span> : null}
        </div>
      </div>
      <p id="reservation-heure-aide" className="reservation-aide">
        Heure de Conakry. Créneaux toutes les 15 minutes, au moins 30 minutes à l&apos;avance.
      </p>

      <div className={`field${erreurs.nbPersonnes ? " has-error" : ""}`}>
        <label htmlFor="reservation-personnes">Nombre de personnes</label>
        <select id="reservation-personnes" value={nbPersonnes} onChange={(e) => setNbPersonnes(e.target.value)}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
        {erreurs.nbPersonnes ? <span className="field-error">{erreurs.nbPersonnes}</span> : null}
      </div>

      <div className={`field${erreurs.nom ? " has-error" : ""}`}>
        <label htmlFor="reservation-nom">Nom pour la réservation</label>
        <input id="reservation-nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} autoComplete="name" />
        {erreurs.nom ? <span className="field-error">{erreurs.nom}</span> : null}
      </div>

      <div className={`field${erreurs.telephone ? " has-error" : ""}`}>
        <label htmlFor="reservation-telephone">Téléphone</label>
        <input id="reservation-telephone" type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="620 00 00 00" autoComplete="tel" />
        {erreurs.telephone ? <span className="field-error">{erreurs.telephone}</span> : null}
      </div>

      <div className={`field${erreurs.note ? " has-error" : ""}`}>
        <label htmlFor="reservation-note">Note pour le restaurant (facultatif)</label>
        <textarea id="reservation-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={3} />
        {erreurs.note ? <span className="field-error">{erreurs.note}</span> : null}
      </div>

      {erreurs.formulaire ? <Alert ton="danger">{erreurs.formulaire}</Alert> : null}
      {etat.erreur && !etat.incertain ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <div className="reservation-actions">
        <Button type="button" onClick={continuer}>
          Vérifier ma demande
        </Button>
      </div>
    </div>
  );
}
