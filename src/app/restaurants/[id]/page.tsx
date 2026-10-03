import { notFound } from "next/navigation";
import Link from "next/link";
import { creerClientPublic } from "@/lib/db/public";
import { Badge, Alert } from "@/components/ui";
import { ControleQuantiteArticle } from "@/components/panier/ControleQuantiteArticle";
import { LienPanier } from "@/components/panier/LienPanier";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import {
  ancienneteLisible,
  estCommandable,
  etatDisponibilite,
  etatRestaurant,
  libelleDisponibilite,
  libelleEtatRestaurant,
} from "@/lib/disponibilite/etat";

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
      "id, nom, horaires, consignes, ouvert, accepte_commandes, statut_mis_a_jour_le, photo_url, logo_url, couleur_accent, menu_categories(nom), neighborhoods(nom)"
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
  const restaurantSur = restaurant;
  const maintenant = new Date();
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  const etatResto = etatRestaurant({ ouvert: restaurant.ouvert, accepteCommandes: restaurant.accepte_commandes });
  const libelleResto = libelleEtatRestaurant(etatResto);

  const [{ data: menu }, { data: sections }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, section_id")
      .eq("restaurant_id", id)
      .is("archive_le", null)
      .order("nom"),
    supabase.from("menu_sections").select("id, nom").eq("restaurant_id", id).order("position"),
  ]);

  const sectionsListe = sections ?? [];
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

  const menuListe = menu ?? [];
  const platsParSection = new Map<string | null, typeof menuListe>();
  for (const item of menuListe) {
    const cle = item.section_id;
    const liste = platsParSection.get(cle) ?? [];
    liste.push(item);
    platsParSection.set(cle, liste);
  }
  const platsSansSection = platsParSection.get(null) ?? [];

  function ligneMenu(item: (typeof menuListe)[number]) {
    const disponibilite = libelleDisponibilite(
      etatDisponibilite(
        { disponible: item.disponible, confirmeLe: item.disponibilite_confirmee_le },
        disponibiliteFraicheurHeures,
        maintenant
      ),
      maintenant
    );
    return (
      <div key={item.id} className={`menu-item-row${!item.disponible ? " indisponible" : ""}`}>
        <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
          {item.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={item.photo_url} alt="" className="menu-item-photo" />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h4 className="menu-item-nom">{item.nom}</h4>
            {item.description ? <p className="menu-item-desc">{item.description}</p> : null}
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              {item.prix_promo !== null ? <Badge ton="danger">Promo</Badge> : null}
              <Badge ton={disponibilite.ton}>{disponibilite.court}</Badge>
              {disponibilite.detail ? (
                <small style={{ color: "var(--secondaire)", fontSize: "0.78rem" }}>{disponibilite.detail}</small>
              ) : null}
            </div>
          </div>
        </div>
        <div className="menu-item-prix-bloc">
          {item.prix_promo !== null ? (
            <span className="menu-item-prix-barre">{formaterGNF(item.prix)}</span>
          ) : null}
          <span className="menu-item-prix" style={item.prix_promo !== null ? { color: "var(--rouge)" } : undefined}>
            {formaterGNF(item.prix_promo ?? item.prix)}
          </span>
          {estCommandable({ ouvert: restaurantSur.ouvert, accepteCommandes: restaurantSur.accepte_commandes }) && item.disponible ? (
            <ControleQuantiteArticle
              restaurant={{ id: restaurantSur.id, nom: restaurantSur.nom }}
              article={{ id: item.id, nom: item.nom, prix: item.prix_promo ?? item.prix }}
              optionsDisponibles={optionsParPlat.get(item.id) ?? []}
            />
          ) : null}
        </div>
      </div>
    );
  }

  const groupesAffiches =
    sectionsListe.length === 0
      ? []
      : [
          ...sectionsListe
            .map((section) => ({ id: section.id, nom: section.nom, plats: platsParSection.get(section.id) ?? [] }))
            .filter((groupe) => groupe.plats.length > 0),
          ...(platsSansSection.length > 0
            ? [{ id: "autres", nom: "Autres plats", plats: platsSansSection }]
            : []),
        ];

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
      <Badge ton={libelleResto.ton}>{libelleResto.texte}</Badge>
      <small style={{ marginLeft: 8, color: "var(--secondaire)", fontSize: "0.78rem" }}>
        statut mis à jour {ancienneteLisible(new Date(restaurant.statut_mis_a_jour_le), maintenant)}
      </small>

      {restaurant.consignes ? (
        <p style={{ marginTop: "var(--space-3)", color: "var(--secondaire)" }}>{restaurant.consignes}</p>
      ) : null}

      {etatResto === "ferme" ? (
        <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
          Ce restaurant est actuellement fermé. Vous pouvez consulter le menu, mais pas commander.
        </Alert>
      ) : etatResto === "pause" ? (
        <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
          Ce restaurant est ouvert mais ne prend plus de commandes pour le moment. Vous pouvez
          consulter le menu et réessayer plus tard.
        </Alert>
      ) : null}

      <h2 style={{ fontSize: "1.5rem", marginTop: "var(--space-6)", marginBottom: "var(--space-3)" }}>
        Menu
      </h2>

      {menuListe.length === 0 ? (
        <Alert ton="info">Ce restaurant n&apos;a pas encore publié son menu.</Alert>
      ) : groupesAffiches.length === 0 ? (
        <div className="card">{menuListe.map((item) => ligneMenu(item))}</div>
      ) : (
        <>
          {groupesAffiches.length > 1 ? (
            <nav className="menu-nav" aria-label="Sections du menu">
              {groupesAffiches.map((groupe) => (
                <a key={groupe.id} href={`#section-${groupe.id}`} className="chip">
                  {groupe.nom}
                </a>
              ))}
            </nav>
          ) : null}
          {groupesAffiches.map((groupe) => (
            <div key={groupe.id} id={`section-${groupe.id}`} className="menu-section">
              <h3 className="menu-section-titre">{groupe.nom}</h3>
              <div className="card">{groupe.plats.map((item) => ligneMenu(item))}</div>
            </div>
          ))}
        </>
      )}

      <LienPanier />
    </main>
  );
}

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}
