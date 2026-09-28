import Link from "next/link";
import { Badge, Card } from "@/components/ui";

interface RestaurantCardProps {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  ouvert: boolean;
  photoUrl?: string | null;
  logoUrl?: string | null;
  couleurAccent?: string | null;
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
  ouvert,
  photoUrl,
  logoUrl,
  couleurAccent,
}: RestaurantCardProps) {
  const couleurCategorie = COULEUR_PAR_CATEGORIE[categorie] ?? "var(--secondaire)";

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
        {photoUrl ? (
          <div className="carte-restaurant-photo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local. */}
            <img src={photoUrl} alt="" className="carte-restaurant-photo" />
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
              <img src={logoUrl} alt="" className="carte-restaurant-logo" />
            ) : null}
          </div>
        ) : null}
        <div
          className="carte-restaurant-corps"
          style={photoUrl && logoUrl ? { paddingTop: "calc(var(--space-4) + 18px)" } : undefined}
        >
          {!photoUrl && logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={logoUrl} alt="" className="carte-restaurant-logo-inline" />
          ) : null}
          <h3 style={{ fontSize: "1.2rem", marginBottom: 6 }}>{nom}</h3>
          <p className="carte-restaurant-meta">
            <span className="pastille-categorie" style={{ background: couleurCategorie }} aria-hidden="true" />
            {categorie} · {quartier}
          </p>
          <Badge ton={ouvert ? "succes" : "danger"}>{ouvert ? "Ouvert" : "Fermé"}</Badge>
        </div>
      </Card>
    </Link>
  );
}
