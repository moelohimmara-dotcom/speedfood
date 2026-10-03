import { notFound } from "next/navigation";
import { creerClientPublic } from "@/lib/db/public";
import { Alert } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { VignettePlat } from "@/components/VignettePlat";
import { ResumePanierFiche } from "@/components/ResumePanierFiche";
import { BanniereRestaurant } from "@/components/BanniereRestaurant";
import { BoutonsPartage } from "@/components/BoutonsPartage";
import { cheminRestaurant, lienWhatsApp, textePlat, texteRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { origineDuSite } from "@/lib/partage/origine";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import {
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
  // Aucun plat confirmé récemment : un seul message pour le restaurant, au lieu de « À confirmer » répété sur chaque plat.
  const aucunConfirme =
    etatsPlats.every((etat) => etat.type !== "disponible") && etatsPlats.some((etat) => etat.type === "a_confirmer");

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
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>

      <BanniereRestaurant
        nom={restaurant.nom}
        categorie={categorie}
        quartier={restaurant.neighborhoods?.nom ?? ""}
        horaires={restaurant.horaires}
        statut={libelleResto}
        photoUrl={restaurant.photo_url}
        logoUrl={restaurant.logo_url}
        couleurAccent={restaurant.couleur_accent}
      />

      <div style={{ marginTop: "var(--space-3)" }}>
        <BoutonsPartage
          texte={texteRestaurant(restaurant.nom, urlRestaurant)}
          url={urlRestaurant}
          variante="liens"
        />
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

      <div className="fiche-grille">
      <div className="fiche-menu">
      <h2 className="fiche-section-titre">Menu</h2>

      {/* Le message « à confirmer » vit ici, au moment du choix, et une seule fois :
          il était auparavant répété dans l'en-tête sous deux formes différentes. */}
      {aucunConfirme ? (
        <Alert ton="info" style={{ marginBottom: "var(--space-4)" }}>
          Aucun plat n&apos;a été confirmé récemment. La disponibilité sera confirmée par le restaurant à la commande.
        </Alert>
      ) : null}

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
      </div>
      <ResumePanierFiche restaurantId={restaurantSur.id} />
      </div>
    </main>
  );
}
