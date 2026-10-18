import { NextResponse } from "next/server";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { journaliserActionSysteme } from "@/lib/system-admin/audit";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { construireCsv } from "@/lib/system-admin/csv";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { lireTout } from "@/lib/db/lecture-complete";

/**
 * Export CSV des contacts d'UNE zone de la liste d'attente. Permission `attente.gerer` ; la trace d'audit est écrite AVANT l'envoi des
 * contacts (pas de donnée sans trace). Réponse sans cache. Une zone inconnue ou sans contact donne un fichier vide plutôt qu'une erreur.
 */
const COLONNE = { region: "region_id", prefecture: "prefecture_id", commune: "commune_id", quartier: "neighborhood_id" } as const;

export async function GET(request: Request) {
  const contexte = await obtenirContexteSysteme();
  if (!roleAPermission(contexte.role, "attente.gerer")) {
    return new NextResponse("Introuvable", { status: 404 });
  }
  const url = new URL(request.url);
  const niveau = url.searchParams.get("niveau") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!(niveau in COLONNE) || !estUuid(id)) {
    return new NextResponse("Requête invalide", { status: 400 });
  }
  const colonne = COLONNE[niveau as keyof typeof COLONNE];

  // Export COMPLET : pages jusqu'à la dernière (une liste amputée à 1 000 contacts sans le dire serait pire qu'une erreur).
  const admin = creerClientAdmin();
  const { data, error, tronque } = await lireTout(
    (de, a) => admin.from("zone_alertes").select("contact_type, contact, cree_le, notifie_le").eq(colonne, id).order("cree_le").order("id").range(de, a),
    100000
  );
  if (tronque) return new NextResponse("Export trop volumineux : réduisez la zone ou contactez le support technique.", { status: 413 });
  if (error) return new NextResponse("Erreur serveur", { status: 500 });

  await journaliserActionSysteme(contexte, {
    action: "attente.export",
    cibleType: colonne,
    cibleId: id,
    motif: `${data?.length ?? 0} contact(s) exporté(s)`,
  });

  const csv = construireCsv(
    ["Type", "Contact", "Inscrit le", "Prévenu le"],
    (data ?? []).map((l) => [l.contact_type === "email" ? "E-mail" : "Téléphone", l.contact, l.cree_le.slice(0, 10), l.notifie_le ? l.notifie_le.slice(0, 10) : ""])
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="liste-attente-${niveau}-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
