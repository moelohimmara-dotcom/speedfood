import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Button, Card } from "@/components/ui";
import { PlatItem } from "./PlatItem";
import { FormulairePlat } from "./FormulairePlat";
import { AjoutEnLot } from "./AjoutEnLot";
import { ChefIA } from "./ChefIA";
import { SectionsMenu } from "./SectionsMenu";
import { confirmerToutesDisponibilitesAction } from "@/lib/menu/actions";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import {
  etatDisponibilite,
  libelleDisponibilite,
} from "@/lib/disponibilite/etat";
import { validerIllustration } from "@/lib/illustrations/modele";
import { familleDepuisCategorie } from "@/lib/illustrations/automatique";
import { PageHeader } from "@/components/admin/blocs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon menu" };

export default async function MenuPage() {
  const { supabase, membership } =
    await obtenirContexteRestaurant("/restaurant/menu");

  const [
    { data: sections },
    { data: plats },
    { disponibiliteFraicheurHeures, prixPlatMaxGnf },
    { data: restaurantFamille },
  ] = await Promise.all([
    supabase
      .from("menu_sections")
      .select("id, nom")
      .eq("restaurant_id", membership.restaurant_id)
      .order("position"),
    supabase
      .from("menu_items")
      .select(
        "id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, illustration, section_id, menu_item_options(id, nom, prix)",
      )
      .eq("restaurant_id", membership.restaurant_id)
      .is("archive_le", null)
      .order("nom"),
    obtenirParametresApplication(),
    supabase
      .from("restaurants")
      .select("menu_categories(nom)")
      .eq("id", membership.restaurant_id)
      .maybeSingle(),
  ]);
  const famille = familleDepuisCategorie(
    restaurantFamille?.menu_categories?.nom ?? "",
  );

  const sectionsListe = sections ?? [];
  const maintenant = new Date();
  const platsListe = (plats ?? []).map((plat) => {
    const etat = etatDisponibilite(
      {
        disponible: plat.disponible,
        confirmeLe: plat.disponibilite_confirmee_le,
      },
      disponibiliteFraicheurHeures,
      maintenant,
    );
    return {
      ...plat,
      options: plat.menu_item_options ?? [],
      illustration: validerIllustration(plat.illustration),
      disponibilite: libelleDisponibilite(etat, maintenant),
      aReconfirmer: etat.type === "a_confirmer",
    };
  });
  const nombreAReconfirmer = platsListe.filter(
    (plat) => plat.aReconfirmer,
  ).length;

  const platsParSection = new Map<string | null, typeof platsListe>();
  for (const plat of platsListe) {
    const cle = plat.section_id;
    const liste = platsParSection.get(cle) ?? [];
    liste.push(plat);
    platsParSection.set(cle, liste);
  }
  const platsSansSection = platsParSection.get(null) ?? [];

  return (
    <div>
      <PageHeader
        titre="Mon menu"
        actions={
          <>
            <Link href="/restaurant/ouverture" className="btn btn-secondary">
              Ouvrir ma journée
            </Link>
            <Link href="/restaurant/menu-du-jour" className="btn btn-secondary">
              Menu du jour
            </Link>
          </>
        }
        description={`${platsListe.length} plat${platsListe.length > 1 ? "s" : ""}${sectionsListe.length > 0 ? ` · ${sectionsListe.length} section${sectionsListe.length > 1 ? "s" : ""}` : ""}`}
      />

      <div className="menu-colonnes">
        <div className="menu-liste">
          {platsListe.length > 0 ? (
            <div className="bandeau-dispo">
              <p>
                <strong>Disponibilité du jour.</strong>{" "}
                {nombreAReconfirmer > 0
                  ? `${nombreAReconfirmer} plat${nombreAReconfirmer > 1 ? "s" : ""} à reconfirmer : les clients les voient « à confirmer » tant que vous ne les reconfirmez pas (au-delà de ${disponibiliteFraicheurHeures} h).`
                  : "Tous vos plats disponibles sont confirmés récemment."}
              </p>
              <form action={confirmerToutesDisponibilitesAction}>
                <Button type="submit" variante="secondary">
                  Tout reconfirmer disponible
                </Button>
              </form>
            </div>
          ) : null}

          {platsListe.length === 0 ? (
            <div className="etat-vide">
              <span className="etat-vide-icone" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="30"
                  height="30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10" />
                  <path d="M17 3c-2 1.5-3 4-3 7h3v11" />
                </svg>
              </span>
              <p className="etat-vide-titre">Votre menu est vide</p>
              <p>
                Une photo et un prix suffisent pour commencer. Une photo aide
                beaucoup les clients à choisir.
              </p>
              <a href="#ajout-plat" className="btn btn-primary">
                Ajouter mon premier plat
              </a>
            </div>
          ) : sectionsListe.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {platsListe.map((plat) => (
                <PlatItem
                  key={plat.id}
                  plat={plat}
                  restaurantId={membership.restaurant_id}
                  famille={famille}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-5)",
              }}
            >
              {sectionsListe.map((section) => {
                const platsDeSection = platsParSection.get(section.id) ?? [];
                if (platsDeSection.length === 0) {
                  return null;
                }
                return (
                  <div key={section.id}>
                    <h2
                      style={{
                        marginBottom: "var(--space-3)",
                        fontSize: "1.25rem",
                      }}
                    >
                      {section.nom}
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {platsDeSection.map((plat) => (
                        <PlatItem
                          key={plat.id}
                          plat={plat}
                          sections={sectionsListe}
                          restaurantId={membership.restaurant_id}
                          famille={famille}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {platsSansSection.length > 0 ? (
                <div>
                  <h2
                    style={{
                      marginBottom: "var(--space-3)",
                      fontSize: "1.25rem",
                    }}
                  >
                    Sans section
                  </h2>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {platsSansSection.map((plat) => (
                      <PlatItem
                        key={plat.id}
                        plat={plat}
                        sections={sectionsListe}
                        restaurantId={membership.restaurant_id}
                        famille={famille}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside
          className="menu-panneau"
          aria-label="Ajouter et organiser"
          id="ajout-plat"
        >
          <Card>
            <h2 style={{ marginBottom: "var(--space-3)", fontSize: "1.25rem" }}>
              Ajouter un plat
            </h2>
            <FormulairePlat sections={sectionsListe} />
          </Card>
          <Card>
            <AjoutEnLot sections={sectionsListe} prixMax={prixPlatMaxGnf} />
          </Card>
          <Card>
            <ChefIA sections={sectionsListe} />
          </Card>
          <SectionsMenu sections={sectionsListe} />
        </aside>
      </div>
    </div>
  );
}
