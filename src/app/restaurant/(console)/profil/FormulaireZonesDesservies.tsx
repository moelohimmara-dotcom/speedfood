"use client";

import { useActionState } from "react";
import { declarerZoneDesserviePAction, retirerZoneDesserviePAction, type EtatZoneDesservie } from "@/lib/restaurant/zones-desservies";
import type { GroupeCommune } from "@/lib/geographie/quartiers";
import { detailLivraison } from "@/lib/site/livraison";
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
 */
export function FormulaireZonesDesservies({ groupes, zones }: { groupes: GroupeCommune[]; zones: ZoneDesserviePourFormulaire[] }) {
  const [etat, action, enCours] = useActionState(declarerZoneDesserviePAction, etatInitial);

  return (
    <Card>
      <h2 className="profil-bloc-titre">Zones de livraison</h2>
      <p className="aide-champ">
        Indiquez où vous livrez. Vos clients voient « Livre chez vous » seulement pour les zones que vous déclarez. Les frais et le
        délai sont facultatifs : laissez-les vides si vous ne voulez pas les afficher.
      </p>

      {zones.length > 0 ? (
        <ul className="zones-desservies-liste">
          {zones.map((z) => {
            const detail = detailLivraison(z.fraisGnf, z.delaiMinutes);
            return (
              <li key={z.id} className="zones-desservies-ligne">
                <span>
                  <strong>{z.libelle}</strong>
                  {detail ? <span className="zones-desservies-detail"> · {detail}</span> : null}
                </span>
                <form action={retirerZoneDesserviePAction}>
                  <input type="hidden" name="id" value={z.id} />
                  <Button type="submit" variante="secondary">
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

      <form action={action} className="zones-desservies-formulaire">
        <div className="field">
          <label htmlFor="zone-desservie">Ajouter ou modifier une zone</label>
          <select id="zone-desservie" name="zone" defaultValue="" required>
            <option value="" disabled>
              Choisir une commune ou un quartier
            </option>
            {groupes.map((g) => (
              <optgroup key={g.communeId} label={g.communeNom}>
                <option value={`c:${g.communeId}`}>Toute la commune de {g.communeNom}</option>
                {g.quartiers.map((q) => (
                  <option key={q.id} value={`q:${q.id}`}>
                    {q.nom}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="zones-desservies-deux">
          <div className="field">
            <label htmlFor="zone-frais">Frais de livraison (GNF, facultatif)</label>
            <input id="zone-frais" name="frais_gnf" type="text" inputMode="numeric" placeholder="10000" maxLength={9} />
          </div>
          <div className="field">
            <label htmlFor="zone-delai">Délai habituel (minutes, facultatif)</label>
            <input id="zone-delai" name="delai_minutes" type="text" inputMode="numeric" placeholder="45" maxLength={3} />
          </div>
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">Zone enregistrée.</Alert> : null}
        <div className="selecteur-quartier-action">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer la zone"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
