import { detailLivraison } from "@/lib/site/livraison";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { creerClientPublic } from "@/lib/db/public";
import { creerClientServeur } from "@/lib/db/server";
import { lireVueFiche } from "@/lib/restaurant/vue-fiche";
import { BandeauApercuFiche } from "@/components/restaurant/BandeauApercuFiche";
import { Alert } from "@/components/ui";
import { AvisPublics } from "@/components/notation/AvisPublics";
import { LienRetour } from "@/components/LienRetour";
import { VignettePlat } from "@/components/VignettePlat";
import { ResumePanierFiche } from "@/components/ResumePanierFiche";
import { BanniereRestaurant } from "@/components/BanniereRestaurant";
import { MenuFiltre, type GroupeDuMenu } from "@/components/MenuFiltre";
import { validerIllustration } from "@/lib/illustrations/modele";
import { MemoireTable } from "@/components/MemoireTable";
import { BoutonsPartage } from "@/components/BoutonsPartage";
import { BoutonFavori } from "@/components/BoutonFavori";
import { cheminRestaurant, lienWhatsApp, textePlat, texteRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { liensCarte } from "@/lib/parametres/assistance-format";
import { libellesMoyensPaiement } from "@/lib/restaurant/paiement";
import { origineDuSite } from "@/lib/partage/origine";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { fonctionnaliteActive } from "@/lib/fonctionnalites/lire";
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
  // Le propriétaire et l'administrateur lisent aussi un restaurant non encore publié (aperçu) : jamais indexé.
  const role = await lireVueFiche(id);
  const clientMeta: SupabaseClient<Database> = role === "visiteur" ? creerClientPublic() : await creerClientServeur();
  const { data } = await clientMeta
    .from("restaurants")
    .select("nom, photo_url, menu_categories(nom), neighborhoods(nom, generique, communes(nom))")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return { title: "Restaurant" };
  }
  const description = `${data.menu_categories?.nom ?? "Restaurant"} · ${(data.neighborhoods?.generique ? data.neighborhoods.communes?.nom : data.neighborhoods?.nom) ?? "Guinée"} — menu et commande sur Speedfood`;
  return {
    title: data.nom,
    description,
    ...(role !== "visiteur" ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: data.nom,
      description,
      type: "website",
      siteName: "Speedfood",
      locale: "fr_FR",
      ...(data.photo_url ? { images: [data.photo_url] } : {}),
    },
  };
}

