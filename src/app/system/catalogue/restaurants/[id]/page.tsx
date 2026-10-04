import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { obtenirRestaurantAdmin } from "@/lib/system-admin/restaurants";
import { listerMembresAdmin } from "@/lib/system-admin/comptes";
import { PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { ActionsModeration } from "./ActionsModeration";
import { GestionEquipe } from "./GestionEquipe";

export const metadata = { title: "Fiche restaurant (administration)" };

export default async function RestaurantDetailSystemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerPermissionPage("restaurant.moderer");
  const { id } = await params;

  const restaurant = await obtenirRestaurantAdmin(id);
  if (!restaurant) {
    notFound();
  }
  const membres = await listerMembresAdmin(id);

  return (
    <div>
      <PageHeader
        titre={restaurant.nom}
        retour={{ href: "/system/catalogue/restaurants", libelle: "Tous les restaurants" }}
        description={`${restaurant.categorie || "Catégorie non renseignée"} · ${restaurant.quartier || "quartier non renseigné"} · créé le ${new Date(restaurant.cree_le).toLocaleDateString("fr-FR")}`}
        actions={
          <>
            {restaurant.suspendu_le ? (
              <Pastille ton="danger">Suspendu</Pastille>
            ) : restaurant.motif_correction ? (
              <Pastille ton="attention">Correction demandée</Pastille>
            ) : (
              <Pastille ton={restaurant.publie ? "succes" : "neutre"}>{restaurant.publie ? "Publié" : "En attente"}</Pastille>
            )}
            <Pastille ton={restaurant.ouvert ? "succes" : "neutre"}>{restaurant.ouvert ? "Ouvert" : "Fermé"}</Pastille>
          </>
        }
      />

      {restaurant.suspendu_motif ? (
        <div className="ad-bandeau ad-bandeau-danger" role="note">
          <p style={{ margin: 0 }}>
            <strong>Motif de suspension :</strong> {restaurant.suspendu_motif}
          </p>
        </div>
      ) : null}
      {restaurant.motif_correction && !restaurant.suspendu_le ? (
        <div className="ad-bandeau ad-bandeau-attention" role="note">
          <p style={{ margin: 0 }}>
            <strong>Correction demandée :</strong> {restaurant.motif_correction}
          </p>
        </div>
      ) : null}

      <div className="ad-grille-deux" style={{ marginTop: 0 }}>
        <Panneau titre="Modération">
          <ActionsModeration
            restaurantId={restaurant.id}
            publie={restaurant.publie}
            suspendu={restaurant.suspendu_le !== null}
            aUneCorrectionEnCours={restaurant.motif_correction !== null}
          />
        </Panneau>
        <Panneau titre="Équipe">
          <GestionEquipe restaurantId={restaurant.id} membres={membres} />
        </Panneau>
      </div>
    </div>
  );
}
