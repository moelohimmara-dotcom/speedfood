import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import {
  listerComptesAnnuaire,
  type TypeCompteAnnuaire,
} from "@/lib/system-admin/annuaire";
import { Card, Badge } from "@/components/ui";
import { formaterDateCourte } from "../../formatage";

const LIBELLES_FILTRE: Record<TypeCompteAnnuaire, string> = {
  tous: "Tous",
  restaurateur: "Restaurateurs",
  systeme: "Rôles système",
  sans_affiliation: "Sans affiliation",
};

const ORDRE_FILTRES: TypeCompteAnnuaire[] = [
  "tous",
  "restaurateur",
  "systeme",
  "sans_affiliation",
];

interface Recherche {
  q?: string;
  type?: string;
}

/**
 * Annuaire global des comptes utilisateurs (post-bloc 8d). Permission
 * `compte.consulter` vérifiée ici (page) et de nouveau dans
 * `src/lib/system-admin/annuaire.ts` (défense en profondeur). Lecture seule :
 * l'attribution des rôles reste dans `/system/acces/roles`, les memberships
 * restaurant dans `/system/catalogue/restaurants`.
 */
export default async function ComptesSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("compte.consulter");

  const { q, type: typeBrut } = await searchParams;
  const type: TypeCompteAnnuaire = ORDRE_FILTRES.includes(typeBrut as TypeCompteAnnuaire)
    ? (typeBrut as TypeCompteAnnuaire)
    : "tous";

  const { comptes, tronque } = await listerComptesAnnuaire({ q, type });

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-2)" }}>Comptes utilisateurs</h1>
      <p style={{ color: "var(--secondaire)", marginTop: 0, marginBottom: "var(--space-4)" }}>
        Annuaire en lecture seule : emails des comptes Speedfood, affiliations restaurant
        et rôles système. Pour attribuer un rôle, utilisez&nbsp;
        <Link href="/system/acces/roles">Rôles système</Link>&nbsp;; pour gérer une équipe,
        la fiche du restaurant concerné.
      </p>

      <form method="GET" style={{ marginBottom: "var(--space-4)" }}>
        {type !== "tous" ? <input type="hidden" name="type" value={type} /> : null}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="q">Rechercher un compte</label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Email" />
        </div>
      </form>

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-5)" }}>
        {ORDRE_FILTRES.map((valeur) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (valeur !== "tous") params.set("type", valeur);
          const chaine = params.toString();
          return (
            <Link
              key={valeur}
              href={chaine ? `/system/acces/comptes?${chaine}` : "/system/acces/comptes"}
              className={`chip ${type === valeur ? "actif" : ""}`}
            >
              {LIBELLES_FILTRE[valeur]}
            </Link>
          );
        })}
      </div>

      {tronque ? (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ margin: 0 }}>
            <Badge ton="danger">Liste incomplète</Badge>{" "}
            L&apos;annuaire a atteint sa borne de lecture : affinez la recherche par email
            pour trouver un compte absent de cette page.
          </p>
        </Card>
      ) : null}

      {comptes.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucun compte ne correspond à cette recherche.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {comptes.map((compte) => (
            <Card key={compte.utilisateurId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
                <strong style={{ color: "var(--encre)" }}>{compte.email}</strong>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {compte.roleSysteme ? <Badge ton="succes">{compte.roleSysteme}</Badge> : null}
                  {compte.restaurants.length > 0 ? (
                    <Badge ton="neutre">
                      {compte.restaurants.length} restaurant{compte.restaurants.length > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                  {compte.roleSysteme === null && compte.restaurants.length === 0 ? (
                    <Badge ton="neutre">Sans affiliation</Badge>
                  ) : null}
                </div>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--secondaire)" }}>
                Créé le {formaterDateCourte(compte.creeLe)}
              </p>
              {compte.restaurants.length > 0 ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: "0.85rem" }}>
                  {compte.restaurants.map((affiliation) => (
                    <li key={affiliation.restaurantId}>
                      <Link href={`/system/catalogue/restaurants/${affiliation.restaurantId}`}>{affiliation.nom}</Link>
                      {" — "}
                      {affiliation.role === "owner" ? "propriétaire" : "équipier"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
