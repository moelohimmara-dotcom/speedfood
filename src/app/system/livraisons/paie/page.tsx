import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { lireRelevePaieLivreurs } from "@/lib/system-admin/paie-livreurs-service";
import { BAREME_PAIE_DEVELOPPEMENT } from "@/lib/system-admin/paie-livreurs-regles";
import { Alert } from "@/components/ui";
import { CarteChiffre, EtatVide, PageHeader } from "@/components/admin/blocs";
import { ActionsPaieLivreur } from "./ActionsPaieLivreur";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paie des livreurs (administration)" };
export const dynamic = "force-dynamic";

function dateSaisie(value: string | undefined, secours: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return secours;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? secours : d;
}
function montant(n: number) { return `${n.toLocaleString("fr-FR")} GNF`; }

export default async function PaieLivreursPage({ searchParams }: { searchParams: Promise<{ debut?: string; fin?: string; livreur?: string }> }) {
  const contexte = await exigerPermissionPage("commande.support");
  const params = await searchParams;
  const maintenant = new Date();
  const debut = dateSaisie(params.debut, new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1)));
  const fin = dateSaisie(params.fin, maintenant);
  const finValide = debut < fin;
  const releve = finValide ? await lireRelevePaieLivreurs(debut, fin, params.livreur) : { lignes: [], livreurs: [] };
  const total = releve.lignes.reduce((s, l) => s + l.totalGnf, 0);
  const courses = releve.lignes.reduce((s, l) => s + l.nombreCourses, 0);
  return <div>
    <PageHeader titre="Paie des livreurs" description="Relevé des courses livrées et gains calculés. Les montants sont factices en développement ; aucun paiement réel n&apos;est déclenché ici." />
    <Alert ton="info" className="u-mb-s4">Barème de développement : {montant(BAREME_PAIE_DEVELOPPEMENT.forfaitParCourseGnf)} par course + {montant(BAREME_PAIE_DEVELOPPEMENT.partVariableParKmGnf)} par km (plafond {BAREME_PAIE_DEVELOPPEMENT.kilometrageMaximumPrisEnCompte} km). Le barème se modifie dans <code>paie-livreurs-regles.ts</code>.</Alert>
    <form method="get" className="ad-panneau u-mb-s4"><div className="grille-formulaire"><label>Du <input type="date" name="debut" defaultValue={params.debut} required /></label><label>Au <input type="date" name="fin" defaultValue={params.fin} required /></label><label>Livreur <select name="livreur" defaultValue={params.livreur ?? ""}><option value="">Tous les livreurs</option>{releve.livreurs.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}</select></label><button type="submit" className="bouton bouton-secondaire">Filtrer</button></div></form>
    {!finValide ? <Alert ton="danger" className="u-mb-s4">La date de début doit être antérieure à la date de fin. Corrigez la période puis relancez le relevé.</Alert> : null}
    <div className="ad-cartes livreurs-compteurs"><CarteChiffre libelle="Courses livrées" valeur={courses} sous="Dans la période sélectionnée" /><CarteChiffre libelle="Gains calculés" valeur={montant(total)} sous="Barème de développement" ton={total > 0 ? "succes" : "neutre"} /><CarteChiffre libelle="Livreurs concernés" valeur={releve.lignes.length} sous="Avec au moins une course" /></div>
    {finValide && releve.lignes.length === 0 ? <div className="ad-panneau"><EtatVide icone="commandes" titre="Aucun gain sur cette période" texte="Choisissez une autre période ou un autre livreur. Seules les courses au statut livrée sont prises en compte." /></div> : null}
    {releve.lignes.length > 0 ? <div className="ad-table-cadre"><table className="ad-table"><caption className="sr-only">Relevé de paie des livreurs</caption><thead><tr><th>Livreur</th><th>Courses</th><th>Forfait</th><th>Variable kilométrique</th><th>Total</th><th>Versement</th></tr></thead><tbody>{releve.lignes.map((l) => <tr key={l.livreurId}><td className="ad-cellule-principale">{l.livreurNom}</td><td>{l.nombreCourses}</td><td>{montant(l.forfaitGnf)}</td><td>{montant(l.variableGnf)}</td><td className="u-ws-nowrap"><strong>{montant(l.totalGnf)}</strong></td><td>{l.versementId && l.versementEtat !== "confirme" ? <ActionsPaieLivreur versementId={l.versementId} montant={l.totalGnf} /> : l.versementEtat === "confirme" ? "Versé" : <span className="ad-secondaire">Aucun versement financier associé : procédure externe requise.</span>}</td></tr>)}</tbody></table></div> : null}
    <p className="ad-secondaire">Connecté comme {contexte.role}. La confirmation d&apos;un versement reste une action du site, réservée à l&apos;opérateur habilité, et est journalisée.</p>
  </div>;
}
