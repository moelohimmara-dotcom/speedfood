import Link from "next/link";
import { Card } from "@/components/ui";

export interface EtatDemarrage {
  photo: boolean;
  logo: boolean;
  plats: boolean;
  horaires: boolean;
  paiement: boolean;
  publie: boolean;
}

/**
 * Liste « Préparez votre page » du tableau de bord (lot E) : ce qui reste à faire avant et pendant la validation.
 * Tout est déduit de l'état réel du restaurant ; aucune durée de validation n'est promise.
 * Disparaît quand tout est fait et que la page est publiée.
 */
export function ListeDemarrage({ etat }: { etat: EtatDemarrage }) {
  const etapes = [
    { cle: "photo", libelle: "Ajouter une photo de couverture", fait: etat.photo, href: "/restaurant/profil" },
    { cle: "logo", libelle: "Ajouter votre logo", fait: etat.logo, href: "/restaurant/profil" },
    { cle: "plats", libelle: "Créer au moins un plat au menu", fait: etat.plats, href: "/restaurant/menu" },
    { cle: "horaires", libelle: "Indiquer vos horaires", fait: etat.horaires, href: "/restaurant/profil" },
    { cle: "paiement", libelle: "Choisir les moyens de paiement acceptés", fait: etat.paiement, href: "/restaurant/profil" },
  ];
  const faites = etapes.filter((e) => e.fait).length;
  if (faites === etapes.length && etat.publie) {
    return null;
  }

  return (
    <Card className="liste-demarrage">
      <h2 className="liste-demarrage-titre">Préparez votre page</h2>
      <p className="liste-demarrage-avancement">
        {faites} étape{faites > 1 ? "s" : ""} sur {etapes.length}
        <progress value={faites} max={etapes.length} aria-label="Avancement de la préparation de votre page" />
      </p>
      <ul className="liste-demarrage-etapes">
        {etapes.map((etape) => (
          <li key={etape.cle} className={etape.fait ? "fait" : undefined}>
            <span className="liste-demarrage-coche" aria-hidden="true">
              {etape.fait ? "✓" : ""}
            </span>
            {etape.fait ? (
              <span>
                {etape.libelle} <span className="sr-only">: fait</span>
              </span>
            ) : (
              <Link href={etape.href} className="lien-texte">
                {etape.libelle}
              </Link>
            )}
          </li>
        ))}
        <li className={etat.publie ? "fait" : undefined}>
          <span className="liste-demarrage-coche" aria-hidden="true">
            {etat.publie ? "✓" : ""}
          </span>
          <span>
            {etat.publie
              ? "Page validée et publiée par l'équipe"
              : "Validation par l'équipe Speedfood : en attente (vous serez prévenu ici ; une correction éventuelle s'affiche en haut de cette page)"}
          </span>
        </li>
      </ul>
    </Card>
  );
}
