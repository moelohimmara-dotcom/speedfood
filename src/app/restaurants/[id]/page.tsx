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
    .select(
      "id, nom, horaires, consignes, ouvert, photo_url, logo_url, couleur_accent, menu_categories(nom), neighborhoods(nom)"
    )
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
    .select("id, nom, description, prix, prix_promo, disponible, photo_url")
    .eq("restaurant_id", id)
    .is("archive_le", null)
    .order("nom");

  const idsPlats = (menu ?? []).map((item) => item.id);
  const { data: optionsBrutes } =
    idsPlats.length > 0
      ? await supabase
          .from("menu_item_options")
          .select("id, menu_item_id, nom, prix")
          .in("menu_item_id", idsPlats)
          .eq("disponible", true)
          .order("nom")
      : { data: [] };
  const optionsParPlat = new Map<string, { id: string; nom: string; prix: number }[]>();
  for (const option of optionsBrutes ?? []) {
    const liste = optionsParPlat.get(option.menu_item_id) ?? [];
    liste.push({ id: option.id, nom: option.nom, prix: option.prix });
    optionsParPlat.set(option.menu_item_id, liste);
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <Link href="/restaurants" style={{ color: "var(--secondaire)", fontWeight: 700, fontSize: "0.9rem" }}>
        ← Retour aux restaurants
      </Link>

      {restaurant.photo_url ? (
        <div className="fiche-restaurant-hero-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local. */}
          <img
            src={restaurant.photo_url}
            alt=""
            className="fiche-restaurant-hero"
            style={restaurant.couleur_accent ? { boxShadow: `0 0 0 3px ${restaurant.couleur_accent}` } : undefined}
          />
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={restaurant.logo_url} alt="" className="fiche-restaurant-logo" />
          ) : null}
        </div>
      ) : null}

      <h1
        style={{
          fontSize: "2rem",
          margin: restaurant.photo_url && restaurant.logo_url ? "28px 0 4px" : "var(--space-3) 0 4px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {!restaurant.photo_url && restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={restaurant.logo_url} alt="" className="fiche-restaurant-logo-inline" />
        ) : null}
        {restaurant.nom}
      </h1>
      {restaurant.couleur_accent ? (
        <div
          aria-hidden="true"
          style={{ width: 48, height: 4, borderRadius: "var(--radius-pill)", background: restaurant.couleur_accent, marginBottom: 8 }}
        />
      ) : null}
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
            <div key={item.id} className="menu-item-row">
              <div style={{ display: "flex", gap: 12 }}>
                {item.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
                  <img src={item.photo_url} alt="" className="menu-item-photo" />
                ) : null}
                <div>
                  <h4 style={{ margin: "0 0 4px", fontWeight: 700 }}>{item.nom}</h4>
                  <p style={{ margin: 0, color: "var(--secondaire)", fontSize: "0.85rem" }}>
                    {item.description}
                  </p>
                  {item.prix_promo !== null ? (
                    <Badge ton="danger" style={{ marginTop: 4 }}>
                      Promo
                    </Badge>
                  ) : null}
                  {!item.disponible ? (
                    <p style={{ margin: "4px 0 0", color: "var(--danger)", fontSize: "0.8rem", fontWeight: 600 }}>
                      Indisponible aujourd&apos;hui
                    </p>
                  ) : null}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {item.prix_promo !== null ? (
                  <>
                    <span
                      style={{
                        textDecoration: "line-through",
                        color: "var(--secondaire)",
                        fontSize: "0.85rem",
                        marginRight: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formaterGNF(item.prix)}
                    </span>
                    <strong style={{ whiteSpace: "nowrap", color: "var(--rouge)" }}>
                      {formaterGNF(item.prix_promo)}
                    </strong>
                  </>
                ) : (
                  <strong style={{ whiteSpace: "nowrap" }}>{formaterGNF(item.prix)}</strong>
                )}
                {restaurant.ouvert && item.disponible ? (
                  <ControleQuantiteArticle
                    restaurant={{ id: restaurant.id, nom: restaurant.nom }}
                    article={{ id: item.id, nom: item.nom, prix: item.prix_promo ?? item.prix }}
                    optionsDisponibles={optionsParPlat.get(item.id) ?? []}
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
