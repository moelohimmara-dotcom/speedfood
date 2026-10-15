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
  visiteurSimule,
  publie,
  suspendu,
}: {
  role: Exclude<RoleVue, "visiteur">;
  restaurantId: string;
  visiteurSimule: boolean;
  publie: boolean;
  suspendu: boolean;
}) {
  const visibleDuPublic = publie && !suspendu;
  const retour = role === "admin" ? { href: `/system/catalogue/restaurants/${restaurantId}`, libelle: "Retour à la fiche d'administration" } : { href: "/restaurant", libelle: "Retour à ma console" };
  const modifier = role === "admin" ? null : { href: "/restaurant/profil", libelle: "Modifier mon restaurant" };
  const fiche = `/restaurants/${restaurantId}`;

  return (
    <aside className="apercu-fiche" aria-label="Aperçu de la page">
      {/* Un aperçu n'est jamais indexé : la fiche d'un restaurant non publié ne doit pas fuiter dans les moteurs de recherche. */}
      <meta name="robots" content="noindex, nofollow" />
      <div className="apercu-fiche-texte">
        <p className="apercu-fiche-kicker">{visiteurSimule ? "Vue visiteur" : role === "admin" ? "Aperçu administrateur" : "Aperçu propriétaire"}</p>
        <p className="apercu-fiche-titre">
          {visiteurSimule
            ? "Voici ce que voit un client qui ouvre votre page. Vous pouvez tester une commande."
            : role === "admin"
              ? "Vous regardez cette page avec vos droits d'administrateur. Les clients voient la même chose, sans ce bandeau."
              : "Vous voyez votre page avec vos droits de propriétaire. Les clients voient la même chose, sans ce bandeau."}
        </p>
        <p className="apercu-fiche-etat">
          <span className={`apercu-fiche-pastille${visibleDuPublic ? " est-publie" : ""}`}>
            {suspendu ? "Suspendu" : publie ? "Publié" : "En attente de validation"}
          </span>{" "}
          {visibleDuPublic
            ? "Les clients peuvent trouver cette page."
            : visiteurSimule
              ? "Un vrai visiteur verrait une page introuvable : elle n'est pas visible du public."
              : "Cette page n'est pas visible du public : vous seul (et l'équipe Speedfood) la voyez."}
          {!visiteurSimule ? " Les commandes sont désactivées dans cette vue." : ""}
        </p>
      </div>
      <div className="apercu-fiche-actions">
        {visiteurSimule ? (
          <Link href={fiche} className="btn btn-secondary">
            Revenir à ma vue
          </Link>
        ) : (
          <Link href={`${fiche}?vue=visiteur`} className="btn btn-secondary">
            Voir comme un visiteur
          </Link>
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
