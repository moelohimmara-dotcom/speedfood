"use client";

import { useMemo } from "react";
import type { ApercuCommandeRestaurant } from "@/lib/contracts/commande";

/**
 * Récapitulatif imprimable de la journée du restaurateur.
 *
 * Un restaurateur qui tient sa recette sur un carnet a besoin d'une liste
 * papier simple à l'impression, pas de l'écran. Cette feuille est donc pensée
 * pour le papier : noir sur blanc, sans ombre ni couleur, et une seule page.
 *
 * Les commandes retenues sont celles qui comptent pour la recette : acceptées,
 * prêtes ou terminées. Les commandes en attente ne sont pas encore une vente.
 */
function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function formaterHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Les trois premières lettres du jour : « lun. », « mar. »… pour un tableau compact. */
function jourCourt(iso: string) {
  const d = new Date(iso);
  const aujourdhui = new Date();
  const memeJour =
    d.getFullYear() === aujourdhui.getFullYear() &&
    d.getMonth() === aujourdhui.getMonth() &&
    d.getDate() === aujourdhui.getDate();
  if (memeJour) return "aujourd'hui";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function RecapitulatifJour({
  restaurantNom,
  commandes,
  jours = 1,
}: {
  restaurantNom: string;
  commandes: ApercuCommandeRestaurant[];
  /** Nombre de jours couverts : 1 = aujourd'hui, 7 = la semaine. */
  jours?: number;
}) {
  const retenu = useMemo(
    () =>
      commandes
        .filter(
          (c) =>
            c.etatDerive === "acceptee" ||
            c.etatDerive === "prete" ||
            c.etatDerive === "terminee" ||
            c.etatDerive === "attente_confirmation_client"
        )
        .sort((a, b) => a.creeLe.localeCompare(b.creeLe)),
    [commandes]
  );

  const total = retenu.reduce((somme, c) => somme + c.sousTotal + c.fraisLivraisonEstime, 0);
  const titre = jours === 1 ? "Récapitulatif du jour" : `Récapitulatif des ${jours} derniers jours`;

  return (
    <div className="recap-imprimable">
      <div className="recap-actions">
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Imprimer ou enregistrer en PDF
        </button>
        <p className="aide-champ">
          Le règlement se fait directement avec vos clients : Speedfood n&apos;encaisse rien.
        </p>
      </div>

      <div className="recap-feuille">
        <header className="recap-entete">
          <h2>{titre}</h2>
          <p>
            <strong>{restaurantNom}</strong>
            <br />
            Édité le {new Date().toLocaleDateString("fr-FR", { dateStyle: "long" })}
          </p>
        </header>

        {retenu.length === 0 ? (
          <p className="recap-vide">Aucune commande retenue sur la période.</p>
        ) : (
          <table className="recap-table">
            <thead>
              <tr>
                <th scope="col">Heure</th>
                <th scope="col">Journée</th>
                <th scope="col">Référence</th>
                <th scope="col">Client</th>
                <th scope="col">Retrait</th>
                <th scope="col" className="recap-num">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {retenu.map((c) => (
                <tr key={c.id}>
                  <td>{formaterHeure(c.creeLe)}</td>
                  <td>{jourCourt(c.creeLe)}</td>
                  <td>{c.reference}</td>
                  <td>{c.clientNom}</td>
                  <td>{c.mode === "livraison" ? "Livraison" : c.mode === "sur_place" ? "Sur place" : "Retrait"}</td>
                  <td className="recap-num">{formaterGNF(c.sousTotal + c.fraisLivraisonEstime)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={5}>
                  Total ({retenu.length} commande{retenu.length > 1 ? "s" : ""})
                </th>
                <td className="recap-num recap-total">{formaterGNF(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}