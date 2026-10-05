import qrcode from "qrcode-generator";
import { creerClientPublic } from "@/lib/db/public";
import { estUuid } from "@/lib/commande/commun";
import { lienCourt, lireSourceScan } from "@/lib/partage/scans";

/**
 * QR code (SVG) de la page publique d'un restaurant, à afficher ou imprimer dans l'établissement.
 * Public mais limité aux restaurants publiés (la lecture publique ne renvoie que ceux-là) : un
 * restaurant non publié n'a pas de QR. Le QR contient le lien court du restaurant (qui compte le scan puis redirige) et rien d'autre.
 * `?telecharger=1` propose le fichier au téléchargement.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  if (!estUuid(id)) {
    return new Response("Introuvable", { status: 404 });
  }

  const { data: restaurant } = await creerClientPublic()
    .from("restaurants")
    .select("id, nom, code_court")
    .eq("id", id)
    .maybeSingle();
  if (!restaurant) {
    return new Response("Introuvable", { status: 404 });
  }

  const url = new URL(requete.url);
  const cible = lienCourt(url.origin, restaurant.code_court, lireSourceScan(url.searchParams.get("s") ?? "qr"));
  const qr = qrcode(0, "M");
  qr.addData(cible);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });

  const entetes: Record<string, string> = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("telecharger") === "1") {
    entetes["Content-Disposition"] = 'attachment; filename="speedfood-qr.svg"';
  }
  return new Response(svg, { headers: entetes });
}
