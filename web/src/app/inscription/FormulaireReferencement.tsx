"use client";

import Link from "next/link";
import { useActionState } from "react";
import { envoyerDemandeReferencementAction, type EtatReferencement } from "@/lib/site/referencement-actions";
import { LIBELLES_TYPES, TYPES_ETABLISSEMENT } from "@/lib/site/referencement";
import { Alert, Button, Input } from "@/components/ui";

const etatInitial: EtatReferencement = {};

export function FormulaireReferencement() {
  const [etat, action, enCours] = useActionState(envoyerDemandeReferencementAction, etatInitial);

  if (etat.envoye) {
    return (
      <div className="partenariat-merci" role="status">
        <svg className="partenariat-merci-icone" viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="28" className="v-mangue v-e" />
          <path d="M20 33l9 9 16-19" className="v-trait partenariat-merci-trait" />
        </svg>
        <h3 className="partenariat-merci-titre">Votre demande est bien reçue.</h3>
        <p>Une personne de l&apos;équipe Speedfood vous rappelle sous 48 heures pour parler de votre établissement, vous présenter les conditions et, si vous êtes d&apos;accord, créer votre fiche avec vous.</p>
        <p>
          <Link href="/restaurateurs" className="lien-texte">Revoir comment ça marche</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="partenariat-formulaire">
      <fieldset className="partenariat-formes referencement-types">
        <legend>Vous souhaitez référencer</legend>
        {TYPES_ETABLISSEMENT.map((t, i) => (
          <label key={t} className="partenariat-forme">
            <input type="radio" name="type" value={t} defaultChecked={i === 0} required />
            <span className="partenariat-forme-texte">
              <strong>{LIBELLES_TYPES[t]}</strong>
            </span>
          </label>
        ))}
      </fieldset>

      <Input label="Nom de l'établissement" name="organisation" type="text" required minLength={2} maxLength={120} autoComplete="organization" />

      <fieldset className="referencement-groupe">
        <legend>Où se trouve-t-il ?</legend>
        <Input label="Commune" name="commune" type="text" required minLength={2} maxLength={80} placeholder="Kaloum, Dixinn, Ratoma, Matam…" />
        <Input label="Quartier" name="quartier" type="text" required minLength={2} maxLength={80} />
        <Input label="Indications (facultatif)" name="indications" type="text" maxLength={300} placeholder="Face à la pharmacie, derrière le marché…" />
        <div className="referencement-gps">
          <Input label="Latitude (facultatif)" name="latitude" type="text" inputMode="decimal" placeholder="9.5370" />
          <Input label="Longitude (facultatif)" name="longitude" type="text" inputMode="decimal" placeholder="-13.6785" />
        </div>
        <p className="referencement-aide">Les coordonnées GPS nous aident à vous trouver ; si vous ne les connaissez pas, nous les relèverons lors de la visite.</p>
      </fieldset>

      <fieldset className="referencement-groupe">
        <legend>Ce que vous servez</legend>
        <Input label="Catégories (facultatif)" name="categories" type="text" maxLength={200} placeholder="Grillades, riz, pâtisserie…" />
        <Input label="Spécialités (facultatif)" name="specialites" type="text" maxLength={200} placeholder="Poulet braisé, poisson grillé…" />
      </fieldset>

      <fieldset className="referencement-groupe">
        <legend>Responsable</legend>
        <div className="referencement-gps">
          <Input label="Prénom" name="prenom" type="text" required maxLength={60} autoComplete="given-name" />
          <Input label="Nom" name="nom" type="text" required maxLength={60} autoComplete="family-name" />
        </div>
        <Input label="Adresse e-mail" name="email" type="email" required maxLength={120} autoComplete="email" />
        <Input label="Téléphone (WhatsApp possible)" name="telephone" type="tel" required maxLength={20} autoComplete="tel" placeholder="622 00 00 00" />
      </fieldset>

      {/* Champ piège : invisible pour une personne, rempli par les robots. */}
      <div className="partenariat-piege" aria-hidden="true">
        <label htmlFor="referencement-site-web">Ne pas remplir</label>
        <input id="referencement-site-web" name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="partenariat-consentement">
        <input type="checkbox" name="consentement" required />
        <span>
          J&apos;accepte que Speedfood utilise ces informations pour me rappeler. Elles ne sont ni vendues ni publiées (voir la{" "}
          <Link href="/confidentialite" className="lien-texte">politique de confidentialité</Link>).
        </span>
      </label>

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Envoi…" : "Envoyer ma demande"}
      </Button>
    </form>
  );
}