export default async function FicheRestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vue?: string }>;
}) {
  const { id } = await params;
  // Qui regarde : visiteur, propriétaire (ou équipe) ou administrateur. Les deux derniers voient la page même non publiée, avec un bandeau
  // d'aperçu, et peuvent basculer en « vue visiteur » (?vue=visiteur) pour voir exactement ce que voit un client.
  const role = await lireVueFiche(id);
  const apercu = role !== "visiteur";
  const vue = (await searchParams).vue;
  // Trois niveaux pour l'équipe et les administrateurs : aperçu (défaut, lecture seule), vue visiteur (identique à un client, mais rien ne s'active),
  // mode test (parcours complet ; la commande est marquée « Test » par le serveur et exclue des chiffres).
  const visiteurSimule = apercu && vue === "visiteur";
  const modeTest = apercu && vue === "test";
  const supabase: SupabaseClient<Database> = apercu ? await creerClientServeur() : creerClientPublic();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select(
      "id, nom, publie, suspendu_le, horaires, consignes, ouvert, accepte_commandes, accepte_sur_place, statut_mis_a_jour_le, photo_url, logo_url, logo_illustration, couverture_illustration, couleur_accent, moyens_paiement, latitude, longitude, menu_categories(nom), neighborhoods(nom, generique, communes(nom))"
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
  // Position affichée seulement si l'administrateur a activé la fonction et si le restaurant l'a renseignée.
  const { carteActive } = await lireReglagesAssistance();
  const carte =
    carteActive && restaurant.latitude !== null && restaurant.longitude !== null
      ? liensCarte(restaurant.latitude, restaurant.longitude)
      : null;
  // Un quartier générique « Centre de … » désigne la commune elle-même : on affiche la commune.
  const lieuRestaurant = (restaurant.neighborhoods?.generique ? restaurant.neighborhoods.communes?.nom : restaurant.neighborhoods?.nom) ?? "";
  const urlRestaurant = urlAbsolue(origine, cheminRestaurant(restaurant.id));
  // Zones où le restaurant déclare livrer (rien n'est affirmé s'il n'en a déclaré aucune).
  const livraisonActive = await fonctionnaliteActive("zones_livraison");
  const { data: zonesLivraison } = await supabase
    .from("restaurant_zones_desservies")
    .select("frais_gnf, delai_minutes, communes(nom), neighborhoods(nom, communes(nom))")
    .eq("restaurant_id", restaurant.id);
  const lignesLivraison = (livraisonActive ? (zonesLivraison ?? []) : [])
    .map((z) => ({
      libelle: z.neighborhoods?.nom ? `${z.neighborhoods.nom}${z.neighborhoods.communes?.nom ? ` (${z.neighborhoods.communes.nom})` : ""}` : `Toute la commune de ${z.communes?.nom ?? ""}`,
      detail: detailLivraison(z.frais_gnf, z.delai_minutes),
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  const etatResto = etatRestaurant({ ouvert: restaurant.ouvert, accepteCommandes: restaurant.accepte_commandes });
  const libelleResto = libelleEtatRestaurant(etatResto);

  const [{ data: menu }, { data: sections }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, illustration, section_id")
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

  // Aperçu : on ne commande pas. Vue visiteur : même rendu qu'un client, mais figé (`inert`) — on regarde, on ne commande pas. Mode test : parcours réel.
  const apercuSansCommande = apercu && !visiteurSimule && !modeTest;
  const commandable = !apercuSansCommande && estCommandable({ ouvert: restaurantSur.ouvert, accepteCommandes: restaurantSur.accepte_commandes });
  const categorie = restaurantSur.menu_categories?.nom ?? "";

  const etatsPlats = menuListe.map((item) =>
    etatDisponibilite({ disponible: item.disponible, confirmeLe: item.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant)
  );
  // Aucun plat confirmé récemment : un seul message pour le restaurant, au lieu de « À confirmer » répété sur chaque plat.
  const aucunConfirme =
    etatsPlats.every((etat) => etat.type !== "disponible") && etatsPlats.some((etat) => etat.type === "a_confirmer");

  function vignette(item: (typeof menuListe)[number], niveauTitre: 3 | 4 = 4) {
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
          illustration: validerIllustration(item.illustration),
          disponible: item.disponible,
        }}
        disponibilite={disponibilite}
        masquerAConfirmer={aucunConfirme}
        commandable={commandable}
        options={optionsParPlat.get(item.id) ?? []}
        lienPartage={lienWhatsApp(textePlat(item.nom, restaurantSur.nom, lien))}
        niveauTitre={niveauTitre}
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
  const groupesMenu = groupesAffiches.length > 0 ? groupesAffiches : [{ id: "tous", nom: "", plats: menuListe }];
  const avecSections = groupesMenu.length > 1;
  const groupesFiltre: GroupeDuMenu[] = groupesMenu.map((groupe) => ({
    id: groupe.id,
    nom: groupe.nom,
    plats: groupe.plats.map((item) => ({
      id: item.id,
      nom: item.nom,
      prix: item.prix_promo ?? item.prix,
      noeud: vignette(item, avecSections ? 4 : 3),
    })),
  }));

  // Fraîcheur du menu : heure de la confirmation la plus récente parmi les plats encore « disponibles ».
  const plusRecente = etatsPlats.reduce<Date | null>(
    (max, etat) => (etat.type === "disponible" && (max === null || etat.confirmeLe > max) ? etat.confirmeLe : max),
    null
  );
  const menuConfirme = plusRecente ? `Menu confirmé ${ancienneteLisible(plusRecente, maintenant)}` : null;
  const moyens = libellesMoyensPaiement(restaurant.moyens_paiement);
  const textePaiement = `Paiement : ${moyens.length > 0 ? `${moyens.join(", ")} (déclaré par le restaurant)` : "à convenir avec le restaurant"}. Speedfood n'encaisse rien.`;

  // Données structurées pour les moteurs de recherche : uniquement des faits connus (nom, catégorie, quartier, photo).
  // Pas de note, pas de fourchette de prix ni de délai : rien qui ne soit calculé ou déclaré par le restaurateur.
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.nom,
    url: urlRestaurant,
    ...(categorie ? { servesCuisine: categorie } : {}),
    ...(restaurant.photo_url ? { image: restaurant.photo_url } : {}),
    address: {
      "@type": "PostalAddress",
      ...(lieuRestaurant ? { addressLocality: lieuRestaurant } : {}),
      addressRegion: "Conakry",
      addressCountry: "GN",
    },
    ...(carte && restaurant.latitude !== null && restaurant.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: restaurant.latitude, longitude: restaurant.longitude } }
      : {}),
  };

  return (
    <main className="fiche">
      {apercu ? (
        <BandeauApercuFiche role={role} restaurantId={restaurant.id} mode={modeTest ? "test" : visiteurSimule ? "visiteur" : "apercu"} publie={restaurant.publie} suspendu={restaurant.suspendu_le !== null} />
      ) : null}
      <script
        type="application/ld+json"
        // Échappe `<` pour qu'un nom de restaurant ne puisse pas fermer la balise script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees).replace(/</g, "\\u003c") }}
      />
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>
      <MemoireTable restaurantId={restaurant.id} accepteSurPlace={restaurant.accepte_sur_place && (await fonctionnaliteActive("commande_a_table"))} />

      <BanniereRestaurant
        nom={restaurant.nom}
        categorie={categorie}
        quartier={lieuRestaurant}
        horaires={restaurant.horaires}
        consignes={restaurant.consignes}
        statut={libelleResto}
        photoUrl={restaurant.photo_url}
        logoUrl={restaurant.logo_url}
        couleurAccent={restaurant.couleur_accent}
        couvertureIllustration={validerIllustration(restaurant.couverture_illustration)}
        logoIllustration={validerIllustration(restaurant.logo_illustration)}
        menuConfirme={menuConfirme}
      >
        <BoutonsPartage texte={texteRestaurant(restaurant.nom, urlRestaurant)} url={urlRestaurant} variante="boutons" />
        <BoutonFavori restaurantId={restaurant.id} />
      </BanniereRestaurant>

      {/* Sur grand écran le paiement vit dans la colonne de commande ; sur téléphone il reste ici. */}
      <p className="fiche-paiement fiche-paiement--mobile">{textePaiement}</p>
      {carte ? (
        <p className="fiche-paiement">
          <a href={carte.voir} className="lien-texte" target="_blank" rel="noopener noreferrer">
            Voir sur la carte<span className="sr-only"> (nouvel onglet)</span>
          </a>
          {" · "}
          <a href={carte.itineraire} className="lien-texte" target="_blank" rel="noopener noreferrer">
            Itinéraire<span className="sr-only"> (nouvel onglet)</span>
          </a>
        </p>
      ) : null}

      {livraisonActive ? (
      <section className="fiche-livraison" aria-labelledby="fiche-livraison-titre">
        <h2 id="fiche-livraison-titre" className="fiche-livraison-titre">
          Livraison et retrait
        </h2>
        {lignesLivraison.length > 0 ? (
          <>
            <p className="fiche-livraison-texte">Ce restaurant déclare livrer dans les zones suivantes. Le retrait et les conditions se confirment avec lui.</p>
            <ul className="fiche-livraison-liste">
              {lignesLivraison.map((l) => (
                <li key={l.libelle}>
                  <strong>{l.libelle}</strong>
                  {l.detail ? <span> · {l.detail}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="fiche-livraison-texte">Ce restaurant n&apos;a pas déclaré de zones de livraison. Retrait ou livraison : à confirmer avec lui au moment de la commande.</p>
        )}
      </section>
      ) : null}

      <AvisPublics restaurantId={restaurant.id} />

      {etatResto === "ferme" ? (
        <Alert ton="info" className="u-mt-s4">
          Ce restaurant est actuellement fermé. Vous pouvez consulter le menu, mais pas commander.
        </Alert>
      ) : etatResto === "pause" ? (
        <Alert ton="info" className="u-mt-s4">
          Ce restaurant est ouvert mais ne prend plus de commandes pour le moment. Vous pouvez consulter le menu et
          réessayer plus tard.
        </Alert>
      ) : null}

      {/* Vue visiteur : `inert` retire tout focus, clic et lecture d'écran — rien ne peut être commandé, la mise en page reste celle d'un client. */}
      <div className="fiche-grille" inert={visiteurSimule || undefined}>
        <div className="fiche-menu">
          {/* Le message « à confirmer » vit ici, au moment du choix, et une seule fois. */}
          {aucunConfirme ? (
            <Alert ton="info" className="u-mb-s4">
              Aucun plat n&apos;a été confirmé récemment. La disponibilité sera confirmée par le restaurant à la commande.
            </Alert>
          ) : null}

          {menuListe.length === 0 ? (
            <Alert ton="info">Ce restaurant n&apos;a pas encore publié son menu.</Alert>
          ) : (
            <MenuFiltre groupes={groupesFiltre} niveauSection={avecSections} />
          )}
        </div>
        {apercuSansCommande ? (
          <aside className="fiche-panier fiche-panier-apercu" aria-label="Aperçu de la commande">
            <h2 className="fiche-panier-titre">Commande</h2>
            <p className="fiche-panier-videtexte">Les commandes sont désactivées dans cette vue. Pour essayer le parcours d&apos;un client, utilisez « Tester une commande ».</p>
            <p className="fiche-panier-note">{textePaiement}</p>
          </aside>
        ) : (
          <ResumePanierFiche restaurantId={restaurantSur.id} paiement={textePaiement} />
        )}
      </div>
    </main>
  );
}
