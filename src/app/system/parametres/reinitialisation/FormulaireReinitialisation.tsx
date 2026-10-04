"use client";

import { useActionState, useState, useTransition } from "react";
import {
  executerReinitialisationAction,
  preparerReinitialisationAction,
  type EtatExecution,
  type EtatPreparation,
} from "@/lib/system-admin/reinitialisation";
import { PHRASE_REINITIALISATION } from "@/lib/system-admin/reinitialisationRegles";
import { Alert, Button } from "@/components/ui";
import { Panneau } from "@/components/admin/blocs";

const LIBELLES_SUPPRIME: Record<string, string> = {
  restaurants: "Restaurants",
  plats: "Plats",
  commandes: "Commandes",
  profils_clients: "Profils clients",
  abonnements_alertes: "Appareils abonnés aux alertes",
  pages: "Pages d'aide",
  bannieres: "Bannières",
  mises_en_avant: "Mises en avant",
  comptes: "Comptes (restaurateurs, clients, autres rôles)",
};
const LIBELLES_CONSERVE: Record<string, string> = {
  super_administrateurs: "Comptes super administrateur",
  quartiers: "Quartiers",
  categories: "Catégories de plats",
  evenements_audit: "Événements du journal d'audit",
};

const etatInitial: EtatExecution = {};

/** Assistant en deux étapes : calcul de ce qui sera supprimé, puis confirmation renforcée. Rien n'est supprimé avant l'étape 2. */
export function FormulaireReinitialisation() {
  const [prepa, setPrepa] = useState<EtatPreparation | null>(null);
  const [enCours, demarrer] = useTransition();
  const [etat, action, execEnCours] = useActionState(executerReinitialisationAction, etatInitial);

  if (etat.succes) {
    return (
      <Panneau titre="Application réinitialisée">
        <Alert ton="succes">L&apos;application est à l&apos;état neuf. Vous pouvez enregistrer vos vraies données.</Alert>
        <p>
          Sauvegarde complète conservée dans le stockage privé « sauvegardes », dossier <strong>{etat.sauvegarde}</strong>. Elle contient des données personnelles :
          téléchargez-la sur un disque chiffré puis supprimez-la.
        </p>
        {etat.avertissement ? <Alert ton="danger">{etat.avertissement}</Alert> : null}
      </Panneau>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <Panneau titre="Étape 1 · Voir ce qui serait supprimé">
        <p style={{ marginTop: 0 }}>Ce calcul ne supprime rien. Il délivre aussi une autorisation valable 5 minutes pour l&apos;étape 2.</p>
        <Button
          type="button"
          variante="secondary"
          disabled={enCours}
          onClick={() => demarrer(async () => setPrepa(await preparerReinitialisationAction()))}
        >
          {enCours ? "Calcul…" : prepa?.resume ? "Recalculer" : "Calculer"}
        </Button>
        {prepa?.erreur ? <Alert ton="danger">{prepa.erreur}</Alert> : null}
        {prepa?.resume ? (
          <div className="ad-reinit-tableaux">
            <div>
              <h3 className="ad-sous-titre">Sera supprimé</h3>
              <ul className="ad-controle">
                {Object.entries(prepa.resume.supprime).map(([k, v]) => (
                  <li key={k} className="ad-controle-ligne ad-controle-manque">
                    <span className="ad-controle-marque" aria-hidden="true">
                      ✕
                    </span>
                    <span>
                      <strong>{v}</strong> {LIBELLES_SUPPRIME[k] ?? k}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="ad-aide-champ">Les fichiers d&apos;images (photos, logos) sont aussi supprimés.</p>
            </div>
            <div>
              <h3 className="ad-sous-titre">Sera conservé</h3>
              <ul className="ad-controle">
                {Object.entries(prepa.resume.conserve).map(([k, v]) => (
                  <li key={k} className="ad-controle-ligne ad-controle-ok">
                    <span className="ad-controle-marque" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>{v}</strong> {LIBELLES_CONSERVE[k] ?? k}
                    </span>
                  </li>
                ))}
                <li className="ad-controle-ligne ad-controle-ok">
                  <span className="ad-controle-marque" aria-hidden="true">
                    ✓
                  </span>
                  <span>Paramètres de l&apos;application (WhatsApp, délais, textes, carte, connexion Facebook)</span>
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </Panneau>

      {prepa?.jeton ? (
        <Panneau titre="Étape 2 · Confirmer">
          <form action={action} className="ad-reinit-form">
            <input type="hidden" name="jeton" value={prepa.jeton} />
            <Alert ton="danger">
              Une sauvegarde complète est faite automatiquement juste avant. Si elle échoue, rien n&apos;est supprimé. Une fois la suppression faite, elle est
              définitive : seule la sauvegarde permet de retrouver les données.
            </Alert>
            <div className="field">
              <label htmlFor="motif">Pourquoi réinitialiser ? (10 caractères au moins)</label>
              <textarea id="motif" name="motif" rows={3} maxLength={500} required />
            </div>
            <div className="field">
              <label htmlFor="phrase">
                Recopiez exactement : <strong>{PHRASE_REINITIALISATION}</strong>
              </label>
              <input id="phrase" name="phrase" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
            </div>
            <label className="case-parametre">
              <input type="checkbox" name="compris" required />
              J&apos;ai compris que c&apos;est irréversible et que tous les restaurants, commandes et comptes (sauf super administrateur) seront supprimés.
            </label>
            {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
            <Button type="submit" variante="danger" disabled={execEnCours}>
              {execEnCours ? "Sauvegarde puis réinitialisation en cours… ne fermez pas la page" : "Réinitialiser toute l'application"}
            </Button>
          </form>
        </Panneau>
      ) : null}
    </div>
  );
}
