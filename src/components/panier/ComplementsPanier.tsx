"use client";

import { useEffect, useMemo, useState } from "react";
import { ajouterArticle, type LignePanier } from "@/components/panier/panier";
import type { Suggestion } from "@/lib/panier/complements";
import { initialePlat } from "@/lib/design/tuile";
import { Button } from "@/components/ui";

/**
 * Bloc « à。或许 vous plaît aussi » du panier.
 *
 * Un bloc de suggestions est souvent une machine à gonfler le panier : on y
 * propose ce qui est cher, ou ce que le restaurant veut écouler. Ici les
 * règles sont déterministes et **chacune affiche pourquoi elle est proposée**
 * (« pour accompagner votre plat »). Un client qui ne comprend pas la raison
 * d'une suggestion la jettera de toute façon — mieux vaut peu et vrai.
 *
 * Le composant ne s'affiche pas du tout tant qu'il n'y a rien à proposer :
 * un bloc vide paraîtrait comme une promesse non tenue.
 */
export function ComplementsPanier({
  restaurantId,
  restaurantNom,
  lignes,
}: {
  restaurantId: string;
  restaurantNom: string | null;
  lignes: LignePanier[];
}) {
  // La réponse est conservée AVEC la signature du panier auquel elle se
  // rapporte, et comparée au rendu. Remettre l'état à zéro dans l'effet
  // serait un setState synchrone : il provoque un rendu en cascade, et il est
  // inutile, puisque la comparaison au rendu fait déjà le travail — une
  // réponse reçue pour un panier qui a changé depuis n'est simplement plus
  // affichée.
  const [reponse, setReponse] = useState<{ signature: string; suggestions: Suggestion[] } | null>(
    null
  );

  // La clé change à chaque panier différent : c'est ce qui déclenche la
  // requête et ce qui invalide une réponse devenue fausse.
  const signature = `${restaurantId}|${lignes.map((l) => l.cle).join(",")}`;
  // Envoyé tel quel à la route ; dépend de `lignes`, ce qui évite à l'effet de
  // dépendre d'un tableau reconstruit à chaque rendu.
  const resumePanier = useMemo(
    () => JSON.stringify(lignes.map((l) => ({ menuItemId: l.menuItemId, nom: l.nom }))),
    [lignes]
  );

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ restaurantId, panier: resumePanier });
    fetch(`/api/panier/complements?${params.toString()}`)
      .then((reponse) => (reponse.ok ? reponse.json() : { suggestions: [] }))
      .then((donnees: { suggestions?: Suggestion[] }) => {
        if (!ignore) setReponse({ signature, suggestions: donnees.suggestions ?? [] });
      })
      .catch(() => {
        // Échec réseau : pas de bloc, pas de bandeau d'erreur. Un client qui
        // commande ne doit pas être bloqué par une suggestion manquante.
        if (!ignore) setReponse({ signature, suggestions: [] });
      });
    return () => {
      ignore = true;
    };
  }, [signature, restaurantId, resumePanier]);

  const suggestions = reponse?.signature === signature ? reponse.suggestions : null;

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="complements-titre" style={{ marginTop: "var(--space-4)" }}>
      <h2 id="complements-titre" style={{ fontSize: "1.05rem", margin: "0 0 var(--space-2)" }}>
        Pour accompagner votre commande
      </h2>
      <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
        {suggestions.map(({ plat, raison }) => (
          <li key={plat.id}>
            <div
              className="carte complement-panier"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div className="panier-ligne-media" aria-hidden="true">
                {plat.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, déjà visible sur la page du restaurant.
                  <img src={plat.photoUrl} alt="" />
                ) : (
                  <span className="tuile tuile-neutre" style={{ fontSize: "1.4rem" }}>
                    {initialePlat(plat.nom)}
                  </span>
                )}
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                <strong style={{ display: "block" }}>{plat.nom}</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--secondaire)" }}>
                  {raison} · {plat.prix.toLocaleString("fr-FR")} GNF
                </span>
              </div>
              <Button
                type="button"
                variante="secondary"
                onClick={() =>
                  ajouterArticle(
                    { id: restaurantId, nom: restaurantNom ?? "Restaurant" },
                    { id: plat.id, nom: plat.nom, prix: plat.prix, photoUrl: plat.photoUrl ?? null }
                  )
                }
              >
                {`Ajouter « ${plat.nom} »`}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}