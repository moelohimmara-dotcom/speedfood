import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { origineDuSite } from "@/lib/partage/origine";
import { LIBELLES_SOURCE, SOURCES_SCAN, type SourceScan } from "@/lib/partage/scans";
import { EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import { BoutonImprimer } from "./BoutonImprimer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Affiche et QR code" };

function jourIlYA(jours: number): string {
  return new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);
}

/**
 * « Affiche et QR code » : le lien court du restaurant, une affiche A4 prête à imprimer (QR code qui mène à la commande) et le nombre
 * de scans par source sur 30 jours. Le QR de l'affiche porte la source « affiche » : on voit ainsi ce qui amène des clients.
 * Aucune donnée personnelle n'est comptée : seulement un total par jour et par source (`restaurant_scans`).
 */
export default async function AffichePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/affiche");
  const id = membership.restaurant_id;
  const [{ data: restaurant }, { data: scans }] = await Promise.all([
    supabase.from("restaurants").select("nom, code_court, publie").eq("id", id).maybeSingle(),
    supabase.from("restaurant_scans").select("jour, source, nb").eq("restaurant_id", id).gte("jour", jourIlYA(29)),
  ]);
  if (!restaurant) {
    return null;
  }
  if (!restaurant.publie) {
    return (
      <div>
        <PageHeader titre="Affiche et QR code" />
        <EtatVide icone="boutique" titre="Disponible après publication" texte="Votre lien court, votre QR code et votre affiche s'activent dès que l'équipe Speedfood a validé votre page." />
      </div>
    );
  }

  const origine = await origineDuSite();
  const lien = `${origine.replace(/^https?:\/\//, "")}/r/${restaurant.code_court}`;
  const sept = jourIlYA(6);
  const totaux = new Map<SourceScan, { sept: number; trente: number }>();
  for (const l of scans ?? []) {
    const source = (SOURCES_SCAN as readonly string[]).includes(l.source) ? (l.source as SourceScan) : "lien";
    const t = totaux.get(source) ?? { sept: 0, trente: 0 };
    t.trente += l.nb;
    if (l.jour >= sept) t.sept += l.nb;
    totaux.set(source, t);
  }
  const lignes = [...totaux.entries()].sort((a, b) => b[1].trente - a[1].trente);
  const total30 = lignes.reduce((n, [, t]) => n + t.trente, 0);
  const total7 = lignes.reduce((n, [, t]) => n + t.sept, 0);

  return (
    <div className="affiche-page">
      <PageHeader titre="Affiche et QR code" description="Faites venir vos clients sur votre page : ils scannent, regardent votre menu et commandent." actions={<BoutonImprimer />} />

      <div className="affiche-grille">
        <div className="affiche-zone">
          <div className="affiche-a4" aria-label="Aperçu de l'affiche">
            <p className="affiche-marque">Speedfood</p>
            <h2 className="affiche-nom">{restaurant.nom}</h2>
            <p className="affiche-accroche">Scannez pour voir le menu et commander</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par notre propre route. */}
            <img src={`/restaurants/${id}/qr?s=affiche`} alt={`QR code de ${restaurant.nom}`} className="affiche-qr" width={360} height={360} />
            <p className="affiche-lien">{lien}</p>
            <p className="affiche-pied">Commande directe auprès du restaurant. Paiement en espèces ou par code marchand, au restaurant.</p>
          </div>
        </div>

        <div className="affiche-cote">
          <Panneau titre="Mon lien court">
            <p style={{ margin: "0 0 var(--space-2)" }}>
              <strong className="affiche-lien-court">{lien}</strong>
            </p>
            <p className="ad-aide-champ" style={{ margin: 0 }}>
              À mettre dans votre bio, vos statuts WhatsApp et sur vos cartes. Ajoutez <code>?s=whatsapp</code> à la fin pour suivre ce qui vient de WhatsApp
              (ou <code>?s=carte</code> pour une carte de visite).
            </p>
            <p style={{ margin: "var(--space-3) 0 0" }}>
              <a href={`/restaurants/${id}/qr?s=qr&telecharger=1`} className="btn btn-secondary">
                Télécharger le QR code (SVG)
              </a>
            </p>
          </Panneau>

          <Panneau titre="Visites sur 30 jours">
            {lignes.length === 0 ? (
              <p className="ad-aide-champ" style={{ margin: 0 }}>
                Aucune visite pour l&apos;instant. Imprimez l&apos;affiche et partagez votre lien : les scans apparaîtront ici.
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 var(--space-2)" }}>
                  <strong>{total30}</strong> visite{total30 > 1 ? "s" : ""} en 30 jours, dont <strong>{total7}</strong> cette semaine.
                </p>
                <table className="affiche-table">
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">7 jours</th>
                      <th scope="col">30 jours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map(([source, t]) => (
                      <tr key={source}>
                        <th scope="row">{LIBELLES_SOURCE[source]}</th>
                        <td>{t.sept}</td>
                        <td>{t.trente}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="ad-aide-champ" style={{ margin: "var(--space-2) 0 0" }}>
                  Chaque ouverture du lien compte une visite : une même personne peut être comptée plusieurs fois.
                </p>
              </>
            )}
          </Panneau>
        </div>
      </div>
    </div>
  );
}
