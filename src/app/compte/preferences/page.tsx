import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { creerClientServeur } from "@/lib/db/server";
import { lireModePrefere } from "@/lib/client/espace";
import { FormulairePreferences } from "./FormulairePreferences";

export const metadata: Metadata = { title: "Mes préférences" };
export const dynamic = "force-dynamic";

export default async function MesPreferencesPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer?suite=/compte/preferences");

  const { data: profil } = await (supabase as unknown as SupabaseClient).from("client_profils").select("mode_prefere, notifications_commande").eq("utilisateur_id", user.id).maybeSingle();
  if (!profil) redirect("/bienvenue");

  return (
    <main className="page-texte">
      <p>
        <Link href="/compte">← Mon compte</Link>
      </p>
      <h1>Mes préférences</h1>
      <Card>
        <FormulairePreferences modePrefere={lireModePrefere(profil.mode_prefere) ?? null} notifications={profil.notifications_commande !== false} />
      </Card>
    </main>
  );
}
