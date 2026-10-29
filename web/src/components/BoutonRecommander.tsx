"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preparerRecommandeAction, type ResultatRecommande } from "@/lib/client/actions-espace";
import { ajouterArticle, changerQuantite, lirePanier, viderPanier } from "@/components/panier/panier";

/**
 * « Commander à nouveau » : remplit le panier du navigateur avec les plats d'une commande passée (prix et disponibilité d'aujourd'hui), puis ouvre
 * le panier. Si le panier contient déjà des plats d'un AUTRE restaurant, on demande avant de le remplacer.
 */
export function BoutonRecommander({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<(ResultatRecommande & { ok: true }) | null>(null);
  const [enCours, demarrer] = useTransition();

  function remplir(r: ResultatRecommande & { ok: true }) {
    // Vider d'abord : un panier d'un autre restaurant a été confirmé par le client, un panier du même restaurant est repris à zéro.
    viderPanier();
    for (const l of r.lignes) {
      ajouterArticle(r.restaurant, { id: l.menuItemId, nom: l.nom, prix: l.prix, options: l.options, photoUrl: l.photoUrl ?? null }, { remplacerSiConflit: true });
      changerQuantite(l.cle, l.quantite);
    }
    router.push(r.message ? `/panier?info=${encodeURIComponent(r.message)}` : "/panier");
  }

  function lancer() {
    setMessage(null);
    setAConfirmer(null);
    demarrer(async () => {
      const r = await preparerRecommandeAction(orderId);
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      const actuel = lirePanier();
      if (actuel.restaurantId && actuel.restaurantId !== r.restaurant.id && actuel.lignes.length > 0) {
        setAConfirmer(r);
        return;
      }
      remplir(r);
    });
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-compact" disabled={enCours} onClick={lancer}>
        {enCours ? "Préparation…" : "Commander à nouveau"}
      </button>
      {message ? (
        <span role="status" className="aide-champ">
          {message}
        </span>
      ) : null}
      {aConfirmer ? (
        <span role="alertdialog" aria-label="Remplacer le panier" className="aide-champ">
          Votre panier contient des plats d&apos;un autre restaurant. Le remplacer par cette commande ?{" "}
          <button type="button" className="btn btn-primary btn-compact" onClick={() => remplir(aConfirmer)}>
            Remplacer
          </button>{" "}
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => setAConfirmer(null)}>
            Garder mon panier
          </button>
        </span>
      ) : null}
    </>
  );
}
