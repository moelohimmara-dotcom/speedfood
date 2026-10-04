import Link from "next/link";
import { exigerPermissionPage, obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { rechercherCommandesAdmin } from "@/lib/system-admin/commandes";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/contracts/statuts";
import { EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { formaterDateCourte } from "../formatage";

export const metadata = { title: "Support commandes (administration)" };

const LIBELLES_STATUT: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  prete: "Prête",
  terminee: "Terminée",
  annulee: "Annulée",
};

const TON_STATUT: Record<StatutCommande, "neutre" | "danger" | "succes" | "attention"> = {
  en_attente: "attention",
  acceptee: "neutre",
  prete: "succes",
  terminee: "succes",
  refusee: "danger",
  annulee: "danger",
};

interface Recherche {
  reference?: string;
  statut?: string;
  jour?: string;
  restaurant?: string;
}

export default async function SupportCommandesSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("commande.consulter");
  const { reference, statut: statutBrut, jour: jourBrut, restaurant: restaurantBrut } = await searchParams;
  const { role } = await obtenirContexteSysteme();
  const peutOuvrirFiche = roleAPermission(role, "restaurant.moderer");
  const restaurantId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantBrut ?? "") ? restaurantBrut : undefined;
  const statut: StatutCommande | "tous" = (STATUTS_COMMANDE as readonly string[]).includes(statutBrut ?? "")
    ? (statutBrut as StatutCommande)
    : "tous";
  const jour = jourBrut === "1";

  const commandes = await rechercherCommandesAdmin({ reference, statut, jour, restaurantId });

  const parametresSansJour = new URLSearchParams();
  if (reference) parametresSansJour.set("reference", reference);
  if (statut !== "tous") parametresSansJour.set("statut", statut);
  if (restaurantId) parametresSansJour.set("restaurant", restaurantId);
  const lienSansJour = parametresSansJour.toString();

  return (
    <div>
      <PageHeader
        titre="Support commandes"
        description="Coordonnées masquées par défaut. La révélation exige un motif et laisse une trace d'audit."
      />

      <div className="ad-outils">
        <form method="GET" role="search" className="ad-recherche">
          {statut !== "tous" ? <input type="hidden" name="statut" value={statut} /> : null}
          {jour ? <input type="hidden" name="jour" value="1" /> : null}
          {restaurantId ? <input type="hidden" name="restaurant" value={restaurantId} /> : null}
          <label htmlFor="reference" className="sr-only">
            Référence de la commande
          </label>
          <input id="reference" name="reference" type="search" defaultValue={reference ?? ""} placeholder="Référence, ex. SF-4KVB9" />
          <button type="submit" className="btn btn-secondary btn-compact">
            Rechercher
          </button>
        </form>

        {jour ? (
          <div className="alerte alerte-info" role="note" style={{ fontSize: "0.85rem" }}>
            Filtre « du jour » : seules les commandes créées depuis minuit (UTC) sont affichées.{" "}
            <Link href={lienSansJour ? `/system/commandes?${lienSansJour}` : "/system/commandes"} style={{ fontWeight: 700 }}>
              Voir toutes les périodes
            </Link>
          </div>
        ) : null}

        {restaurantId ? (
          <div className="alerte alerte-info" role="note" style={{ fontSize: "0.85rem" }}>
            Filtre : commandes d&apos;un seul restaurant{commandes[0]?.restaurantNom ? ` (${commandes[0].restaurantNom})` : ""}.{" "}
            <Link href="/system/commandes" style={{ fontWeight: 700 }}>
              Voir tous les restaurants
            </Link>
          </div>
        ) : null}

        <div className="ad-filtres" role="group" aria-label="Filtrer par statut">
          {(["tous", ...STATUTS_COMMANDE] as const).map((valeur) => {
            const params = new URLSearchParams();
            if (reference) params.set("reference", reference);
            if (jour) params.set("jour", "1");
            if (restaurantId) params.set("restaurant", restaurantId);
            if (valeur !== "tous") params.set("statut", valeur);
            const chaine = params.toString();
            return (
              <Link
                key={valeur}
                href={chaine ? `/system/commandes?${chaine}` : "/system/commandes"}
                className={`chip ${statut === valeur ? "actif" : ""}`}
                aria-current={statut === valeur ? "true" : undefined}
              >
                {valeur === "tous" ? "Tous" : LIBELLES_STATUT[valeur]}
              </Link>
            );
          })}
        </div>
      </div>

      {commandes.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="commandes" titre="Aucune commande" texte="Aucune commande ne correspond à cette recherche." />
        </div>
      ) : (
        <>
          <p className="ad-resume" role="status">
            {commandes.length} commande{commandes.length > 1 ? "s" : ""}
          </p>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Commandes</caption>
              <thead>
                <tr>
                  <th scope="col">Référence</th>
                  <th scope="col">Restaurant</th>
                  <th scope="col">Client</th>
                  <th scope="col">Créée le</th>
                  <th scope="col" className="ad-droite">
                    Montant
                  </th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => (
                  <tr key={c.id}>
                    <td className="ad-cellule-principale" data-label="Référence">
                      <Link href={`/system/commandes/${c.id}`}>{c.reference}</Link>
                    </td>
                    <td data-label="Restaurant">
                      {peutOuvrirFiche && c.restaurantId ? (
                        <Link href={`/system/catalogue/restaurants/${c.restaurantId}`}>{c.restaurantNom}</Link>
                      ) : (
                        c.restaurantNom
                      )}
                    </td>
                    <td className="ad-secondaire" data-label="Client">
                      {c.clientNom} · {c.telephoneAffiche}
                    </td>
                    <td className="ad-secondaire" data-label="Créée le">
                      {formaterDateCourte(c.creeLe)}
                    </td>
                    <td className="ad-nombre ad-droite" data-label="Montant">
                      {c.sousTotal.toLocaleString("fr-FR")} GNF
                    </td>
                    <td data-label="Statut">
                      <Pastille ton={TON_STATUT[c.statut]}>{LIBELLES_STATUT[c.statut]}</Pastille>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
