"use client";

import { useState, useTransition } from "react";
import { agirSurLivraisonAction } from "@/lib/livraison/actions-restaurant";
import type { VueLivraison } from "@/lib/livraison/vues";
import { estFinal } from "@/lib/livraison/statuts";
import { Alert, Button } from "@/components/ui";

const ETAPES_SPEEDFOOD = ["Livreur", "Vers le restaurant", "Récupérée", "En route", "Livrée"];

/**
 * Livraison d'une commande, dans la carte de commande du restaurant. Livreur Speedfood : le restaurant suit l'avancement et voit
 * qui vient chercher la commande. Livraison par son propre personnel : « Parti livrer », puis « Livrée » avec le code à 4 chiffres
 * que le client donne à la porte (le restaurant ne voit jamais ce code).
 */
export function BlocLivraison({ livraison, commandePrete }: { livraison: VueLivraison; commandePrete: boolean }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enCours, demarrer] = useTransition();
  const final = estFinal(livraison.statut);

  function agir(action: "partir" | "livree" | "annuler") {
    setErreur(null);
    demarrer(async () => {
      const r = await agirSurLivraisonAction(livraison.id, action, action === "livree" ? code : undefined);
      if (!r.ok) setErreur(r.message);
      else setCode("");
    });
  }

  return (
    <div className="commande-livraison-bloc">
      <p className="commande-livraison-statut">
        <strong>Livraison : {livraison.libelle}</strong>
        {livraison.mode === "speedfood" && livraison.livreurNom ? ` · ${livraison.livreurNom}` : ""}
        {livraison.fraisGnf > 0 ? ` · frais ${livraison.fraisGnf.toLocaleString("fr-FR")} GNF` : ""}
        {livraison.distanceKm !== null ? ` · ${livraison.distanceKm.toLocaleString("fr-FR")} km` : ""}
      </p>
      {livraison.mode === "speedfood" && !final ? (
        <ol className="commande-livraison-etapes" aria-label="Avancement de la livraison">
          {ETAPES_SPEEDFOOD.map((nom, i) => (
            <li key={nom} className={i + 1 <= livraison.etape ? "fait" : ""} aria-current={i + 1 === livraison.etape ? "step" : undefined}>
              {nom}
            </li>
          ))}
        </ol>
      ) : null}

      {livraison.mode === "propre" && !final ? (
        <div className="commande-livraison-actions">
          {livraison.statut === "assignee" ? (
            <Button type="button" disabled={enCours || !commandePrete} onClick={() => agir("partir")}>
              Je pars livrer
            </Button>
          ) : null}
          {livraison.statut === "vers_client" ? (
            <>
              <label className="commande-livraison-code">
                Code du client (4 chiffres)
                <input inputMode="numeric" maxLength={4} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <Button type="button" disabled={enCours || code.length !== 4} onClick={() => agir("livree")}>
                Livrée
              </Button>
            </>
          ) : null}
          {livraison.statut === "assignee" && !commandePrete ? <p className="aide-champ">Marquez d&apos;abord la commande prête.</p> : null}
        </div>
      ) : null}

      {!final ? (
        <Button type="button" variante="secondary" disabled={enCours} onClick={() => agir("annuler")}>
          Annuler la livraison
        </Button>
      ) : null}
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
    </div>
  );
}
