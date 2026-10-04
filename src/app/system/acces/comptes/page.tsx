import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { LIBELLES_ROLES, roleAPermission, sousSectionsAccessibles, type RoleSysteme } from "@/lib/system-admin/permissions";
import { SuppressionCompte } from "./SuppressionCompte";
import { BarreSelectionGroupee, CaseCompte, CaseToutSelectionner } from "./SelectionGroupee";
import { estCompteDeTest } from "@/lib/system-admin/comptesTest";
import {
  listerComptesAnnuaire,
  type TypeCompteAnnuaire,
} from "@/lib/system-admin/annuaire";
import { Alert } from "@/components/ui";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { formaterDateCourte } from "../../formatage";

export const metadata = { title: "Comptes (administration)" };

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

/** Filtre supplémentaire, propre à cet écran : les comptes qui ressemblent à des comptes de test (voir `comptesTest.ts`). */
const FILTRE_TEST = "test";

interface Recherche {
  q?: string;
  type?: string;
  supprime?: string;
  n?: string;
  refus?: string;
  rs?: string;
  rc?: string;
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
  const contexte = await exigerPermissionPage("compte.consulter");
  const peutSupprimer = roleAPermission(contexte.role, "compte.supprimer");

  const { q, type: typeBrut, supprime, rs, rc, n, refus } = await searchParams;
  const comptesSupprimes = Number.parseInt(n ?? "", 10);
  const comptesRefuses = Number.parseInt(refus ?? "0", 10) || 0;
  const filtreTest = typeBrut === FILTRE_TEST;
  const restaurantsSupprimes = Number.parseInt(rs ?? "0", 10) || 0;
  const restaurantsConserves = Number.parseInt(rc ?? "0", 10) || 0;
  const type: TypeCompteAnnuaire = ORDRE_FILTRES.includes(typeBrut as TypeCompteAnnuaire)
    ? (typeBrut as TypeCompteAnnuaire)
    : "tous";

  const { comptes: tousLesComptes, tronque } = await listerComptesAnnuaire({ q, type });
  const comptes = filtreTest ? tousLesComptes.filter((c) => estCompteDeTest(c.email)) : tousLesComptes;
  const estSupprimable = (c: (typeof comptes)[number]) =>
    peutSupprimer && c.utilisateurId !== contexte.utilisateurId && c.roleSysteme !== "super_admin";
  const nombreSupprimables = comptes.filter(estSupprimable).length;

  return (
    <div>
      <PageHeader
        titre="Accès"
        description={
          <>
            Annuaire des comptes Speedfood, de leurs restaurants et de leurs rôles système. Pour attribuer un rôle, utilisez{" "}
            <Link href="/system/acces/roles" className="lien-texte">
              Rôles système
            </Link>
            .
          </>
        }
      />
      <SousNav entrees={sousSectionsAccessibles("Accès", contexte.role)} />

      {supprime === "1" ? (
        <Alert ton="succes" style={{ marginBottom: "var(--space-4)" }}>
          {Number.isFinite(comptesSupprimes) && comptesSupprimes !== 1
            ? `${comptesSupprimes} comptes supprimés définitivement.`
            : "Compte supprimé définitivement."}
          {comptesRefuses > 0
            ? ` ${comptesRefuses} compte(s) refusé(s) : votre propre compte, un super administrateur ou une erreur. Rien n'a été supprimé pour ceux-là.`
            : ""}
          {restaurantsSupprimes > 0 ? ` ${restaurantsSupprimes} restaurant(s) supprimé(s).` : ""}
          {restaurantsConserves > 0
            ? ` ${restaurantsConserves} restaurant(s) conservé(s) sans membre (commandes existantes, ou suppression non demandée).`
            : ""}
        </Alert>
      ) : null}

      <div className="ad-outils">
        <form method="GET" role="search" className="ad-recherche">
          {type !== "tous" ? <input type="hidden" name="type" value={type} /> : null}
          <label htmlFor="q" className="sr-only">
            Rechercher un compte par e-mail
          </label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Rechercher par e-mail" />
          <button type="submit" className="btn btn-secondary btn-compact">
            Rechercher
          </button>
        </form>
        <div className="ad-filtres" role="group" aria-label="Filtrer par type de compte">
          {ORDRE_FILTRES.map((valeur) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (valeur !== "tous") params.set("type", valeur);
            const chaine = params.toString();
            const actif = !filtreTest && type === valeur;
            return (
              <Link
                key={valeur}
                href={chaine ? `/system/acces/comptes?${chaine}` : "/system/acces/comptes"}
                className={`chip ${actif ? "actif" : ""}`}
                aria-current={actif ? "true" : undefined}
              >
                {LIBELLES_FILTRE[valeur]}
              </Link>
            );
          })}
          <Link
            href={`/system/acces/comptes?${new URLSearchParams({ ...(q ? { q } : {}), type: FILTRE_TEST }).toString()}`}
            className={`chip ${filtreTest ? "actif" : ""}`}
            aria-current={filtreTest ? "true" : undefined}
          >
            Comptes de test
          </Link>
        </div>
      </div>

