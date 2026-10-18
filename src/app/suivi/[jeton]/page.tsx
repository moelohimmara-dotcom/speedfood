import { notFound } from "next/navigation";
import type { EtatDeriveCommande, LigneCommandeApercu } from "@/lib/contracts/commande";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { Badge, Card, Alert } from "@/components/ui";
import { LienRetour } from "@/components/LienRetour";
import { libelleMode } from "@/lib/commande/mode";
import { PropositionCarte } from "./PropositionCarte";
import { PanneauPaiement } from "./PanneauPaiement";
import { RafraichissementAuto } from "./RafraichissementAuto";
import { FriseSuivi } from "@/components/site/FriseSuivi";
import { CelebrationCommande } from "@/components/site/CelebrationCommande";
import { BlocLivraisonClient } from "./BlocLivraisonClient";
import { clientLivraison } from "@/lib/livraison/lecture";
import { vueLivraisonPourClient } from "@/lib/livraison/vues";
import { creerClientServeur } from "@/lib/db/server";
import { etatNotationClient } from "@/lib/notation/service";
import { BlocNotation } from "./BlocNotation";
import { BlocTable } from "./BlocTable";
import { vueTableParJeton } from "@/lib/table/service";

/**
 * Suivi public d'une commande par jeton opaque (TDR.md §5, ADR-005).
 *
 * Confidentialité : cette page (et le type `SuiviCommande` qu'elle consomme)
 * n'expose ni le téléphone ni l'adresse du client. Le jeton de suivi n'est
 * jamais journalisé (ADR-005).
 */

const LIBELLES_ETAT: Record<EtatDeriveCommande, string> = {
  en_attente: "En attente du restaurant",
  attente_confirmation_client: "Votre avis est demandé",
  acceptee: "Acceptée, en préparation",
  prete: "Prête",
  terminee: "Terminée",
  refusee: "Refusée par le restaurant",
  annulee: "Annulée",
};

const DESCRIPTIONS_ETAT: Record<EtatDeriveCommande, string> = {
  en_attente:
    "Votre commande a bien été transmise. Elle n'est pas encore confirmée : le restaurant doit l'accepter.",
  attente_confirmation_client:
    "Le restaurant propose une modification (prix, frais ou conditions). Consultez-la ci-dessous : la commande ne sera préparée qu'après votre accord.",
  acceptee: "Le restaurant a accepté votre commande et la prépare. Vous pouvez la régler ci-dessous, directement auprès de lui.",
  prete: "Votre commande est prête. Retirez-la ou attendez la livraison selon le mode choisi.",
  terminee: "Cette commande est terminée. Merci !",
  refusee:
    "Le restaurant ne peut pas honorer cette commande. Aucun montant n'a été encaissé : tout règlement se fait directement avec le restaurant.",
  annulee:
    "Cette commande est annulée. Aucun montant n'a été encaissé : tout règlement se fait directement avec le restaurant.",
};

const TONS_BADGE: Record<EtatDeriveCommande, "succes" | "danger" | "neutre"> = {
  en_attente: "neutre",
  attente_confirmation_client: "neutre",
  acceptee: "succes",
  prete: "succes",
  terminee: "succes",
  refusee: "danger",
  annulee: "danger",
};

function formaterGNF(montant: number) {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function LigneRecap({ ligne }: { ligne: LigneCommandeApercu }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid var(--bordure)",
      }}
    >
      <span>
        {ligne.quantite} × {ligne.nom}
        {ligne.options.length > 0 ? (
          <span style={{ display: "block", color: "var(--secondaire)", fontSize: "0.8rem" }}>
            {ligne.options.map((o) => o.nom).join(", ")}
          </span>
        ) : null}
      </span>
      <strong style={{ whiteSpace: "nowrap" }}>
        {formaterGNF(ligne.prix * ligne.quantite)}
      </strong>
    </div>
  );
}

