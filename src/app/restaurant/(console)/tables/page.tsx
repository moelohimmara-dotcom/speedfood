import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { OngletsSalle } from "@/components/restaurant/OngletsSalle";
import { clientLivraison } from "@/lib/livraison/lecture";
import { estReglageValidation, estServiceTable } from "@/lib/table/regles";
import { ChoixNombreTables } from "./ChoixNombreTables";
import { BoutonImprimerTables } from "./BoutonImprimerTables";
import { ServiceSurPlace } from "./ServiceSurPlace";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Service sur place et QR" };

const MAX_TABLES = 60;

/**
 * Service sur place en trois étapes : activer, choisir la façon de servir (avec des profils prêts à l'emploi), puis imprimer les QR.
 * Le client scanne le QR, arrive sur le menu avec son numéro de table (ou « Comptoir ») et commande. Le numéro de table n'est jamais une
 * autorisation : le serveur revérifie à chaque commande que le service est activé.
 */
export default async function TablesPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/tables");
  const id = membership.restaurant_id;
  const { data: restaurant } = await supabase.from("restaurants").select("nom, publie, accepte_sur_place").eq("id", id).maybeSingle();
  if (!restaurant) return null;
  if (!restaurant.publie) {
    return (
      <div>
        <PageHeader titre="Service sur place et QR" />
        <OngletsSalle />
        <EtatVide icone="boutique" titre="Disponible après publication" texte="Le service sur place et les QR s'activent dès que l'équipe Speedfood a validé votre page." />
      </div>
    );
  }

  // Réglages du service sur place (lecture tolérante : sans migration, valeurs par défaut) et tables actuellement ouvertes.
  const [{ data: reglagesBruts }, { count: ouvertes }] = await Promise.all([
    clientLivraison().from("restaurants").select("service_table, table_sans_compte, table_validation").eq("id", id).maybeSingle(),
    clientLivraison().from("table_sessions").select("id", { count: "exact", head: true }).eq("restaurant_id", id).eq("statut", "ouverte"),
  ]);
  const rb = reglagesBruts as { service_table?: string; table_sans_compte?: boolean; table_validation?: string } | null;
  const service = estServiceTable(rb?.service_table) ? rb.service_table : "table";
  const sansCompte = rb?.table_sans_compte ?? false;
  const validation = estReglageValidation(rb?.table_validation) ? rb.table_validation : "premiere";

  const { n } = await searchParams;
  const brut = /^\d{1,3}$/.test(n ?? "") ? Number(n) : 0;
  const nombre = Math.min(Math.max(brut, 0), MAX_TABLES);
  const planche = service === "comptoir" || nombre > 0;

  return (
    <div className="tables-page">
      <PageHeader
        titre="Service sur place et QR"
        description="Réglez comment vos clients commandent sur place, puis imprimez les QR à poser sur vos tables."
        actions={planche ? <BoutonImprimerTables /> : undefined}
      />
      <OngletsSalle />

      <ServiceSurPlace reglages={{ actif: restaurant.accepte_sur_place, service, sansCompte, validation }} tablesOuvertes={ouvertes ?? 0} />

      <section className="ssp-etape" aria-labelledby="ssp-qr">
        <h2 id="ssp-qr" className="ssp-titre">
          3. Imprimer vos QR
        </h2>
        {!restaurant.accepte_sur_place ? (
          <p className="alerte alerte-info" role="status">
            Le service sur place est désactivé : activez-le (étape 1) avant d&apos;afficher ces QR, sinon vos clients ne pourront pas commander.
          </p>
        ) : null}

        {service === "comptoir" ? (
          <div className="tables-planche">
            <div className="table-carte">
              <p className="table-marque">Speedfood · {restaurant.nom}</p>
              <p className="table-numero">Comptoir</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par notre propre route. */}
              <img src={`/restaurants/${id}/qr?t=Comptoir`} alt="QR code du comptoir" width={200} height={200} className="table-qr" loading="lazy" />
              <p className="table-texte">Scannez pour commander : on vous appellera avec votre numéro</p>
            </div>
          </div>
        ) : (
          <>
            <ChoixNombreTables valeur={nombre} max={MAX_TABLES} />
            {nombre === 0 ? <p className="ssp-aide">Voici un exemple. Indiquez le nombre de tables pour préparer toute la planche.</p> : null}
            <div className="tables-planche">
              {Array.from({ length: nombre > 0 ? nombre : 1 }, (_, i) => i + 1).map((t) => (
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
        )}
      </section>
    </div>
  );
}
