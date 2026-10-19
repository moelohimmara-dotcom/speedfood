"use client";

import Link from "next/link";
import { VecteurPanierVide } from "@/components/site/vecteurs/VecteurPanierVide";
import { usePanier, usePanierPret, sousTotalPanier, nombreArticlesPanier, prixLigne } from "@/components/panier/panier";
import { useEffect, useState } from "react";
import { Card, Alert } from "@/components/ui";
import { useTableMemorisee } from "@/lib/commande/table-memoire";
import { lireServiceSurPlaceAction } from "@/lib/table/actions";
import { LienRetour } from "@/components/LienRetour";
import { FormulaireCommande } from "./FormulaireCommande";
import type { OptionChoix } from "@/components/ui/ListeChoix";

/**
 * Checkout invité (TDR.md §6 « Parcours client », ADR-005) : sans compte,
 * adresse obligatoire seulement en livraison, règlement hors portail.
 */
/** État du compte client vu par la page de commande (lu côté serveur). */
export interface CompteCommande {
  /** La connexion des clients est activée par l'administrateur. */
  actif: boolean;
  /** Une personne est connectée (condition pour envoyer une commande, TDR v0.2 §5.1). */
  connecte: boolean;
  /** Une personne est connectée ET a un profil client (peut mémoriser ses coordonnées). */
  estClient: boolean;
  /** Coordonnées mémorisées, ou `null`. */
  prefill: { nom: string; telephone: string; adresse: string } | null;
}

export function CommandeClient({
  cleSiteTurnstile,
  compte,
  quartiersLivraison,
}: {
  cleSiteTurnstile?: string;
  compte: CompteCommande;
  quartiersLivraison: OptionChoix[];
}) {
  const panier = usePanier();
  const pret = usePanierPret();
  // Convive sans compte : possible seulement à table (QR scanné) ET si ce restaurant l'a autorisé ; le serveur revérifie à l'envoi.
  const tableScannee = useTableMemorisee(panier.restaurantId);
  const [restaurantAutorise, setRestaurantAutorise] = useState<string | null>(null);
  const restaurantTable = !compte.connecte && tableScannee ? panier.restaurantId : null;
  useEffect(() => {
    if (!restaurantTable) return;
    let annule = false;
    lireServiceSurPlaceAction(restaurantTable)
      .then((r) => {
        if (!annule) setRestaurantAutorise(r?.accepteSurPlace && r.sansCompte ? restaurantTable : null);
      })
      .catch(() => {
        if (!annule) setRestaurantAutorise(null);
      });
    return () => {
      annule = true;
    };
  }, [restaurantTable]);
  const invitePossible = restaurantTable !== null && restaurantAutorise === restaurantTable;

  if (!pret) {
    return (
      <main className="commande-page">
        <h1 className="commande-titre">Votre commande</h1>
        <div className="squelette" role="status" aria-busy="true">
          <span className="sr-only">Chargement de votre commande…</span>
        </div>
      </main>
    );
  }

  if (panier.lignes.length === 0 || panier.restaurantId === null) {
    return (
      <main className="commande-page">
        <h1 className="commande-titre">Votre commande</h1>
        <Card className="commande-vide">
          <VecteurPanierVide />
          <p className="commande-vide-texte">Votre panier est vide : rien à commander pour le moment.</p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="commande-page">
      <LienRetour href="/panier">Retour au panier</LienRetour>

      <h1 className="commande-titre">
        Votre commande
      </h1>

      <div className="commande-grille">
      <div className="commande-recap">
      <Card>
        <p className="commande-recap-titre">
          {panier.restaurantNom} · {nombreArticlesPanier(panier)} article
          {nombreArticlesPanier(panier) > 1 ? "s" : ""}
        </p>
        {panier.lignes.map((ligne) => (
          <div key={ligne.cle} className="commande-recap-ligne">
            <span>
              {ligne.quantite} × {ligne.nom}
              {ligne.options.length > 0 ? (
                <span className="commande-recap-options">
                  {ligne.options.map((o) => o.nom).join(", ")}
                </span>
              ) : null}
            </span>
            <strong className="commande-recap-prix">
              {(prixLigne(ligne) * ligne.quantite).toLocaleString("fr-FR")} GNF
            </strong>
          </div>
        ))}
        <div className="commande-recap-total">
          <span>Sous-total indicatif</span>
          <span>{sousTotalPanier(panier).toLocaleString("fr-FR")} GNF</span>
        </div>
        <p className="commande-note">
          Montant indicatif : le serveur recalcule les prix et la disponibilité au moment de
          l&apos;envoi, et le restaurant confirme la commande.
        </p>
      </Card>
      </div>

      <div className="commande-formulaire">
      <h2 className="commande-formulaire-titre">
        {compte.connecte || invitePossible ? "Vos coordonnées" : "Connexion"}
      </h2>

      {compte.connecte || invitePossible ? (
        <FormulaireCommande panier={panier} cleSiteTurnstile={cleSiteTurnstile} compte={compte} quartiersLivraison={quartiersLivraison} invite={!compte.connecte} />
      ) : (
        <Card className="commande-connexion">
          <p className="commande-connexion-titre">Connectez-vous pour envoyer votre commande</p>
          <p className="commande-connexion-texte">
            Chaque commande est rattachée à un compte : le restaurant sait qui commande et vous retrouvez votre suivi. Votre
            panier est conservé pendant la connexion.
          </p>
          <Link href="/entrer?suite=/commande" className="btn btn-primary btn-block">
            Me connecter ou créer un compte
          </Link>
        </Card>
      )}

      <Alert ton="info" className="commande-avis">
        Une fois envoyée, votre commande reste « en attente » jusqu&apos;à la réponse du restaurant.
        Vous recevrez un lien de suivi à conserver.
      </Alert>
      </div>
      </div>
    </main>
  );
}
