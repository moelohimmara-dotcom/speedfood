import type { ComponentConfig, Config, Field } from "@puckeditor/core";
import { RenduPage } from "@/components/studio/RenduPage";
import { CATEGORIES_BLOCS, REGISTRE, entreeRegistre, type ChampBloc, type PageBlocs } from "@/lib/studio/registre";

/**
 * Configuration de Puck DÉRIVÉE du registre (palier 3, tâche 7) : types, libellés, familles, champs et valeurs par défaut
 * viennent tous de `src/lib/studio/registre.ts`, la source unique. Import de TYPES seulement depuis Puck : ce module ne
 * charge rien de l'éditeur à lui seul (il n'est importé que par l'éditeur, lui-même chargé en différé).
 *
 * Aperçu fidèle : chaque bloc est dessiné par `RenduPage`, le rendu public (mêmes classes `sb-*`), à partir de ses
 * propriétés validées par le schéma du registre. Un bloc en cours de saisie invalide (titre vide, lien refusé) affiche
 * un avertissement à la place, jamais un rendu partiel.
 */

function champPuck(champ: ChampBloc): Field {
  switch (champ.genre) {
    case "texte":
      return { type: "text", label: champ.libelle };
    case "texteLong":
      return { type: "textarea", label: champ.libelle };
    case "choix":
      // Peu d'options : boutons radio (tout est visible) ; au-delà, liste déroulante.
      return champ.options.length <= 3
        ? { type: "radio", label: champ.libelle, options: champ.options.map((o) => ({ label: o.libelle, value: o.valeur })) }
        : { type: "select", label: champ.libelle, options: champ.options.map((o) => ({ label: o.libelle, value: o.valeur })) };
  }
}

function RenduBloc({ type, props }: { type: string; props: Record<string, unknown> }) {
  const entree = entreeRegistre(type);
  if (!entree) return null;
  const valeurs: Record<string, unknown> = {};
  for (const cle of Object.keys(entree.champs)) valeurs[cle] = props[cle];
  const resultat = entree.schemaProps.safeParse(valeurs);
  if (!resultat.success) {
    return (
      <p className="se-bloc-incomplet">
        {entree.libelle} incomplet ou invalide : corrigez ses réglages (il ne sera pas enregistré tel quel).
      </p>
    );
  }
  const page = { content: [{ type, props: resultat.data }], root: { props: {} } } as PageBlocs;
  return <RenduPage page={page} />;
}

const composants: Record<string, ComponentConfig> = {};
for (const entree of REGISTRE) {
  const fields: Record<string, Field> = {};
  for (const [cle, champ] of Object.entries(entree.champs) as [string, ChampBloc][]) fields[cle] = champPuck(champ);
  const type = entree.type;
  composants[type] = {
    label: entree.libelle,
    fields,
    defaultProps: { ...entree.defauts },
    render: (props) => <RenduBloc type={type} props={props as Record<string, unknown>} />,
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
