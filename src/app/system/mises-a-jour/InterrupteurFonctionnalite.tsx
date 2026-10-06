"use client";

import { useActionState } from "react";
import { basculerFonctionnaliteAction, type EtatActionFonctionnalite } from "@/lib/system-admin/fonctionnalites";

const etatInitial: EtatActionFonctionnalite = {};

/** Bouton d'activation / de coupure d'une fonctionnalité. La décision et le contrôle d'accès sont côté serveur ; ce composant n'affiche que le résultat. */
export function InterrupteurFonctionnalite({ cle, active, libelle }: { cle: string; active: boolean; libelle: string }) {
  const [etat, action, enCours] = useActionState(basculerFonctionnaliteAction, etatInitial);
  return (
    <form action={action} className="mj-interrupteur">
      <input type="hidden" name="cle" value={cle} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button type="submit" className={active ? "btn btn-secondaire" : "btn btn-primaire"} disabled={enCours} aria-label={`${active ? "Couper" : "Réactiver"} : ${libelle}`}>
        {enCours ? "…" : active ? "Couper" : "Réactiver"}
      </button>
      <p className="mj-retour" role="status" aria-live="polite">
        {etat.erreur ?? etat.succes ?? ""}
      </p>
    </form>
  );
}
