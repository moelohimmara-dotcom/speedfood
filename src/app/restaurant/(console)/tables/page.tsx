import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import { BasculeServiceTable } from "./BasculeServiceTable";
import { BoutonImprimerTables } from "./BoutonImprimerTables";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "QR de tables" };

const MAX_TABLES = 60;

/**
 * « QR de tables » : un QR par table. Le client le scanne, arrive sur le menu avec son numéro de table et commande à table ; le restaurateur voit
 * « Table 7 » sur la commande. Le service à table doit être activé ; le numéro de table n'est jamais une autorisation.
 */
export default async function TablesPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/tables");
  const id = membership.restaurant_id;
  const { data: restaurant } = await supabase.from("restaurants").select("nom, publie, accepte_sur_place").eq("id", id).maybeSingle();
  if (!restaurant) return null;
  if (!restaurant.publie) {
    return (
      <div>
        <PageHeader titre="QR de tables" />
        <EtatVide icone="boutique" titre="Disponible après publication" texte="Les QR de tables s'activent dès que l'équipe Speedfood a validé votre page." />
      </div>
    );
  }
  const { n } = await searchParams;
  const brut = /^\d{1,3}$/.test(n ?? "") ? Number(n) : 0;
  const nombre = Math.min(Math.max(brut, 0), MAX_TABLES);

  return (
    <div className="tables-page">
      <PageHeader
        titre="QR de tables"
        description="Un QR par table : le client scanne, voit votre menu et commande à sa table."
        actions={nombre > 0 ? <BoutonImprimerTables /> : undefined}
      />
      <div className="tables-haut">
        <Panneau titre="Service à table">
          <BasculeServiceTable actif={restaurant.accepte_sur_place} />
        </Panneau>
        <Panneau titre="Combien de tables ?">
          <form method="get" className="tables-formulaire">
            <div className="field">
              <label htmlFor="n">Nombre de tables (1 à {MAX_TABLES})</label>
              <input id="n" name="n" type="number" min={1} max={MAX_TABLES} defaultValue={nombre || ""} inputMode="numeric" />
            </div>
            <button type="submit" className="btn btn-secondary">
              Préparer les QR
            </button>
          </form>
        </Panneau>
      </div>

      {nombre > 0 ? (
        <>
          {!restaurant.accepte_sur_place ? (
            <p className="alerte alerte-info" role="status">
              Le service à table est désactivé : activez-le avant d&apos;afficher ces QR, sinon vos clients ne pourront pas commander à table.
            </p>
          ) : null}
          <div className="tables-planche">
            {Array.from({ length: nombre }, (_, i) => i + 1).map((t) => (
              <div key={t} className="table-carte">
                <p className="table-marque">Speedfood · {restaurant.nom}</p>
                <p className="table-numero">Table {t}</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par notre propre route. */}
                <img src={`/restaurants/${id}/qr?t=${t}`} alt={`QR code de la table ${t}`} width={200} height={200} className="table-qr" loading="lazy" />
                <p className="table-texte">Scannez pour voir le menu et commander</p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
