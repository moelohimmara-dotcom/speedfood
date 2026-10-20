"use client";

import { useActionState } from "react";
import { enregistrerReglagesPaiementAction, type EtatActionPaiementAdmin } from "@/lib/system-admin/paiements";
import type { ReglagesAdmin } from "@/lib/paiement/en-ligne/admin-lectures";
import { Alert, Button } from "@/components/ui";
import { Panneau } from "@/components/admin/blocs";

const etatInitial: EtatActionPaiementAdmin = {};

function Aide({ children }: { children: React.ReactNode }) {
  return <p className="ad-aide-champ">{children}</p>;
}

/** Réglages du paiement en ligne. La validation fait foi côté serveur. Tant que « valeurs validées » n'est pas coché, tout reste une simulation. */
export function FormulaireReglagesPaiement({ reglages: r }: { reglages: ReglagesAdmin }) {
  const [etat, action, enCours] = useActionState(enregistrerReglagesPaiementAction, etatInitial);

  return (
    <form action={action} className="ad-formulaire">
      <Panneau titre="Interrupteur et fournisseur">
        <div className="field">
          <label className="case-parametre">
            <input type="checkbox" name="actif" defaultChecked={r.actif} />
            Proposer le paiement en ligne aux clients
          </label>
          <Aide>
            Éteint : personne ne le voit et rien ne s&apos;exécute. Les paiements déjà ouverts continuent d&apos;être traités (notifications, libération, remboursement).
          </Aide>
        </div>
        <div className="field">
          <label htmlFor="pay-fournisseur">Fournisseur</label>
          <select id="pay-fournisseur" name="fournisseur" defaultValue={r.fournisseur}>
            <option value="simulation">Démonstration (aucun argent réel)</option>
            <option value="chapchap">Chap Chap Pay (réel : non livré, ne peut pas être allumé)</option>
          </select>
          <Aide>
            {r.cleSimulationConfiguree
              ? "La clé de la démonstration est configurée sur le serveur."
              : "La clé de la démonstration (PAIEMENT_SIMULATION_CLE) n'est pas configurée sur le serveur : la démonstration ne peut pas être allumée."}
          </Aide>
        </div>
      </Panneau>

      <Panneau titre="Frais">
        <div className="field">
          <label htmlFor="pay-orange">Frais Orange Money (‰)</label>
          <input id="pay-orange" name="fraisOrange" inputMode="numeric" defaultValue={r.fraisMobilePermilleOrange} required />
          <Aide>En pour-mille du total : 15 = 1,5 %. Supportés par Speedfood.</Aide>
        </div>
        <div className="field">
          <label htmlFor="pay-mtn">Frais MTN MoMo (‰)</label>
          <input id="pay-mtn" name="fraisMtn" inputMode="numeric" defaultValue={r.fraisMobilePermilleMtn} required />
        </div>
        <div className="field">
          <label htmlFor="pay-fixe">Frais fixes du paiement mobile (GNF)</label>
          <input id="pay-fixe" name="fraisMobileFixe" inputMode="numeric" defaultValue={r.fraisMobileFixeGnf} required />
          <Aide>S&apos;ajoute au pourcentage ci-dessus. Chap Chap Pay, mesuré en mode test : 200 GNF + 2 % (à confirmer en production).</Aide>
        </div>
        <div className="field">
          <label htmlFor="pay-speedfood">Frais Speedfood par commande (GNF)</label>
          <input id="pay-speedfood" name="fraisSpeedfood" inputMode="numeric" defaultValue={r.fraisSpeedfoodCommandeGnf} required />
          <Aide>Prélevé sur la part du restaurant, jamais plus que le repas.</Aide>
        </div>
        <div className="field">
          <label htmlFor="pay-versement">Frais par versement (GNF)</label>
          <input id="pay-versement" name="fraisVersement" inputMode="numeric" defaultValue={r.fraisVersementGnf} required />
          <Aide>À renseigner quand le prestataire aura communiqué ses frais de transfert. Supportés par Speedfood.</Aide>
        </div>
      </Panneau>

      <Panneau titre="Délais, plafonds et litiges">
        <div className="field">
          <label htmlFor="pay-delai">Délai pour valider le paiement (minutes)</label>
          <input id="pay-delai" name="delai" inputMode="numeric" defaultValue={r.delaiExpirationMinutes} required />
        </div>
        <div className="field">
          <label htmlFor="pay-plafond">Montant maximal d&apos;un paiement (GNF)</label>
          <input id="pay-plafond" name="plafond" inputMode="numeric" defaultValue={r.plafondPaiementGnf} required />
        </div>
        <div className="field">
          <label htmlFor="pay-rembo">Remboursement partiel automatique, plafond (‰ du repas)</label>
          <input id="pay-rembo" name="plafondRemboursement" inputMode="numeric" defaultValue={r.plafondRemboursementAutoPermille} required />
          <Aide>300 = 30 %. Au-delà, un humain décide.</Aide>
        </div>
        <div className="field">
          <label htmlFor="pay-seuil">Seuil de décision humaine (GNF)</label>
          <input id="pay-seuil" name="seuilLitige" inputMode="numeric" defaultValue={r.seuilLitigeHumainGnf} required />
        </div>
      </Panneau>

      <Panneau titre="Validation">
        <div className="field">
          <label className="case-parametre">
            <input type="checkbox" name="valide" defaultChecked={r.valeursValideesLe !== null} />
            Ces valeurs sont les valeurs réelles, validées
          </label>
          <Aide>Décoché : un bandeau « valeurs de simulation » reste affiché sur l&apos;écran des paiements.</Aide>
        </div>
      </Panneau>

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="info">{etat.succes}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
