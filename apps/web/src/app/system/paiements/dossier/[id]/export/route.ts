import { chargerContexteSysteme } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { estUuid } from "@/lib/commande/commun";
import { lireDossier } from "@/lib/paiement/en-ligne/remboursement-lecture";
import { dossierEnMarkdown } from "@/lib/paiement/en-ligne/remboursement-dossier";

/**
 * Export Markdown du dossier d'un remboursement. Généré CÔTÉ SERVEUR à partir de `DossierDonnees` (aucune coordonnée du client, aucun texte
 * libre du personnel ou des livreurs). Réservé à `commande.support` (comme la page) ; sans droit : 404, pour ne rien révéler.
 */
export async function GET(_requete: Request, contexte: { params: Promise<{ id: string }> }) {
  const systeme = await chargerContexteSysteme();
  if (!systeme || !roleAPermission(systeme.role, "commande.support")) return new Response(null, { status: 404 });
  const { id } = await contexte.params;
  if (!estUuid(id)) return new Response(null, { status: 404 });
  const { dossier } = await lireDossier(id);
  if (!dossier) return new Response(null, { status: 404 });
  const nom = `dossier-remboursement-${dossier.commande.reference.replace(/[^A-Za-z0-9-]/g, "")}.md`;
  return new Response(dossierEnMarkdown(dossier), {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${nom}"`,
      "cache-control": "no-store",
    },
  });
}
