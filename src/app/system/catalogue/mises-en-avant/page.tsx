import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerMisesEnAvant, listerRestaurantsPublies } from "@/lib/system-admin/misesEnAvant";
import { Card } from "@/components/ui";
import { FormulaireNouvelleMiseEnAvant } from "./FormulaireNouvelleMiseEnAvant";
import { MiseEnAvantItem } from "./MiseEnAvantItem";

export default async function MisesEnAvantSystemePage() {
  await exigerPermissionPage("contenu.mettre_en_avant");

  const [misesEnAvant, restaurants] = await Promise.all([
    listerMisesEnAvant(),
    listerRestaurantsPublies(),
  ]);

  const idsDejaMisEnAvant = new Set(misesEnAvant.map((m) => m.restaurant_id));
  const restaurantsDisponibles = restaurants.filter((r) => !idsDejaMisEnAvant.has(r.id));

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Mises en avant</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        Décision opérationnelle (permission distincte des contenus éditoriaux) : quels restaurants
        publiés apparaissent en avant au catalogue.
      </p>

      <Card style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-3)" }}>Ajouter une mise en avant</h2>
        {restaurantsDisponibles.length === 0 ? (
          <p style={{ margin: 0, color: "var(--secondaire)" }}>
            Tous les restaurants publiés sont déjà mis en avant, ou aucun restaurant n&apos;est publié.
          </p>
        ) : (
          <FormulaireNouvelleMiseEnAvant restaurants={restaurantsDisponibles} prochainePosition={misesEnAvant.length} />
        )}
      </Card>

      {misesEnAvant.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune mise en avant pour l&apos;instant.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {misesEnAvant.map((m) => (
            <MiseEnAvantItem key={m.id} miseEnAvant={m} />
          ))}
        </div>
      )}
    </div>
  );
}
