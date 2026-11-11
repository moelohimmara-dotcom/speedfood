import { notFound } from "next/navigation";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission, sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { lireDossier } from "@/lib/paiement/en-ligne/remboursement-lecture";
import { AVIS_NON_JURIDIQUE, NOTE_DONNEES_EXCLUES, dossierEnSections, montantTexte } from "@/lib/paiement/en-ligne/remboursement-dossier";
import { estUuid } from "@/lib/commande/commun";
import { Alert } from "@/components/ui";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { LienRetour } from "@/components/LienRetour";
import { SousNav } from "../../../SousNav";
import { FormulaireDecision } from "./FormulaireDecision";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dossier de remboursement (administration)" };
export const dynamic = "force-dynamic";

/**
 * Dossier d'un litige de remboursement, lisible en un écran : situation, mode de paiement d'origine, preuves existantes, ce que la règle
 * automatique conclurait (à titre indicatif), décisions humaines et historique, remboursement exécuté ou non. Lecture : `commande.support`.
 * Enregistrer une décision : `parametres.editer` (super administrateur). Le même texte est exporté en Markdown (route voisine `export`).
 * L'identifiant est celui d'un paiement en ligne, ou d'une commande payée par code marchand.
 */
export default async function DossierRemboursementPage({ params }: { params: Promise<{ id: string }> }) {
  const contexte = await exigerPermissionPage("commande.support");
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { dossier, decisionsDisponibles } = await lireDossier(id);
  if (!dossier) notFound();

  const peutDecider = roleAPermission(contexte.role, "parametres.editer");
  const sections = dossierEnSections(dossier);
  const decisionEnVigueur = dossier.decisions.find((d) => !d.remplacee) ?? null;

  return (
    <div>
      <LienRetour href="/system/paiements">Paiements en ligne</LienRetour>
      <PageHeader titre={`Dossier de remboursement ${dossier.commande.reference}`} description="Tout ce que le système sait de ce litige, sur une page. À transmettre tel quel au conseil juridique." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      <Alert ton="info" className="u-mb-s4">
        {AVIS_NON_JURIDIQUE} {NOTE_DONNEES_EXCLUES}
      </Alert>
      <p className="u-mb-s4">
        <a className="lien-texte" href={`/system/paiements/dossier/${id}/export`} download>
          Exporter le dossier (Markdown)
        </a>
      </p>

      {!decisionsDisponibles ? (
        <Alert ton="danger" className="u-mb-s4">
          Les décisions de remboursement ne sont pas encore disponibles : la base de données n&apos;a pas reçu la mise à jour correspondante. Le reste du dossier est lisible.
        </Alert>
      ) : null}

      <div className="dossier-remb-sections">
        {sections.map((s) => (
          <Panneau key={s.id} titre={s.titre}>
            {s.avertissement ? (
              <Alert ton="danger" className="u-mb-s2">
                <strong>Attention :</strong> {s.avertissement}
              </Alert>
            ) : null}
            <ul className="dossier-remb-liste">
              {s.lignes.map((ligne, i) => (
                <li key={`${s.id}-${i}`}>{ligne}</li>
              ))}
            </ul>
            {s.id === "decisions" && decisionsDisponibles ? (
              peutDecider ? (
                <FormulaireDecision
                  identifiant={id}
                  modeOrigine={dossier.modeOrigine}
                  especesAutorise={dossier.especesAutorise}
                  totalLibelle={montantTexte(dossier.commande.totalGnf)}
                  remplaceUneDecision={decisionEnVigueur !== null}
                />
              ) : (
                <p className="ad-secondaire">Seul le super administrateur peut enregistrer une décision.</p>
              )
            ) : null}
          </Panneau>
        ))}
      </div>
    </div>
  );
}