export async function renderSuiviPage(jeton: string, session = false) {
  const suivi = await chargerSuiviParJeton(jeton);

  if (!suivi) {
    notFound();
  }

  const totalIndicatif = suivi.sousTotal + suivi.fraisLivraisonEstime;

  // Livraison : lue pour CETTE commande (retrouvée par son jeton) ; une panne ne casse jamais le suivi. En répartition, on fait
  // d'abord avancer les offres en attente (expiration, réponse des livreurs simulés).
  let livraison = null;
  if (suivi.mode === "livraison") {
    try {
      const { data: ligne } = await clientLivraison().from("orders").select("id").eq("jeton_suivi", jeton).maybeSingle();
      if (ligne) {
        livraison = await vueLivraisonPourClient(ligne.id as string);
        if (livraison && livraison.mode === "speedfood" && !["livree", "echec", "annulee"].includes(livraison.statut)) {
          const { traiterOffres } = await import("@/lib/livraison/service");
          await traiterOffres();
          livraison = await vueLivraisonPourClient(ligne.id as string);
        }
      }
    } catch {
      livraison = null;
    }
  }

  // Commande sur place : ardoise de la table (table partagée) et numéro d'appel au comptoir. Une panne n'affecte jamais le suivi.
  let tableVue = null;
  let numeroAppel: number | null = null;
  if (suivi.mode === "sur_place") {
    try {
      tableVue = await vueTableParJeton(jeton);
      const { data } = await clientLivraison().from("orders").select("numero_appel").eq("jeton_suivi", jeton).maybeSingle();
      numeroAppel = (data as { numero_appel: number | null } | null)?.numero_appel ?? null;
    } catch {
      tableVue = null;
    }
  }

  // Notation : proposée au propriétaire de la commande (compte connecté) une fois la commande terminée. Une panne n'affecte pas le suivi.
  let notation = null;
  if (suivi.etatDerive === "terminee" && !suivi.estTest) {
    try {
      const {
        data: { user },
      } = await (await creerClientServeur()).auth.getUser();
      if (user) notation = await etatNotationClient(jeton, user.id);
    } catch {
      notation = null;
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>

      <h1 style={{ fontSize: "2rem", margin: "var(--space-3) 0 4px" }}>Suivi de votre commande</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-3)" }}>
        Référence <strong>{suivi.reference}</strong> · passée le {formaterDate(suivi.creeLe)}
      </p>

      {suivi.estTest ? (
        <p className="commande-test-bandeau" role="note">
          <span className="commande-test-pastille">Test</span> Commande de test : elle suit le parcours complet mais n&apos;est comptée dans aucun chiffre et ne concerne aucun vrai client.
        </p>
      ) : null}
      {session ? null : <CelebrationCommande jeton={jeton} />}
      <FriseSuivi etat={suivi.etatDerive} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <Badge ton={TONS_BADGE[suivi.etatDerive]}>{LIBELLES_ETAT[suivi.etatDerive]}</Badge>
            <p style={{ margin: "10px 0 0" }}>{DESCRIPTIONS_ETAT[suivi.etatDerive]}</p>
          </div>
        </div>
      </Card>

      {numeroAppel !== null ? (
        <Card style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Votre numéro d&apos;appel</p>
          <p className="table-numero-appel">{numeroAppel}</p>
          <p style={{ margin: 0 }}>
            {suivi.etatDerive === "prete" ? "Votre commande est prête : présentez ce numéro au comptoir." : "Gardez ce numéro : on l'appelle quand votre commande est prête."}
          </p>
        </Card>
      ) : null}

      {tableVue ? <BlocTable jeton={jeton} vue={tableVue} /> : null}

      {livraison ? <BlocLivraisonClient livraison={livraison} /> : null}

      {notation?.notable ? (
        <BlocNotation jeton={jeton} restaurantNom={notation.restaurantNom} restaurant={notation.restaurant} livreur={notation.livreur} />
      ) : null}

      {suivi.propositionActive ? (
        <PropositionCarte
          jeton={session ? undefined : jeton}
          session={session}
          proposition={suivi.propositionActive}
          sousTotalInitial={suivi.sousTotal}
          fraisInitial={suivi.fraisLivraisonEstime}
        />
      ) : null}

      <PanneauPaiement jeton={session ? undefined : jeton} session={session} paiement={suivi.paiement} total={totalIndicatif} restaurant={suivi.restaurant.nom} />

      <Card style={{ marginTop: "var(--space-4)" }}>
        <p style={{ marginTop: 0, fontWeight: 700 }}>{suivi.restaurant.nom}</p>
        <p style={{ margin: "0 0 4px", color: "var(--secondaire)", fontSize: "0.85rem" }}>
          {suivi.restaurant.horaires}
        </p>
        {suivi.restaurant.consignes ? (
          <p style={{ margin: "0 0 10px", color: "var(--secondaire)", fontSize: "0.85rem" }}>
            {suivi.restaurant.consignes}
          </p>
        ) : null}
        <Badge ton={suivi.restaurant.ouvert ? "succes" : "neutre"}>
          {suivi.restaurant.ouvert ? "Ouvert actuellement" : "Fermé actuellement"}
        </Badge>

        <div style={{ marginTop: "var(--space-3)" }}>
          {suivi.lignes.map((ligne, index) => (
            <LigneRecap key={`${ligne.nom}-${index}`} ligne={ligne} />
          ))}
        </div>

        <div style={{ marginTop: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Sous-total</span>
            <span>{formaterGNF(suivi.sousTotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Frais de livraison</span>
            <span>
              {suivi.mode === "livraison"
                ? `${formaterGNF(suivi.fraisLivraisonEstime)} (à confirmer avec le restaurant)`
                : formaterGNF(suivi.fraisLivraisonEstime)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total indicatif</span>
            <span>{formaterGNF(totalIndicatif)}</span>
          </div>
          <p style={{ margin: "8px 0 0", color: "var(--secondaire)", fontSize: "0.85rem" }}>
            {suivi.mode === "livraison" ? "Livraison demandée" : libelleMode(suivi.mode, suivi.tableNumero)} · montants
            indicatifs : aucun paiement n&apos;est encaissé par Speedfood et aucun frais de livraison
            n&apos;est calculé automatiquement.
          </p>
        </div>
      </Card>

      {suivi.historiqueStatuts.length > 0 ? (
        <Card style={{ marginTop: "var(--space-4)" }}>
          <p style={{ marginTop: 0, fontWeight: 700 }}>Historique</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--secondaire)" }}>
            {suivi.historiqueStatuts.map((evenement, index) => (
              <li key={`${evenement.horodatage}-${index}`}>
                {LIBELLES_ETAT[evenement.statutSuivant] ?? evenement.statutSuivant} ·{" "}
                {formaterDate(evenement.horodatage)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {suivi.etatDerive !== "en_attente" && suivi.etatDerive !== "refusee" && suivi.etatDerive !== "annulee" && suivi.paiement.statut !== "recu" ? (
        <p style={{ marginTop: "var(--space-3)" }}>
          <a href={session ? "/suivi/recu" : `/suivi/${jeton}/recu`} className="lien-texte">
            Voir le récapitulatif imprimable de ma commande
          </a>
        </p>
      ) : null}

      <Alert ton="info" style={{ marginTop: "var(--space-4)" }}>
        Conservez ce lien : c&apos;est la clé de suivi de votre commande. Ne le partagez pas.
      </Alert>

      <RafraichissementAuto intervalleSecondes={livraison && livraison.statut !== "livree" && livraison.statut !== "echec" && livraison.statut !== "annulee" ? 6 : 20} />
    </main>
  );
}

export default async function SuiviPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return renderSuiviPage(jeton);
}
