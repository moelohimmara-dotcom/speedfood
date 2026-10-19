import { Alert, Badge, Card } from "@/components/ui";
import { estFinal } from "@/lib/livraison/statuts";
import type { VueLivraison } from "@/lib/livraison/vues";
import { CarteLivraison } from "@/components/livraison/CarteLivraison";

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
    <Card className="u-mt-s4">
      <div className="u-145926cb">
        <strong>Livraison</strong>
        <Badge ton={livraison.statut === "livree" ? "succes" : livraison.statut === "echec" || livraison.statut === "annulee" ? "danger" : "neutre"}>
          {livraison.libelle}
        </Badge>
      </div>
      {livraison.livreurNom && !final ? (
        <p className="u-m-s2-0-0">
          Votre livreur : <strong>{livraison.livreurNom}</strong>
        </p>
      ) : null}
      {!final ? (
        <ol className="commande-livraison-etapes u-mt-s3" aria-label="Avancement de la livraison">
          {etapes.map((nom, i) => (
            <li key={nom} className={i + 1 <= courante ? "fait" : ""} aria-current={i + 1 === courante ? "step" : undefined}>
              {nom}
            </li>
          ))}
        </ol>
      ) : null}
      {livraison.minutesAvantArrivee !== null ? (
        <p className="u-m-s3-0-0">
          Arrivée estimée dans environ <strong>{livraison.minutesAvantArrivee} min</strong>.
        </p>
      ) : null}
      {!final && !propre && (livraison.restaurantPoint || livraison.arriveePoint) ? (
        <CarteLivraison
          restaurant={livraison.restaurantPoint}
          destination={livraison.arriveePoint}
          livreur={livraison.livreurPoint}
          description="Carte de la livraison : le restaurant, votre adresse et la position du livreur."
        />
      ) : null}
      {livraison.code ? (
        <div className="suivi-code-remise">
          <p className="u-m-0">Donnez ce code au livreur quand il vous remet la commande :</p>
          <p className="suivi-code-remise-valeur" aria-label={`Code de remise ${livraison.code.split("").join(" ")}`}>
            {livraison.code}
          </p>
        </div>
      ) : null}
      {livraison.fraisGnf > 0 ? (
        <p className="u-m-s3-0-0-c-secondaire-fs-0-9rem">
          Frais de livraison : {livraison.fraisGnf.toLocaleString("fr-FR")} GNF, à régler directement
          {livraison.distanceKm !== null ? ` · ${livraison.distanceKm.toLocaleString("fr-FR")} km` : ""}.
        </p>
      ) : null}
      {livraison.statut === "echec" ? (
        <Alert ton="danger" className="u-mt-s3">
          La livraison n&apos;a pas pu aboutir. Contactez le restaurant.
        </Alert>
      ) : null}
    </Card>
  );
}
