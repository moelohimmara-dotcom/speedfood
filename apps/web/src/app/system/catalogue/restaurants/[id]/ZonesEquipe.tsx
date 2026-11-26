"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { SelecteurQuartier } from "@/components/geographie/SelecteurQuartier";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { detailLivraison } from "@/lib/site/livraison";
import { declarerZoneEquipeAction, retirerZoneEquipeAction, type EtatZoneEquipe } from "@/lib/system-admin/restaurants";

const etatInitial: EtatZoneEquipe = {};

export interface ZoneEquipeAffichee {
  id: string;
  libelle: string;
  fraisGnf: number | null;
  delaiMinutes: number | null;
}

/** Zones de livraison déclarées par l'équipe pour un restaurant : ajout, mise à jour par redéclaration, retrait. */
export function ZonesEquipe({ restaurantId, groupes, zones }: { restaurantId: string; groupes: GroupeCommune[]; zones: ZoneEquipeAffichee[] }) {
  const [etat, action, enCours] = useActionState(declarerZoneEquipeAction, etatInitial);
  const [etatRetrait, actionRetrait, retraitEnCours] = useActionState(retirerZoneEquipeAction, etatInitial);

  return (
    <div>
      <h3 className="ad-sous-titre">Zones de livraison déclarées</h3>
      {etatRetrait.erreur ? <Alert ton="danger">{etatRetrait.erreur}</Alert> : null}
      {etatRetrait.succes ? <Alert ton="succes">{etatRetrait.message ?? "Zone retirée."}</Alert> : null}
      {zones.length === 0 ? (
        <p className="ad-aide-champ">Aucune zone déclarée : les clients voient que la livraison n’est pas déclarée (l’option à emporter reste possible).</p>
      ) : (
        <ul className="ad-liste-simple">
          {zones.map((z) => {
            const detail = detailLivraison(z.fraisGnf, z.delaiMinutes);
            return (
              <li key={z.id}>
                <strong>{z.libelle}</strong>
                {detail ? <span> · {detail}</span> : null}{" "}
                <form action={actionRetrait} style={{ display: "inline" }}>
                  <input type="hidden" name="restaurant_id" value={restaurantId} />
                  <input type="hidden" name="id" value={z.id} />
                  <Button type="submit" variante="secondary" disabled={retraitEnCours}>Retirer</Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <form action={action} className="zones-desservies-formulaire" key={etat.rev ?? 0}>
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <p className="zones-desservies-sous-titre">Ajouter ou modifier une zone (redéclarer une zone met à jour ses frais et son délai)</p>
        <SelecteurQuartier nom="zone" groupes={groupes} quartierInitial={null} libelleQuartier="Zone" modeZone />
        <div className="zones-desservies-deux">
          <div className="field">
            <label htmlFor="zone-frais-equipe">Frais de livraison (GNF, facultatif)</label>
            <input id="zone-frais-equipe" name="frais_gnf" type="text" inputMode="numeric" placeholder="10 000" maxLength={9} />
          </div>
          <div className="field">
            <label htmlFor="zone-delai-equipe">Délai habituel (minutes, facultatif)</label>
            <input id="zone-delai-equipe" name="delai_minutes" type="text" inputMode="numeric" placeholder="45" maxLength={3} />
          </div>
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">{etat.message ?? "Zone enregistrée."}</Alert> : null}
        <Button type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer la zone"}</Button>
      </form>
    </div>
  );
}
