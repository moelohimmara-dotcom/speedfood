"use client";

import { useActionState, useEffect, useRef } from "react";
import { declarerZoneDesserviePAction, retirerZoneDesserviePAction, type EtatZoneDesservie } from "@/lib/restaurant/zones-desservies";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { detailLivraison } from "@/lib/site/livraison";
import { SelecteurQuartier } from "@/components/geographie/SelecteurQuartier";
import { Alert, Button, Card } from "@/components/ui";

const etatInitial: EtatZoneDesservie = {};

export interface ZoneDesserviePourFormulaire {
  id: string;
  libelle: string;
  fraisGnf: number | null;
  delaiMinutes: number | null;
}

/**
 * Zones où le restaurant livre. Sans zone, le restaurant ne déclare aucune livraison : les clients voient « livraison non
 * déclarée » et le retrait reste possible. Frais et délai sont facultatifs et ne s'affichent que s'ils sont renseignés.
 * Le choix de la zone suit la même cascade que le quartier (région, préfecture, commune, puis « Toute la commune » ou un quartier).
 */
export function FormulaireZonesDesservies({ groupes, zones }: { groupes: GroupeCommune[]; zones: ZoneDesserviePourFormulaire[] }) {
  const [etat, action, enCours] = useActionState(declarerZoneDesserviePAction, etatInitial);
  const [etatRetrait, actionRetrait, retraitEnCours] = useActionState(retirerZoneDesserviePAction, etatInitial);
  const titre = useRef<HTMLHeadingElement>(null);

  // Après un retrait, la ligne (et son bouton) disparaît : le focus revient sur le titre de la carte, au lieu de se perdre.
  useEffect(() => {
    if (etatRetrait.rev) titre.current?.focus();
  }, [etatRetrait.rev]);

  return (
    <Card>
      <h2 className="profil-bloc-titre" ref={titre} tabIndex={-1}>
        Zones de livraison
      </h2>
      <p className="aide-champ">
        Indiquez où vous livrez. Vos clients voient « Livre à … » seulement pour les zones que vous déclarez, et votre quartier ci-dessus reste
        l&apos;endroit où se trouve votre restaurant. Les frais et le délai sont facultatifs : laissez-les vides si vous ne voulez pas les afficher.
      </p>

      {/* Région live toujours présente : elle survit à la suppression de la ligne retirée. */}
      <div role="status" aria-live="polite" className="sr-only">
        {etatRetrait.message ?? ""}
      </div>
      {etatRetrait.erreur ? <Alert ton="danger">{etatRetrait.erreur}</Alert> : null}

      {zones.length > 0 ? (
        <ul className="zones-desservies-liste">
          {zones.map((z) => {
            const detail = detailLivraison(z.fraisGnf, z.delaiMinutes);
            return (
              <li key={z.id} className="zones-desservies-ligne">
                <span>
                  <strong>{z.libelle}</strong>
                  {detail ? (
                    <span className="zones-desservies-detail">
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only"> : </span>
                      {detail}
                    </span>
                  ) : null}
                </span>
                <form action={actionRetrait}>
                  <input type="hidden" name="id" value={z.id} />
                  <Button type="submit" variante="secondary" disabled={retraitEnCours}>
                    Retirer<span className="sr-only"> {z.libelle}</span>
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="aide-champ">Aucune zone déclarée pour l&apos;instant : vos clients voient que la livraison n&apos;est pas déclarée.</p>
      )}

      <form action={action} className="zones-desservies-formulaire" key={etat.rev ?? 0}>
        <p className="zones-desservies-sous-titre">Ajouter ou modifier une zone (redéclarer une zone met à jour ses frais et son délai)</p>
        <SelecteurQuartier nom="zone" groupes={groupes} quartierInitial={null} libelleQuartier="Zone" modeZone />
        <div className="zones-desservies-deux">
          <div className="field">
            <label htmlFor="zone-frais">Frais de livraison (GNF, facultatif)</label>
            <input id="zone-frais" name="frais_gnf" type="text" inputMode="numeric" pattern="[0-9 ]*" placeholder="10 000" maxLength={9} />
          </div>
          <div className="field">
            <label htmlFor="zone-delai">Délai habituel (minutes, facultatif)</label>
            <input id="zone-delai" name="delai_minutes" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="45" maxLength={3} />
          </div>
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">{etat.message ?? "Zone enregistrée."}</Alert> : null}
        <div className="zones-desservies-action">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer la zone"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
