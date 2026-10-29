import qrcode from "qrcode-generator";
import { creerClientPublic } from "@/lib/db/public";
import { estUuid } from "@/lib/commande/commun";
import { lienCourt, lireSourceScan } from "@/lib/partage/scans";
import { lireNumeroTable } from "@/lib/commande/mode";
import { creerClientServeur } from "@/lib/db/server";
import { cleDeTable } from "@/lib/table/cle";

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
  const table = lireNumeroTable(url.searchParams.get("t"));
  // Un QR de TABLE contient la clé de cette table (src/lib/table/cle.ts) : seule l'équipe du restaurant peut le générer, sinon n'importe qui
  // l'obtiendrait en changeant le numéro dans l'adresse. Le QR général du restaurant (sans table) reste public.
  let cleTable: string | null = null;
  if (table) {
    const supabase = await creerClientServeur();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: membre } = user
      ? await supabase.from("restaurant_memberships").select("restaurant_id").eq("restaurant_id", restaurant.id).eq("utilisateur_id", user.id).maybeSingle()
      : { data: null };
    if (!membre) {
      return new Response("Réservé à l'équipe du restaurant", { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    cleTable = cleDeTable(restaurant.id, table);
  }
  const cible = lienCourt(url.origin, restaurant.code_court, lireSourceScan(url.searchParams.get("s") ?? "qr"), table, cleTable);
  const qr = qrcode(0, "M");
  qr.addData(cible);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });

  const entetes: Record<string, string> = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    // Un QR de table (avec clé) ne se met jamais en cache partagé.
    "Cache-Control": table ? "private, no-store" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.get("telecharger") === "1") {
    entetes["Content-Disposition"] = 'attachment; filename="speedfood-qr.svg"';
  }
  return new Response(svg, { headers: entetes });
}
