"use client";

import { useActionState, useId, useRef, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import { enregistrerLotAction, type CommuneSysteme, type EtatGeographie, type QuartierSysteme } from "@/lib/system-admin/geographie";
import { LIBELLES_STATUT, STATUTS_LANCEMENT } from "@/lib/system-admin/geographie-outils";
import { FormulaireCommuneSysteme, FormulaireQuartierSysteme } from "./Formulaires";

type Filtre = "tous" | "inactifs" | "sans_point" | "attente";

const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: "tous", libelle: "Tous" },
  { valeur: "inactifs", libelle: "Inactifs" },
  { valeur: "sans_point", libelle: "Sans point central" },
  { valeur: "attente", libelle: "Avec des personnes en attente" },
];

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

const etatInitial: EtatGeographie = {};

interface Element {
  id: string;
  nom: string;
  actif: boolean;
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs: string[];
  attente: number;
}

/**
 * Liste d'une région avec recherche, filtres et actions par lot. Les lignes restent des formulaires indépendants ; leur case de sélection
 * est reliée au formulaire de lot par l'attribut `form`. Changer de recherche ou de filtre vide la sélection : une ligne masquée ne
 * peut jamais être modifiée par un lot sans que la personne l'ait vue.
 */
function ListeGeo({
  niveau,
  elements,
  rendre,
  operations,
}: {
  niveau: "commune" | "quartier";
  elements: Element[];
  rendre: (id: string) => React.ReactNode;
  operations: { valeur: string; libelle: string }[];
}) {
  const idLot = niveau === "commune" ? "lot-communes" : "lot-quartiers";
  const idRecherche = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [selection, setSelection] = useState(0);
  const [operation, setOperation] = useState("");
  const [etat, action, enCours] = useActionState(enregistrerLotAction, etatInitial);

  const requete = normaliser(recherche);
  const visibles = new Set(
    elements
      .filter((e) => {
        if (requete && !normaliser([e.nom, ...e.nomsAlternatifs].join(" ")).includes(requete)) return false;
        if (filtre === "inactifs") return !e.actif;
        if (filtre === "sans_point") return e.latitude === null || e.longitude === null;
        if (filtre === "attente") return e.attente > 0;
        return true;
      })
      .map((e) => e.id)
  );

  function cases(): HTMLInputElement[] {
    return Array.from(conteneur.current?.querySelectorAll<HTMLInputElement>("input.geo-selection") ?? []);
  }
  function compter() {
    setSelection(cases().filter((c) => c.checked).length);
  }
  function toutDeselectionner() {
    for (const c of cases()) c.checked = false;
    setSelection(0);
  }
  function toutSelectionner() {
    for (const c of cases()) c.checked = visibles.has(c.value);
    compter();
  }
  function changerFiltre(nouveau: Filtre) {
    setFiltre(nouveau);
    toutDeselectionner();
  }
  function envoyer(donnees: FormData) {
    action(donnees);
    toutDeselectionner();
  }

  const libelleElement = niveau === "commune" ? "commune" : "quartier";

  return (
    <div>
      <div className="geo-outils" role="search">
        <label htmlFor={idRecherche} className="geo-outils-etiquette">
          Rechercher {niveau === "commune" ? "une commune" : "un quartier"}
        </label>
        <input
          id={idRecherche}
          type="search"
          className="geo-outils-champ"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            toutDeselectionner();
          }}
          autoComplete="off"
          placeholder="Nom ou nom alternatif"
        />
        <div className="geo-filtres" role="group" aria-label="Filtrer la liste">
          {FILTRES.map((f) => (
            <button key={f.valeur} type="button" className={`geo-filtre${filtre === f.valeur ? " actif" : ""}`} aria-pressed={filtre === f.valeur} onClick={() => changerFiltre(f.valeur)}>
              {f.libelle}
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite" className="geo-outils-etat">
          {visibles.size} {libelleElement}
          {visibles.size > 1 ? "s" : ""} affiché{niveau === "commune" ? "e" : ""}{visibles.size > 1 ? "s" : ""} sur {elements.length}
        </p>
      </div>

      <form id={idLot} action={envoyer} className="geo-lot" aria-label={`Actions sur les ${libelleElement}s cochés`}>
        <input type="hidden" name="niveau" value={niveau} />
        <button type="button" className="btn btn-secondary" onClick={toutSelectionner}>
          Cocher les {visibles.size} affichés
        </button>
        <button type="button" className="btn btn-secondary" onClick={toutDeselectionner} disabled={selection === 0}>
          Tout décocher
        </button>
        <span role="status" aria-live="polite" className="geo-lot-compte">
          {selection === 0 ? "Aucun coché" : `${selection} coché${selection > 1 ? "s" : ""}`}
        </span>
        <div className="geo-lot-operation">
          <ListeChoix nom="operation" options={operations} valeur={operation} onChange={setOperation} placeholder="Appliquer aux cochés…" libelleAccessible="Action à appliquer aux éléments cochés" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={enCours || selection === 0 || operation === ""}>
          {enCours ? "Application…" : "Appliquer"}
        </button>
        {etat.erreur ? (
          <span role="alert" className="geo-erreur">
            {etat.erreur}
          </span>
        ) : null}
        <span role="status" aria-live="polite" className="geo-ok">
          {etat.succes ? "Modification appliquée." : ""}
        </span>
      </form>

      <div ref={conteneur} onChange={compter}>
        {elements.map((e) => (
          <div key={e.id} hidden={!visibles.has(e.id)}>
            {rendre(e.id)}
          </div>
        ))}
        {visibles.size === 0 ? <p className="ad-aide-champ">Aucun élément ne correspond à cette recherche.</p> : null}
      </div>
    </div>
  );
}

export function ListeCommunes({ communes, contexte }: { communes: CommuneSysteme[]; contexte: string }) {
  const parId = new Map(communes.map((c) => [c.id, c]));
  return (
    <ListeGeo
      niveau="commune"
      elements={communes}
      rendre={(id) => <FormulaireCommuneSysteme commune={parId.get(id)!} contexte={contexte} />}
      operations={[
        { valeur: "activer", libelle: "Rendre visibles dans les choix" },
        { valeur: "desactiver", libelle: "Retirer des choix" },
        { valeur: "statut:auto", libelle: "Statut : Automatique" },
        ...STATUTS_LANCEMENT.map((s) => ({ valeur: `statut:${s}`, libelle: `Statut : ${LIBELLES_STATUT[s]}` })),
      ]}
    />
  );
}

export function ListeQuartiers({ quartiers, communes }: { quartiers: QuartierSysteme[]; communes: CommuneSysteme[] }) {
  const parId = new Map(quartiers.map((q) => [q.id, q]));
  return (
    <ListeGeo
      niveau="quartier"
      elements={quartiers}
      rendre={(id) => <FormulaireQuartierSysteme quartier={parId.get(id)!} communes={communes} />}
      operations={[
        { valeur: "activer", libelle: "Rendre visibles dans les choix" },
        { valeur: "desactiver", libelle: "Retirer des choix" },
      ]}
    />
  );
}
