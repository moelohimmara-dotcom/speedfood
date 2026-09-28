import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientPublic } from "@/lib/db/public";
import { NouvelEtablissementForm } from "./NouvelEtablissementForm";
import { Card } from "@/components/ui";

export default async function NouvelEtablissementPage() {
  const supabaseServeur = await creerClientServeur();
  const {
    data: { user },
  } = await supabaseServeur.auth.getUser();

  if (!user) {
    redirect("/connexion?suite=/restaurant/nouveau");
  }

  const { data: membership } = await supabaseServeur
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();

  if (membership) {
    // Déjà associé à un restaurant : ce chemin d'onboarding ne sert qu'une fois.
    redirect("/restaurant");
  }

  // Un admin système pur n'a pas à créer d'établissement : sa console est /system.
  const { data: roleSysteme } = await supabaseServeur
    .from("system_admin_memberships")
    .select("utilisateur_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (roleSysteme) {
    redirect("/system");
  }

  const publicClient = creerClientPublic();
  const [{ data: categories }, { data: quartiers }] = await Promise.all([
    publicClient.from("menu_categories").select("id, nom").order("ordre"),
    publicClient.from("neighborhoods").select("id, nom").order("ordre"),
  ]);

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-3)" }}>
        Configurons votre établissement
      </h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        Ces informations pourront être modifiées plus tard depuis votre espace restaurant.
      </p>
      <Card>
        <NouvelEtablissementForm categories={categories ?? []} quartiers={quartiers ?? []} />
      </Card>
    </main>
  );
}
