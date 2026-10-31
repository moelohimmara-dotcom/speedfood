"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { envoyerDemandePartenariatAction, type EtatPartenariat } from "@/lib/site/partenariat-actions";
import { FORMES_PARTENARIAT, LIBELLES_FORMES, type FormePartenariat } from "@/lib/site/partenariat";
import { SymbolePartenariat } from "@/components/site/SymbolePartenariat";
import { Alert, Button, Input } from "@/components/ui";

const etatInitial: EtatPartenariat = {};

const AIDE_FORMES: Record<FormePartenariat, string> = {
  investir: "Capital, prêt, accompagnement financier.",
  soutenir: "Mécénat, formation, équipement pour les restaurateurs.",
  moyens: "Réseau, paiement mobile, logistique, matériel.",
  contribuer: "Compétences, traduction, données, développement.",
};

export function FormulairePartenariat({ formeInitiale }: { formeInitiale: FormePartenariat | null }) {
  const [etat, action, enCours] = useActionState(envoyerDemandePartenariatAction, etatInitial);
  const [forme, setForme] = useState<FormePartenariat>(formeInitiale ?? "investir");

  if (etat.envoye) {
    return (
      <div className="partenariat-merci" role="status">
        <svg className="partenariat-merci-icone" viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="28" className="v-mangue v-e" />
          <path d="M20 33l9 9 16-19" className="v-trait partenariat-merci-trait" />
        </svg>
        <h3 className="partenariat-merci-titre">Merci, votre proposition est bien reçue.</h3>
        <p>Une personne de l&apos;équipe Speedfood vous répondra à l&apos;adresse ou au numéro indiqué. Aucune réponse n&apos;est automatique : nous lisons chaque demande.</p>
        <p>
          <Link href="/a-propos" className="lien-texte">Relire notre mission</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="partenariat-formulaire">
      <fieldset className="partenariat-formes">
        <legend>Comment souhaitez-vous nous rejoindre ?</legend>
        {FORMES_PARTENARIAT.map((f) => (
          <label key={f} className={`partenariat-forme partenariat-forme-${f}${forme === f ? " est-choisie" : ""}`}>
            <input type="radio" name="forme" value={f} checked={forme === f} onChange={() => setForme(f)} />
            <SymbolePartenariat forme={f} />
            <span className="partenariat-forme-texte">
              <strong>{LIBELLES_FORMES[f]}</strong>
              <small>{AIDE_FORMES[f]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <Input label="Organisation (ou votre nom si vous agissez seul(e))" name="organisation" type="text" required minLength={2} maxLength={120} autoComplete="organization" />
      <Input label="Personne à contacter" name="nom_contact" type="text" required minLength={2} maxLength={120} autoComplete="name" />
      <Input label="E-mail ou téléphone (WhatsApp possible)" name="contact" type="text" required maxLength={120} autoComplete="email" />
      <div className="field">
        <label htmlFor="partenariat-message">Votre proposition</label>
        <textarea id="partenariat-message" name="message" rows={5} required minLength={20} maxLength={1500} placeholder="Qui vous êtes, ce que vous proposez, ce que vous attendez de Speedfood." />
      </div>

      {/* Champ piège : invisible pour une personne, rempli par les robots. */}
      <div className="partenariat-piege" aria-hidden="true">
        <label htmlFor="partenariat-site-web">Ne pas remplir</label>
        <input id="partenariat-site-web" name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="partenariat-consentement">
        <input type="checkbox" name="consentement" required />
        <span>
          J&apos;accepte que Speedfood utilise ces informations pour me répondre. Elles ne sont ni vendues ni publiées (voir la{" "}
          <Link href="/confidentialite" className="lien-texte">politique de confidentialité</Link>).
        </span>
      </label>

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Envoi…" : "Envoyer ma proposition"}
      </Button>
    </form>
  );
}
