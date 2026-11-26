import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { lireCatalogueEquipe } from "@/lib/system-admin/catalogue-restaurant-lecture";
import { archiverPlatEquipeAction, basculerDisponibiliteEquipeAction, confirmerDisponibiliteEquipeAction, confirmerToutesDisponibilitesEquipeAction, definirModeVenteAction } from "@/lib/system-admin/catalogue-restaurant";
import { EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { FormulairePlat } from "./FormulairePlat";
import { GestionSections } from "./GestionSections";
import { OptionsPlatEquipe } from "./OptionsPlatEquipe";
import { PhotoBibliothequeEquipe } from "./PhotoBibliothequeEquipe";
import { AjoutEnLotEquipe } from "./AjoutEnLotEquipe";

export const metadata = { title: "Catalogue d'un établissement (administration)" };
export const dynamic = "force-dynamic";

function formaterGnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

/**
 * Catalogue d'un établissement tenu par l'équipe Speedfood (ADR-020) : plats, prix du restaurant (parité avec le prix sur place), photos, disponibilité
 * horodatée. Réservé aux établissements en mode « speedfood » ; un établissement « autonome » tient lui-même son menu.
 */
export default async function CatalogueEquipePage({ params }: { params: Promise<{ id: string }> }) {
  await exigerPermissionPage("restaurant.moderer");
  const { id } = await params;
  const { restaurant, plats, sections } = await lireCatalogueEquipe(id);
  if (!restaurant) notFound();
  const maintenant = new Date();

  return (
    <div>
      <PageHeader titre={`Catalogue : ${restaurant.nom}`} description="Plats et prix de l'établissement, tenus par l'équipe. Le prix saisi est le prix pratiqué par le restaurant sur place." />
      <p>
        <Link href={`/system/catalogue/restaurants/${restaurant.id}`} className="lien-texte">
          ← Retour à la fiche de l&apos;établissement
        </Link>
      </p>

      {restaurant.modeVente !== "speedfood" ? (
        <Panneau titre="Cet établissement tient lui-même son catalogue">
          <p>
            Son mode de vente est « autonome » : son restaurateur gère ses plats et ses prix depuis sa console. Pour que l&apos;équipe tienne le catalogue à sa place, passez-le en
            mode « Speedfood ».
          </p>
          <form action={definirModeVenteAction}>
            <input type="hidden" name="restaurant_id" value={restaurant.id} />
            <input type="hidden" name="mode" value="speedfood" />
            <button type="submit" className="btn btn-primary">Passer en mode « Speedfood »</button>
          </form>
        </Panneau>
      ) : (
        <div className="ad-pile">
          <Panneau titre="Sections du menu">
            <GestionSections restaurantId={restaurant.id} sections={sections} />
          </Panneau>

          <Panneau titre="Ajouter un plat">
            <FormulairePlat restaurantId={restaurant.id} sections={sections} />
          </Panneau>

          <Panneau titre="Ajouter des plats en lot">
            <AjoutEnLotEquipe restaurantId={restaurant.id} sections={sections} />
          </Panneau>

          <Panneau titre={`Plats (${plats.length})`} actions={plats.some((p) => p.disponible) ? (
            <form action={confirmerToutesDisponibilitesEquipeAction}>
              <input type="hidden" name="restaurant_id" value={restaurant.id} />
              <button type="submit" className="btn btn-secondary btn-compact">Tout reconfirmer</button>
            </form>
          ) : undefined}>
            {plats.length === 0 ? (
              <EtatVide titre="Aucun plat pour l'instant" texte="Ajoutez les plats du restaurant : le client ne peut rien commander tant que le catalogue est vide." />
            ) : (
              <ul className="catalogue-equipe-liste">
                {plats.map((p) => {
                  const age = p.confirmeLe ? maintenant.getTime() - new Date(p.confirmeLe).getTime() : null;
                  return (
                    <li key={p.id} className="catalogue-equipe-plat">
                      <div className="catalogue-equipe-entete">
                        {p.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- aperçu d'un média déjà hébergé, dimensions libres.
                          <img src={p.photoUrl} alt="" width={56} height={56} className="catalogue-equipe-photo" />
                        ) : (
                          <span className="catalogue-equipe-photo catalogue-equipe-photo-vide" aria-hidden="true" />
                        )}
                        <div className="catalogue-equipe-titre">
                          <strong>{p.nom}</strong>
                          <span>
                            {formaterGnf(p.prix)}
                            {p.prixPromo !== null ? ` · promo ${formaterGnf(p.prixPromo)}` : ""}
                          </span>
                          <span className="ad-aide-champ">{p.allergenes === null ? "Allergènes non renseignés" : p.allergenes.length === 0 ? "Aucun allergène déclaré" : `Allergènes déclarés : ${p.allergenes.length}`}{p.allergenesDeclaresLe ? ` (le ${new Date(p.allergenesDeclaresLe).toLocaleDateString("fr-FR")})` : ""}</span>
                          <span className="ad-aide-champ">{sections.find((s) => s.id === p.sectionId)?.nom ?? "Sans section"}</span>
                          <span className="ad-aide-champ">{p.photoSource === null ? "Aucune photo" : p.photoSource === "restaurant" ? "Photo du restaurant" : p.photoSource === "ia" ? "Image illustrative (générée, signalée aux clients)" : `Photo libre de la bibliothèque${p.photoLicence ? ` · ${p.photoLicence}` : ""}${p.photoAuteur ? ` · ${p.photoAuteur}` : ""}`}{p.photoPage ? <>{" · "}<a href={p.photoPage} target="_blank" rel="noopener noreferrer" className="lien-texte">source</a></> : null}</span>
                        </div>
                        <div className="catalogue-equipe-etat">
                          <Pastille ton={p.disponible ? "succes" : "neutre"}>{p.disponible ? "Disponible" : "Épuisé"}</Pastille>
                          {p.disponible ? (
                            <span className="ad-aide-champ">{age === null ? "jamais confirmé" : `confirmé ${ancienneteLisible(new Date(p.confirmeLe as string), maintenant)}`}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="catalogue-equipe-actions">
                        <form action={basculerDisponibiliteEquipeAction}>
                          <input type="hidden" name="restaurant_id" value={restaurant.id} />
                          <input type="hidden" name="plat_id" value={p.id} />
                          <input type="hidden" name="disponible" value={p.disponible ? "non" : "oui"} />
                          <button type="submit" className="btn btn-secondary btn-compact">{p.disponible ? "Marquer épuisé" : "Rendre disponible"}</button>
                        </form>
                        {p.disponible ? (
                          <form action={confirmerDisponibiliteEquipeAction}>
                            <input type="hidden" name="restaurant_id" value={restaurant.id} />
                            <input type="hidden" name="plat_id" value={p.id} />
                            <button type="submit" className="btn btn-secondary btn-compact">Reconfirmer maintenant</button>
                          </form>
                        ) : null}
                        <form action={archiverPlatEquipeAction}>
                          <input type="hidden" name="restaurant_id" value={restaurant.id} />
                          <input type="hidden" name="plat_id" value={p.id} />
                          <button type="submit" className="btn btn-danger btn-compact">Archiver</button>
                        </form>
                      </div>
                      <details className="catalogue-equipe-edition">
                        <summary>Modifier</summary>
                        <FormulairePlat restaurantId={restaurant.id} sections={sections} plat={{ id: p.id, nom: p.nom, description: p.description, prix: p.prix, prixPromo: p.prixPromo, aPhoto: p.photoUrl !== null, allergenes: p.allergenes, sectionId: p.sectionId }} />
                        <OptionsPlatEquipe restaurantId={restaurant.id} platId={p.id} options={p.options} />
                        <PhotoBibliothequeEquipe restaurantId={restaurant.id} platId={p.id} candidats={p.photoCandidats} />
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panneau>
        </div>
      )}
    </div>
  );
}
