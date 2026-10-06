import type { ComponentConfig } from "@puckeditor/core";

export interface PropsTitre {
  texte: string;
  niveau: "h1" | "h2" | "h3";
}

/** Bloc « Titre » : texte et niveau de titre (le niveau structure la page pour les lecteurs d'écran). Composant pur, utilisable côté serveur. */
export const Titre: ComponentConfig<PropsTitre> = {
  label: "Titre",
  fields: {
    texte: { type: "text", label: "Texte" },
    niveau: {
      type: "radio",
      label: "Niveau",
      options: [
        { label: "Titre 1", value: "h1" },
        { label: "Titre 2", value: "h2" },
        { label: "Titre 3", value: "h3" },
      ],
    },
  },
  defaultProps: { texte: "Un titre", niveau: "h2" },
  render: ({ texte, niveau }) => {
    const Balise = niveau;
    return <Balise style={{ margin: 0, color: "var(--encre)" }}>{texte}</Balise>;
  },
};
