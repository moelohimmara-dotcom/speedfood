"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { creerSectionEquipeAction, deplacerSectionEquipeAction, renommerSectionEquipeAction, supprimerSectionEquipeAction, type EtatSectionEquipe } from "@/lib/system-admin/catalogue-restaurant";
import type { SectionEquipe } from "@/lib/system-admin/catalogue-restaurant-lecture";

const etatInitial: EtatSectionEquipe = {};

/** Sections du menu tenues par l'équipe : créer, renommer, déplacer, supprimer (les plats d'une section supprimée redeviennent non classés). */
export function GestionSections({ restaurantId, sections }: { restaurantId: string; sections: SectionEquipe[] }) {
  const [etatCreation, actionCreation, creationEnCours] = useActionState(creerSectionEquipeAction, etatInitial);
  const [etatNom, actionNom, nomEnCours] = useActionState(renommerSectionEquipeAction, etatInitial);

  return (
    <div className="ad-pile">
      {sections.length === 0 ? <p className="ad-aide-champ">Aucune section : tous les plats sont non classés.</p> : null}
      <ul className="catalogue-equipe-liste">
        {sections.map((section, index) => (
          <li key={section.id} className="catalogue-equipe-plat">
            <div className="catalogue-equipe-entete">
              <div className="catalogue-equipe-titre">
                <strong>{section.nom}</strong>
                <span>Position {index + 1} sur {sections.length}</span>
              </div>
            </div>
            <div className="catalogue-equipe-actions">
              <form action={deplacerSectionEquipeAction}>
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <input type="hidden" name="section_id" value={section.id} />
                <input type="hidden" name="direction" value="haut" />
                <button type="submit" className="btn btn-secondary btn-compact" disabled={index === 0}>Monter</button>
              </form>
              <form action={deplacerSectionEquipeAction}>
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <input type="hidden" name="section_id" value={section.id} />
                <input type="hidden" name="direction" value="bas" />
                <button type="submit" className="btn btn-secondary btn-compact" disabled={index === sections.length - 1}>Descendre</button>
              </form>
              <form action={supprimerSectionEquipeAction}>
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <input type="hidden" name="section_id" value={section.id} />
                <button type="submit" className="btn btn-danger btn-compact">Supprimer</button>
              </form>
            </div>
            <details className="catalogue-equipe-edition">
              <summary>Renommer</summary>
              <form action={actionNom} className="catalogue-equipe-formulaire">
                <input type="hidden" name="restaurant_id" value={restaurantId} />
                <input type="hidden" name="section_id" value={section.id} />
                <Input label="Nom de la section" name="nom" type="text" required maxLength={60} defaultValue={section.nom} />
                <Button type="submit" disabled={nomEnCours}>{nomEnCours ? "Enregistrement…" : "Renommer"}</Button>
              </form>
            </details>
          </li>
        ))}
      </ul>
      {etatNom.erreur ? <Alert ton="danger">{etatNom.erreur}</Alert> : null}
      {etatNom.succes ? <Alert ton="succes">{etatNom.succes}</Alert> : null}
      <form action={actionCreation} className="catalogue-equipe-formulaire">
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <Input label="Nouvelle section" name="nom" type="text" required maxLength={60} placeholder="Ex. Grillades" />
        {etatCreation.erreur ? <Alert ton="danger">{etatCreation.erreur}</Alert> : null}
        {etatCreation.succes ? <Alert ton="succes">{etatCreation.succes}</Alert> : null}
        <Button type="submit" disabled={creationEnCours}>{creationEnCours ? "Ajout…" : "Ajouter la section"}</Button>
      </form>
    </div>
  );
}
