import { NextResponse } from "next/server";
import { creerClientServeur } from "@/lib/db/server";
import { lireCommandesATraiter } from "@/lib/commande/a-traiter-lecture";

export const dynamic = "force-dynamic";

const ENTETES = { "Cache-Control": "no-store" } as const;

/**
 * Commandes « à traiter » du restaurant du membre connecté, pour les alertes de la console (son, titre
 * d'onglet, rafraîchissement). Réponse minimale : identifiants et dates, jamais de nom, téléphone ni
 * adresse de client. Le restaurant est déduit de la session, jamais d'un paramètre ; la RLS reste
 * l'autorité sur ce qui est lisible.
 */
export async function GET(): Promise<Response> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ code: "NON_AUTHENTIFIE" }, { status: 401, headers: ENTETES });
  }

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ code: "NON_AUTORISE" }, { status: 403, headers: ENTETES });
  }

  // Même règle que la pastille et la page Commandes : une commande qui attend la réponse du CLIENT n'est pas à traiter.
  const { erreur: error, commandes: data } = await lireCommandesATraiter(supabase, membership.restaurant_id);
  if (error) {
    console.error("alertes_commandes_indisponible");
    return NextResponse.json({ code: "ERREUR_SERVEUR" }, { status: 500, headers: ENTETES });
  }

  const lignes = data ?? [];
  return NextResponse.json(
    {
      aTraiter: lignes.length,
      ids: lignes.map((ligne) => ligne.id),
      plusAncienne: lignes.length > 0 ? lignes[lignes.length - 1].cree_le : null,
    },
    { headers: ENTETES }
  );
}
