import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { Button, Card } from "@/components/ui";
import { PlatItem } from "./PlatItem";
import { FormulairePlat } from "./FormulairePlat";
import { SectionsMenu } from "./SectionsMenu";
import { confirmerToutesDisponibilitesAction } from "@/lib/menu/actions";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { etatDisponibilite, libelleDisponibilite } from "@/lib/disponibilite/etat";

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
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>Mon menu</h1>

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h3 style={{ marginBottom: "var(--space-2)" }}>Disponibilité du jour</h3>
        <p style={{ margin: "0 0 var(--space-3)", fontSize: "0.9rem", color: "var(--secondaire)" }}>
          {nombreAReconfirmer > 0
            ? `${nombreAReconfirmer} plat${nombreAReconfirmer > 1 ? "s" : ""} à reconfirmer : les clients les voient « à confirmer » tant que vous ne les reconfirmez pas (au-delà de ${disponibiliteFraicheurHeures} h).`
            : "Tous vos plats disponibles sont confirmés récemment."}
        </p>
        <form action={confirmerToutesDisponibilitesAction}>
          <Button type="submit" variante="secondary">
            Tout reconfirmer disponible
          </Button>
        </form>
      </Card>

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
