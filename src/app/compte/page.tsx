import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { deconnexionClientAction } from "@/lib/client/actions";
import { emojiAvatar } from "@/lib/client/profil";
import { creerClientServeur } from "@/lib/db/server";
import { SuppressionCompte } from "./SuppressionCompte";

export const metadata: Metadata = { title: "Mon compte" };

/**
 * Accueil du compte : avatar, pseudo, modification et suppression. Un compte restaurateur ou système y trouve un lien
 * vers sa console (il n'a pas de profil client à remplir). Les commandes passées, les informations préremplies et les
 * favoris ne sont pas encore reliés au compte : la page ne les promet pas.
 */
export default async function ComptePage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/entrer");
  }

  const [{ data: profil }, { data: membre }, { data: roleSysteme }] = await Promise.all([
    supabase.from("client_profils").select("pseudo, avatar").eq("utilisateur_id", user.id).maybeSingle(),
    supabase.from("restaurant_memberships").select("restaurant_id").eq("utilisateur_id", user.id).maybeSingle(),
    supabase.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", user.id).maybeSingle(),
  ]);

  const estPro = Boolean(membre || roleSysteme);
  if (!profil && !estPro) {
    redirect("/bienvenue");
  }

  return (
    <main className="page-texte">
      <h1>Mon compte</h1>

      {profil ? (
        <Card className="compte-profil">
          <span className="compte-avatar" aria-hidden="true">
            {emojiAvatar(profil.avatar)}
          </span>
          <div>
            <p className="compte-pseudo">{profil.pseudo}</p>
            <p className="aide-champ">{user.email ?? "Compte connecté"}</p>
          </div>
          <Link href="/bienvenue?modifier=1" className="btn btn-secondary btn-compact">
            Modifier
          </Link>
        </Card>
      ) : null}

      {estPro ? (
        <Card>
          <p>Ce compte gère un restaurant ou l&apos;administration.</p>
          <Link href={roleSysteme ? "/system" : "/restaurant"} className="btn btn-primary">
            Ouvrir ma console
          </Link>
        </Card>
      ) : null}

      <div className="page-texte-actions">
        <form action={deconnexionClientAction}>
          <button type="submit" className="btn btn-secondary">
            Se déconnecter
          </button>
        </form>
        <Link href="/restaurants" className="btn btn-secondary">
          Voir les restaurants
        </Link>
      </div>

      {!estPro ? <SuppressionCompte /> : null}
    </main>
  );
}
