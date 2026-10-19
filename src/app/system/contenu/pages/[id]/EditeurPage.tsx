"use client";

import { useActionState, useState } from "react";
import { modifierPageAction, type EtatActionContenu, type PageEditoriale } from "@/lib/system-admin/contenus";
import { Input, Button, Alert } from "@/components/ui";
import { BasculerPublicationPage } from "./BasculerPublicationPage";

const etatInitial: EtatActionContenu = {};

/**
 * Édition + aperçu mobile en direct (bloc 8c : « valider et prévisualiser sur
 * mobile »). L'aperçu reflète le texte en cours de frappe, pas seulement ce
 * qui est déjà enregistré — sinon ce ne serait pas un vrai aperçu avant
 * publication.
 *
 * `limites` (palier insuffisant, Studio palier 2) : explications des actions indisponibles. Confort d'interface seulement,
 * le serveur revérifie le palier de chaque action. Absent = aucune limite (rendu inchangé).
 */
export interface LimitesEdition {
  /** Explication si la modification est indisponible, sinon `null`. */
  modification: string | null;
  /** Explication de la publication/dépublication indisponible. */
  publication: string;
}

export function EditeurPage({ page, limites }: { page: PageEditoriale; limites?: LimitesEdition }) {
  const lectureSeule = Boolean(limites?.modification);
  const [etat, action, enCours] = useActionState(modifierPageAction, etatInitial);
  const [titre, setTitre] = useState(page.titre);
  const [contenu, setContenu] = useState(page.contenu);

  return (
    <div className="u-d-grid-gtc-1fr-g-s5">
      <form action={action}>
        <input type="hidden" name="id" value={page.id} />
        <Input
          label="Titre"
          name="titre"
          type="text"
          required
          maxLength={200}
          readOnly={lectureSeule}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
        />
        <div className="field">
          <label htmlFor="contenu">Contenu</label>
          <textarea
            id="contenu"
            name="contenu"
            rows={8}
            maxLength={20000}
            readOnly={lectureSeule}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
          />
        </div>
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">Modifications enregistrées.</Alert> : null}
        {limites?.modification ? <p className="ad-palier-note">{limites.modification}</p> : null}
        <Button type="submit" disabled={enCours || lectureSeule}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <div className="u-mt-s4">
          <BasculerPublicationPage id={page.id} publie={page.statut === "publie"} indisponible={limites?.publication} />
        </div>
      </form>

      <div
        className="u-a775f1ea"
      >
        <p className="u-fs-0-75rem-c-secondaire-mb-s2">
          Aperçu mobile (375px)
        </p>
        <h2 className="u-fs-1-2rem-mb-s2">{titre}</h2>
        <div className="u-ws-pre-wrap-fs-0-9rem-c-encre">
          {contenu || <span className="u-c-secondaire">(contenu vide)</span>}
        </div>
      </div>
    </div>
  );
}
