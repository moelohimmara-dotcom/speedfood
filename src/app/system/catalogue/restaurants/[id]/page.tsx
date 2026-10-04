import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerPermissionPage, obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { obtenirRestaurantAdmin } from "@/lib/system-admin/restaurants";
import { listerMembresAdmin } from "@/lib/system-admin/comptes";
import { PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { roleAPermission } from "@/lib/system-admin/permissions";
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
  const { role } = await obtenirContexteSysteme();
  const reglages = await lireReglagesAssistance();
  const enLigne = restaurant.publie && restaurant.suspendu_le === null;
  const peutOuvrirParametres = roleAPermission(role, "parametres.editer");
  const peutOuvrirComptes = roleAPermission(role, "compte.consulter");

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
        <Panneau titre="Où en est ce restaurant ?">
          <p style={{ margin: "0 0 var(--space-3)" }}>
            {restaurant.suspendu_le
              ? "Suspendu : invisible des clients tant qu'il n'est pas réactivé."
              : enLigne
                ? "En ligne : visible des clients."
                : restaurant.motif_correction
                  ? "En attente d'une correction du restaurateur."
                  : "En attente de votre validation : invisible des clients."}
          </p>
          <ul className="ad-liens-contexte">
            {enLigne ? (
              <li>
                <Link href={`/restaurants/${restaurant.id}`} className="lien-texte" target="_blank" rel="noopener">
                  Voir la page vue par les clients
                </Link>
              </li>
            ) : null}
            {!enLigne && reglages.delaiValidationHeures !== null ? (
              <li>
                Délai de validation annoncé aux restaurateurs : {reglages.delaiValidationHeures} h
                {peutOuvrirParametres ? (
                  <>
                    {" · "}
                    <Link href="/system/parametres" className="lien-texte">
                      Modifier dans Paramètres
                    </Link>
                  </>
                ) : null}
              </li>
            ) : null}
            {roleAPermission(role, "commande.consulter") ? (
            <li>
              <Link href={`/system/commandes?restaurant=${restaurant.id}`} className="lien-texte">
                Voir les commandes de ce restaurant
              </Link>
            </li>
            ) : null}
            {restaurant.suspendu_le || restaurant.motif_correction ? (
              <li>
                <Link href="/system/audit?action=restaurant.suspension" className="lien-texte">
                  Voir l&apos;historique des décisions
                </Link>
              </li>
            ) : null}
          </ul>
        </Panneau>
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
          {peutOuvrirComptes ? (
            <p className="ad-aide-champ">
              Pour suivre ou supprimer un compte, voir{" "}
              <Link href="/system/acces/comptes" className="lien-texte">
                Accès, comptes
              </Link>
              .
            </p>
          ) : null}
        </Panneau>
      </div>
    </div>
  );
}
