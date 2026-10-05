"use client";

import Link from "next/link";
import {
  changerQuantite,
  nombreArticlesPanier,
  prixLigne,
  QUANTITE_MAX_LIGNE,
  sousTotalPanier,
  usePanier,
} from "@/components/panier/panier";
import { initialePlat } from "@/lib/design/tuile";

/**
 * Résumé du panier affiché à droite de la fiche restaurant sur grand écran (masqué sur téléphone, où la
 * barre de panier flottante joue ce rôle). N'affiche que le panier de CE restaurant : un panier ouvert
 * chez un autre restaurant est signalé, jamais mélangé.
 *
 * Chaque ligne se modifie ici même (− / +, retrait quand la quantité tombe à zéro) : le client règle sa
 * commande sans quitter le menu. Le montant affiché par ligne est le montant RÉEL de la ligne
 * (prix unitaire, suppléments et quantité compris), pas le prix unitaire.
 *
 * Panier vide : un état vide invitant (icône, phrase, rappel du paiement), pour que la colonne de commande soit toujours là
 * sur grand écran et que le menu ne « saute » pas quand le premier plat est ajouté.
 */
export function ResumePanierFiche({ restaurantId, paiement }: { restaurantId: string; paiement?: string }) {
  const panier = usePanier();
  const nombre = nombreArticlesPanier(panier);
  const ici = panier.restaurantId === restaurantId;
  const total = sousTotalPanier(panier);

  if (nombre === 0) {
    return (
      <aside className="fiche-panier" aria-label="Votre panier">
        <h2 className="fiche-panier-titre">
          Votre panier <span className="fiche-panier-compte">0</span>
        </h2>
        <div className="fiche-panier-videbloc">
          <span className="fiche-panier-videicone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10" />
              <path d="M17 3c-2 1.5-3 4-3 7h3v11" />
            </svg>
          </span>
          <p className="fiche-panier-videtitre">Votre panier est vide</p>
          <p className="fiche-panier-videtexte">Ajoutez vos envies pour commencer.</p>
        </div>
        <p className="fiche-panier-note">{paiement ?? "Speedfood n'encaisse rien : vous réglez le restaurant directement."}</p>
      </aside>
    );
  }

  return (
    <aside className="fiche-panier" aria-label="Votre panier">
      <h2 className="fiche-panier-titre">
        Votre panier <span className="fiche-panier-compte">{nombre} article{nombre > 1 ? "s" : ""}</span>
      </h2>
      {!ici ? (
        <p className="fiche-panier-vide">
          Votre panier contient des plats de {panier.restaurantNom ?? "un autre restaurant"}. Un panier ne peut
          contenir qu&apos;un seul restaurant.
        </p>
      ) : (
        <ul className="fiche-panier-lignes">
          {panier.lignes.map((ligne) => (
            <li key={ligne.cle}>
              <span className="fiche-panier-media" aria-hidden="true">
                {ligne.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniature d'une photo déjà affichée, URL Supabase Storage dynamique.
                  <img src={ligne.photoUrl} alt="" />
                ) : (
                  <span>{initialePlat(ligne.nom)}</span>
                )}
              </span>
              <span className="fiche-panier-ligne-texte">
                <span className="fiche-panier-ligne-nom">{ligne.nom}</span>
                {ligne.options.length > 0 ? (
                  <span className="fiche-panier-ligne-options">{ligne.options.map((o) => o.nom).join(", ")}</span>
                ) : null}
                <span className="fiche-panier-ligne-prix">
                  {(prixLigne(ligne) * ligne.quantite).toLocaleString("fr-FR")} GNF
                </span>
              </span>
              <span className="fiche-panier-pas" role="group" aria-label={`Quantité de ${ligne.nom}`}>
                <button
                  type="button"
                  aria-label={ligne.quantite <= 1 ? `Retirer « ${ligne.nom} » du panier` : `Retirer un « ${ligne.nom} »`}
                  onClick={() => changerQuantite(ligne.cle, ligne.quantite - 1)}
                >
                  {ligne.quantite <= 1 ? "×" : "−"}
                </button>
                <span aria-live="polite">{ligne.quantite}</span>
                <button
                  type="button"
                  aria-label={`Ajouter un « ${ligne.nom} »`}
                  disabled={ligne.quantite >= QUANTITE_MAX_LIGNE}
                  onClick={() => changerQuantite(ligne.cle, ligne.quantite + 1)}
                >
                  +
                </button>
              </span>
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
      <p className="fiche-panier-note">{paiement ?? "Speedfood n'encaisse rien : vous réglez le restaurant directement."}</p>
    </aside>
  );
}
