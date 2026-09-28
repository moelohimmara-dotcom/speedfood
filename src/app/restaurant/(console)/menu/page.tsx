import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Card } from "@/components/ui";
import { PlatItem } from "./PlatItem";
import { FormulairePlat } from "./FormulairePlat";
import { SectionsMenu } from "./SectionsMenu";

export default async function MenuPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const [{ data: sections }, { data: plats }] = await Promise.all([
    supabase
      .from("menu_sections")
      .select("id, nom")
      .eq("restaurant_id", membership.restaurant_id)
      .order("position"),
    supabase
      .from("menu_items")
      .select(
        "id, nom, description, prix, prix_promo, disponible, photo_url, section_id, menu_item_options(id, nom, prix)"
      )
      .eq("restaurant_id", membership.restaurant_id)
      .is("archive_le", null)
      .order("nom"),
  ]);

  const sectionsListe = sections ?? [];
  const platsListe = (plats ?? []).map((plat) => ({ ...plat, options: plat.menu_item_options ?? [] }));

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
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Mon menu</h1>

      <SectionsMenu sections={sectionsListe} />

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h3 style={{ marginBottom: "var(--space-3)" }}>Ajouter un plat</h3>
        <FormulairePlat sections={sectionsListe} />
      </Card>

      {platsListe.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Aucun plat pour l&apos;instant. Ajoutez votre premier plat ci-dessus.
          </p>
        </Card>
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
  );
}
