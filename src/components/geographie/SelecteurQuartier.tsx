"use client";

import { useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import type { GroupeCommune } from "@/lib/geographie/quartiers";

/**
 * Choix d'un quartier en deux temps : d'abord la commune, puis le quartier de cette commune.
 * Le champ caché `nom` transporte l'identifiant du quartier ; la commune reste un choix d'affichage.
 */
export function SelecteurQuartier({
  nom,
  groupes,
  quartierInitial,
  libelleQuartier = "Quartier",
}: {
  nom: string;
  groupes: GroupeCommune[];
  quartierInitial: string | null;
  libelleQuartier?: string;
}) {
  const communeInitiale =
    groupes.find((g) => g.quartiers.some((q) => q.id === quartierInitial))?.communeId ?? "";
  const [communeId, setCommuneId] = useState(communeInitiale);
  const [quartierId, setQuartierId] = useState(quartierInitial && communeInitiale ? quartierInitial : "");

  const groupeChoisi = groupes.find((g) => g.communeId === communeId);

  return (
    <div className="selecteur-quartier">
      <div className="field">
        <span className="etiquette-champ" id={`${nom}-commune-etiquette`}>
          Commune
        </span>
        <ListeChoix
          nom={`${nom}__commune`}
          options={groupes.map((g) => ({ valeur: g.communeId, libelle: g.communeNom }))}
          valeur={communeId}
          placeholder="Choisir une commune"
          libelleAccessible="Commune"
          onChange={(valeur) => {
            setCommuneId(valeur);
            setQuartierId("");
          }}
        />
      </div>
      <div className="field">
        <span className="etiquette-champ" id={`${nom}-quartier-etiquette`}>
          {libelleQuartier}
        </span>
        <ListeChoix
          nom={nom}
          options={(groupeChoisi?.quartiers ?? []).map((q) => ({ valeur: q.id, libelle: q.nom }))}
          valeur={quartierId}
          placeholder={communeId ? "Choisir un quartier" : "Choisissez d'abord la commune"}
          libelleAccessible={libelleQuartier}
          disabled={!communeId}
          onChange={setQuartierId}
        />
      </div>
    </div>
  );
}
