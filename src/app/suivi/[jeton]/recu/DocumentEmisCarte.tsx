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
    <article className="recu-carte" aria-label={`${titreDocument(doc.type)} ${doc.numero}`} style={{ marginTop: "var(--space-3)" }}>
      <div className="recu-entete">
        <div>
          <h1 className="recu-titre">{titreDocument(doc.type)}</h1>
          <p style={{ margin: "4px 0 0", fontWeight: 700 }}>{emetteur.nom}</p>
          <div className="recu-emetteur">
            {emetteur.adresse ? <span>{emetteur.adresse}</span> : null}
            {emetteur.telephone ? <span>Tél. {emetteur.telephone}</span> : null}
            {emetteur.nif ? <span>NIF {emetteur.nif}</span> : null}
            {emetteur.rccm ? <span>RCCM {emetteur.rccm}</span> : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>N° {doc.numero}</strong>
          <p style={{ margin: "4px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>{formaterDate(doc.emisLe)}</p>
          <p style={{ margin: "2px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>Commande {reference}</p>
        </div>
      </div>

      {doc.clientNom ? (
        <p style={{ margin: "0 0 var(--space-2)", color: "var(--secondaire)", fontSize: "0.9rem" }}>Client : {doc.clientNom}</p>
      ) : null}

      {doc.lignes.map((ligne, i) => (
        <div key={`${ligne.nom}-${i}`} className="recu-ligne">
          <span>
            {ligne.quantite} × {ligne.nom}
            {ligne.options.length > 0 ? <span style={{ display: "block", color: "var(--secondaire)", fontSize: "0.8rem" }}>{ligne.options.join(", ")}</span> : null}
          </span>
          <strong style={{ whiteSpace: "nowrap" }}>{formaterMontantGnf(ligne.prix * ligne.quantite)}</strong>
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

      {paiementLigne ? <p style={{ margin: "var(--space-3) 0 0", fontWeight: 700 }}>{paiementLigne}</p> : null}
      {emetteur.mention ? <p style={{ margin: "var(--space-3) 0 0" }}>{emetteur.mention}</p> : null}
      <p className="recu-mentions">{mentionRegime(doc.regime)}</p>
    </article>
  );
}
