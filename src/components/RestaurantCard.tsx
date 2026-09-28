import Link from "next/link";
import { Badge, Card } from "@/components/ui";

interface RestaurantCardProps {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  ouvert: boolean;
  photoUrl?: string | null;
}

export function RestaurantCard({ id, nom, categorie, quartier, ouvert, photoUrl }: RestaurantCardProps) {
  return (
    <Link href={`/restaurants/${id}`} style={{ textDecoration: "none" }}>
      <Card style={{ height: "100%", padding: photoUrl ? 0 : undefined, overflow: photoUrl ? "hidden" : undefined }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img
            src={photoUrl}
            alt=""
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
          />
        ) : null}
        <div style={{ padding: photoUrl ? "var(--space-3)" : 0 }}>
          <h3 style={{ fontSize: "1.2rem", marginBottom: 4 }}>{nom}</h3>
          <p style={{ color: "var(--secondaire)", fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>
            {categorie} · {quartier}
          </p>
          <Badge ton={ouvert ? "succes" : "danger"}>{ouvert ? "Ouvert" : "Fermé"}</Badge>
        </div>
      </Card>
    </Link>
  );
}
