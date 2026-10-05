import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { formaterMontantGnf } from "@/lib/paiement/regles";
import { titreDocument, type RegimeDocument, type TypeDocument } from "@/lib/paiement/documents-regles";
import { EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { FormulaireIdentite } from "./FormulaireIdentite";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reçus et factures" };

function formaterDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

/**
 * « Reçus et factures » : l'identité qui figure sur les documents (non fiscaux par défaut) et la liste des derniers documents établis.
 * Un reçu est établi automatiquement quand le restaurateur confirme un paiement ; une facture s'établit à la demande depuis la commande.
 * Les documents sont numérotés sans trou (R-2026-0001, F-2026-0001) et figés une fois émis.
 */
export default async function DocumentsPage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/documents");
  const id = membership.restaurant_id;
  const [{ data: identite }, { data: documents }] = await Promise.all([
    supabase.from("restaurant_identite_documents").select("*").eq("restaurant_id", id).maybeSingle(),
    supabase
      .from("documents_commande")
      .select("id, order_id, type, numero, emis_le, total, regime")
      .eq("restaurant_id", id)
      .order("emis_le", { ascending: false })
      .limit(30),
  ]);

  const orderIds = [...new Set((documents ?? []).map((d) => d.order_id))];
  const { data: commandes } = orderIds.length
    ? await supabase.from("orders").select("id, reference, jeton_suivi").in("id", orderIds)
    : { data: [] as { id: string; reference: string; jeton_suivi: string }[] };
  const parCommande = new Map((commandes ?? []).map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader titre="Reçus et factures" description="Des documents numériques que le client reçoit sur WhatsApp ou par lien. Non fiscaux par défaut." />

      <div className="doc-colonnes">
        <Panneau titre="Mon identité sur les documents">
          <FormulaireIdentite
            valeurs={{
              raisonSociale: identite?.raison_sociale ?? "",
              adresse: identite?.adresse ?? "",
              telephone: identite?.telephone ?? "",
              nif: identite?.nif ?? "",
              rccm: identite?.rccm ?? "",
              regime: (identite?.regime === "fiscal_declare" ? "fiscal_declare" : "non_fiscal") as RegimeDocument,
              tvaTaux: identite?.tva_taux != null ? String(identite.tva_taux) : "",
              mention: identite?.mention ?? "",
            }}
          />
        </Panneau>

        <Panneau titre="Derniers documents établis" compteur={documents?.length ?? 0}>
          {!documents || documents.length === 0 ? (
            <EtatVide icone="commandes" titre="Aucun document pour l'instant" texte="Le reçu s'établit quand vous confirmez un paiement ; la facture, depuis la carte d'une commande acceptée." />
          ) : (
            <ul className="doc-liste">
              {documents.map((d) => {
                const commande = parCommande.get(d.order_id);
                const type = d.type as TypeDocument;
                const lien = commande ? `/suivi/${commande.jeton_suivi}/recu${type === "facture" ? "?doc=facture" : ""}` : null;
                return (
                  <li key={d.id} className="doc-ligne">
                    <div>
                      <strong>{d.numero}</strong>
                      <span className="doc-ligne-detail">
                        {titreDocument(type)} · commande {commande?.reference ?? ""} · {formaterDate(d.emis_le)}
                      </span>
                    </div>
                    <div className="doc-ligne-droite">
                      <span>{formaterMontantGnf(d.total)}</span>
                      <Pastille ton={d.regime === "fiscal_declare" ? "attention" : "neutre"}>{d.regime === "fiscal_declare" ? "Fiscal déclaré" : "Non fiscal"}</Pastille>
                      {lien ? (
                        <a href={lien} className="lien-texte" target="_blank" rel="noopener noreferrer">
                          Ouvrir
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panneau>
      </div>
    </div>
  );
}
