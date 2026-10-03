import { notFound } from "next/navigation";
import Link from "next/link";
import { creerClientPublic } from "@/lib/db/public";
import { Badge, Alert } from "@/components/ui";
import { VignettePlat } from "@/components/VignettePlat";
import { classeTuile, initialePlat } from "@/lib/design/tuile";
import { BoutonsPartage } from "@/components/BoutonsPartage";
import { cheminRestaurant, lienWhatsApp, textePlat, texteRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { origineDuSite } from "@/lib/partage/origine";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import {
  ancienneteLisible,
  estCommandable,
  etatDisponibilite,
  etatRestaurant,
  libelleDisponibilite,
  libelleEtatRestaurant,
} from "@/lib/disponibilite/etat";

/**
 * Aperçu de lien (WhatsApp, réseaux) : nom, catégorie et quartier, photo si elle existe. Aucune
 * donnée de commande ni de client. Un restaurant non publié n'est pas lisible (RLS) : l'aperçu
 * reste alors générique.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await creerClientPublic()
    .from("restaurants")
    .select("nom, photo_url, menu_categories(nom), neighborhoods(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return { title: "Speedfood" };
  }
  const description = `${data.menu_categories?.nom ?? "Restaurant"} · ${data.neighborhoods?.nom ?? "Conakry"} — menu et commande sur Speedfood`;
  return {
    title: `${data.nom} · Speedfood`,
    description,
    openGraph: {
      title: data.nom,
      description,
      type: "website",
      siteName: "Speedfood",
      ...(data.photo_url ? { images: [data.photo_url] } : {}),
    },
  };
}

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
  const origine = await origineDuSite();
  const urlRestaurant = urlAbsolue(origine, cheminRestaurant(restaurant.id));
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

  const commandable = estCommandable({ ouvert: restaurantSur.ouvert, accepteCommandes: restaurantSur.accepte_commandes });
  const categorie = restaurantSur.menu_categories?.nom ?? "";

  const etatsPlats = menuListe.map((item) =>
    etatDisponibilite({ disponible: item.disponible, confirmeLe: item.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant)
  );
  const nombreConfirmes = etatsPlats.filter((etat) => etat.type === "disponible").length;
  // Aucun plat confirmé récemment : un seul message pour le restaurant, au lieu de « À confirmer » répété sur chaque plat.
  const aucunConfirme = nombreConfirmes === 0 && etatsPlats.some((etat) => etat.type === "a_confirmer");

  function vignette(item: (typeof menuListe)[number]) {
    const disponibilite = libelleDisponibilite(
      etatDisponibilite(
        { disponible: item.disponible, confirmeLe: item.disponibilite_confirmee_le },
        disponibiliteFraicheurHeures,
        maintenant
      ),
      maintenant
    );
    const lien = urlAbsolue(origine, cheminRestaurant(restaurantSur.id, item.id));
    return (
      <VignettePlat
        key={item.id}
        restaurant={{ id: restaurantSur.id, nom: restaurantSur.nom, categorie }}
        plat={{
          id: item.id,
          nom: item.nom,
          description: item.description,
          prix: item.prix,
          prixPromo: item.prix_promo,
          photoUrl: item.photo_url,
          disponible: item.disponible,
        }}
        disponibilite={disponibilite}
        masquerAConfirmer={aucunConfirme}
        commandable={commandable}
        options={optionsParPlat.get(item.id) ?? []}
        lienPartage={lienWhatsApp(textePlat(item.nom, restaurantSur.nom, lien))}
      />
    );
  }

  const groupesAffiches =
    sectionsListe.length === 0
      ? []
      : [
          ...sectionsListe
            .map((section) => ({ id: section.id, nom: section.nom, plats: platsParSection.get(section.id) ?? [] }))
            .filter((groupe) => groupe.plats.length > 0),
          ...(platsSansSection.length > 0 ? [{ id: "autres", nom: "Autres plats", plats: platsSansSection }] : []),
        ];

  return (
    <main className="fiche">
      <Link href="/restaurants" className="fiche-retour">
        ← Retour aux restaurants
      </Link>

      <div className="fiche-hero" style={restaurant.couleur_accent ? { boxShadow: `0 0 0 3px ${restaurant.couleur_accent}` } : undefined}>
        {restaurant.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={restaurant.photo_url} alt="" />
        ) : (
          <span className={`tuile ${classeTuile(categorie)}`} style={{ fontSize: "6rem" }} aria-hidden="true">
            {initialePlat(restaurant.nom)}
          </span>
        )}
        <span className="fiche-hero-statut">
          <Badge ton={libelleResto.ton}>{libelleResto.texte}</Badge>
        </span>
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img src={restaurant.logo_url} alt="" className="fiche-hero-logo" />
        ) : null}
      </div>

      <h1 className="fiche-titre">{restaurant.nom}</h1>
      {restaurant.couleur_accent ? (
        <div
          aria-hidden="true"
          style={{ width: 48, height: 4, borderRadius: "var(--radius-pill)", background: restaurant.couleur_accent, marginBottom: 8 }}
        />
      ) : null}
      <p className="fiche-meta">
        {categorie} · {restaurant.neighborhoods?.nom}
      </p>
      <p className="fiche-meta">{restaurant.horaires}</p>
      <p className="fiche-meta" style={{ fontSize: "0.85rem" }}>
        Statut mis à jour {ancienneteLisible(new Date(restaurant.statut_mis_a_jour_le), maintenant)}
        {menuListe.length > 0
          ? ` · ${nombreConfirmes} plat${nombreConfirmes > 1 ? "s" : ""} confirmé${nombreConfirmes > 1 ? "s" : ""} récemment`
          : ""}
      </p>

      <div style={{ marginTop: "var(--space-3)" }}>
        <BoutonsPartage texte={texteRestaurant(restaurant.nom, urlRestaurant)} url={urlRestaurant} />
      </div>

      {restaurant.consignes ? (
        <p style={{ marginTop: "var(--space-3)", color: "var(--secondaire)" }}>{restaurant.consignes}</p>
      ) : null}

      {etatResto === "ferme" ? (
        <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
          Ce restaurant est actuellement fermé. Vous pouvez consulter le menu, mais pas commander.
        </Alert>
      ) : etatResto === "pause" ? (
        <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
          Ce restaurant est ouvert mais ne prend plus de commandes pour le moment. Vous pouvez consulter le menu et
          réessayer plus tard.
        </Alert>
      ) : null}

      {aucunConfirme ? (
        <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
          Ce restaurant n&apos;a pas confirmé ses plats récemment. La disponibilité sera confirmée par le restaurant à la
          commande.
        </Alert>
      ) : null}

      <h2 className="fiche-section-titre">Menu</h2>

      {menuListe.length === 0 ? (
        <Alert ton="info">Ce restaurant n&apos;a pas encore publié son menu.</Alert>
      ) : groupesAffiches.length === 0 ? (
        <div className="vignettes">{menuListe.map((item) => vignette(item))}</div>
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
            <section key={groupe.id} id={`section-${groupe.id}`} className="menu-section">
              <h3 className="menu-section-titre">{groupe.nom}</h3>
              <div className="vignettes">{groupe.plats.map((item) => vignette(item))}</div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
