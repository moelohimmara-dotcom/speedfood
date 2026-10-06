import type { ComponentConfig } from "@puckeditor/core";

export interface PropsEspace {
  hauteur: number;
}

/** Bloc « Espace » : espacement vertical, borné (0 à 200 px) pour qu'une page ne devienne pas inutilisable. */
export const Espace: ComponentConfig<PropsEspace> = {
  label: "Espace",
  fields: { hauteur: { type: "number", label: "Hauteur (px)", min: 0, max: 200 } },
  defaultProps: { hauteur: 24 },
  render: ({ hauteur }) => {
    const h = Number.isFinite(hauteur) ? Math.min(200, Math.max(0, Math.round(hauteur))) : 24;
    return <div aria-hidden="true" style={{ height: h }} />;
  },
};
