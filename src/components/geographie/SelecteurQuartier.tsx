"use client";

import { useMemo, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import type { GroupeCommune } from "@/lib/geographie/quartiers";

const parNom = (a: { libelle: string }, b: { libelle: string }) => a.libelle.localeCompare(b.libelle, "fr");

/**
 * Choix d'un quartier de haut en bas : région, préfecture, commune (ou sous-préfecture), puis quartier. Un niveau qui n'a
 * qu'une seule possibilité (Conakry, une commune à un seul quartier) est choisi d'office et, pour la région et la préfecture,
 * n'est pas affiché. Le champ caché `nom` transporte l'identifiant du quartier ; les niveaux au-dessus ne sont qu'un choix d'affichage.
 *
 * `modeZone` : pour déclarer une zone desservie. Le dernier niveau propose alors « Toute la commune de … » en tête, puis les
 * quartiers réels ; la valeur envoyée est `c:<identifiant de la commune>` ou `q:<identifiant du quartier>`.
 */
export function SelecteurQuartier({
  nom,
  groupes,
  quartierInitial,
  libelleQuartier = "Quartier",
  modeZone = false,
}: {
  nom: string;
  groupes: GroupeCommune[];
  quartierInitial: string | null;
  libelleQuartier?: string;
  modeZone?: boolean;
}) {
  const groupeInitial = groupes.find((g) => g.quartiers.some((q) => q.id === quartierInitial));
  const [regionId, setRegionId] = useState(groupeInitial?.regionId ?? "");
  const [prefectureId, setPrefectureId] = useState(groupeInitial?.prefectureId ?? "");
  const [communeId, setCommuneId] = useState(groupeInitial?.communeId ?? "");
  const [quartierId, setQuartierId] = useState(!modeZone && quartierInitial && groupeInitial ? quartierInitial : "");

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
  const communeEffective = communeId || (prefectureEffective && communes.length === 1 ? communes[0].valeur : "");
  const groupeChoisi = groupes.find((g) => g.communeId === communeEffective);

  // Derniers choix possibles de la commune : quartiers réels (et, en mode zone, la commune entière).
  const optionsQuartier = useMemo(() => {
    if (!groupeChoisi) return [];
    const reels = groupeChoisi.quartiers.filter((q) => !q.generique).map((q) => ({ valeur: modeZone ? `q:${q.id}` : q.id, libelle: q.nom }));
    const generique = groupeChoisi.quartiers.find((q) => q.generique);
    if (modeZone) return [{ valeur: `c:${groupeChoisi.communeId}`, libelle: `Toute la commune de ${groupeChoisi.communeNom}` }, ...reels];
    return generique ? [{ valeur: generique.id, libelle: `Centre de ${groupeChoisi.communeNom}` }, ...reels] : reels;
  }, [groupeChoisi, modeZone]);
  // Une seule possibilité : choisie d'office, y compris à l'affichage initial.
  const quartierEffectif = quartierId || (!modeZone && optionsQuartier.length === 1 ? optionsQuartier[0].valeur : "");

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
    setQuartierId("");
  }

  const afficherRegion = regions.length > 1;
  const afficherPrefecture = afficherRegion || prefectures.length > 1;

  return (
    <div className="selecteur-quartier">
      {afficherRegion ? (
        <div className="field">
          <span className="etiquette-champ" id={`${nom}-region-etiquette`}>
            Région
          </span>
          <ListeChoix
            nom={`${nom}__region`}
            options={regions}
            valeur={regionEffective}
            placeholder="Choisir une région"
            libelleAccessible="Région"
            idEtiquette={`${nom}-region-etiquette`}
            onChange={choisirRegion}
          />
        </div>
      ) : null}
      {afficherPrefecture ? (
        <div className="field">
          <span className="etiquette-champ" id={`${nom}-prefecture-etiquette`}>
            Préfecture
          </span>
          <ListeChoix
            nom={`${nom}__prefecture`}
            options={prefectures}
            valeur={prefectureEffective}
            placeholder={regionEffective ? "Choisir une préfecture" : "Choisissez d'abord la région"}
            libelleAccessible="Préfecture"
            idEtiquette={`${nom}-prefecture-etiquette`}
            disabled={!regionEffective}
            onChange={choisirPrefecture}
          />
        </div>
      ) : null}
      <div className="field">
        <span className="etiquette-champ" id={`${nom}-commune-etiquette`}>
          Commune
        </span>
        <ListeChoix
          nom={`${nom}__commune`}
          options={communes}
          valeur={communeEffective}
          placeholder={prefectureEffective ? "Choisir une commune" : "Choisissez d'abord la préfecture"}
          libelleAccessible="Commune"
          idEtiquette={`${nom}-commune-etiquette`}
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
          options={optionsQuartier}
          valeur={quartierEffectif}
          placeholder={communeEffective ? (optionsQuartier.length > 0 ? `Choisir ${libelleQuartier === "Quartier" ? "un quartier" : libelleQuartier.toLowerCase()}` : "Aucun quartier disponible") : "Choisissez d'abord la commune"}
          libelleAccessible={libelleQuartier}
          idEtiquette={`${nom}-quartier-etiquette`}
          disabled={!communeEffective || optionsQuartier.length === 0}
          onChange={setQuartierId}
        />
      </div>
    </div>
  );
}
