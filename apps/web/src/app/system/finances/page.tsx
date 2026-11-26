import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { lireFinances } from "@/lib/system-admin/finances-service";
import { exporterReleveCsv } from "@/lib/system-admin/finances-regles";
import { CarteChiffre, EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { FormulaireFinances } from "./FormulaireFinances";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Finances (administration)" };
export const dynamic = "force-dynamic";
const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ debut?: string; fin?: string }> }) {
  await exigerPermissionPage("parametres.editer");
  const params = await searchParams;
  const debut = params.debut ? new Date(`${params.debut}T00:00:00`) : undefined;
  // La date « Au » choisie est incluse entièrement : la borne haute est le lendemain à minuit.
  const fin = params.fin ? new Date(new Date(`${params.fin}T00:00:00`).getTime() + 86_400_000) : undefined;
  let donnees;
  try { donnees = await lireFinances(debut && !Number.isNaN(debut.getTime()) ? debut : undefined, fin && !Number.isNaN(fin.getTime()) ? fin : undefined); }
  catch { return <EtatVide titre="Relevé illisible" texte="La période est invalide ou les finances n'ont pas pu être lues. Choisissez une date de début antérieure à la date de fin, puis réessayez." />; }
  const total = donnees.lignes.reduce((s, l) => ({ ventes: s.ventes + l.ventesGnf, commission: s.commission + l.commissionGnf, net: s.net + l.netAReverserGnf }), { ventes: 0, commission: 0, net: 0 });
  const csv = exporterReleveCsv(donnees.lignes);
  const p = donnees.parametres;
  return <div>
    <PageHeader titre="Relevés et versements" description="Relevé réel en GNF : les paiements en ligne libérés de la période, par restaurant. La commission est celle déjà prélevée à l'ouverture de chaque paiement." />
    <p className="ad-aide-champ">Commission en vigueur : {gnf(p.fraisFixeGnf)} par commande + {(p.tauxDefaut * 100).toFixed(1).replace(".", ",")} % du repas, réduction du palier excellent de {p.reductionExcellentPermille} ‰ · fournisseur {p.fournisseur} · paiement en ligne {p.actif ? "actif" : "éteint"}. Réglages dans <Link href="/system/parametres/paiement" className="lien-texte">Paramètres, Paiement</Link> ; versements et litiges dans <Link href="/system/paiements" className="lien-texte">Paiements</Link>.</p>
    <FormulaireFinances debut={donnees.debut.toISOString().slice(0, 10)} fin={new Date(donnees.fin.getTime() - 86_400_000).toISOString().slice(0, 10)} csv={csv} />
    <div className="ad-cartes" aria-label="Totaux du relevé"><CarteChiffre libelle="Ventes hors livraison" valeur={gnf(total.ventes)} /><CarteChiffre libelle="Commission" valeur={gnf(total.commission)} /><CarteChiffre libelle="Net à reverser" valeur={gnf(total.net)} /></div>
    {donnees.lignes.length === 0 ? <div className="ad-panneau"><EtatVide titre="Aucun paiement libéré sur cette période" texte="Élargissez la période, ou vérifiez dans Paiements si des paiements sont encore en attente de libération." /></div> : <div className="ad-table-cadre"><table className="ad-table"><caption className="sr-only">Relevé financier par établissement</caption><thead><tr><th>Établissement</th><th>Ventes</th><th>Commission</th><th>Livraison</th><th>Remboursements</th><th>Net à reverser</th><th>Versement</th></tr></thead><tbody>{donnees.lignes.map((l) => <tr key={l.etablissementId}><td className="ad-cellule-principale">{l.etablissementNom}<span className="ad-secondaire u-d-block-fs-0-8rem">Taux effectif {(l.tauxCommission * 100).toFixed(1).replace(".", ",")} % · {l.paiements} paiement{l.paiements > 1 ? "s" : ""} libéré{l.paiements > 1 ? "s" : ""}</span></td><td>{gnf(l.ventesGnf)}</td><td>{gnf(l.commissionGnf)}</td><td>{gnf(l.fraisLivraisonGnf)}</td><td>{gnf(l.remboursementsGnf)}</td><td><strong>{gnf(l.netAReverserGnf)}</strong></td><td>{l.versement.statut === "verse" ? <Pastille ton="succes">Versé</Pastille> : l.versement.statut === "partiel" ? <Pastille ton="attention">Partiellement versé</Pastille> : <Pastille ton="neutre">À verser</Pastille>}</td></tr>)}</tbody></table></div>}
  </div>;
}
