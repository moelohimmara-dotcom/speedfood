import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerRestaurantsAdmin, type StatutFiltre } from "@/lib/system-admin/restaurants";
import { Card, Badge } from "@/components/ui";

const LIBELLES_FILTRE: Record<StatutFiltre, string> = {
  tous: "Tous",
  en_attente: "En attente",
  publies: "Publiés",
  suspendus: "Suspendus",
  correction: "Correction demandée",
};

const ORDRE_FILTRES: StatutFiltre[] = ["tous", "en_attente", "publies", "suspendus", "correction"];

interface Recherche {
  q?: string;
  statut?: string;
}

/**
 * Bloc 8b — liste/recherche/filtre des restaurants pour modération. La
 * permission est vérifiée ici (page) ; chaque action l'est de nouveau dans
 * `src/lib/system-admin/restaurants.ts` (défense en profondeur).
 */
export default async function RestaurantsComptesSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("restaurant.moderer");

  const { q, statut: statutBrut } = await searchParams;
  const statut: StatutFiltre = ORDRE_FILTRES.includes(statutBrut as StatutFiltre)
    ? (statutBrut as StatutFiltre)
    : "tous";

  const restaurants = await listerRestaurantsAdmin({ q, statut });

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Restaurants &amp; comptes</h1>

      <form method="GET" style={{ marginBottom: "var(--space-4)" }}>
        {statut !== "tous" ? <input type="hidden" name="statut" value={statut} /> : null}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="q">Rechercher un restaurant</label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Nom du restaurant" />
        </div>
      </form>

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-5)" }}>
        {ORDRE_FILTRES.map((valeur) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (valeur !== "tous") params.set("statut", valeur);
          const chaine = params.toString();
          return (
            <Link
              key={valeur}
              href={chaine ? `/system/restaurants?${chaine}` : "/system/restaurants"}
              className={`chip ${statut === valeur ? "actif" : ""}`}
            >
              {LIBELLES_FILTRE[valeur]}
            </Link>
          );
        })}
      </div>

      {restaurants.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucun restaurant ne correspond à cette recherche.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {restaurants.map((r) => (
            <Link key={r.id} href={`/system/restaurants/${r.id}`} style={{ textDecoration: "none" }}>
              <Card style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ color: "var(--encre)" }}>{r.nom}</strong>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>
                    {r.categorie} · {r.quartier}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {r.suspendu_le ? <Badge ton="danger">Suspendu</Badge> : null}
                  {!r.suspendu_le && r.motif_correction ? <Badge ton="danger">Correction demandée</Badge> : null}
                  {!r.suspendu_le && !r.motif_correction ? (
                    <Badge ton={r.publie ? "succes" : "neutre"}>
                      {r.publie ? "Publié" : "En attente"}
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
