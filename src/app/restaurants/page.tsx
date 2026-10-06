import Link from "next/link";
import { creerClientPublic } from "@/lib/db/public";
import { BarreFiltres, type OptionFiltre } from "@/components/site/BarreFiltres";
import { RecherchesRecentes } from "@/components/site/RecherchesRecentes";
import { CarrouselVedettes } from "@/components/site/CarrouselVedettes";
import { VecteurDecouverte } from "@/components/site/vecteurs/VecteurDecouverte";
import { VecteurIntrouvable } from "@/components/site/vecteurs/VecteurIntrouvable";
import { RestaurantCard, type PlatCarte } from "@/components/RestaurantCard";
import { Alert } from "@/components/ui";
import { StampFraicheur } from "@/components/StampFraicheur";
import { rechercherCatalogue } from "@/lib/decouverte/recherche";
import { LIBELLES_GROUPES, ORDRE_GROUPES, type ResultatClasse } from "@/lib/decouverte/classement";
import { etatRestaurant, libelleDisponibilite } from "@/lib/disponibilite/etat";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";
import type { Metadata } from "next";
import { lirePromesse } from "@/lib/parametres/promesse";
import { lireChiffresEnDirect } from "@/lib/decouverte/chiffres";
import { origineDuSite } from "@/lib/partage/origine";

interface Recherche {
  q?: string;
  categorie?: string;
  quartier?: string;
  ouvert?: string;
  commandes?: string;
  dispo?: string;
  compte?: string;
}

const MAX_PLATS_PAR_CARTE = 3;

