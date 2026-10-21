import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerDemandesReferencement } from "@/lib/system-admin/referencements-lecture";
import { changerStatutReferencementAction, supprimerReferencementAction } from "@/lib/system-admin/referencements";
import { LIBELLES_STATUTS_REFERENCEMENT, LIBELLES_TYPES, STATUTS_REFERENCEMENT } from "@/lib/site/referencement";
import { grouperParCommune, lireQuartiersActifs } from "@/lib/geographie/quartiers";
import { creerClientAdmin } from "@/lib/db/admin";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { CreationEtablissement } from "./CreationEtablissement";

export const metadata = { title: "Référencements (administration)" };
export const dynamic = "force-dynamic";

function jour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Demandes de référencement reçues par `/inscription` (ADR-020). L'équipe rappelle, visite, fait signer l'accord, puis crée l'établissement : il naît en
 * mode « speedfood », non publié ; l'équipe saisit ensuite son catalogue et décide de la publication (fiche du restaurant). Les coordonnées de la
 * personne ne servent qu'à la rappeler.
 */
export default async function ReferencementsPage() {
  const contexte = await exigerPermissionPage("restaurant.moderer");
  const admin = creerClientAdmin();
  const [demandes, quartiers, { data: categories }] = await Promise.all([
    listerDemandesReferencement(),
    lireQuartiersActifs(admin),
    admin.from("menu_categories").select("id, nom").order("ordre").limit(200),
  ]);
  const groupes = grouperParCommune(quartiers);
  const listeCategories = categories ?? [];
  const nouvelles = demandes.filter((d) => d.statut === "nouvelle").length;
  const enCours = demandes.filter((d) => d.statut === "rappelee" || d.statut === "visite_prevue" || d.statut === "accord").length;

  return (
    <div>
      <PageHeader titre="Catalogue" description="Demandes de référencement : on rappelle, on visite, on signe, puis on crée la fiche. Les coordonnées sont des données personnelles." />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />
      <div className="ad-pile">
        <section className="ad-cartes" aria-label="Chiffres clés des référencements">
          <CarteChiffre libelle="Nouvelles demandes" valeur={nouvelles} sous="À rappeler sous 48 heures" />
          <CarteChiffre libelle="En cours" valeur={enCours} sous="Rappelées, visite prévue ou accord signé" />
          <CarteChiffre libelle="Demandes affichées" valeur={demandes.length} sous="Les 200 plus récentes" />
        </section>

        <Panneau titre="Demandes de référencement">
          {demandes.length === 0 ? (
            <EtatVide titre="Aucune demande pour l'instant" texte="Quand un établissement remplit la page « Demander à être référencé », sa demande apparaît ici." />
          ) : (
            <div className="ad-table-cadre">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Établissement</th>
                    <th scope="col">Où</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Suite</th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d) => {
                    const proposee = listeCategories.find((c) => d.categories && normaliser(d.categories).includes(normaliser(c.nom)))?.id ?? null;
                    const chiffres = d.telephone.replace(/\D/g, "");
                    return (
                      <tr key={d.id}>
                        <td className="ad-cellule-principale" data-label="Établissement">
                          {d.organisation} <Pastille ton="neutre">{LIBELLES_TYPES[d.type]}</Pastille>
                          <span className="ad-aide-champ"> · {jour(d.creeLe)}</span>
                          {d.categories || d.specialites ? (
                            <span className="ad-aide-champ referencement-admin-ligne">{[d.categories, d.specialites].filter(Boolean).join(" · ")}</span>
                          ) : null}
                        </td>
                        <td data-label="Où">
                          {d.quartier}, {d.commune}
                          {d.indications ? <span className="ad-aide-champ referencement-admin-ligne">{d.indications}</span> : null}
                          {d.latitude !== null && d.longitude !== null ? (
                            <a
                              className="lien-texte referencement-admin-ligne"
                              href={`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=17/${d.latitude}/${d.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Voir sur la carte
                            </a>
                          ) : null}
                        </td>
                        <td data-label="Responsable">
                          {d.responsable}
                          <span className="referencement-admin-ligne">{d.telephone}</span>
                          <span className="referencement-admin-ligne">{d.email}</span>
                          <span className="referencement-admin-ligne">
                            <a className="lien-texte" href={`https://wa.me/${chiffres}`} target="_blank" rel="noopener noreferrer">
                              WhatsApp
                            </a>
                            {" · "}
                            <a className="lien-texte" href={`mailto:${d.email}`}>
                              E-mail
                            </a>
                          </span>
                        </td>
                        <td data-label="Statut">
                          {d.statut === "creee" ? (
                            <Pastille ton="succes">{LIBELLES_STATUTS_REFERENCEMENT.creee}</Pastille>
                          ) : (
                            <form action={changerStatutReferencementAction} className="partenariat-admin-statut">
                              <input type="hidden" name="id" value={d.id} />
                              <select name="statut" defaultValue={d.statut} aria-label={`Statut de la demande de ${d.organisation}`}>
                                {STATUTS_REFERENCEMENT.filter((s) => s !== "creee").map((s) => (
                                  <option key={s} value={s}>
                                    {LIBELLES_STATUTS_REFERENCEMENT[s]}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="btn btn-secondary btn-compact">
                                Enregistrer
                              </button>
                            </form>
                          )}
                        </td>
                        <td data-label="Suite">
                          {d.restaurantId ? (
                            <Link href={`/system/catalogue/restaurants/${d.restaurantId}`} className="lien-texte">
                              Ouvrir l&apos;établissement
                            </Link>
                          ) : d.statut === "refusee" ? (
                            <span className="ad-aide-champ">Refusée</span>
                          ) : (
                            <details className="referencement-admin-creation-bloc">
                              <summary>Créer l&apos;établissement</summary>
                              <CreationEtablissement demandeId={d.id} categories={listeCategories} groupes={groupes} categorieProposee={proposee} />
                            </details>
                          )}
                          {d.restaurantId ? null : (
                            <form action={supprimerReferencementAction} className="referencement-admin-ligne">
                              <input type="hidden" name="id" value={d.id} />
                              <button type="submit" className="btn btn-danger btn-compact">
                                Supprimer
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panneau>
      </div>
    </div>
  );
}
