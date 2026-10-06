import type { Data } from "@puckeditor/core";
import { configBlocs } from "./config";

/**
 * Rendu public d'une page par blocs, SANS le `Render` de Puck : son entrée serveur (`rsc`) embarque tiptap, prosemirror et happy-dom
 * (mesuré : +1,39 Mo bruts / +356 Ko gzip dans le bundle du Worker). Ce rendu maison appelle directement le `render` de chaque bloc ;
 * il ne gère ni les zones imbriquées ni le texte riche (à ajouter bloc par bloc si le besoin se confirme). Import de types seulement.
 * Un type de bloc inconnu est ignoré en silence (page enregistrée avec un bloc retiré depuis).
 */
export function RenduPage({ donnees }: { donnees: Data }) {
  return (
    <>
      {donnees.content.map((item) => {
        const bloc = (configBlocs.components as Record<string, { render: (props: never) => React.ReactNode } | undefined>)[item.type];
        if (!bloc) return null;
        const Rendu = bloc.render as unknown as React.ComponentType<Record<string, unknown>>;
        return <Rendu key={String(item.props.id)} {...item.props} />;
      })}
    </>
  );
}
