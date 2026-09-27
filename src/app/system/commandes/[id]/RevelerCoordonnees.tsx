"use client";

import { useState, useTransition } from "react";
import { reveleCoordonneesCommandeAction } from "@/lib/system-admin/commandes";
import { Button, Alert } from "@/components/ui";

export function RevelerCoordonnees({
  commandeId,
  telephoneAffiche,
  adresseAffichee,
}: {
  commandeId: string;
  telephoneAffiche: string;
  adresseAffichee: string;
}) {
  const [devoile, setDevoile] = useState<{ telephone: string; adresse: string } | null>(null);
  const [motif, setMotif] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enTransition, demarrerTransition] = useTransition();

  if (devoile) {
    return (
      <div>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Téléphone :</strong> {devoile.telephone}
        </p>
        <p style={{ margin: "0 0 4px" }}>
          <strong>Adresse :</strong> {devoile.adresse}
        </p>
        <p style={{ fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Révélation journalisée. Rechargez la page pour revenir au masquage par défaut.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 4px" }}>
        <strong>Téléphone :</strong> {telephoneAffiche}
      </p>
      <p style={{ margin: "0 0 8px" }}>
        <strong>Adresse :</strong> {adresseAffichee}
      </p>

      {formulaireOuvert ? (
        <div>
          <div className="field">
            <label htmlFor="motif-revelation">Motif de la révélation (obligatoire)</label>
            <input
              id="motif-revelation"
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={500}
            />
          </div>
          {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              type="button"
              disabled={enTransition}
              onClick={() =>
                demarrerTransition(async () => {
                  setErreur(null);
                  const resultat = await reveleCoordonneesCommandeAction(commandeId, motif);
                  if (resultat.erreur) {
                    setErreur(resultat.erreur);
                  } else if (resultat.coordonnees) {
                    setDevoile({
                      telephone: resultat.coordonnees.telephone,
                      adresse: resultat.coordonnees.adresse,
                    });
                  }
                })
              }
            >
              {enTransition ? "Vérification…" : "Confirmer la révélation"}
            </Button>
            <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variante="secondary" onClick={() => setFormulaireOuvert(true)}>
          Révéler les coordonnées
        </Button>
      )}
    </div>
  );
}
