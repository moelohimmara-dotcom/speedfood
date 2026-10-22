"use client";

import { useActionState } from "react";
import { annoncerMiseAJourAction, type EtatAnnonceVersion } from "@/lib/system-admin/annonce-version";

const etatInitial: EtatAnnonceVersion = {};

/** Bouton d'annonce de la version courante aux applications installées. Le contrôle d'accès et la règle « une seule fois par version » sont côté serveur. */
export function AnnonceVersion({ version, dejaAnnoncee }: { version: string; dejaAnnoncee: boolean }) {
  const [etat, action, enCours] = useActionState(annoncerMiseAJourAction, etatInitial);
  return (
    <form action={action} className="mj-interrupteur">
      <button type="submit" className="btn btn-primary" disabled={enCours || dejaAnnoncee} aria-label={`Annoncer la version ${version} aux applications installées`}>
        {enCours ? "Envoi…" : dejaAnnoncee ? "Déjà annoncée" : `Annoncer la version ${version}`}
      </button>
      <p className="mj-retour" role="status" aria-live="polite">
        {etat.erreur ?? etat.succes ?? ""}
      </p>
    </form>
  );
}
