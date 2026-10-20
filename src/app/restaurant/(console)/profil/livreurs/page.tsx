import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { FilAriane } from "@/components/console/FilAriane";
import { PageHeader } from "@/components/admin/blocs";
import { RegistreLivreurs } from "./RegistreLivreurs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mes livreurs" };
export const dynamic = "force-dynamic";

/**
 * « Mes livreurs » (sous-page du hub « Mon restaurant ») : le registre des personnes qui livrent pour CE restaurant. Lu avec la session du
 * restaurateur : la RLS ne lui montre que les fiches de son restaurant. Les écritures passent par le serveur (registre-restaurant.ts).
 */
export default async function MesLivreursPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil/livreurs");
  // Les types générés ne connaissent pas encore la table : client sans typage de tables (la RLS limite la lecture à ce restaurant).
  const { data } = await (supabase as unknown as SupabaseClient)
    .from("livreurs")
    .select("id, nom, telephone, vehicule, utilisateur_id")
    .eq("restaurant_id", membership.restaurant_id)
    .eq("cycle", "actif")
    .order("nom")
    .limit(50);
  const livreurs = ((data ?? []) as Array<{ id: string; nom: string; telephone: string | null; vehicule: string; utilisateur_id: string | null }>).map((l) => ({
    id: l.id,
    nom: l.nom,
    telephone: l.telephone,
    vehicule: l.vehicule,
    // Seulement l'information « a un compte », jamais l'identifiant du compte.
    compteActive: l.utilisateur_id !== null,
  }));

  return (
    <div>
      <FilAriane elements={[{ libelle: "Mon restaurant", href: "/restaurant/profil" }, { libelle: "Mes livreurs" }]} />
      <PageHeader titre="Mes livreurs" description="Les personnes qui livrent vos commandes. Vous choisissez qui livre chaque commande depuis la liste des commandes." />
      <div className="profil-section">
        <RegistreLivreurs livreurs={livreurs} />
      </div>
    </div>
  );
}
