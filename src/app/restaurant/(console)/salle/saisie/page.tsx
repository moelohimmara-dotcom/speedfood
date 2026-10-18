import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { OngletsSalle } from "@/components/restaurant/OngletsSalle";
import { clientLivraison } from "@/lib/livraison/lecture";
import { estServiceTable } from "@/lib/table/regles";
import { tablesOuvertes } from "@/lib/table/service";
import { SaisieServeur, type PlatSaisie } from "./SaisieServeur";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Prendre une commande" };
export const dynamic = "force-dynamic";

/** Mode serveur : le serveur prend la commande d'une table sur son téléphone. Elle part directement en cuisine, à son nom. */
export default async function SaisieSallePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/salle");
  const id = membership.restaurant_id;
  const [{ data: resto }, { data: plats }, tables, { data: reglages }] = await Promise.all([
    supabase.from("restaurants").select("accepte_sur_place").eq("id", id).maybeSingle(),
    supabase
      .from("menu_items")
      .select("id, nom, prix, prix_promo, menu_item_options(id, nom, prix, disponible)")
      .eq("restaurant_id", id)
      .eq("disponible", true)
      .is("archive_le", null)
      .order("nom"),
    tablesOuvertes(id).catch(() => []),
    clientLivraison().from("restaurants").select("service_table").eq("id", id).maybeSingle(),
  ]);

  const comptoir = estServiceTable((reglages as { service_table?: string } | null)?.service_table) && (reglages as { service_table: string }).service_table === "comptoir";
  const liste: PlatSaisie[] = (plats ?? []).map((p) => ({
    id: p.id,
    nom: p.nom,
    prix: p.prix_promo ?? p.prix,
    options: (p.menu_item_options ?? []).filter((o) => o.disponible).map((o) => ({ id: o.id, nom: o.nom, prix: o.prix })),
  }));

  return (
    <div>
      <PageHeader titre="Prendre une commande" description="Pour un convive qui préfère commander au serveur. La commande part en cuisine à votre nom et s'ajoute à l'addition de la table." />
      <OngletsSalle />
      {!resto?.accepte_sur_place ? (
        <EtatVide icone="carte" titre="Le service à table est désactivé" texte="Activez-le dans l'onglet « Service et QR » pour prendre des commandes en salle." />
      ) : liste.length === 0 ? (
        <EtatVide icone="carte" titre="Aucun plat disponible" texte="Ajoutez ou rendez disponible au moins un plat dans votre menu." />
      ) : (
        <SaisieServeur plats={liste} tablesOuvertes={tables.map((t) => t.session.tableNumero)} comptoir={comptoir} />
      )}
    </div>
  );
}
