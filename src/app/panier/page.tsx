"use client";

import Link from "next/link";
import { VecteurPanierVide } from "@/components/site/vecteurs/VecteurPanierVide";
import {
  changerQuantite,
  nombreArticlesPanier,
  prixLigne,
  sousTotalPanier,
  supprimerArticle,
  usePanier,
  usePanierPret,
  QUANTITE_MAX_LIGNE,
} from "@/components/panier/panier";
import { Button, Card, Alert } from "@/components/ui";
import { ComplementsPanier } from "@/components/panier/ComplementsPanier";
import { initialePlat } from "@/lib/design/tuile";

/**
 * Panier mono-restaurant (TDR.md §5). Entièrement local au navigateur :
 * aucun envoi serveur à cette étape, tout sera recalculé à la commande.
 */
export default function PanierPage() {
  const panier = usePanier();
  const pret = usePanierPret();
  const total = sousTotalPanier(panier);
  const nombre = nombreArticlesPanier(panier);

  return (
    <main className="panier-page">
      <h1 className="panier-titre">Mon panier</h1>

      {!pret ? (
        <div className="squelette" role="status" aria-busy="true">
          <span className="sr-only">Chargement du panier…</span>
        </div>
      ) : panier.lignes.length === 0 ? (
        <Card className="panier-vide">
          <VecteurPanierVide />
          <p className="panier-vide-titre">Votre panier est vide.</p>
          <p className="panier-vide-texte">
            Parcourez le catalogue et ajoutez les plats d&apos;un seul restaurant.
          </p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <p className="panier-restaurant">
              Restaurant : {panier.restaurantNom ?? "—"}
            </p>
            <p className="panier-note">
              Un panier ne peut contenir qu&apos;un seul restaurant.
            </p>
          </Card>

          <div className="panier-lignes">
            {panier.lignes.map((ligne) => (
              <Card key={ligne.cle} className="panier-ligne">
                <div className="panier-ligne-media" aria-hidden="true">
                  {ligne.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniature d'une photo déjà affichée, URL Supabase Storage dynamique.
                    <img src={ligne.photoUrl} alt="" />
                  ) : (
                    <span className="tuile tuile-neutre">
                      {initialePlat(ligne.nom)}
                    </span>
                  )}
                </div>
                <div className="panier-ligne-texte">
                  <strong>{ligne.nom}</strong>
                  {ligne.options.length > 0 ? (
                    <ul className="panier-ligne-options">
                      {ligne.options.map((o) => (
                        <li key={o.id}>
                          {o.nom} (+{o.prix.toLocaleString("fr-FR")} GNF)
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="panier-note">
                    {prixLigne(ligne).toLocaleString("fr-FR")} GNF l&apos;unité
                  </p>
                </div>
                <p className="panier-ligne-total">{(prixLigne(ligne) * ligne.quantite).toLocaleString("fr-FR")} GNF</p>
                <div className="panier-ligne-controles">
                  <Button
                    type="button"
                    variante="secondary"
                    aria-label={`Retirer un « ${ligne.nom} »`}
                    onClick={() => changerQuantite(ligne.cle, ligne.quantite - 1)}
                    className="panier-pas"
                  >
                    −
                  </Button>
                  <span className="panier-quantite">
                    {ligne.quantite}
                  </span>
                  <Button
                    type="button"
                    variante="secondary"
                    aria-label={`Ajouter un « ${ligne.nom} »`}
                    disabled={ligne.quantite >= QUANTITE_MAX_LIGNE}
                    onClick={() => changerQuantite(ligne.cle, ligne.quantite + 1)}
                    className="panier-pas"
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variante="danger"
                    onClick={() => supprimerArticle(ligne.cle)}
                    className="panier-pas panier-retirer"
                  >
                    Retirer
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {panier.restaurantId ? (
            <ComplementsPanier
              restaurantId={panier.restaurantId}
              restaurantNom={panier.restaurantNom}
              lignes={panier.lignes}
            />
          ) : null}

          <Card className="panier-recapitulatif">
            <div className="panier-sous-total">
              <span>
                Sous-total ({nombre} article{nombre > 1 ? "s" : ""})
              </span>
              <span>{total.toLocaleString("fr-FR")} GNF</span>
            </div>
            <p className="panier-note">
              Les prix et la disponibilité seront revérifiés par le restaurant à l&apos;envoi de la
              commande. Le règlement se fait directement avec le restaurant.
            </p>
          </Card>

          <div className="panier-actions">
            <Link href="/commande" className="btn btn-primary">
              Passer la commande
            </Link>
            {panier.restaurantId ? (
              <Link href={`/restaurants/${panier.restaurantId}`} className="btn btn-secondary">
                Continuer mes achats
              </Link>
            ) : null}
          </div>

          <Alert ton="info" className="panier-avis">
            Votre panier est conservé uniquement sur cet appareil.
          </Alert>
        </>
      )}
    </main>
  );
}
