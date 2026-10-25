import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerPaiementsAdmin, lireReglagesAdmin } from "@/lib/paiement/en-ligne/admin-lectures";
import { formaterMontantGnf } from "@/lib/paiement/regles";
import { Alert } from "@/components/ui";
import { CarteChiffre, EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../SousNav";
import { formaterDateCourte } from "../formatage";
import { ActionsPaiement } from "./ActionsPaiement";
import { LIBELLE_MOYEN, type MoyenRemboursement } from "@/lib/paiement/en-ligne/remboursement-manuel";
import { VersementManuel } from "./VersementManuel";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paiements en ligne (administration)" };
export const dynamic = "force-dynamic";

const LIBELLES_ETAT: Record<string, string> = {
  cree: "Créé",
  en_attente: "En attente du client",
  confirme: "Payé, à libérer",
  libere: "Libéré",
  echoue: "Échoué",
  expire: "Expiré",
  annule: "Annulé",
  rembourse: "Remboursé",
  en_litige: "En litige",
};
const LIBELLES_VERSEMENT: Record<string, string> = { a_verser: "À verser", envoye: "Envoyé", confirme: "Versé", echoue: "Échoué" };
const LIBELLES_ERREUR: Record<string, string> = {
  compte_absent: "compte de versement absent",
  compte_non_verifie: "compte non vérifié",
  refuse_par_le_prestataire: "refusé par le prestataire",
  reseau: "prestataire injoignable",
  non_configuree: "prestataire non configuré",
  non_implemente: "prestataire non branché",
  versement_manuel_requis: "versement manuel : à faire depuis le compte du prestataire",
};

function tonEtat(etat: string): "neutre" | "danger" | "succes" | "attention" {
  if (etat === "libere" || etat === "confirme") return "succes";
  if (etat === "echoue" || etat === "en_litige") return "danger";
  if (etat === "en_attente" || etat === "cree") return "attention";
  return "neutre";
}

/** Paiements en ligne (Speedfood encaisse puis verse). Permission `commande.support`. Réglages et comptes : `/system/parametres/paiement`. */
export default async function PaiementsAdminPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const [paiements, reglages] = await Promise.all([listerPaiementsAdmin(), lireReglagesAdmin()]);
  const versementsATraiter = paiements.flatMap((p) => p.versements).filter((v) => v.etat === "a_verser" || v.etat === "echoue").length;
  const litigesAHumain = paiements.flatMap((p) => p.litiges).filter((l) => l.etat === "a_humain").length;
  const enAttente = paiements.filter((p) => p.etat === "en_attente").length;

  return (
    <div>
      <PageHeader titre="Paiements en ligne" description="Paiements encaissés via le prestataire, versements au restaurant et au livreur, litiges confiés à l'exploitation." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      {reglages.actif ? (
        <Alert ton="info" className="u-mb-s4">
          Paiement en ligne <strong>allumé</strong>, fournisseur : {reglages.fournisseur === "simulation" ? "démonstration (aucun argent réel)" : "Chap Chap Pay"}.
        </Alert>
      ) : (
        <Alert ton="info" className="u-mb-s4">
          Paiement en ligne <strong>éteint</strong> : les clients ne le voient pas. <Link href="/system/parametres/paiement" className="lien-texte">Réglages du paiement en ligne</Link>
        </Alert>
      )}
      {reglages.valeursValideesLe === null ? (
        <Alert ton="info" className="u-mb-s4">
          Les frais, délais et plafonds affichés sont des <strong>valeurs de simulation</strong> : elles n&apos;ont pas été validées.
        </Alert>
      ) : null}

      <div className="ad-cartes livreurs-compteurs">
        <CarteChiffre libelle="En attente du client" valeur={enAttente} sous="Paiement ouvert, pas encore validé" />
        <CarteChiffre libelle="Versements à traiter" valeur={versementsATraiter} sous="À verser ou échoués" ton={versementsATraiter > 0 ? "danger" : "neutre"} />
        <CarteChiffre libelle="Litiges à décider" valeur={litigesAHumain} sous="Confiés à l'exploitation" ton={litigesAHumain > 0 ? "danger" : "neutre"} />
      </div>

      {paiements.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide icone="commandes" titre="Aucun paiement en ligne" texte="Un paiement apparaît ici quand un client choisit de payer en ligne sur sa page de suivi." />
        </div>
      ) : (
        <div className="ad-table-cadre">
          <table className="ad-table">
            <caption className="sr-only">Paiements en ligne</caption>
            <thead>
              <tr>
                <th scope="col">Commande</th>
                <th scope="col">État</th>
                <th scope="col">Montants</th>
                <th scope="col">Versements</th>
                <th scope="col">Litige</th>
                <th scope="col">Créé le</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => {
                const litige = p.litiges.find((l) => l.etat === "a_humain") ?? null;
                return (
                  <tr key={p.id}>
                    <td className="ad-cellule-principale" data-label="Commande">
                      {p.commandeReference}
                      <span className="ad-secondaire u-d-block-fs-0-8rem">{p.restaurantNom}</span>
                    </td>
                    <td data-label="État">
                      <Pastille ton={tonEtat(p.etat)}>{LIBELLES_ETAT[p.etat] ?? p.etat}</Pastille>
                      <span className="ad-secondaire u-d-block-fs-0-8rem">
                        {p.operateur === "orange_money" ? "Orange Money" : "MTN MoMo"}
                        {p.fournisseur === "simulation" ? " · démonstration" : ""}
                      </span>
                    </td>
                    <td className="u-ws-nowrap" data-label="Montants">
                      {formaterMontantGnf(p.totalGnf)}
                      <span className="ad-secondaire u-d-block-fs-0-8rem">
                        Restaurant {formaterMontantGnf(p.restaurantGnf)}
                        {p.livreurGnf > 0 ? ` · livreur ${formaterMontantGnf(p.livreurGnf)}` : ""}
                      </span>
                      <span className="ad-secondaire u-d-block-fs-0-8rem">
                        Speedfood {formaterMontantGnf(p.speedfoodBrutGnf)} − frais {formaterMontantGnf(p.fraisMobileGnf)}
                      </span>
                    </td>
                    <td data-label="Versements">
                      {p.versements.length === 0 ? (
                        "—"
                      ) : (
                        p.versements.map((v) => (
                          <span key={v.id} className="u-d-block-fs-0-8rem">
                            {v.beneficiaire === "restaurant" ? "Restaurant" : "Livreur"} : {LIBELLES_VERSEMENT[v.etat]} ({formaterMontantGnf(v.montantGnf)})
                            {v.erreurCode ? ` · ${LIBELLES_ERREUR[v.erreurCode] ?? v.erreurCode}` : ""}
                          </span>
                        ))
                      )}
                    </td>
                    <td data-label="Litige">
                      {p.remboursementManuel ? (
                        <span className="u-d-block-fs-0-8rem">
                          Remboursé à la main : {LIBELLE_MOYEN[p.remboursementManuel.moyen as MoyenRemboursement] ?? p.remboursementManuel.moyen}
                          {p.remboursementManuel.reference ? ` · réf. ${p.remboursementManuel.reference}` : ""}
                        </span>
                      ) : null}
                      {p.litiges.length === 0 ? (
                        p.remboursementManuel ? null : "—"
                      ) : (
                        p.litiges.map((l) => (
                          <span key={l.id} className="u-d-block-fs-0-8rem">
                            {l.situation.replaceAll("_", " ")} · {l.etat === "a_humain" ? "à décider" : l.etat === "clos" ? "clos" : l.etat}
                            {l.regle ? ` (${l.regle.replaceAll("_", " ")})` : ""}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="ad-secondaire u-ws-nowrap" data-label="Créé le">
                      {formaterDateCourte(p.creeLe)}
                    </td>
                    <td data-label="Actions">
                      {contexte.role === "super_admin"
                        ? p.versements
                            .filter((v) => (v.etat === "a_verser" || v.etat === "echoue") && p.etat === "libere")
                            .map((v) => <VersementManuel key={v.id} versementId={v.id} beneficiaire={v.beneficiaire} montantLibelle={formaterMontantGnf(v.montantGnf)} />)
                        : null}
                      <ActionsPaiement
                        paiementId={p.id}
                        etat={p.etat}
                        versementsEnAttente={p.versements.some((v) => v.etat === "a_verser" || v.etat === "echoue")}
                        litigeAHumain={litige?.id ?? null}
                        peutEspeces={contexte.role === "super_admin"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
