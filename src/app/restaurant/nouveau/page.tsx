import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { Card } from "@/components/ui";

/**
 * Compte connecté sans établissement. Depuis le modèle « Speedfood intermédiaire » (ADR-020), un établissement n'est plus créé par son propriétaire :
 * l'équipe le crée après une demande de référencement. Cette page explique la suite au lieu de proposer un formulaire de création (la fonction de base
 * correspondante n'est d'ailleurs plus exécutable par un compte connecté).
 */
export default async function SansEtablissementPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?suite=/restaurant/nouveau");
  }

  const { data: membership } = await supabase.from("restaurant_memberships").select("restaurant_id").eq("utilisateur_id", user.id).maybeSingle();
  if (membership) {
    redirect("/restaurant");
  }

  // Un admin système pur n'a pas d'établissement : sa console est /system.
  const { data: roleSysteme } = await supabase.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", user.id).maybeSingle();
  if (roleSysteme) {
    redirect("/system");
  }

  return (
    <main className="u-maxw-420px-m-0-auto-p-s8-s4">
      <h1 className="u-fs-1-8rem-mb-s3">Votre établissement n&apos;est pas encore créé</h1>
      <p className="u-c-secondaire-mb-s5">
        Chez Speedfood, c&apos;est l&apos;équipe qui crée la fiche d&apos;un établissement, avec son responsable, après une demande de référencement.
      </p>
      <Card>
        <p>Si vous n&apos;avez pas encore fait la demande, faites-la maintenant : nous vous rappelons sous 48 heures.</p>
        <p>
          <Link href="/inscription" className="btn btn-primary btn-block">Demander à être référencé</Link>
        </p>
        <p>
          <Link href="/compte" className="lien-texte">Aller à mon compte</Link>
        </p>
      </Card>
    </main>
  );
}
