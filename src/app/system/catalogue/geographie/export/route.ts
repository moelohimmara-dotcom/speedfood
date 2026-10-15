import { NextResponse } from "next/server";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { construireCsv } from "@/lib/system-admin/csv";
import { listerGeographieSysteme } from "@/lib/system-admin/geographie";
import { ENTETES_CSV, ligneExport } from "@/lib/system-admin/geographie-outils";
import { roleAPermission } from "@/lib/system-admin/permissions";

/**
 * Export CSV des communes et quartiers d'UNE région, à corriger dans un tableur puis recharger depuis la page Géographie (aperçu des
 * changements avant application). Aucune donnée personnelle : seulement des noms, des points et des statuts. Permission `taxonomie.editer`.
 */
export async function GET(request: Request) {
  const contexte = await obtenirContexteSysteme();
  if (!roleAPermission(contexte.role, "taxonomie.editer")) {
    return new NextResponse("Introuvable", { status: 404 });
  }
  const region = (new URL(request.url).searchParams.get("region") ?? "conakry").slice(0, 60);
  const geo = await listerGeographieSysteme(region);
  if (!geo.regionChoisie) return new NextResponse("Région inconnue", { status: 404 });

  const lignes = [
    ...geo.communes.map((c) =>
      ligneExport({ id: c.id, niveau: "commune", nom: c.nom, actif: c.actif, latitude: c.latitude, longitude: c.longitude, nomsAlternatifs: c.nomsAlternatifs, statutLancement: c.statutLancement })
    ),
    ...geo.quartiers.map((q) =>
      ligneExport({ id: q.id, niveau: "quartier", nom: q.nom, actif: q.actif, latitude: q.latitude, longitude: q.longitude, nomsAlternatifs: q.nomsAlternatifs, statutLancement: null })
    ),
  ];
  return new NextResponse(construireCsv([...ENTETES_CSV], lignes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="geographie-${geo.regionChoisie.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
