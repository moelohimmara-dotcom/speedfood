"use client";

import Link from "next/link";
import { nombreArticlesPanier, prixLigne, sousTotalPanier, usePanier } from "@/components/panier/panier";

/**
 * Résumé du panier affiché à droite de la fiche restaurant sur grand écran (masqué sur téléphone, où la
 * barre de panier flottante joue ce rôle). N'affiche que le panier de CE restaurant : un panier ouvert
 * chez un autre restaurant est signalé, jamais mélangé.
 *
 * Panier vide : on ne rend RIEN. La colonne de droite est dimensionnée par son contenu
 * (voir `.fiche-grille`), donc le menu occupe toute la largeur tant qu'il n'y a rien à montrer —
 * une carte de 200 px pour deux lignes de texte n'apportait rien.
 */
export function ResumePanierFiche({ restaurantId }: { restaurantId: string }) {
  const panier = usePanier();
  const nombre = nombreArticlesPanier(panier);
  const ici = panier.restaurantId === restaurantId;
  const total = sousTotalPanier(panier);

  if (nombre === 0) {
    return null;
  }

  return (
    <aside className="fiche-panier" aria-label="Votre panier">
      <h2 className="fiche-panier-titre">Votre panier</h2>
      {!ici ? (
        <p className="fiche-panier-vide">
          Votre panier contient des plats de {panier.restaurantNom ?? "un autre restaurant"}. Un panier ne peut
          contenir qu&apos;un seul restaurant.
        </p>
      ) : (
        <ul className="fiche-panier-lignes">
          {panier.lignes.map((ligne) => (
            <li key={ligne.cle}>
              <span>
                {ligne.quantite} × {ligne.nom}
              </span>
              <strong>{prixLigne(ligne).toLocaleString("fr-FR")} GNF</strong>
            </li>
          ))}
        </ul>
      )}
      <p className="fiche-panier-total">
        <span>Sous-total indicatif</span>
        <strong>{total.toLocaleString("fr-FR")} GNF</strong>
      </p>
      <Link href={ici ? "/commande" : "/panier"} className="btn btn-primary btn-block">
        {ici ? "Commander" : "Voir le panier"}
      </Link>
      <p className="fiche-panier-note">Aucun paiement en ligne : vous réglez le restaurant directement.</p>
    </aside>
  );
}
