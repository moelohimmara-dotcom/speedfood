"use client";

import Link from "next/link";
import { usePanier, usePanierPret, sousTotalPanier, nombreArticlesPanier, prixLigne } from "@/components/panier/panier";
import { Card, Alert } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { FormulaireCommande } from "./FormulaireCommande";

/**
 * Checkout invité (TDR.md §6 « Parcours client », ADR-005) : sans compte,
 * adresse obligatoire seulement en livraison, règlement hors portail.
 */
export function CommandeClient({ cleSiteTurnstile }: { cleSiteTurnstile?: string }) {
  const panier = usePanier();
  const pret = usePanierPret();

  if (!pret) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-4)" }}>Votre commande</h1>
        <div className="squelette" role="status" aria-busy="true">
          <span className="sr-only">Chargement de votre commande…</span>
        </div>
      </main>
    );
  }

  if (panier.lignes.length === 0 || panier.restaurantId === null) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-4)" }}>Votre commande</h1>
        <Card>
          <p style={{ marginTop: 0 }}>Votre panier est vide : rien à commander pour le moment.</p>
          <Link href="/restaurants" className="btn btn-primary">
            Voir les restaurants
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <LienRetour href="/panier">Retour au panier</LienRetour>

      <h1 style={{ fontSize: "2rem", margin: "var(--space-3) 0 var(--space-4)" }}>
        Votre commande
      </h1>

      <Card>
        <p style={{ marginTop: 0, fontWeight: 700 }}>
          {panier.restaurantNom} · {nombreArticlesPanier(panier)} article
          {nombreArticlesPanier(panier) > 1 ? "s" : ""}
        </p>
        {panier.lignes.map((ligne) => (
          <div
            key={ligne.cle}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "6px 0",
              borderBottom: "1px solid var(--bordure)",
            }}
          >
            <span>
              {ligne.quantite} × {ligne.nom}
              {ligne.options.length > 0 ? (
                <span style={{ display: "block", color: "var(--secondaire)", fontSize: "0.8rem" }}>
                  {ligne.options.map((o) => o.nom).join(", ")}
                </span>
              ) : null}
            </span>
            <strong style={{ whiteSpace: "nowrap" }}>
              {(prixLigne(ligne) * ligne.quantite).toLocaleString("fr-FR")} GNF
            </strong>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            paddingTop: 10,
          }}
        >
          <span>Sous-total indicatif</span>
          <span>{sousTotalPanier(panier).toLocaleString("fr-FR")} GNF</span>
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
          Montant indicatif : le serveur recalcule les prix et la disponibilité au moment de
          l&apos;envoi, et le restaurant confirme la commande.
        </p>
      </Card>

      <h2 style={{ fontSize: "1.25rem", margin: "var(--space-6) 0 var(--space-3)" }}>
        Vos coordonnées
      </h2>

      <FormulaireCommande panier={panier} cleSiteTurnstile={cleSiteTurnstile} />

      <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
        Une fois envoyée, votre commande reste « en attente » jusqu&apos;à la réponse du restaurant.
        Vous recevrez un lien de suivi à conserver.
      </Alert>
    </main>
  );
}
