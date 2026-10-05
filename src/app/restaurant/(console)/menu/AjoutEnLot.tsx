"use client";

import { useActionState, useState } from "react";
import { creerPlatsEnLotAction, type EtatAjoutEnLot } from "@/lib/menu/actions";
import { Alert, Button } from "@/components/ui";
import { lirePlatsEnLot, PLATS_MAX_PAR_LISTE } from "@/lib/menu/saisieRapide";
import { formaterPrixGnf } from "@/lib/menu/ouverture";

const etatInitial: EtatAjoutEnLot = {};
const EXEMPLE = "Riz sauce feuille 25000\nPoulet braisé - 40 000 GNF\nJus d'orange 5k";

/**
 * « Ajouter plusieurs plats d'un coup » : le restaurateur colle une liste (copiée de WhatsApp, d'un carnet ou d'un
 * tableur), voit tout de suite ce qui sera créé, puis valide. Les plats sont créés sans photo ni description : ils se
 * complètent ensuite un par un. Le serveur relit le texte avec les mêmes règles : l'aperçu n'est qu'une aide.
 */
export function AjoutEnLot({ sections, prixMax }: { sections: { id: string; nom: string }[]; prixMax: number }) {
  const [etat, action, enCours] = useActionState(creerPlatsEnLotAction, etatInitial);
  const [texte, setTexte] = useState("");
  const { plats, ignorees } = lirePlatsEnLot(texte, prixMax);

  return (
    <details className="saisie-lot">
      <summary>Ajouter plusieurs plats d&apos;un coup</summary>
      <form
        action={(donnees) => {
          action(donnees);
          setTexte("");
        }}
        className="saisie-lot-corps"
      >
        <p className="aide-champ" style={{ margin: 0 }}>
          Collez une liste, une ligne par plat, le prix à la fin. Exemple :
        </p>
        <pre className="saisie-lot-exemple">{EXEMPLE}</pre>
        <div className="field">
          <label htmlFor="liste-plats">Votre liste</label>
          <textarea
            id="liste-plats"
            name="liste"
            rows={6}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder={EXEMPLE}
            maxLength={6000}
            spellCheck={false}
          />
        </div>
        {sections.length > 0 ? (
          <div className="field">
            <label htmlFor="lot-section">Section du menu</label>
            <select id="lot-section" name="section_id" defaultValue="">
              <option value="">Aucune section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {texte.trim() ? (
          <div className="saisie-lot-apercu" aria-live="polite">
            <p className="saisie-lot-titre">
              {plats.length > 0 ? `${plats.length} plat${plats.length > 1 ? "s" : ""} seront ajoutés` : "Aucun plat reconnu pour l'instant"}
            </p>
            {plats.length > 0 ? (
              <ul>
                {plats.map((p, i) => (
                  <li key={`${p.nom}-${i}`}>
                    <span>{p.nom}</span>
                    <span>{formaterPrixGnf(p.prix)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {ignorees.length > 0 ? (
              <ul className="saisie-lot-ignorees">
                {ignorees.map((i, k) => (
                  <li key={`${i.ligne}-${k}`}>
                    « {i.ligne.length > 40 ? `${i.ligne.slice(0, 40)}…` : i.ligne} » : {i.raison.toLowerCase()}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.ajoutes ? (
          <Alert ton="info" role="status">
            {etat.ajoutes} plat{etat.ajoutes > 1 ? "s" : ""} ajouté{etat.ajoutes > 1 ? "s" : ""}
            {etat.ignorees ? `, ${etat.ignorees} ligne${etat.ignorees > 1 ? "s" : ""} ignorée${etat.ignorees > 1 ? "s" : ""}` : ""}. Complétez ensuite chaque plat avec une photo et une description.
          </Alert>
        ) : null}
        <Button type="submit" pleineLargeur disabled={enCours || plats.length === 0}>
          {enCours ? "Ajout…" : plats.length > 0 ? `Ajouter ${Math.min(plats.length, PLATS_MAX_PAR_LISTE)} plat${plats.length > 1 ? "s" : ""}` : "Ajouter les plats"}
        </Button>
      </form>
    </details>
  );
}
