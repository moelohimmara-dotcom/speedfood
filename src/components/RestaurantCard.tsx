import Link from "next/link";
import { Badge, Card } from "@/components/ui";

interface RestaurantCardProps {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  ouvert: boolean;
}

export function RestaurantCard({ id, nom, categorie, quartier, ouvert }: RestaurantCardProps) {
  return (
    <Link href={`/restaurants/${id}`} style={{ textDecoration: "none" }}>
      <Card style={{ height: "100%" }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: 4 }}>{nom}</h3>
        <p style={{ color: "var(--secondaire)", fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>
          {categorie} · {quartier}
        </p>
        <Badge ton={ouvert ? "succes" : "danger"}>{ouvert ? "Ouvert" : "Fermé"}</Badge>
      </Card>
    </Link>
  );
}
