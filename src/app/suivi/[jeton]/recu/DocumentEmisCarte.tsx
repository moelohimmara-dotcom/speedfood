import type { DocumentEmis } from "@/lib/paiement/documents";
import { mentionRegime, titreDocument } from "@/lib/paiement/documents-regles";
import { formaterMontantGnf } from "@/lib/paiement/regles";

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

/**
 * Document numéroté établi par le restaurant (reçu ou facture), tel qu'il a été figé à l'émission : l'émetteur, les lignes et les totaux
 * ne dépendent plus du profil ni du menu actuels. Ni téléphone ni adresse du client ; le nom du client n'apparaît que sur une facture.
 */
export function DocumentEmisCarte({ doc, reference, paiementLigne }: { doc: DocumentEmis; reference: string; paiementLigne: string | null }) {
  const { emetteur } = doc;
  return (
    <article className="recu-carte u-mt-s3" aria-label={`${titreDocument(doc.type)} ${doc.numero}`}>
      <div className="recu-entete">
        <div>
          <h1 className="recu-titre">{titreDocument(doc.type)}</h1>
          <p className="u-m-4px-0-0-fw-700">{emetteur.nom}</p>
          <div className="recu-emetteur">
            {emetteur.adresse ? <span>{emetteur.adresse}</span> : null}
            {emetteur.telephone ? <span>Tél. {emetteur.telephone}</span> : null}
            {emetteur.nif ? <span>NIF {emetteur.nif}</span> : null}
            {emetteur.rccm ? <span>RCCM {emetteur.rccm}</span> : null}
          </div>
        </div>
        <div className="u-ta-right">
          <strong>N° {doc.numero}</strong>
          <p className="u-m-4px-0-0-c-secondaire-fs-0-85rem">{formaterDate(doc.emisLe)}</p>
          <p className="u-m-2px-0-0-c-secondaire-fs-0-85rem">Commande {reference}</p>
        </div>
      </div>

      {doc.clientNom ? (
        <p className="u-m-0-0-s2-c-secondaire-fs-0-9rem">Client : {doc.clientNom}</p>
      ) : null}

      {doc.lignes.map((ligne, i) => (
        <div key={`${ligne.nom}-${i}`} className="recu-ligne">
          <span>
            {ligne.quantite} × {ligne.nom}
            {ligne.options.length > 0 ? <span className="u-d-block-c-secondaire-fs-0-8rem">{ligne.options.join(", ")}</span> : null}
          </span>
          <strong className="u-ws-nowrap">{formaterMontantGnf(ligne.prix * ligne.quantite)}</strong>
        </div>
      ))}
      <div className="recu-ligne">
        <span>Sous-total</span>
        <span>{formaterMontantGnf(doc.sousTotal)}</span>
      </div>
      <div className="recu-ligne">
        <span>Frais de livraison</span>
        <span>{formaterMontantGnf(doc.fraisLivraison)}</span>
      </div>
      <div className="recu-total">
        <span>Total</span>
        <span>{formaterMontantGnf(doc.total)}</span>
      </div>
      {doc.tvaMontant != null && doc.tvaTaux ? (
        <p className="recu-fiscal-note">
          Dont TVA {doc.tvaTaux} % incluse : {formaterMontantGnf(doc.tvaMontant)}
        </p>
      ) : null}

      {paiementLigne ? <p className="u-m-s3-0-0-fw-700">{paiementLigne}</p> : null}
      {emetteur.mention ? <p className="u-m-s3-0-0">{emetteur.mention}</p> : null}
      <p className="recu-mentions">{mentionRegime(doc.regime)}</p>
    </article>
  );
}
