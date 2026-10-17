"use client";

import { useActionState, useRef } from "react";
import {
  modifierReglagesLivraisonAction,
  type EtatActionLivraison,
  type ReglagesLivraisonAffiches,
} from "@/lib/system-admin/livraison";
import { calculerFraisLivraison } from "@/lib/livraison/frais";
import { Panneau } from "@/components/admin/blocs";
import { BarreEnregistrement, useSuiviModifications } from "@/components/admin/BarreEnregistrement";

const etatInitial: EtatActionLivraison = {};

function Aide({ children }: { children: React.ReactNode }) {
  return <p className="ad-aide-champ">{children}</p>;
}

/** Exemples chiffrés avec les réglages ENREGISTRÉS : ce que paierait un client à 1, 3 et 6 km, pour une commande de 40 000 GNF. */
function Exemples({ reglages }: { reglages: ReglagesLivraisonAffiches["reglages"] }) {
  const lignes = [1, 3, 6].map((km) => {
    const r = calculerFraisLivraison(km, 40000, reglages);
    return { km, texte: r.ok ? `${r.fraisGnf.toLocaleString("fr-FR")} GNF` : "refusée (hors rayon)" };
  });
  return (
    <ul className="livraison-exemples">
      {lignes.map((l) => (
        <li key={l.km}>
          {l.km} km : <strong>{l.texte}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Réglages de livraison : frais au kilomètre, minimum, gratuité, rayon, durée de l'offre aux livreurs. La validation fait foi côté serveur. */
export function FormulaireLivraison({ valeurs }: { valeurs: ReglagesLivraisonAffiches }) {
  const [etat, action, enCours] = useActionState(modifierReglagesLivraisonAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);
  const { modifie, mesurer, annuler } = useSuiviModifications(formulaire, Boolean(etat.succes));
  const r = valeurs.reglages;

  return (
    <form ref={formulaire} action={action} className="ad-formulaire" onInput={mesurer} onChange={mesurer}>
      <Panneau titre="Calcul des frais">
        <div className="field">
          <label className="case-parametre">
            <input type="checkbox" name="frais_actifs" defaultChecked={valeurs.fraisActifs} />
            Calculer automatiquement les frais de livraison
          </label>
          <Aide>
            Tant que c&apos;est décoché, la livraison reste comme avant : frais à convenir avec le restaurant (0 GNF dans la commande). Cochez
            quand les montants ci-dessous vous conviennent. Les frais sont calculés par le serveur d&apos;après la distance entre le restaurant et
            le quartier (ou la position) du client.
          </Aide>
        </div>
        <div className="field">
          <label htmlFor="liv-base">Frais de départ (GNF)</label>
          <input id="liv-base" name="base_gnf" inputMode="numeric" defaultValue={r.baseGnf} required />
        </div>
        <div className="field">
          <label htmlFor="liv-km">Prix du kilomètre (GNF)</label>
          <input id="liv-km" name="prix_km_gnf" inputMode="numeric" defaultValue={r.prixKmGnf} required />
        </div>
        <div className="field">
          <label htmlFor="liv-min">Minimum facturé (GNF)</label>
          <input id="liv-min" name="minimum_gnf" inputMode="numeric" defaultValue={r.minimumGnf} required />
          <Aide>Formule : le plus grand de « minimum » et « départ + prix du km × distance », arrondi au multiple supérieur ci-dessous.</Aide>
        </div>
        <div className="field">
          <label htmlFor="liv-arrondi">Arrondi (GNF)</label>
          <input id="liv-arrondi" name="arrondi_gnf" inputMode="numeric" defaultValue={r.arrondiGnf} required />
        </div>
        <div className="field">
          <label htmlFor="liv-gratuit">Livraison offerte à partir de (GNF, laisser vide pour jamais)</label>
          <input id="liv-gratuit" name="gratuit_des_gnf" inputMode="numeric" defaultValue={r.gratuitDesGnf ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="liv-rayon">Rayon maximal (km)</label>
          <input id="liv-rayon" name="rayon_max_km" inputMode="decimal" defaultValue={r.rayonMaxKm} required />
          <Aide>Au-delà, le client est averti que son adresse est trop éloignée et ne peut pas commander en livraison.</Aide>
        </div>
        <p className="ad-aide-champ">Avec les réglages enregistrés, pour une commande de 40 000 GNF :</p>
        <Exemples reglages={r} />
      </Panneau>

      <Panneau titre="Livreurs">
        <div className="field">
          <label htmlFor="liv-vitesse">Vitesse moyenne en ville (km/h)</label>
          <input id="liv-vitesse" name="vitesse_moyenne_kmh" inputMode="numeric" defaultValue={valeurs.vitesseMoyenneKmh} required />
          <Aide>Sert à estimer la durée du trajet affichée au client.</Aide>
        </div>
        <div className="field">
          <label htmlFor="liv-offre">Temps laissé à un livreur pour accepter une course (secondes)</label>
          <input id="liv-offre" name="delai_offre_secondes" inputMode="numeric" defaultValue={valeurs.delaiOffreSecondes} required />
          <Aide>Utilisé par la répartition des courses (prochaine étape de la livraison).</Aide>
        </div>
      </Panneau>

      <BarreEnregistrement modifie={modifie} enCours={enCours} etat={etat} onAnnuler={annuler} messageSucces="Réglages de livraison enregistrés" />
    </form>
  );
}