      {tronque ? (
        <Alert ton="info" style={{ marginBottom: "var(--space-4)" }}>
          <strong>Liste incomplète.</strong> L&apos;annuaire a atteint sa borne de lecture : affinez la recherche par e-mail pour
          trouver un compte absent de cette page.
        </Alert>
      ) : null}

      {comptes.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="acces" titre="Aucun compte" texte="Aucun compte ne correspond à cette recherche." />
        </div>
      ) : (
        <>
          <p className="ad-resume" role="status">
            {comptes.length} compte{comptes.length > 1 ? "s" : ""}
          </p>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Comptes utilisateurs</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {nombreSupprimables > 0 ? <CaseToutSelectionner /> : null}
                      Compte
                    </span>
                  </th>
                  <th scope="col">Accès</th>
                  <th scope="col">Créé le</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((compte) => (
                  <tr key={compte.utilisateurId}>
                    <td className="ad-cellule-principale" data-label="Compte" style={{ overflowWrap: "anywhere" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {estSupprimable(compte) ? <CaseCompte utilisateurId={compte.utilisateurId} email={compte.email} /> : null}
                        <span style={{ fontWeight: 800 }}>{compte.email}</span>
                      </span>
                    </td>
                    <td data-label="Accès">
                      <div style={{ display: "grid", gap: 4, justifyItems: "start", textAlign: "left" }}>
                        {compte.roleSysteme ? (
                          <Pastille ton="succes">{LIBELLES_ROLES[compte.roleSysteme as RoleSysteme] ?? compte.roleSysteme}</Pastille>
                        ) : null}
                        {compte.restaurants.map((affiliation) => (
                          <span key={affiliation.restaurantId} style={{ fontSize: "0.88rem" }}>
                            {affiliation.role === "owner" ? "Propriétaire" : "Équipier"} de{" "}
                            <Link href={`/system/catalogue/restaurants/${affiliation.restaurantId}`} className="lien-texte">
                              {affiliation.nom}
                            </Link>
                          </span>
                        ))}
                        {compte.roleSysteme === null && compte.restaurants.length === 0 ? <Pastille ton="neutre">Sans affiliation</Pastille> : null}
                      </div>
                    </td>
                    <td className="ad-secondaire" data-label="Créé le" style={{ whiteSpace: "nowrap" }}>
                      {formaterDateCourte(compte.creeLe)}
                    </td>
                    <td data-label="Actions">
                      {estSupprimable(compte) ? (
                        <SuppressionCompte
                          utilisateurId={compte.utilisateurId}
                          email={compte.email}
                          nombreRestaurants={compte.restaurants.length}
                        />
                      ) : compte.utilisateurId === contexte.utilisateurId ? (
                        <Pastille ton="neutre">Vous</Pastille>
                      ) : compte.roleSysteme === "super_admin" ? (
                        <span className="ad-secondaire" style={{ fontSize: "0.82rem" }}>
                          Retirez d&apos;abord son rôle
                        </span>
                      ) : (
                        <span className="ad-secondaire">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nombreSupprimables > 0 ? <BarreSelectionGroupee /> : null}
        </>
      )}
    </div>
  );
}
