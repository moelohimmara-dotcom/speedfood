import type { Metadata } from "next";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerIncidentsAdmin } from "@/lib/system-admin/incidents-service";
import { libellesIncident } from "@/lib/system-admin/incidents-regles";
import { Alert } from "@/components/ui";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { ActionsIncident } from "./ActionsIncident";
import { NouveauIncident } from "./NouveauIncident";
export const metadata: Metadata = { title: "Incidents de livraison (administration)" };
export const dynamic = "force-dynamic";
const date = (v: string) => new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
export default async function IncidentsLivraisonPage() { await exigerPermissionPage("commande.support"); const incidents = await listerIncidentsAdmin(); return <div><PageHeader titre="Incidents de livraison" description="Retards, colis perdus et litiges suivis jusqu&apos;à leur résolution. Les remboursements restent manuels et passent par le module de paiement existant." /><NouveauIncident /><Alert ton="info" className="u-mb-s4">Tout incident doit avoir un motif. Une résolution ou clôture exige une suite donnée et son motif ; aucune compensation financière n&apos;est déclenchée automatiquement.</Alert>{incidents.length === 0 ? <div className="ad-panneau"><EtatVide icone="commandes" titre="Aucun incident" texte="Les incidents créés par l'équipe apparaîtront ici." /></div> : <div className="ad-table-cadre"><table className="ad-table"><caption className="sr-only">Incidents de livraison</caption><thead><tr><th>Commande</th><th>Type</th><th>Gravité</th><th>Statut</th><th>Motif</th><th>Créé le</th><th>Suite et audit</th></tr></thead><tbody>{incidents.map((i) => <tr key={i.id}><td className="ad-cellule-principale">{i.commandeReference}</td><td>{libellesIncident[i.type]}</td><td>{libellesIncident[i.gravite]}</td><td>{libellesIncident[i.statut]}</td><td>{i.motif}</td><td>{date(i.creeLe)}</td><td><ActionsIncident id={i.id} statut={i.statut} />{i.resolution ? <span className="ad-secondaire">{libellesIncident[i.resolution]} : {i.resolutionMotif}</span> : null}</td></tr>)}</tbody></table></div>}</div>; }
