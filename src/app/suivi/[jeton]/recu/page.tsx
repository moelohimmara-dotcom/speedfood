import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { origineDuSite } from "@/lib/partage/origine";
import { LIBELLES_MODE, formaterMontantGnf, texteRecuWhatsApp } from "@/lib/paiement/regles";
import { LienRetour } from "@/components/LienRetour";
import { chargerDocumentsParJeton } from "@/lib/paiement/documents";
import { texteDocumentWhatsApp } from "@/lib/paiement/documents-regles";
import { ActionsRecu } from "./ActionsRecu";
import { DocumentEmisCarte } from "./DocumentEmisCarte";
import Link from "next/link";

export const metadata: Metadata = { title: "Reçu de commande", robots: { index: false, follow: false } };

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

/**
 * Reçu numérique d'une commande, accessible par le lien privé de suivi (jamais indexé). Il s'intitule « Reçu de paiement »
 * seulement quand le restaurateur a confirmé avoir reçu le paiement ; sinon c'est un « Récapitulatif de commande ». Ce n'est
 * pas une facture fiscale : le restaurant reste responsable de ses propres pièces comptables. Ni téléphone ni adresse du client.
 */
export default async function RecuPage({
  params,
  searchParams,
}: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { jeton } = await params;
  const { doc: docDemande } = await searchParams;
  const suivi = await chargerSuiviParJeton(jeton);
  if (!suivi) {
    notFound();
  }

  const accepte = suivi.etatDerive === "acceptee" || suivi.etatDerive === "prete" || suivi.etatDerive === "terminee";
  if (!accepte) {
    return (
      <main className="recu">
        <LienRetour href={`/suivi/${jeton}`}>Retour au suivi</LienRetour>
        <h1 className="recu-titre" style={{ marginTop: "var(--space-3)" }}>
          Pas encore de reçu
        </h1>
        <p>Le reçu est disponible une fois la commande acceptée par le restaurant.</p>
      </main>
    );
  }

  // Document numéroté établi par le restaurant : il prime sur le récapitulatif provisoire ci-dessous.
  const documents = await chargerDocumentsParJeton(jeton);
  const emis = (docDemande === "facture" ? documents.facture : documents.recu) ?? documents.recu ?? documents.facture;
  if (emis) {
    const origineDoc = await origineDuSite();
    const lienDoc = `${origineDoc}/suivi/${jeton}/recu${emis.type === "facture" ? "?doc=facture" : ""}`;
    const totalDoc = emis.total;
    const texteDoc = texteDocumentWhatsApp({ type: emis.type, numero: emis.numero, restaurant: emis.emetteur.nom, total: totalDoc, lien: lienDoc });
    const paiementLigne =
      emis.type === "recu" || suivi.paiement.statut === "recu"
        ? `${suivi.paiement.mode === "especes" ? "Espèces encaissées" : "Paiement reçu"}${suivi.paiement.mode && suivi.paiement.mode !== "especes" ? ` · ${LIBELLES_MODE[suivi.paiement.mode]}` : ""}${suivi.paiement.reference ? ` · réf. ${suivi.paiement.reference}` : ""}`
        : null;
    return (
      <main className="recu">
        <LienRetour href={`/suivi/${jeton}`}>Retour au suivi</LienRetour>
        {documents.recu && documents.facture ? (
          <div className="recu-onglets">
            <Link href={`/suivi/${jeton}/recu`} className={`btn ${emis.type === "recu" ? "btn-primary" : "btn-secondary"}`}>
              Reçu
            </Link>
            <Link href={`/suivi/${jeton}/recu?doc=facture`} className={`btn ${emis.type === "facture" ? "btn-primary" : "btn-secondary"}`}>
              Facture
            </Link>
          </div>
        ) : null}
        <DocumentEmisCarte doc={emis} reference={suivi.reference} paiementLigne={paiementLigne} />
        <ActionsRecu lienWhatsApp={`https://wa.me/?text=${encodeURIComponent(texteDoc)}`} lien={lienDoc} />
      </main>
    );
  }

  const total = suivi.sousTotal + suivi.fraisLivraisonEstime;
  const confirme = suivi.paiement.statut === "recu";
  const origine = await origineDuSite();
  const lien = `${origine}/suivi/${jeton}/recu`;
  const texte = texteRecuWhatsApp({ restaurant: suivi.restaurant.nom, reference: suivi.reference, total, statut: suivi.paiement.statut, lien });

  return (
    <main className="recu">
      <LienRetour href={`/suivi/${jeton}`}>Retour au suivi</LienRetour>
      <article className="recu-carte" aria-label={confirme ? "Reçu de paiement" : "Récapitulatif de commande"} style={{ marginTop: "var(--space-3)" }}>
        <div className="recu-entete">
          <div>
            <h1 className="recu-titre">{confirme ? "Reçu de paiement" : "Récapitulatif de commande"}</h1>
            <p style={{ margin: "4px 0 0", color: "var(--secondaire)" }}>{suivi.restaurant.nom}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>{suivi.reference}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>{formaterDate(suivi.creeLe)}</p>
          </div>
        </div>

        <p style={{ margin: "0 0 var(--space-2)", color: "var(--secondaire)", fontSize: "0.9rem" }}>
          {suivi.mode === "livraison" ? "Livraison" : "Retrait sur place"}
        </p>

        {suivi.lignes.map((ligne, i) => (
          <div key={`${ligne.nom}-${i}`} className="recu-ligne">
            <span>
              {ligne.quantite} × {ligne.nom}
              {ligne.options.length > 0 ? (
                <span style={{ display: "block", color: "var(--secondaire)", fontSize: "0.8rem" }}>{ligne.options.map((o) => o.nom).join(", ")}</span>
              ) : null}
            </span>
            <strong style={{ whiteSpace: "nowrap" }}>{formaterMontantGnf(ligne.prix * ligne.quantite)}</strong>
          </div>
        ))}
        <div className="recu-ligne">
          <span>Sous-total</span>
          <span>{formaterMontantGnf(suivi.sousTotal)}</span>
        </div>
        <div className="recu-ligne">
          <span>Frais de livraison</span>
          <span>{formaterMontantGnf(suivi.fraisLivraisonEstime)}</span>
        </div>
        <div className="recu-total">
          <span>Total</span>
          <span>{formaterMontantGnf(total)}</span>
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          {confirme ? (
            <>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {suivi.paiement.mode === "especes" ? "Espèces encaissées par le restaurant" : "Paiement reçu par le restaurant"}
              </p>
              <p style={{ margin: "2px 0 0", color: "var(--secondaire)", fontSize: "0.9rem" }}>
                {suivi.paiement.mode ? LIBELLES_MODE[suivi.paiement.mode] : ""}
                {suivi.paiement.recuLe ? ` · confirmé le ${formaterDate(suivi.paiement.recuLe)}` : ""}
                {suivi.paiement.reference ? ` · réf. ${suivi.paiement.reference}` : ""}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: "var(--secondaire)" }}>
              Paiement non confirmé à ce jour : le règlement se fait directement avec le restaurant.
            </p>
          )}
        </div>

        <p className="recu-mentions">
          Document établi par Speedfood à titre de justificatif de commande. Speedfood ne reçoit ni ne conserve aucun paiement : le règlement est fait
          directement auprès du restaurant, qui confirme sa réception. Ce document n&apos;est pas une facture fiscale.
        </p>
      </article>

      <ActionsRecu lienWhatsApp={`https://wa.me/?text=${encodeURIComponent(texte)}`} lien={lien} />
    </main>
  );
}
