"use client";

import { useActionState, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import {
  enregistrerCommuneAction,
  enregistrerPrefectureAction,
  enregistrerQuartierAction,
  enregistrerRegionAction,
  type CommuneSysteme,
  type EtatGeographie,
  type QuartierSysteme,
  type ZoneLargeSysteme,
} from "@/lib/system-admin/geographie";

const etatInitial: EtatGeographie = {};

/** Point central (latitude, longitude) et noms alternatifs : repliés pour garder la liste lisible. */
function ChampsPoint({ latitude, longitude, nomsAlternatifs, avecAliases = true }: { latitude: number | null; longitude: number | null; nomsAlternatifs?: string[]; avecAliases?: boolean }) {
  const renseigne = latitude !== null && longitude !== null;
  return (
    <details className="geo-details">
      <summary>
        Point central{avecAliases ? " et noms alternatifs" : ""}
        <span className="geo-details-resume">{renseigne ? `${latitude}, ${longitude}` : "non renseigné"}</span>
      </summary>
      <div className="geo-details-corps">
        <label>
          Latitude
          <input name="latitude" type="text" inputMode="decimal" defaultValue={latitude ?? ""} placeholder="9.6412" maxLength={12} />
        </label>
        <label>
          Longitude
          <input name="longitude" type="text" inputMode="decimal" defaultValue={longitude ?? ""} placeholder="-13.6015" maxLength={12} />
        </label>
        {avecAliases ? (
          <label className="geo-details-large">
            Noms alternatifs (un par ligne)
            <textarea name="noms_alternatifs" rows={2} defaultValue={(nomsAlternatifs ?? []).join("\n")} maxLength={900} />
          </label>
        ) : null}
        <p className="geo-details-aide">
          Le point sert à trouver la zone d&apos;une personne qui utilise « Utiliser ma position ». Les noms alternatifs sont reconnus par la
          recherche et par la localisation (ex. « Kipe Centre » pour Kipé). Laissez vide pour retirer.
        </p>
      </div>
    </details>
  );
}

/** Une région ou une préfecture : nom, activation et point central. Désactiver la retire de la recherche, sans rien supprimer. */
export function FormulaireZoneLargeSysteme({ zone, type }: { zone: ZoneLargeSysteme; type: "region" | "prefecture" }) {
  const [etat, action, enCours] = useActionState(type === "region" ? enregistrerRegionAction : enregistrerPrefectureAction, etatInitial);
  return (
    <form action={action} className="geo-ligne geo-ligne-colonne">
      <div className="geo-ligne-haut">
        <input type="hidden" name="id" value={zone.id} />
        <input name="nom" defaultValue={zone.nom} required minLength={2} maxLength={80} aria-label={`Nom de ${type === "region" ? "la région" : "la préfecture"} ${zone.nom}`} />
        <label className="geo-case">
          <input type="checkbox" name="actif" defaultChecked={zone.actif} /> Active
        </label>
        {zone.codeOfficiel ? <span className="geo-code">{zone.codeOfficiel}</span> : null}
        <button type="submit" className="btn btn-secondary" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {etat.erreur ? <span role="alert" className="geo-erreur">{etat.erreur}</span> : null}
        <span role="status" aria-live="polite" className="geo-ok">{etat.succes ? "Enregistré." : ""}</span>
      </div>
      <ChampsPoint latitude={zone.latitude} longitude={zone.longitude} avecAliases={false} />
    </form>
  );
}

/** Une commune : nom, activation. Désactiver retire la commune des choix, sans rien supprimer. */
export function FormulaireCommuneSysteme({ commune }: { commune: CommuneSysteme }) {
  const [etat, action, enCours] = useActionState(enregistrerCommuneAction, etatInitial);

  return (
    <form action={action} className="geo-ligne geo-ligne-colonne">
      <div className="geo-ligne-haut">
        <input type="hidden" name="id" value={commune.id} />
        <input
          name="nom"
          defaultValue={commune.nom}
          required
          minLength={2}
          maxLength={80}
          aria-label={`Nom de la commune ${commune.nom}`}
        />
        <label className="geo-case">
          <input type="checkbox" name="actif" defaultChecked={commune.actif} /> Active
        </label>
        {commune.codeOfficiel ? <span className="geo-code">{commune.codeOfficiel}</span> : null}
        <button type="submit" className="btn btn-secondary" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {etat.erreur ? <span role="alert" className="geo-erreur">{etat.erreur}</span> : null}
        <span role="status" aria-live="polite" className="geo-ok">{etat.succes ? "Enregistré." : ""}</span>
      </div>
      <ChampsPoint latitude={commune.latitude} longitude={commune.longitude} nomsAlternatifs={commune.nomsAlternatifs} />
    </form>
  );
}

/** Un quartier existant (avec `quartier`) ou la création d'un nouveau (sans `quartier`). */
export function FormulaireQuartierSysteme({
  quartier,
  communes,
}: {
  quartier?: QuartierSysteme;
  communes: CommuneSysteme[];
}) {
  const [etat, action, enCours] = useActionState(enregistrerQuartierAction, etatInitial);
  const [communeId, setCommuneId] = useState(quartier?.communeId ?? "");
  const libelleNom = quartier ? `Nom du quartier ${quartier.nom}` : "Nom du nouveau quartier";

  return (
    <form action={action} className="geo-ligne geo-ligne-colonne">
      <div className="geo-ligne-haut">
        {quartier ? <input type="hidden" name="id" value={quartier.id} /> : null}
        <input
          name="nom"
          defaultValue={quartier?.nom ?? ""}
          required
          minLength={2}
          maxLength={80}
          placeholder="Nom du quartier"
          aria-label={libelleNom}
        />
        <div className="geo-commune">
          <ListeChoix
            nom="commune_id"
            options={communes.map((c) => ({ valeur: c.id, libelle: c.actif ? c.nom : `${c.nom} (inactive)` }))}
            valeur={communeId}
            onChange={setCommuneId}
            placeholder="Commune…"
            libelleAccessible="Commune du quartier"
          />
        </div>
        <label className="geo-case">
          <input type="checkbox" name="actif" defaultChecked={quartier ? quartier.actif : true} /> Actif
        </label>
        <button type="submit" className="btn btn-secondary" disabled={enCours}>
          {enCours ? "Enregistrement…" : quartier ? "Enregistrer" : "Ajouter"}
        </button>
        {etat.erreur ? <span role="alert" className="geo-erreur">{etat.erreur}</span> : null}
        <span role="status" aria-live="polite" className="geo-ok">{etat.succes ? "Enregistré." : ""}</span>
      </div>
      <ChampsPoint latitude={quartier?.latitude ?? null} longitude={quartier?.longitude ?? null} nomsAlternatifs={quartier?.nomsAlternatifs} />
    </form>
  );
}
