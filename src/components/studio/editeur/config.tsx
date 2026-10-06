import type { ComponentConfig, Config, Field, SlotComponent } from "@puckeditor/core";
import { EnveloppeBloc, RenduBloc as ApercuBloc } from "@/components/studio/RenduBlocs";
import { proprietesPourRendu } from "@/lib/studio/editeur-donnees";
import { CATEGORIES_BLOCS, REGISTRE, entreeRegistre, type BlocPage, type ChampBloc } from "@/lib/studio/registre";
import { ChampImage, ChampReglages, ChampRestaurant, ChampTaxonomie } from "./ChampsPerso";

/**
 * Configuration de Puck DÉRIVÉE du registre (palier 3) : types, libellés, familles, champs et valeurs par défaut viennent
 * tous de `src/lib/studio/registre.ts`, la source unique. Import de TYPES seulement depuis Puck : ce module ne charge rien
 * de l'éditeur à lui seul (il n'est importé que par l'éditeur, lui-même chargé en différé).
 *
 * Aperçu fidèle : chaque bloc est dessiné par `RenduBlocs`, le rendu public (mêmes classes `sb-*`), à partir de ses
 * propriétés validées par le schéma du registre. Un bloc en cours de saisie invalide (titre vide, lien refusé, image à choisir)
 * affiche un avertissement à la place, jamais un rendu partiel. Le bloc « Colonnes » utilise les zones (« slots ») de Puck :
 * chaque colonne est une zone où l'on dépose des blocs simples.
 */

function optionsDe(champ: Extract<ChampBloc, { genre: "choix" }>) {
  return champ.options.map((o) => ({ label: o.libelle, value: o.valeur }));
}

function champsPuck(champs: Record<string, ChampBloc>): Record<string, Field> {
  return Object.fromEntries(Object.entries(champs).map(([cle, champ]) => [cle, champPuck(champ)]));
}

function champPuck(champ: ChampBloc): Field {
  switch (champ.genre) {
    case "texte":
      return { type: "text", label: champ.libelle };
    case "texteLong":
      return { type: "textarea", label: champ.libelle };
    case "choix":
      // Peu d'options : boutons radio (tout est visible) ; au-delà, liste déroulante.
      return champ.options.length <= 3
        ? { type: "radio", label: champ.libelle, options: optionsDe(champ) }
        : { type: "select", label: champ.libelle, options: optionsDe(champ) };
    case "case":
      return { type: "radio", label: champ.libelle, options: [{ label: "Oui", value: true }, { label: "Non", value: false }] };
    case "reglages":
      return {
        type: "custom",
        label: champ.libelle,
        render: ({ value, onChange, readOnly }) => <ChampReglages libelle={champ.libelle} value={value as Record<string, unknown> | undefined} onChange={(v) => onChange(v as never)} readOnly={readOnly} />,
      };
    case "image":
      return {
        type: "custom",
        label: champ.libelle,
        render: ({ value, onChange, readOnly }) => <ChampImage libelle={champ.libelle} value={value as string | undefined} onChange={(v) => onChange(v as never)} readOnly={readOnly} />,
      };
    case "restaurant":
      return {
        type: "custom",
        label: champ.libelle,
        render: ({ value, onChange, readOnly }) => <ChampRestaurant libelle={champ.libelle} value={value as string | undefined} onChange={(v) => onChange(v as never)} readOnly={readOnly} />,
      };
    case "taxonomie":
      return {
        type: "custom",
        label: champ.libelle,
        render: ({ value, onChange, readOnly }) => (
          <ChampTaxonomie libelle={champ.libelle} source={champ.source} value={value as string | undefined} onChange={(v) => onChange(v as never)} readOnly={readOnly} />
        ),
      };
    case "groupe":
      return { type: "object", label: champ.libelle, objectFields: champsPuck(champ.champs) };
    case "liste":
      return {
        type: "array",
        label: champ.libelle,
        max: champ.max,
        arrayFields: champsPuck(champ.champs),
        defaultItemProps: Object.fromEntries(Object.keys(champ.champs).map((cle) => [cle, ""])),
        getItemSummary: (element: Record<string, unknown>, i = 0) => {
          const valeur = element?.[champ.resume];
          return typeof valeur === "string" && valeur.trim() ? (valeur.length > 50 ? `${valeur.slice(0, 49)}…` : valeur) : `Élément n° ${i + 1}`;
        },
      };
    case "colonne":
      return { type: "slot", allow: [...champ.autorise] };
  }
}

/** Aperçu d'un bloc : propriétés réduites au registre, validées, puis rendues par le rendu public. */
function ApercuValide({ type, props }: { type: string; props: Record<string, unknown> }) {
  const entree = entreeRegistre(type);
  if (!entree) return null;
  const resultat = entree.schemaProps.safeParse(proprietesPourRendu(type, props));
  if (!resultat.success) {
    return (
      <p className="se-bloc-incomplet">
        {entree.libelle} incomplet ou invalide : corrigez ses réglages (l&apos;enregistrement sera refusé tant qu&apos;il n&apos;est pas corrigé).
      </p>
    );
  }
  return <ApercuBloc bloc={{ type, props: resultat.data } as BlocPage} edition />;
}

interface ProprietesColonnes {
  nombre?: number;
  ecart?: number;
  reglages?: Record<string, unknown>;
  colonne1: SlotComponent;
  colonne2: SlotComponent;
  colonne3: SlotComponent;
}

/** Colonnes dans l'éditeur : une zone de dépôt par colonne affichée, les colonnes s'empilent comme sur la page publique. */
function ApercuColonnes(p: ProprietesColonnes) {
  const nombre = p.nombre === 3 ? 3 : 2;
  const colonnes = [p.colonne1, p.colonne2, p.colonne3].slice(0, nombre);
  const ecart = p.ecart === 8 || p.ecart === 32 ? p.ecart : 16;
  return (
    <EnveloppeBloc reglages={p.reglages as BlocPage["props"]["reglages"]} edition>
      <div className={`sb-colonnes sb-colonnes-${nombre} sb-ecart-${ecart}`}>
        {colonnes.map((Colonne, k) => (
          <div key={k} className="sb-colonne">
            <p className="se-colonne-etiquette">Colonne {k + 1}</p>
            <Colonne minEmptyHeight={72} />
          </div>
        ))}
      </div>
    </EnveloppeBloc>
  );
}

const composants: Record<string, ComponentConfig> = {};
for (const entree of REGISTRE) {
  const type = entree.type;
  composants[type] = {
    label: entree.libelle,
    fields: champsPuck(entree.champs as Record<string, ChampBloc>),
    defaultProps: structuredClone(entree.defauts),
    render: (props) =>
      type === "Colonnes" ? <ApercuColonnes {...(props as unknown as ProprietesColonnes)} /> : <ApercuValide type={type} props={props as Record<string, unknown>} />,
  };
}

export const configEditeur: Config = {
  components: composants,
  categories: Object.fromEntries(
    CATEGORIES_BLOCS.map((c) => [
      c.code,
      { title: c.libelle, components: REGISTRE.filter((e) => e.categorie === c.code).map((e) => e.type), defaultExpanded: true },
    ])
  ),
  root: {
    // Aucun réglage de page dans l'éditeur (le titre de la page vient de la liste des pages) : pas de champ « title » anglais.
    fields: {},
    render: ({ children }: { children: React.ReactNode }) => <div className="sb-page se-apercu-page">{children}</div>,
  },
};
