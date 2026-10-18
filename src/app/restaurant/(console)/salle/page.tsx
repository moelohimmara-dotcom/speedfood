import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { tablesOuvertes } from "@/lib/table/service";
import { OngletsSalle } from "@/components/restaurant/OngletsSalle";
import { SalleTables } from "./SalleTables";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Salle" };
export const dynamic = "force-dynamic";

/** Salle : les tables ouvertes, ce que chacune a commandé, l'addition, et ce qui attend le personnel (validation, appel, addition demandée). */
export default async function SallePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/salle");
  const { data: resto } = await supabase.from("restaurants").select("accepte_sur_place").eq("id", membership.restaurant_id).maybeSingle();
  const tables = await tablesOuvertes(membership.restaurant_id).catch(() => []);

  return (
    <div>
      <PageHeader titre="Salle" description="Les tables ouvertes en ce moment. La page se met à jour toute seule ; un signal sonore prévient quand une table appelle ou demande l'addition." />
      <OngletsSalle />
      {!resto?.accepte_sur_place ? (
        <EtatVide
          icone="carte"
          titre="Le service sur place est désactivé"
          texte="Activez-le dans l'onglet « Service et QR » pour que vos clients commandent depuis leur table ou au comptoir."
        />
      ) : tables.length === 0 ? (
        <EtatVide icone="commandes" titre="Aucune table ouverte" texte="Une table apparaît ici dès qu'un convive y envoie une commande." />
      ) : (
        <SalleTables tables={tables} />
      )}
    </div>
  );
}
