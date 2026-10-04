"use client";

import { useState, useTransition } from "react";
import { definirStatutRestaurantAction, type ChampStatut } from "@/lib/restaurant/actions";
import { Alert, Badge, Button, Card } from "@/components/ui";

interface Props {
  ouvert: boolean;
  accepteCommandes: boolean;
  /** Ancienneté lisible du dernier changement, ex. « il y a 2 h ». */
  miseAJour: string;
}

/**
 * Deux grandes bascules, un geste chacune. Le nouvel état n'est affiché
 * qu'APRÈS confirmation du serveur (jamais un succès optimiste), avec un message
 * d'erreur clair sinon.
 */
export function BasculesStatut({ ouvert, accepteCommandes, miseAJour }: Props) {
  const [etat, setEtat] = useState({ ouvert, accepte_commandes: accepteCommandes });
  const [erreur, setErreur] = useState<string | null>(null);
  const [champEnCours, setChampEnCours] = useState<ChampStatut | null>(null);
  const [, demarrerTransition] = useTransition();

  function basculer(champ: ChampStatut) {
    setErreur(null);
    setChampEnCours(champ);
    demarrerTransition(async () => {
      const nouvelleValeur = !etat[champ];
      const resultat = await definirStatutRestaurantAction(champ, nouvelleValeur);
      if (resultat.ok) {
        setEtat((precedent) => ({ ...precedent, [champ]: nouvelleValeur }));
      } else {
        setErreur(resultat.erreur ?? "Impossible d'enregistrer le changement.");
      }
      setChampEnCours(null);
    });
  }

  return (
    <Card style={{ marginBottom: "var(--space-4)" }}>
      <h2 style={{ marginBottom: "var(--space-3)", fontSize: "1.25rem" }}>État du restaurant</h2>

      <div className="rc-bascules">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong>Restaurant</strong>
            <Badge ton={etat.ouvert ? "succes" : "danger"}>{etat.ouvert ? "Ouvert" : "Fermé"}</Badge>
          </div>
          <Button
            type="button"
            variante="secondary"
            pleineLargeur
            disabled={champEnCours !== null}
            onClick={() => basculer("ouvert")}
          >
            {champEnCours === "ouvert"
              ? "Enregistrement…"
              : etat.ouvert
                ? "Fermer le restaurant"
                : "Rouvrir le restaurant"}
          </Button>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong>Commandes</strong>
            <Badge ton={etat.accepte_commandes ? "succes" : "neutre"}>
              {etat.accepte_commandes ? "Acceptées" : "En pause"}
            </Badge>
          </div>
          <Button
            type="button"
            variante="secondary"
            pleineLargeur
            disabled={champEnCours !== null}
            onClick={() => basculer("accepte_commandes")}
          >
            {champEnCours === "accepte_commandes"
              ? "Enregistrement…"
              : etat.accepte_commandes
                ? "Mettre les commandes en pause"
                : "Reprendre les commandes"}
          </Button>
          <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
            En pause, les clients voient votre menu mais ne peuvent plus commander. Le restaurant reste
            ouvert.
          </p>
        </div>
      </div>

      {erreur ? (
        <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
          {erreur}
        </Alert>
      ) : null}
      <p style={{ margin: "var(--space-3) 0 0", fontSize: "0.78rem", color: "var(--secondaire)" }}>
        Dernier changement : {miseAJour}.
      </p>
    </Card>
  );
}
