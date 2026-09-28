import Link from "next/link";
import { creerClientPublic } from "@/lib/db/public";
import { RestaurantCard } from "@/components/RestaurantCard";
import { Alert } from "@/components/ui";

interface Recherche {
  q?: string;
  categorie?: string;
  quartier?: string;
}

// Limite explicite plutôt qu'une vraie pagination : à revoir une fois le volume
// réel de restaurants publiés observé (TDR.md §7 demande l'un ou l'autre, pas
// une liste illimitée).
const LIMITE_CATALOGUE = 60;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const { q, categorie, quartier } = await searchParams;
  const supabase = creerClientPublic();

  const [{ data: categories, error: erreurCategories }, { data: quartiers, error: erreurQuartiers }] =
    await Promise.all([
      supabase.from("menu_categories").select("id, nom").order("ordre"),
      supabase.from("neighborhoods").select("id, nom").order("ordre"),
    ]);

  let requete = supabase
    .from("restaurants")
    .select("id, nom, ouvert, photo_url, logo_url, couleur_accent, menu_categories(nom), neighborhoods(nom)")
    .order("nom")
    .limit(LIMITE_CATALOGUE);

  if (categorie) requete = requete.eq("categorie_id", categorie);
  if (quartier) requete = requete.eq("quartier_id", quartier);
  if (q) requete = requete.ilike("nom", `%${q}%`);

  const { data: restaurants, error: erreurRestaurants } = await requete;

  const erreur = erreurCategories || erreurQuartiers || erreurRestaurants;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-5)" }}>
        Découvrez les restaurants de Conakry
      </h1>

      <form action="/restaurants" method="GET" style={{ marginBottom: "var(--space-4)" }}>
        {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
        {quartier ? <input type="hidden" name="quartier" value={quartier} /> : null}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="q">Rechercher</label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Nom du restaurant" />
        </div>
      </form>

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {(categories ?? []).map((c) => (
          <Link
            key={c.id}
            href={construireLienFiltre({ q, quartier }, "categorie", categorie, c.id)}
            className={`chip ${categorie === c.id ? "actif" : ""}`}
          >
            {c.nom}
          </Link>
        ))}
      </div>
      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-5)" }}>
        {(quartiers ?? []).map((quartierOption) => (
          <Link
            key={quartierOption.id}
            href={construireLienFiltre({ q, categorie }, "quartier", quartier, quartierOption.id)}
            className={`chip ${quartier === quartierOption.id ? "actif" : ""}`}
          >
            {quartierOption.nom}
          </Link>
        ))}
      </div>

      {erreur ? (
        <Alert ton="danger">
          Impossible de charger le catalogue pour le moment. Réessayez dans un instant.
        </Alert>
      ) : !restaurants || restaurants.length === 0 ? (
        <Alert ton="info">
          Aucun restaurant ne correspond à cette recherche.{" "}
          <Link href="/restaurants" style={{ fontWeight: 700 }}>
            Réinitialiser les filtres
          </Link>
        </Alert>
      ) : (
        <div className="grille-restaurants">
          {restaurants.map((r) => (
            <RestaurantCard
              key={r.id}
              id={r.id}
              nom={r.nom}
              ouvert={r.ouvert}
              photoUrl={r.photo_url}
              logoUrl={r.logo_url}
              couleurAccent={r.couleur_accent}
              categorie={r.menu_categories?.nom ?? ""}
              quartier={r.neighborhoods?.nom ?? ""}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/** Construit un lien de filtre qui bascule (toggle) la valeur si déjà active, en conservant les autres paramètres. */
function construireLienFiltre(
  autresParams: Recherche,
  cle: "categorie" | "quartier",
  valeurActuelle: string | undefined,
  valeurBouton: string
) {
  const params = new URLSearchParams();
  if (autresParams.q) params.set("q", autresParams.q);
  if (autresParams.categorie) params.set("categorie", autresParams.categorie);
  if (autresParams.quartier) params.set("quartier", autresParams.quartier);

  if (valeurActuelle === valeurBouton) {
    params.delete(cle);
  } else {
    params.set(cle, valeurBouton);
  }

  const chaine = params.toString();
  return chaine ? `/restaurants?${chaine}` : "/restaurants";
}
