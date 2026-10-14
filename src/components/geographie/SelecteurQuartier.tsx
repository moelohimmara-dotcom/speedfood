"use client";

import { useMemo, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import type { GroupeCommune } from "@/lib/geographie/quartiers";

const parNom = (a: { libelle: string }, b: { libelle: string }) => a.libelle.localeCompare(b.libelle, "fr");

/**
 * Choix d'un quartier de haut en bas : région, préfecture, commune (ou sous-préfecture), puis quartier. Un niveau qui n'a
 * qu'une seule possibilité (Conakry, par exemple) est choisi d'office. Le champ caché `nom` transporte l'identifiant du quartier ;
 * les niveaux au-dessus ne sont qu'un choix d'affichage. Hors Conakry, le quartier « Centre de … » représente le centre de la commune.
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
  const groupeInitial = groupes.find((g) => g.quartiers.some((q) => q.id === quartierInitial));
  const [regionId, setRegionId] = useState(groupeInitial?.regionId ?? "");
  const [prefectureId, setPrefectureId] = useState(groupeInitial?.prefectureId ?? "");
  const [communeId, setCommuneId] = useState(groupeInitial?.communeId ?? "");
  const [quartierId, setQuartierId] = useState(quartierInitial && groupeInitial ? quartierInitial : "");

  const regions = useMemo(() => {
    const vues = new Map<string, string>();
    for (const g of groupes) if (g.regionId) vues.set(g.regionId, g.regionNom);
    return [...vues].map(([valeur, libelle]) => ({ valeur, libelle })).sort(parNom);
  }, [groupes]);
  // Un niveau sans alternative se choisit d'office : on n'oblige personne à cliquer pour rien.
  const regionEffective = regionId || (regions.length === 1 ? regions[0].valeur : "");
  const prefectures = useMemo(() => {
    const vues = new Map<string, string>();
    for (const g of groupes) if (g.regionId === regionEffective && g.prefectureId) vues.set(g.prefectureId, g.prefectureNom);
    return [...vues].map(([valeur, libelle]) => ({ valeur, libelle })).sort(parNom);
  }, [groupes, regionEffective]);
  const prefectureEffective = prefectureId || (regionEffective && prefectures.length === 1 ? prefectures[0].valeur : "");
  const communes = useMemo(
    () => groupes.filter((g) => g.prefectureId === prefectureEffective).map((g) => ({ valeur: g.communeId, libelle: g.communeNom })).sort(parNom),
    [groupes, prefectureEffective]
  );
  const groupeChoisi = groupes.find((g) => g.communeId === communeId);

  function choisirRegion(valeur: string) {
    setRegionId(valeur);
    setPrefectureId("");
    setCommuneId("");
    setQuartierId("");
  }
  function choisirPrefecture(valeur: string) {
    setPrefectureId(valeur);
    setCommuneId("");
    setQuartierId("");
  }
  function choisirCommune(valeur: string) {
    setCommuneId(valeur);
    const g = groupes.find((x) => x.communeId === valeur);
    // Une commune qui n'a qu'un quartier (le centre d'une sous-préfecture) le sélectionne d'office.
    setQuartierId(g && g.quartiers.length === 1 ? g.quartiers[0].id : "");
  }

  return (
    <div className="selecteur-quartier">
      <div className="field">
        <span className="etiquette-champ">Région</span>
        <ListeChoix nom={`${nom}__region`} options={regions} valeur={regionEffective} placeholder="Choisir une région" libelleAccessible="Région" onChange={choisirRegion} />
      </div>
      <div className="field">
        <span className="etiquette-champ">Préfecture</span>
        <ListeChoix
          nom={`${nom}__prefecture`}
          options={prefectures}
          valeur={prefectureEffective}
          placeholder={regionEffective ? "Choisir une préfecture" : "Choisissez d'abord la région"}
          libelleAccessible="Préfecture"
          disabled={!regionEffective}
          onChange={choisirPrefecture}
        />
      </div>
      <div className="field">
        <span className="etiquette-champ" id={`${nom}-commune-etiquette`}>
          Commune
        </span>
        <ListeChoix
          nom={`${nom}__commune`}
          options={communes}
          valeur={communeId}
          placeholder={prefectureEffective ? "Choisir une commune" : "Choisissez d'abord la préfecture"}
          libelleAccessible="Commune"
          disabled={!prefectureEffective}
          onChange={choisirCommune}
        />
      </div>
      <div className="field">
        <span className="etiquette-champ" id={`${nom}-quartier-etiquette`}>
          {libelleQuartier}
        </span>
        <ListeChoix
          nom={nom}
          options={(groupeChoisi?.quartiers ?? []).map((q) => ({ valeur: q.id, libelle: q.generique ? "Centre de la commune" : q.nom }))}
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
