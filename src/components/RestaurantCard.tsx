import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie, illustrationCouverture, illustrationLogo } from "@/lib/illustrations/automatique";
import type { Illustration as ModeleIllustration } from "@/lib/illustrations/modele";
import { libelleEtatRestaurant, type EtatRestaurant, type LibelleDisponibilite } from "@/lib/disponibilite/etat";

export interface PlatCarte {
  id: string;
  nom: string;
  prixAffiche: number;
  disponibilite: LibelleDisponibilite;
}

interface RestaurantCardProps {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  etat: EtatRestaurant;
  /** Plats qui correspondent à la recherche, avec leur état de disponibilité (jamais affirmé sans horodatage). */
  plats?: PlatCarte[];
  autresPlats?: number;
  photoUrl?: string | null;
  logoUrl?: string | null;
  couleurAccent?: string | null;
  /** Illustrations modifiables (console admin), utilisées quand il n'y a ni photo ni logo téléversés. */
  couvertureIllustration?: ModeleIllustration | null;
  logoIllustration?: ModeleIllustration | null;
}

/**
 * Couleur plate par catégorie (réutilise les tokens déjà définis dans
 * globals.css — jamais un nouveau dégradé, réservé au CTA principal par
 * DESIGN-SYSTEM.md). Repli neutre si une catégorie future n'est pas listée
 * ici : ne casse jamais l'affichage, juste moins de couleur distinctive.
 */
const COULEUR_PAR_CATEGORIE: Record<string, string> = {
  "Riz & sauces": "var(--couleur-riz)",
  Grillades: "var(--couleur-grill)",
  "Fast-food": "var(--couleur-fast)",
  "Petit-déjeuner": "var(--couleur-cafe)",
};

export function RestaurantCard({
  id,
  nom,
  categorie,
  quartier,
  etat,
  plats = [],
  autresPlats = 0,
  photoUrl,
  logoUrl,
  couleurAccent,
  couvertureIllustration,
  logoIllustration,
}: RestaurantCardProps) {
  const famille = familleDepuisCategorie(categorie);
  const couverture = couvertureIllustration ?? illustrationCouverture(famille);
  const logoIllustre = logoIllustration ?? illustrationLogo(nom, famille);
  const couleurCategorie = COULEUR_PAR_CATEGORIE[categorie] ?? "var(--secondaire)";
  const libelleEtat = libelleEtatRestaurant(etat);

  return (
    <Link href={`/restaurants/${id}`} style={{ textDecoration: "none" }}>
      <Card
        className="carte-restaurant"
        style={{
          height: "100%",
          borderTopColor: couleurAccent ?? undefined,
          borderTopWidth: couleurAccent ? 4 : undefined,
        }}
      >
        <div className="carte-restaurant-photo-wrap">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={photoUrl} alt="" className="carte-restaurant-photo" />
          ) : (
            <Illustration valeur={couverture} nom="" decoratif className="carte-restaurant-photo carte-restaurant-photo-illustree" />
          )}
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={logoUrl} alt="" className="carte-restaurant-logo" />
          ) : (
            <span className="carte-restaurant-logo carte-restaurant-logo-illustre">
              <Illustration valeur={logoIllustre} nom="" decoratif />
            </span>
          )}
        </div>
        <div className="carte-restaurant-corps" style={{ paddingTop: "calc(var(--space-4) + 18px)" }}>
          <h3 style={{ fontSize: "1.2rem", marginBottom: 6 }}>{nom}</h3>
          <p className="carte-restaurant-meta">
            <span className="pastille-categorie" style={{ background: couleurCategorie }} aria-hidden="true" />
            {categorie} · {quartier}
          </p>
          <Badge ton={libelleEtat.ton}>{libelleEtat.texte}</Badge>
          {plats.length > 0 ? (
            <ul className="carte-restaurant-plats">
              {plats.map((plat) => (
                <li key={plat.id}>
                  <span className="carte-restaurant-plat-ligne">
                    <span className="carte-restaurant-plat-nom">{plat.nom}</span>
                    <span className="carte-restaurant-plat-prix">{plat.prixAffiche.toLocaleString("fr-FR")} GNF</span>
                  </span>
                  <span className="carte-restaurant-plat-etat">
                    <Badge ton={plat.disponibilite.ton}>{plat.disponibilite.court}</Badge>
                    {plat.disponibilite.detail ? <small>{plat.disponibilite.detail}</small> : null}
                  </span>
                </li>
              ))}
              {autresPlats > 0 ? (
                <li className="carte-restaurant-plat-autres">
                  + {autresPlats} autre{autresPlats > 1 ? "s" : ""} plat{autresPlats > 1 ? "s" : ""} correspondant
                  {autresPlats > 1 ? "s" : ""}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
