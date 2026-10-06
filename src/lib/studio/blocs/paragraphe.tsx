import type { ComponentConfig } from "@puckeditor/core";

export interface PropsParagraphe {
  texte: string;
}

/** Bloc « Paragraphe » : texte brut sur plusieurs lignes. */
export const Paragraphe: ComponentConfig<PropsParagraphe> = {
  label: "Paragraphe",
  fields: { texte: { type: "textarea", label: "Texte" } },
  defaultProps: { texte: "Un paragraphe de texte." },
  render: ({ texte }) => <p style={{ margin: 0, whiteSpace: "pre-line" }}>{texte}</p>,
};
