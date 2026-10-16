import Link from "next/link";
import type { RoleVue } from "@/lib/restaurant/vue-fiche";

/**
 * Bandeau d'aperçu de la fiche publique, affiché au propriétaire (ou à l'équipe) et aux administrateurs qui regardent la page de leur
 * restaurant : il dit qui regarde, ce que voient les clients, l'état de publication, et propose de basculer entre « ma vue » et la
 * vue d'un visiteur (comme « voir en tant que » sur une page Facebook). Un visiteur ordinaire ne le voit jamais.
 */
export function BandeauApercuFiche({
  role,
  restaurantId,
  mode,
  publie,
  suspendu,
}: {
  role: Exclude<RoleVue, "visiteur">;
  restaurantId: string;
  mode: "apercu" | "visiteur" | "test";
  publie: boolean;
  suspendu: boolean;
}) {
  const visiteurSimule = mode === "visiteur";
  const test = mode === "test";
  const visibleDuPublic = publie && !suspendu;
  const retour = role === "admin" ? { href: `/system/catalogue/restaurants/${restaurantId}`, libelle: "Retour à la fiche d'administration" } : { href: "/restaurant", libelle: "Retour à ma console" };
  const modifier = role === "admin" ? null : { href: "/restaurant/profil/page-publique", libelle: "Modifier ma page" };
  const fiche = `/restaurants/${restaurantId}`;

  return (
    <aside className={`apercu-fiche${test ? " apercu-fiche-test" : ""}`} aria-label={test ? "Mode test" : "Aperçu de la page"}>
      {/* Un aperçu n'est jamais indexé : la fiche d'un restaurant non publié ne doit pas fuiter dans les moteurs de recherche. */}
      <meta name="robots" content="noindex, nofollow" />
      <div className="apercu-fiche-texte">
        <p className="apercu-fiche-kicker">{test ? "Mode test" : visiteurSimule ? "Vue visiteur" : role === "admin" ? "Aperçu administrateur" : "Aperçu propriétaire"}</p>
        <p className="apercu-fiche-titre">
          {test
            ? "Vous pouvez passer une commande pour essayer le parcours complet. Elle est marquée « Test » et n'est comptée dans aucun chiffre."
            : visiteurSimule
              ? "Voici exactement ce que voit un client qui ouvre votre page. Rien ne peut être commandé depuis cette vue."
              : role === "admin"
              ? "Vous regardez cette page avec vos droits d'administrateur. Les clients voient la même chose, sans ce bandeau."
              : "Vous voyez votre page avec vos droits de propriétaire. Les clients voient la même chose, sans ce bandeau."}
        </p>
        <p className="apercu-fiche-etat">
          <span className={`apercu-fiche-pastille${visibleDuPublic ? " est-publie" : ""}`}>
            {suspendu ? "Suspendu" : publie ? "Publié" : "En attente de validation"}
          </span>{" "}
          {test
            ? visibleDuPublic
              ? "Le restaurant reçoit la commande comme une vraie, sans prévenir de client réel."
              : "Cette page n'est pas encore visible du public : une commande de test ne peut pas être envoyée avant la publication."
            : visibleDuPublic
            ? "Les clients peuvent trouver cette page."
            : visiteurSimule
              ? "Un vrai visiteur verrait une page introuvable : elle n'est pas visible du public."
              : "Cette page n'est pas visible du public : vous seul (et l'équipe Speedfood) la voyez."}
          {mode === "apercu" ? " Les commandes sont désactivées dans cette vue." : ""}
        </p>
      </div>
      <div className="apercu-fiche-actions">
        {mode !== "apercu" ? (
          <Link href={fiche} className="btn btn-secondary">
            Revenir à ma vue
          </Link>
        ) : (
          <>
            <Link href={`${fiche}?vue=visiteur`} className="btn btn-secondary">
              Voir comme un visiteur
            </Link>
            {visibleDuPublic ? (
              <Link href={`${fiche}?vue=test`} className="btn btn-secondary">
                Tester une commande
              </Link>
            ) : null}
          </>
        )}
        {modifier ? (
          <Link href={modifier.href} className="btn btn-secondary">
            {modifier.libelle}
          </Link>
        ) : null}
        <Link href={retour.href} className="lien-texte">
          {retour.libelle}
        </Link>
      </div>
    </aside>
  );
}
