import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Button, Card } from "@/components/ui";
import { PlatItem } from "./PlatItem";
import { FormulairePlat } from "./FormulairePlat";
import { SectionsMenu } from "./SectionsMenu";
import { confirmerToutesDisponibilitesAction } from "@/lib/menu/actions";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { etatDisponibilite, libelleDisponibilite } from "@/lib/disponibilite/etat";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon menu" };

export default async function MenuPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const [{ data: sections }, { data: plats }, { disponibiliteFraicheurHeures }] = await Promise.all([
    supabase
      .from("menu_sections")
      .select("id, nom")
      .eq("restaurant_id", membership.restaurant_id)
      .order("position"),
    supabase
      .from("menu_items")
      .select(
        "id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, section_id, menu_item_options(id, nom, prix)"
      )
      .eq("restaurant_id", membership.restaurant_id)
      .is("archive_le", null)
      .order("nom"),
    obtenirParametresApplication(),
  ]);

  const sectionsListe = sections ?? [];
  const maintenant = new Date();
  const platsListe = (plats ?? []).map((plat) => {
    const etat = etatDisponibilite(
      { disponible: plat.disponible, confirmeLe: plat.disponibilite_confirmee_le },
      disponibiliteFraicheurHeures,
      maintenant
    );
    return {
      ...plat,
      options: plat.menu_item_options ?? [],
      disponibilite: libelleDisponibilite(etat, maintenant),
      aReconfirmer: etat.type === "a_confirmer",
    };
  });
  const nombreAReconfirmer = platsListe.filter((plat) => plat.aReconfirmer).length;

  const platsParSection = new Map<string | null, typeof platsListe>();
  for (const plat of platsListe) {
    const cle = plat.section_id;
    const liste = platsParSection.get(cle) ?? [];
    liste.push(plat);
    platsParSection.set(cle, liste);
  }
  const platsSansSection = platsParSection.get(null) ?? [];

  return (
    <div className="tableau">
      <header className="tableau-entete">
        <h1>Mon menu</h1>
        <p className="tableau-sous">
          {platsListe.length} plat{platsListe.length > 1 ? "s" : ""}
          {sectionsListe.length > 0 ? ` · ${sectionsListe.length} section${sectionsListe.length > 1 ? "s" : ""}` : ""}
        </p>
      </header>

      <div className="menu-colonnes">
        <div className="menu-liste">
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

      {platsListe.length === 0 ? (
        <div className="etat-vide">
          <span className="etat-vide-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10" />
              <path d="M17 3c-2 1.5-3 4-3 7h3v11" />
            </svg>
          </span>
          <p className="etat-vide-titre">Votre menu est vide</p>
          <p>Ajoutez votre premier plat avec le formulaire « Ajouter un plat ». Une photo aide beaucoup les clients à choisir.</p>
        </div>
      ) : sectionsListe.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {platsListe.map((plat) => (
            <PlatItem key={plat.id} plat={plat} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {sectionsListe.map((section) => {
            const platsDeSection = platsParSection.get(section.id) ?? [];
            if (platsDeSection.length === 0) {
              return null;
            }
            return (
              <div key={section.id}>
                <h3 style={{ marginBottom: "var(--space-3)" }}>{section.nom}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {platsDeSection.map((plat) => (
                    <PlatItem key={plat.id} plat={plat} sections={sectionsListe} />
                  ))}
                </div>
              </div>
            );
          })}
          {platsSansSection.length > 0 ? (
            <div>
              <h3 style={{ marginBottom: "var(--space-3)" }}>Sans section</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {platsSansSection.map((plat) => (
                  <PlatItem key={plat.id} plat={plat} sections={sectionsListe} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

        </div>

        <aside className="menu-panneau" aria-label="Ajouter et organiser">
          <Card>
            <h3 style={{ marginBottom: "var(--space-3)" }}>Ajouter un plat</h3>
            <FormulairePlat sections={sectionsListe} />
          </Card>
          <SectionsMenu sections={sectionsListe} />
        </aside>
      </div>
    </div>
  );
}
