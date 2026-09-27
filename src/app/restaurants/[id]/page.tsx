import { notFound } from "next/navigation";
import Link from "next/link";
import { creerClientPublic } from "@/lib/db/public";
import { Badge, Alert } from "@/components/ui";
import { ControleQuantiteArticle } from "@/components/panier/ControleQuantiteArticle";
import { LienPanier } from "@/components/panier/LienPanier";

export default async function FicheRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = creerClientPublic();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, nom, horaires, consignes, ouvert, menu_categories(nom), neighborhoods(nom)")
    .eq("id", id)
    .maybeSingle();

  // La RLS ("lecture_publique_restaurants_publies") ne renvoie déjà que les
  // restaurants publiés et non suspendus. Si `restaurant` est absent ici, c'est
  // soit un identifiant invalide, soit un restaurant non publié/suspendu : dans
  // les deux cas, la bonne réponse publique est une 404, pas une fuite
  // d'information sur pourquoi (TDR.md §6 : "établissement non publié ou
  // suspendu n'apparaît pas au catalogue public").
  if (!restaurant) {
    notFound();
  }

  const { data: menu } = await supabase
    .from("menu_items")
    .select("id, nom, description, prix, disponible")
    .eq("restaurant_id", id)
    .is("archive_le", null)
    .order("nom");

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <Link href="/" style={{ color: "var(--secondaire)", fontWeight: 700, fontSize: "0.9rem" }}>
        ← Retour aux restaurants
      </Link>

      <h1 style={{ fontSize: "2rem", margin: "var(--space-3) 0 4px" }}>{restaurant.nom}</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: 4 }}>
        {restaurant.menu_categories?.nom} · {restaurant.neighborhoods?.nom}
      </p>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-3)" }}>{restaurant.horaires}</p>
      <Badge ton={restaurant.ouvert ? "succes" : "danger"}>
        {restaurant.ouvert ? "Ouvert" : "Fermé"}
      </Badge>

      {restaurant.consignes ? (
        <p style={{ marginTop: "var(--space-3)", color: "var(--secondaire)" }}>{restaurant.consignes}</p>
      ) : null}

      {!restaurant.ouvert ? (
        <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
          Ce restaurant est actuellement fermé. Vous pouvez consulter le menu, mais pas commander.
        </Alert>
      ) : null}

      <h2 style={{ fontSize: "1.5rem", marginTop: "var(--space-6)", marginBottom: "var(--space-3)" }}>
        Menu
      </h2>

      {!menu || menu.length === 0 ? (
        <Alert ton="info">Ce restaurant n&apos;a pas encore publié son menu.</Alert>
      ) : (
        <div>
          {menu.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 0",
                borderBottom: "1px solid var(--bordure)",
              }}
            >
              <div>
                <h4 style={{ margin: "0 0 4px", fontWeight: 700 }}>{item.nom}</h4>
                <p style={{ margin: 0, color: "var(--secondaire)", fontSize: "0.85rem" }}>
                  {item.description}
                </p>
                {!item.disponible ? (
                  <p style={{ margin: "4px 0 0", color: "var(--danger)", fontSize: "0.8rem", fontWeight: 600 }}>
                    Indisponible aujourd&apos;hui
                  </p>
                ) : null}
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ whiteSpace: "nowrap" }}>{formaterGNF(item.prix)}</strong>
                {restaurant.ouvert && item.disponible ? (
                  <ControleQuantiteArticle
                    restaurant={{ id: restaurant.id, nom: restaurant.nom }}
                    article={{ id: item.id, nom: item.nom, prix: item.prix }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <LienPanier />
    </main>
  );
}

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}
