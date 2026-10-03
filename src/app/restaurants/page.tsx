import Link from "next/link";
import { creerClientPublic } from "@/lib/db/public";
import { RestaurantCard, type PlatCarte } from "@/components/RestaurantCard";
import { Alert } from "@/components/ui";
import { StampFraicheur } from "@/components/StampFraicheur";
import { rechercherCatalogue } from "@/lib/decouverte/recherche";
import { LIBELLES_GROUPES, ORDRE_GROUPES, type ResultatClasse } from "@/lib/decouverte/classement";
import { etatRestaurant, libelleDisponibilite } from "@/lib/disponibilite/etat";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";

interface Recherche {
  q?: string;
  categorie?: string;
  quartier?: string;
  ouvert?: string;
  commandes?: string;
  dispo?: string;
}

const MAX_PLATS_PAR_CARTE = 3;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const { categorie, quartier } = params;
  const filtres = {
    ouvert: params.ouvert === "1",
    commandes: params.commandes === "1",
    dispo: params.dispo === "1",
  };

  const supabase = creerClientPublic();
  const [{ data: categories, error: erreurCategories }, { data: quartiers, error: erreurQuartiers }, recherche] =
    await Promise.all([
      supabase.from("menu_categories").select("id, nom").order("ordre"),
      supabase.from("neighborhoods").select("id, nom").order("ordre"),
      rechercherCatalogue({ q, categorie, quartier, filtres }),
    ]);

  const erreur = erreurCategories || erreurQuartiers || recherche.erreur;
  const etat = { q, categorie, quartier, ...filtres };
  const resultats = recherche.resultats;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 className="decouverte-hero">Qu&apos;est-ce qui vous ferait plaisir aujourd&apos;hui ?</h1>

      <form action="/restaurants" method="GET" style={{ marginBottom: "var(--space-4)" }}>
        {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
        {quartier ? <input type="hidden" name="quartier" value={quartier} /> : null}
        {filtres.ouvert ? <input type="hidden" name="ouvert" value="1" /> : null}
        {filtres.commandes ? <input type="hidden" name="commandes" value="1" /> : null}
        {filtres.dispo ? <input type="hidden" name="dispo" value="1" /> : null}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="q">Rechercher</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            placeholder="Un plat, un restaurant…"
          />
        </div>
      </form>

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <Link href={lien(etat, { ouvert: !filtres.ouvert })} className={`chip ${filtres.ouvert ? "actif" : ""}`}>
          Ouvert maintenant
        </Link>
        <Link
          href={lien(etat, { commandes: !filtres.commandes })}
          className={`chip ${filtres.commandes ? "actif" : ""}`}
        >
          Accepte les commandes
        </Link>
        <Link href={lien(etat, { dispo: !filtres.dispo })} className={`chip ${filtres.dispo ? "actif" : ""}`}>
          Plat disponible
        </Link>
      </div>
      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {(categories ?? []).map((c) => (
          <Link
            key={c.id}
            href={lien(etat, { categorie: categorie === c.id ? undefined : c.id })}
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
            href={lien(etat, { quartier: quartier === quartierOption.id ? undefined : quartierOption.id })}
            className={`chip ${quartier === quartierOption.id ? "actif" : ""}`}
          >
            {quartierOption.nom}
          </Link>
        ))}
      </div>

      {!erreur && !q && recherche.vedettes.length > 0 ? (
        <section aria-labelledby="titre-vedettes" style={{ marginBottom: "var(--space-5)" }}>
          <h2 id="titre-vedettes" className="groupe-resultats-titre">
            Plats du moment
          </h2>
          <div className="carrousel">
            {recherche.vedettes.map((vedette) => (
              <Link key={vedette.platId} href={`/restaurants/${vedette.restaurantId}#plat-${vedette.platId}`} className="carte-vedette">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local. */}
                <img src={vedette.photoUrl} alt="" loading="lazy" />
                <span className="carte-vedette-corps">
                  <span className="carte-vedette-nom">{vedette.nom}</span>
                  <span className="carte-vedette-resto">
                    {vedette.restaurantNom} · {vedette.quartier}
                  </span>
                  <StampFraicheur disponibilite={libelleDisponibilite(vedette.etat, recherche.maintenant)} />
                  <span className="carte-vedette-prix">{vedette.prixAffiche.toLocaleString("fr-FR")} GNF</span>
                </span>
              </Link>
            ))}
          </div>
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
        <Alert ton="info">
          Aucun restaurant ne correspond à cette recherche.{" "}
          <Link href="/restaurants" style={{ fontWeight: 700 }}>
            Réinitialiser les filtres
          </Link>
        </Alert>
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
        <div className="grille-restaurants">{resultats.map((r) => carte(r, recherche.maintenant))}</div>
      )}
    </main>
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
