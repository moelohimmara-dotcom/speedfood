import { Alert, Badge, Card } from "@/components/ui";
import { estFinal } from "@/lib/livraison/statuts";
import type { VueLivraison } from "@/lib/livraison/vues";

const ETAPES = ["Livreur trouvé", "Vers le restaurant", "Commande récupérée", "En route vers vous", "Livrée"];
const ETAPES_PROPRE = ["Prête à partir", "En route vers vous", "Livrée"];

/**
 * Livraison vue par le client : où en est la course, qui livre, et le CODE à donner au livreur à la porte. Le code n'est montré
 * que pendant la livraison ; il prouve la remise.
 */
export function BlocLivraisonClient({ livraison }: { livraison: VueLivraison & { code: string | null } }) {
  const final = estFinal(livraison.statut);
  const propre = livraison.mode === "propre";
  const etapes = propre ? ETAPES_PROPRE : ETAPES;
  // Étape courante dans la liste affichée (le mode « propre » n'a que trois étapes).
  const courante = propre
    ? livraison.statut === "livree"
      ? 3
      : livraison.statut === "vers_client"
        ? 2
        : livraison.statut === "assignee"
          ? 1
          : 0
    : livraison.etape;

  return (
    <Card style={{ marginTop: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Livraison</strong>
        <Badge ton={livraison.statut === "livree" ? "succes" : livraison.statut === "echec" || livraison.statut === "annulee" ? "danger" : "neutre"}>
          {livraison.libelle}
        </Badge>
      </div>
      {livraison.livreurNom && !final ? (
        <p style={{ margin: "var(--space-2) 0 0" }}>
          Votre livreur : <strong>{livraison.livreurNom}</strong>
        </p>
      ) : null}
      {!final ? (
        <ol className="commande-livraison-etapes" aria-label="Avancement de la livraison" style={{ marginTop: "var(--space-3)" }}>
          {etapes.map((nom, i) => (
            <li key={nom} className={i + 1 <= courante ? "fait" : ""} aria-current={i + 1 === courante ? "step" : undefined}>
              {nom}
            </li>
          ))}
        </ol>
      ) : null}
      {livraison.code ? (
        <div className="suivi-code-remise">
          <p style={{ margin: 0 }}>Donnez ce code au livreur quand il vous remet la commande :</p>
          <p className="suivi-code-remise-valeur" aria-label={`Code de remise ${livraison.code.split("").join(" ")}`}>
            {livraison.code}
          </p>
        </div>
      ) : null}
      {livraison.fraisGnf > 0 ? (
        <p style={{ margin: "var(--space-3) 0 0", color: "var(--secondaire)", fontSize: "0.9rem" }}>
          Frais de livraison : {livraison.fraisGnf.toLocaleString("fr-FR")} GNF, à régler directement
          {livraison.distanceKm !== null ? ` · ${livraison.distanceKm.toLocaleString("fr-FR")} km` : ""}.
        </p>
      ) : null}
      {livraison.statut === "echec" ? (
        <Alert ton="danger" style={{ marginTop: "var(--space-3)" }}>
          La livraison n&apos;a pas pu aboutir. Contactez le restaurant.
        </Alert>
      ) : null}
    </Card>
  );
}
