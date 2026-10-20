import Link from "next/link";
import { redirect } from "next/navigation";
import { ConnexionForm } from "./ConnexionForm";
import { Card } from "@/components/ui";
import { PageCompte } from "@/components/PageCompte";
import { estCheminInterneSur } from "@/lib/auth/redirection";
import { lireRoleChoisi, roleDepuisSuite, type RoleChoisi } from "@/lib/auth/acces";
import type { Metadata } from "next";

/**
 * Connexion par piste (deux espaces séparés, choisis dès `/acces`) :
 * - `role=client` → « Connexion client » ; `role=restaurateur` → « Connexion restaurateur » ;
 * - `suite=/system...` → « Administration Speedfood » (comptes de l'équipe, créés par un admin) ;
 * - ni piste ni destination reconnue → retour à `/acces` (« Qui êtes-vous ? »).
 * La piste voyage dans le formulaire ; `connexionAction` refuse un compte qui ne lui correspond pas
 * (un compte client ne peut pas entrer par la piste restaurateur, et inversement), puis route selon le type réel.
 */
export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; role?: string }>;
}) {
  const { suite, role } = await searchParams;
  const pourSysteme = (suite ?? "").startsWith("/system");

  const deduite = roleDepuisSuite(suite ?? "");
  const piste: RoleChoisi | null = pourSysteme ? null : lireRoleChoisi(role) ?? (deduite === "systeme" ? null : deduite);
  // Page ouverte (commande, suivi…) : on y vient pour se reconnecter, sans piste imposée → présentation client, aucun filtre.
  const sansPiste = !pourSysteme && !piste && estCheminInterneSur(suite ?? "") && (suite ?? "") !== "";
  if (!pourSysteme && !piste && !sansPiste) redirect("/acces");

  if (pourSysteme) {
    return (
      <PageCompte
        titre="Administration Speedfood"
        sousTitre="Accès réservé aux comptes de l'équipe Speedfood (rôles système)."
        pied={
          <p>
            Vous êtes restaurateur ? <Link href="/connexion?role=restaurateur" className="lien-texte">Connexion restaurateur</Link>
            <br />
            Vous êtes client ? <Link href="/connexion?role=client" className="lien-texte">Connexion client</Link>
          </p>
        }
      >
        <Card>
          <ConnexionForm suite={suite ?? ""} role={null} />
        </Card>
      </PageCompte>
    );
  }

  const estResto = piste === "restaurateur";
  const roleFormulaire: RoleChoisi | null = sansPiste ? null : piste;
  return (
    <PageCompte
      titre={estResto ? "Connexion restaurateur" : "Connexion client"}
      sousTitre={
        estResto
          ? "Accédez à votre console : commandes, menu et plats du jour."
          : "Retrouvez vos commandes, vos adresses et vos restaurants favoris."
      }
      panneau={
        estResto
          ? {
              titre: "Votre restaurant, dans votre poche.",
              points: [
                "Voyez arriver les commandes et répondez d'un geste.",
                "Confirmez vos plats du jour : le client voit depuis quand.",
                "Partagez votre page par WhatsApp ou avec un QR code.",
                "Speedfood n'encaisse rien : vos clients vous paient directement, en espèces ou avec votre code marchand.",
              ],
            }
          : undefined
      }
      libellePanneau={estResto ? "À propos de l'espace restaurateur" : undefined}
      pied={
        estResto ? (
          <p>
            Pas encore de restaurant sur Speedfood ? <Link href="/inscription" className="lien-texte">Inscrivez-le</Link>
            <br />
            Vous êtes plutôt client ? <Link href="/connexion?role=client" className="lien-texte">Connexion client</Link>
            {" · "}
            <Link href="/acces" className="lien-texte">Changer de piste</Link>
          </p>
        ) : (
          <p>
            Pas encore de compte ? <Link href="/entrer" className="lien-texte">Créez votre compte client</Link>
            <br />
            Vous tenez un restaurant ? <Link href="/connexion?role=restaurateur" className="lien-texte">Connexion restaurateur</Link>
            {" · "}
            <Link href="/acces" className="lien-texte">Changer de piste</Link>
          </p>
        )
      }
    >
      <Card>
        <ConnexionForm suite={suite ?? ""} role={roleFormulaire} />
      </Card>
    </PageCompte>
  );
}
