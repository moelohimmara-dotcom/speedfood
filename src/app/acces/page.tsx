import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/db/server";

/**
 * Porte d'entrée unique : deux pistes séparées dès le départ. « Je suis client » (commander, favoris, suivi)
 * et « Je suis restaurateur » (console, commandes, menu). Chaque piste a sa propre inscription et sa propre
 * connexion ; la connexion vérifie ensuite que le compte correspond à la piste choisie (`connexionAction`).
 */
export const metadata: Metadata = {
  title: "Choisir mon accès",
  description: "Client ou restaurateur : choisissez votre piste pour créer un compte ou vous connecter.",
};

export default async function AccesPage() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: membership } = await supabase
      .from("restaurant_memberships")
      .select("restaurant_id")
      .eq("utilisateur_id", user.id)
      .maybeSingle();
    redirect(membership ? "/restaurant" : "/compte");
  }

  return (
    <main className="page-compte">
      <h1 className="page-compte-titre acces-piste-titre">Qui êtes-vous ?</h1>
      <p className="page-compte-sous acces-piste-sous">
        Deux espaces séparés, chacun avec son propre compte. Choisissez le vôtre.
      </p>

      <div className="acces-piste-grille">
        <section className="acces-piste-carte" aria-labelledby="acces-piste-client">
          <h2 id="acces-piste-client">Je suis client</h2>
          <p>Je veux commander, retrouver mes commandes, mes adresses et mes restaurants favoris.</p>
          <div className="acces-piste-actions">
            <Link href="/entrer" className="btn btn-primary btn-block">Créer mon compte client</Link>
            <Link href="/connexion?role=client" className="btn btn-secondary btn-block">J&apos;ai déjà un compte</Link>
          </div>
          <p className="acces-piste-note">
            Pas besoin de compte pour commander : <Link href="/restaurants" className="lien-texte">parcourir les restaurants</Link>.
          </p>
        </section>

        <section className="acces-piste-carte acces-piste-carte-resto" aria-labelledby="acces-piste-resto">
          <h2 id="acces-piste-resto">Je suis restaurateur</h2>
          <p>Je tiens un restaurant et je veux recevoir des commandes, gérer mon menu et mes plats du jour.</p>
          <div className="acces-piste-actions">
            <Link href="/inscription" className="btn btn-primary btn-block">Inscrire mon restaurant</Link>
            <Link href="/connexion?role=restaurateur" className="btn btn-secondary btn-block">Me connecter à ma console</Link>
          </div>
          <p className="acces-piste-note">
            <Link href="/devenir-partenaire" className="lien-texte">Comment ça marche pour un restaurateur ?</Link>
          </p>
        </section>
      </div>

      <p className="acces-piste-equipe">
        Équipe Speedfood ? <Link href="/connexion?suite=/system" className="lien-texte">Administration</Link>
      </p>
    </main>
  );
}
