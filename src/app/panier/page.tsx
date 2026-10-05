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
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-4)" }}>Mon panier</h1>

      {!pret ? (
        <div className="squelette" role="status" aria-busy="true">
          <span className="sr-only">Chargement du panier…</span>
        </div>
      ) : panier.lignes.length === 0 ? (
        <Card>
          <VecteurPanierVide />
          <p style={{ marginTop: 0 }}>Votre panier est vide.</p>
          <p style={{ color: "var(--secondaire)" }}>
            Parcourez le catalogue et ajoutez les plats d&apos;un seul restaurant.
          </p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <p style={{ marginTop: 0, fontWeight: 700 }}>
              Restaurant : {panier.restaurantNom ?? "—"}
            </p>
            <p style={{ margin: 0, color: "var(--secondaire)", fontSize: "0.85rem" }}>
              Un panier ne peut contenir qu&apos;un seul restaurant.
            </p>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "var(--space-4)" }}>
            {panier.lignes.map((ligne) => (
              <Card
                key={ligne.cle}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div className="panier-ligne-media" aria-hidden="true">
                  {ligne.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniature d'une photo déjà affichée, URL Supabase Storage dynamique.
                    <img src={ligne.photoUrl} alt="" />
                  ) : (
                    <span className="tuile tuile-neutre" style={{ fontSize: "1.6rem" }}>
                      {initialePlat(ligne.nom)}
                    </span>
                  )}
                </div>
                <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                  <strong>{ligne.nom}</strong>
                  {ligne.options.length > 0 ? (
                    <ul style={{ margin: "2px 0 0", paddingLeft: 16, fontSize: "0.8rem", color: "var(--secondaire)" }}>
                      {ligne.options.map((o) => (
                        <li key={o.id}>
                          {o.nom} (+{o.prix.toLocaleString("fr-FR")} GNF)
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p style={{ margin: 0, color: "var(--secondaire)", fontSize: "0.85rem" }}>
                    {prixLigne(ligne).toLocaleString("fr-FR")} GNF l&apos;unité
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                  <Button
                    type="button"
                    variante="secondary"
                    aria-label={`Retirer un « ${ligne.nom} »`}
                    onClick={() => changerQuantite(ligne.cle, ligne.quantite - 1)}
                    style={{ padding: "6px 12px", minWidth: 44, minHeight: 44 }}
                  >
                    −
                  </Button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                    {ligne.quantite}
                  </span>
                  <Button
                    type="button"
                    variante="secondary"
                    aria-label={`Ajouter un « ${ligne.nom} »`}
                    disabled={ligne.quantite >= QUANTITE_MAX_LIGNE}
                    onClick={() => changerQuantite(ligne.cle, ligne.quantite + 1)}
                    style={{ padding: "6px 12px", minWidth: 44, minHeight: 44 }}
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variante="danger"
                    onClick={() => supprimerArticle(ligne.cle)}
                    style={{ padding: "6px 12px", minWidth: 44, minHeight: 44 }}
                  >
                    Retirer
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card style={{ marginTop: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>
                Sous-total ({nombre} article{nombre > 1 ? "s" : ""})
              </span>
              <span>{total.toLocaleString("fr-FR")} GNF</span>
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
              Les prix et la disponibilité seront revérifiés par le restaurant à l&apos;envoi de la
              commande. Le règlement se fait directement avec le restaurant.
            </p>
          </Card>

          <div style={{ display: "flex", gap: 8, marginTop: "var(--space-4)", flexWrap: "wrap" }}>
            <Link href="/commande" className="btn btn-primary">
              Passer la commande
            </Link>
            {panier.restaurantId ? (
              <Link href={`/restaurants/${panier.restaurantId}`} className="btn btn-secondary">
                Continuer mes achats
              </Link>
            ) : null}
          </div>

          <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
            Votre panier est conservé uniquement sur cet appareil.
          </Alert>
        </>
      )}
    </main>
  );
}
