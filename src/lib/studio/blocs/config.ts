import type { Config, Data } from "@puckeditor/core";
import { Titre, type PropsTitre } from "./titre";
import { Paragraphe, type PropsParagraphe } from "./paragraphe";
import { Espace, type PropsEspace } from "./espace";

type Composants = { Titre: PropsTitre; Paragraphe: PropsParagraphe; Espace: PropsEspace };

/**
 * Configuration des blocs de l'éditeur de pages (essai de faisabilité, palier 3). Aucun import de valeur depuis Puck :
 * ce module est partagé par l'éditeur (navigateur) et par le rendu (serveur) sans embarquer l'éditeur dans le Worker.
 */
export const configBlocs: Config<Composants> = {
  components: { Titre, Paragraphe, Espace },
};

/** Page d'exemple pour l'éditeur et le rendu serveur de l'essai. */
export const donneesExemple: Data<Composants> = {
  root: { props: {} },
  content: [
    { type: "Titre", props: { id: "t1", texte: "Bienvenue chez Speedfood", niveau: "h1" } },
    { type: "Espace", props: { id: "e1", hauteur: 16 } },
    { type: "Paragraphe", props: { id: "p1", texte: "Commandez vos plats préférés à Conakry." } },
  ],
};
