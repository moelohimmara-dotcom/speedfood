"use client";

import { useActionState, useEffect, useRef } from "react";
import { attribuerPalierAction, type EtatActionPalier } from "@/lib/system-admin/acces-paliers";
import { Alert, Button } from "@/components/ui";

const etatInitial: EtatActionPalier = {};

/**
 * Formulaire d'attribution : personne (par e-mail, recherchée côté serveur comme pour les rôles), actif, palier 0 à 4
 * (le 5 n'est pas proposé et le serveur le refuse), type (relèvement ou accès partiel), expiration facultative. Toute la
 * validation est refaite côté serveur.
 */
export function FormulaireAttributionPalier({
  actifs,
  paliers,
  suggestions,
}: {
  actifs: { code: string; libelle: string }[];
  paliers: { valeur: number; libelle: string }[];
  suggestions: string[];
}) {
  const [etat, action, enCours] = useActionState(attribuerPalierAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes) formRef.current?.reset();
  }, [etat]);

  return (
    <form action={action} ref={formRef} className="ad-paliers-formulaire">
      <div className="field">
        <label htmlFor="palier-email">E-mail de la personne</label>
        <input id="palier-email" name="email" type="email" required placeholder="nom@exemple.com" list="palier-suggestions" />
        <datalist id="palier-suggestions">
          {suggestions.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="palier-actif">Espace (actif)</label>
        <select id="palier-actif" name="actif" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {actifs.map((a) => (
            <option key={a.code} value={a.code}>
              {a.libelle}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="palier-niveau">Palier</label>
        <select id="palier-niveau" name="palier" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {paliers.map((p) => (
            <option key={p.valeur} value={p.valeur}>
              {p.valeur} · {p.libelle}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field ad-paliers-type">
        <legend>Type d&apos;accès</legend>
        <label>
          <input type="radio" name="type" value="plafond" defaultChecked /> Accès partiel : limiter à ce palier au plus
        </label>
        <label>
          <input type="radio" name="type" value="relevement" /> Relèvement : monter jusqu&apos;à ce palier
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor="palier-expiration">Expire après le (facultatif)</label>
        <input id="palier-expiration" name="expiration" type="date" />
      </div>
      <div aria-live="polite">
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      </div>
      <div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Attribuer"}
        </Button>
      </div>
    </form>
  );
}
