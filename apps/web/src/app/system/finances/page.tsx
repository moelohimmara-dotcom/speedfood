import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { lireFinances } from "@/lib/system-admin/finances-service";
import { exporterReleveCsv } from "@/lib/system-admin/finances-regles";
import { CarteChiffre, EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { FormulaireFinances, VersementFinances } from "./FormulaireFinances";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Finances (administration)" };
export const dynamic = "force-dynamic";
const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ debut?: string; fin?: string }> }) {
  await exigerPermissionPage("parametres.editer");
  const params = await searchParams;
  const debut = params.debut ? new Date(`${params.debut}T00:00:00`) : undefined;
  const fin = params.fin ? new Date(`${params.fin}T00:00:00`) : undefined;
  let donnees;
  try { donnees = lireFinances(debut && !Number.isNaN(debut.getTime()) ? debut : undefined, fin && !Number.isNaN(fin.getTime()) ? fin : undefined); }
  catch { return <EtatVide titre="Période invalide" texte="Choisissez une date de début antérieure à la date de fin, puis réessayez." />; }
  const total = donnees.lignes.reduce((s, l) => ({ ventes: s.ventes + l.ventesGnf, commission: s.commission + l.commissionGnf, net: s.net + l.netAReverserGnf }), { ventes: 0, commission: 0, net: 0 });
  const csv = exporterReleveCsv(donnees.lignes);
  return <div>
    <PageHeader titre="Relevés et versements" description="Relevé de démonstration en GNF : commission hors livraison, frais de livraison séparés et versement manuel simulé." />
    <p className="ad-aide-champ">Paramètres de développement : {donnees.parametres.tauxDefaut * 100}% par défaut · rythme {donnees.parametres.rythme} · arrondi au franc entier. Aucune API de paiement réelle n&apos;est appelée.</p>
    <FormulaireFinances debut={donnees.debut.toISOString().slice(0, 10)} fin={donnees.fin.toISOString().slice(0, 10)} csv={csv} contrats={donnees.contrats} />
    <div className="ad-cartes" aria-label="Totaux du relevé"><CarteChiffre libelle="Ventes hors livraison" valeur={gnf(total.ventes)} /><CarteChiffre libelle="Commission" valeur={gnf(total.commission)} /><CarteChiffre libelle="Net à reverser" valeur={gnf(total.net)} /></div>
    {donnees.lignes.length === 0 ? <div className="ad-panneau"><EtatVide titre="Aucun relevé sur cette période" texte="Élargissez la période pour afficher les ventes factices disponibles." /></div> : <div className="ad-table-cadre"><table className="ad-table"><caption className="sr-only">Relevé financier par établissement</caption><thead><tr><th>Établissement</th><th>Ventes</th><th>Commission</th><th>Livraison</th><th>Remboursements</th><th>Net à reverser</th><th>Versement</th></tr></thead><tbody>{donnees.lignes.map((l) => <tr key={l.etablissementId}><td className="ad-cellule-principale">{l.etablissementNom}<span className="ad-secondaire u-d-block-fs-0-8rem">Taux {l.tauxCommission * 100}%</span></td><td>{gnf(l.ventesGnf)}</td><td>{gnf(l.commissionGnf)}</td><td>{gnf(l.fraisLivraisonGnf)}</td><td>{gnf(l.remboursementsGnf)}</td><td><strong>{gnf(l.netAReverserGnf)}</strong></td><td>{l.versement.statut === "verse" ? <><Pastille ton="succes">Versé</Pastille><span className="ad-secondaire u-d-block-fs-0-8rem">{l.versement.reference}</span></> : <VersementFinances etablissementId={l.etablissementId} />}</td></tr>)}</tbody></table></div>}
  </div>;
}
