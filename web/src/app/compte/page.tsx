import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { deconnexionClientAction, oublierCoordonneesAction } from "@/lib/client/actions";
import { emojiAvatar } from "@/lib/client/profil";
import { assurerProfilClient } from "@/lib/client/profil-serveur";
import { creerClientServeur } from "@/lib/db/server";
import { SuppressionCompte } from "./SuppressionCompte";
import { FormulaireQuartierClient } from "./FormulaireQuartierClient";
import { grouperParCommune, lireQuartiersActifs } from "@/lib/geographie/quartiers";

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

  // Inscription par formulaire : les coordonnées attendent dans les métadonnées du compte (l'inscription elle-même
  // n'avait pas de session, la confirmation d'e-mail étant requise). On les reprend ici, une seule fois.
  await assurerProfilClient(supabase, user);

  const [{ data: profil }, { data: membre }, { data: roleSysteme }] = await Promise.all([
    supabase.from("client_profils").select("pseudo, avatar, nom_commande, telephone, adresse, quartier_id").eq("utilisateur_id", user.id).maybeSingle(),
    supabase.from("restaurant_memberships").select("restaurant_id").eq("utilisateur_id", user.id).maybeSingle(),
    supabase.from("system_admin_memberships").select("utilisateur_id").eq("utilisateur_id", user.id).maybeSingle(),
  ]);

  const estPro = Boolean(membre || roleSysteme);
  if (!profil && !estPro) {
    redirect("/bienvenue");
  }
  const quartiers = profil ? await lireQuartiersActifs(supabase) : [];

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

      {profil ? (
        <Card className="compte-espace">
          <h2>Mon espace</h2>
          <ul className="compte-espace-liste">
            <li>
              <Link href="/compte/commandes" className="compte-espace-lien">
                <strong>Mes commandes</strong>
                <span>Suivre une commande, retrouver un reçu, commander à nouveau</span>
              </Link>
            </li>
            <li>
              <Link href="/compte/favoris" className="compte-espace-lien">
                <strong>Mes restaurants favoris</strong>
                <span>Les restaurants que vous aimez, à portée de main</span>
              </Link>
            </li>
            <li>
              <Link href="/compte/adresses" className="compte-espace-lien">
                <strong>Mes adresses</strong>
                <span>Jusqu&apos;à cinq adresses de livraison, à choisir d&apos;un geste</span>
              </Link>
            </li>
            <li>
              <Link href="/compte/avis" className="compte-espace-lien">
                <strong>Mes avis</strong>
                <span>Ce que vous avez écrit sur les restaurants, et leurs réponses</span>
              </Link>
            </li>
            <li>
              <Link href="/compte/preferences" className="compte-espace-lien">
                <strong>Mes préférences</strong>
                <span>Mode de commande habituel, notifications de suivi</span>
              </Link>
            </li>
            <li>
              <Link href="/compte/securite" className="compte-espace-lien">
                <strong>Sécurité du compte</strong>
                <span>Double authentification et questions de sécurité</span>
              </Link>
            </li>
          </ul>
        </Card>
      ) : null}

      {profil ? (
        <FormulaireQuartierClient groupes={grouperParCommune(quartiers)} quartierActuelId={profil.quartier_id} />
      ) : null}

      {profil?.nom_commande && profil.telephone ? (
        <Card className="compte-coordonnees">
          <h2>Vos informations de commande</h2>
          <p className="aide-champ">Mémorisées pour préremplir vos commandes. Visibles de vous seul.</p>
          <ul>
            <li>{profil.nom_commande}</li>
            <li>{profil.telephone}</li>
            {profil.adresse ? <li>{profil.adresse}</li> : null}
          </ul>
          <form action={oublierCoordonneesAction}>
            <button type="submit" className="btn btn-secondary btn-compact">
              Effacer ces informations
            </button>
          </form>
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