// Aperçu de partage de l'accueil et du catalogue : logo officiel (adresse absolue, requise par WhatsApp et les réseaux).
export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  const { partage: description } = await lirePromesse();
  return {
    title: "Découvrir les restaurants",
    description,
    alternates: { canonical: `${origine}/restaurants` },
    openGraph: {
      title: "Speedfood · Restaurants de Conakry",
      description,
      type: "website",
      siteName: "Speedfood",
      locale: "fr_FR",
      images: [{ url: `${origine}/logo-speedfood.webp`, width: 1024, height: 1024, alt: "Speedfood" }],
    },
  };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const params = await searchParams;
  const promesse = await lirePromesse();
  const q = (params.q ?? "").trim().slice(0, 100);
  const { categorie, quartier } = params;
  const filtres = {
    ouvert: params.ouvert === "1",
    commandes: params.commandes === "1",
    dispo: params.dispo === "1",
  };

  const supabase = creerClientPublic();
  const [{ data: categories, error: erreurCategories }, { data: quartiers, error: erreurQuartiers }, recherche, base] =
    await Promise.all([
      supabase.from("menu_categories").select("id, nom").order("ordre"),
      supabase.from("neighborhoods").select("id, nom").order("ordre"),
      rechercherCatalogue({ q, categorie, quartier, filtres }),
      // Même recherche sans filtre de cuisine ni de quartier : sert aux compteurs des puces (avec l'autre filtre actif).
      rechercherCatalogue({ q, filtres }),
    ]);

  // Accueil « nu » (sans recherche ni filtre) : preuve en direct et trois étapes ; une recherche affiche d'abord ses résultats.
  const accueilNu = !q && !categorie && !quartier && !filtres.ouvert && !filtres.commandes && !filtres.dispo;
  const chiffres = accueilNu ? await lireChiffresEnDirect() : null;

  const erreur = erreurCategories || erreurQuartiers || recherche.erreur;
  const etat = { q, categorie, quartier, ...filtres };
  const resultats = recherche.resultats;
  const nomQuartierActif = (quartiers ?? []).find((x) => x.id === quartier)?.nom;
  const compter = (liste: ResultatClasse<RestaurantCatalogue>[]) => liste.length;
  const optionsCuisine: OptionFiltre[] = (categories ?? []).map((c) => ({
    cle: c.id,
    libelle: c.nom,
    n: compter(base.resultats.filter((r) => r.restaurant.categorieId === c.id && (!nomQuartierActif || r.restaurant.quartier === nomQuartierActif))),
    href: lien(etat, { categorie: categorie === c.id ? undefined : c.id }),
    actif: categorie === c.id,
  }));
  const optionsQuartier: OptionFiltre[] = (quartiers ?? []).map((x) => ({
    cle: x.id,
    libelle: x.nom,
    n: compter(base.resultats.filter((r) => r.restaurant.quartier === x.nom && (!categorie || r.restaurant.categorieId === categorie))),
    href: lien(etat, { quartier: quartier === x.id ? undefined : x.id }),
    actif: quartier === x.id,
  }));
  const effacerFiltres = categorie || quartier ? lien(etat, { categorie: undefined, quartier: undefined }) : null;
  const nbConfirmes = recherche.vedettes.filter((v) => v.etat.type === "disponible").length;

  return (
    <main className="decouverte">
      {params.compte === "supprime" ? (
        <p className="accueil-confirmation" role="status">
          Votre compte a été supprimé. Vous pouvez toujours commander sans compte.
        </p>
      ) : null}
      <section className="decouverte-bandeau">
        <div className="decouverte-bandeau-interieur">
          <div className="decouverte-bandeau-texte">
          <p className="decouverte-surtitre">{promesse.signature}</p>
          <h1 className="decouverte-hero pub-titre">Qu&apos;est-ce qui vous ferait plaisir aujourd&apos;hui ?</h1>
          <p className="decouverte-sous">
            {promesse.sousTitre}
          </p>

          <form action="/restaurants" method="GET" role="search" className="decouverte-recherche">
            {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
            {quartier ? <input type="hidden" name="quartier" value={quartier} /> : null}
            {filtres.ouvert ? <input type="hidden" name="ouvert" value="1" /> : null}
            {filtres.commandes ? <input type="hidden" name="commandes" value="1" /> : null}
            {filtres.dispo ? <input type="hidden" name="dispo" value="1" /> : null}
            <label htmlFor="q" className="sr-only">Rechercher un plat ou un restaurant</label>
            <input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Un plat, un restaurant…" />
            <button type="submit" className="btn btn-primary decouverte-recherche-bouton">Rechercher</button>
          </form>

          <RecherchesRecentes courante={q} />

          <div className="chip-row decouverte-puces">
            <Link href={lien(etat, { ouvert: !filtres.ouvert })} className={`chip ${filtres.ouvert ? "actif" : ""}`}>
              Ouvert maintenant
            </Link>
            <Link href={lien(etat, { commandes: !filtres.commandes })} className={`chip ${filtres.commandes ? "actif" : ""}`}>
              Accepte les commandes
            </Link>
            <Link href={lien(etat, { dispo: !filtres.dispo })} className={`chip ${filtres.dispo ? "actif" : ""}`}>
              Plat disponible
            </Link>
          </div>
          </div>
          {/* Illustration vectorielle animée (ordinateur) : une loupe qui passe de plat en plat, en rapport avec la rubrique. */}
          <div className="decouverte-vecteur" aria-hidden="true">
            <VecteurDecouverte />
          </div>
        </div>
      </section>

      {accueilNu ? (
        <section className="accueil-preuve" aria-label="En ce moment">
          {chiffres && (chiffres.platsConfirmes > 0 || chiffres.restaurantsOuverts > 0) ? (
            <p className="accueil-preuve-direct" role="status">
              <span className="accueil-preuve-point boucle" aria-hidden="true" />
              En ce moment :{" "}
              {chiffres.restaurantsOuverts > 0 ? (
                <strong>
                  {chiffres.restaurantsOuverts} restaurant{chiffres.restaurantsOuverts > 1 ? "s" : ""} ouvert
                  {chiffres.restaurantsOuverts > 1 ? "s" : ""} aux commandes
                </strong>
              ) : null}
              {chiffres.restaurantsOuverts > 0 && chiffres.platsConfirmes > 0 ? " · " : null}
              {chiffres.platsConfirmes > 0 ? (
                <strong>
                  {chiffres.platsConfirmes} plat{chiffres.platsConfirmes > 1 ? "s" : ""} confirmé
                  {chiffres.platsConfirmes > 1 ? "s" : ""} depuis moins d&apos;une heure
                </strong>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}

      {!erreur ? <BarreFiltres cuisines={optionsCuisine} quartiers={optionsQuartier} effacer={effacerFiltres} total={resultats.length} /> : null}

      <div className="decouverte-corps decouverte-corps-large">
        <div className="decouverte-resultats">
      {!erreur && !q && recherche.vedettes.length > 0 ? (
        <section aria-labelledby="titre-vedettes" style={{ marginBottom: "var(--space-5)" }}>
          {/* Titre fidèle au contenu : « du moment » seulement s'il y a des plats confirmés récemment ; sinon « à découvrir ». */}
          <h2 id="titre-vedettes" className="groupe-resultats-titre">
            {nbConfirmes > 0 ? "Plats du moment" : "Plats à découvrir"}
          </h2>
          {nbConfirmes < recherche.vedettes.length ? (
            <p className="decouverte-note-dispo" role="note">
              <strong>« À confirmer »</strong> : le restaurant n&apos;a pas reconfirmé ce plat depuis {recherche.fraicheurHeures} h. Il le confirme à la commande.
            </p>
          ) : null}
          <CarrouselVedettes key={lien(etat, {})} libelle="Plats à découvrir, défilement horizontal">
            {recherche.vedettes.map((vedette) => (
              <Link key={vedette.platId} href={`/restaurants/${vedette.restaurantId}#plat-${vedette.platId}`} className="carte-vedette">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local. */}
                <img src={vedette.photoUrl} alt="" loading="lazy" />
                <span className="carte-vedette-corps">
                  <span className="carte-vedette-nom">{vedette.nom}</span>
                  <span className="carte-vedette-resto">
                    {vedette.restaurantNom} · {vedette.quartier}
                  </span>
                  {vedette.etat.type === "disponible" ? (
                    <StampFraicheur disponibilite={libelleDisponibilite(vedette.etat, recherche.maintenant)} />
                  ) : (
                    <span className="carte-vedette-aconfirmer">À confirmer</span>
                  )}
                  <span className="carte-vedette-prix">{vedette.prixAffiche.toLocaleString("fr-FR")} GNF</span>
                </span>
              </Link>
            ))}
          </CarrouselVedettes>
        </section>
      ) : null}

      {!q && !erreur && resultats.length > 0 ? (
        <h2 className="groupe-resultats-titre">Restaurants</h2>
      ) : null}

      {q || filtres.dispo ? (
        <p style={{ color: "var(--secondaire)", fontSize: "0.85rem", margin: "0 0 var(--space-3)" }}>
          La disponibilité est déclarée par chaque restaurant. Sans reconfirmation depuis{" "}
          {recherche.fraicheurHeures} h, elle s&apos;affiche « à confirmer » : le restaurant confirme à la
          commande.
        </p>
      ) : null}

      {erreur ? (
        <Alert ton="danger">
          Impossible de charger le catalogue pour le moment. Réessayez dans un instant.
        </Alert>
      ) : resultats.length === 0 ? (
        <div className="decouverte-vide" role="status">
          <VecteurIntrouvable />
          <p className="decouverte-vide-titre">Aucun restaurant ne correspond à cette recherche.</p>
          <p className="decouverte-vide-texte">Essayez un autre plat, retirez un filtre ou parcourez tous les restaurants.</p>
          <Link href="/restaurants" className="btn btn-primary">
            Réinitialiser les filtres
          </Link>
          {(categories ?? []).length > 0 ? (
            <p className="decouverte-vide-pistes">
              <span>Ou essayez :</span>
              {(categories ?? []).slice(0, 4).map((c) => (
                <Link key={c.id} href={`/restaurants?categorie=${c.id}`} className="chip">
                  {c.nom}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
      ) : q ? (
        ORDRE_GROUPES.map((groupe) => {
          const duGroupe = resultats.filter((r) => r.groupe === groupe);
          if (duGroupe.length === 0) {
            return null;
          }
          return (
            <section key={groupe}>
              <h2 className="groupe-resultats-titre">{LIBELLES_GROUPES[groupe]}</h2>
              <div className="grille-restaurants">
                {duGroupe.map((r) => carte(r, recherche.maintenant))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="grille-restaurants">{ouvertsDabord(resultats).map((r) => carte(r, recherche.maintenant))}</div>
      )}
        </div>
      </div>
    </main>
  );
}

/** Restaurants ouverts aux commandes d'abord, puis en pause, puis fermés ; à égalité, ordre alphabétique (liste sans recherche seulement). */
function ouvertsDabord(resultats: ResultatClasse<RestaurantCatalogue>[]): ResultatClasse<RestaurantCatalogue>[] {
  const rang = { ouvert: 0, pause: 1, ferme: 2 } as const;
  return [...resultats].sort(
    (a, b) => rang[etatRestaurant(a.restaurant)] - rang[etatRestaurant(b.restaurant)] || a.restaurant.nom.localeCompare(b.restaurant.nom, "fr")
  );
}

function carte(resultat: ResultatClasse<RestaurantCatalogue>, maintenant: Date) {
  const r = resultat.restaurant;
  const plats: PlatCarte[] = resultat.platsCorrespondants.slice(0, MAX_PLATS_PAR_CARTE).map((p) => ({
    id: p.plat.id,
    nom: p.plat.nom,
    prixAffiche: p.plat.prixPromo ?? p.plat.prix,
    disponibilite: libelleDisponibilite(p.etat, maintenant),
  }));
  return (
    <RestaurantCard
      key={r.id}
      id={r.id}
      nom={r.nom}
      etat={etatRestaurant(r)}
      photoUrl={r.photoUrl}
      logoUrl={r.logoUrl}
      couleurAccent={r.couleurAccent}
      couvertureIllustration={r.couvertureIllustration}
      logoIllustration={r.logoIllustration}
      categorie={r.categorie}
      quartier={r.quartier}
      plats={plats}
      autresPlats={Math.max(0, resultat.platsCorrespondants.length - MAX_PLATS_PAR_CARTE)}
    />
  );
}

interface EtatFiltres {
  q?: string;
  categorie?: string;
  quartier?: string;
  ouvert: boolean;
  commandes: boolean;
  dispo: boolean;
}

/** Lien qui applique des changements aux filtres en conservant tous les autres paramètres. */
function lien(actuel: EtatFiltres, changements: Partial<EtatFiltres>) {
  const suivant = { ...actuel, ...changements };
  const params = new URLSearchParams();
  if (suivant.q) params.set("q", suivant.q);
  if (suivant.categorie) params.set("categorie", suivant.categorie);
  if (suivant.quartier) params.set("quartier", suivant.quartier);
  if (suivant.ouvert) params.set("ouvert", "1");
  if (suivant.commandes) params.set("commandes", "1");
  if (suivant.dispo) params.set("dispo", "1");
  const chaine = params.toString();
  return chaine ? `/restaurants?${chaine}` : "/restaurants";
}
