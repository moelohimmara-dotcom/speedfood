import { NextResponse } from "next/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { cheminRestaurant } from "@/lib/partage/liens";
import { estRobotApercu, lireSourceScan } from "@/lib/partage/scans";
import { lireNumeroTable } from "@/lib/commande/mode";

/**
 * Lien court d'un restaurant (`/r/ab12cd`) : c'est ce que contiennent le QR code et l'affiche. Il compte la visite par source
 * (QR, affiche, WhatsApp, carte, table, lien) puis envoie sur la page publique du restaurant. Aucune donnée personnelle ni adresse IP
 * n'est conservée : seulement un compteur par restaurant, jour et source. Les aperçus de liens (WhatsApp, réseaux) et les robots ne
 * sont pas comptés. Un code inconnu, d'un restaurant non publié ou suspendu, mène à la liste des restaurants.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  const url = new URL(requete.url);
  const retour = (chemin: string) => NextResponse.redirect(new URL(chemin, url.origin), 307);

  if (!/^[a-zA-Z0-9]{4,12}$/.test(code)) {
    return retour("/restaurants");
  }

  const table = lireNumeroTable(url.searchParams.get("t"));
  const source = table ? "table" : lireSourceScan(url.searchParams.get("s"));
  const vers = (id: string) => `${cheminRestaurant(id)}${table ? `?table=${encodeURIComponent(table)}` : ""}`;
  const compter = !estRobotApercu(requete.headers.get("user-agent"));
  try {
    const admin = creerClientAdmin();
    if (compter) {
      const { data } = await admin.rpc("fn_compter_scan", { p_code: code, p_source: source });
      return data ? retour(vers(data)) : retour("/restaurants");
    }
    const { data } = await admin.from("restaurants").select("id").eq("code_court", code.toLowerCase()).eq("publie", true).is("suspendu_le", null).maybeSingle();
    return data ? retour(vers(data.id)) : retour("/restaurants");
  } catch {
    return retour("/restaurants");
  }
}

