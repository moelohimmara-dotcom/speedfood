import { REGISTRE, entreeRegistre, pageVide, type PageBlocs } from "./registre";

/**
 * Passage entre les données de l'éditeur visuel (Puck) et le document de page du registre (palier 3, tâche 7). Module PUR,
 * sans import de Puck : on décrit ici la forme utile des données de Puck (`content`, `root.props`), le reste est ignoré.
 *
 * Vers le serveur, on n'envoie que ce que le registre connaît : `{ content: [{ type, props }], root: { props } }`, chaque
 * bloc réduit aux propriétés de son schéma (plus l'identifiant `id`), dans l'ordre de ses champs ; `zones` et toute autre
 * clé ajoutée par Puck sont retirées (le schéma strict de la tâche 6 les refuserait). Un type inconnu est GARDÉ tel quel :
 * la validation le signalera avec son numéro au lieu de le faire disparaître sans rien dire.
 */

/** Forme minimale des données de Puck lues ici (aucune dépendance au paquet). */
export interface DonneesEditeur {
  content: { type: string; props: Record<string, unknown> }[];
  root: { props?: Record<string, unknown> };
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

/** Propriétés d'un bloc réduites à son schéma : `id` d'abord (s'il existe), puis les champs du registre dans leur ordre. */
function propsReduites(type: string, props: Record<string, unknown>): Record<string, unknown> {
  const entree = entreeRegistre(type);
  if (!entree) return { ...props };
  const resultat: Record<string, unknown> = {};
  if (typeof props.id === "string") resultat.id = props.id;
  for (const cle of Object.keys(entree.champs)) {
    if (Object.prototype.hasOwnProperty.call(props, cle)) resultat[cle] = props[cle];
  }
  return resultat;
}

/** Données de l'éditeur -> document à valider puis enregistrer. */
export function puckVersDocument(donnees: DonneesEditeur): PageBlocs {
  const content = (Array.isArray(donnees.content) ? donnees.content : []).map((bloc) => ({
    type: bloc.type,
    props: propsReduites(bloc.type, estObjet(bloc.props) ? bloc.props : {}),
  }));
  const titre = estObjet(donnees.root?.props) ? donnees.root.props.titre : undefined;
  // Le type exact est garanti par la validation qui suit (validerPage), jamais supposé ici.
  return { content, root: { props: typeof titre === "string" ? { titre } : {} } } as PageBlocs;
}

/**
 * Document lu en base -> données initiales de l'éditeur. Un document illisible (pas d'objet, pas de liste de blocs)
 * donne une page vide : l'appelant affiche alors les erreurs de validation renvoyées par le serveur.
 */
export function documentVersPuck(document: unknown): DonneesEditeur {
  if (!estObjet(document) || !Array.isArray(document.content)) return pageVide() as DonneesEditeur;
  const content = document.content
    .filter((bloc): bloc is Record<string, unknown> => estObjet(bloc) && typeof bloc.type === "string")
    .map((bloc) => ({ type: bloc.type as string, props: estObjet(bloc.props) ? { ...bloc.props } : {} }));
  const racine = estObjet(document.root) && estObjet(document.root.props) ? { ...document.root.props } : {};
  return { content, root: { props: racine } };
}

/**
 * Empreinte d'un document pour savoir s'il a changé : sérialisation SANS les identifiants de blocs (l'éditeur en ajoute
 * à l'ouverture, ce n'est pas une modification), clés dans l'ordre du registre.
 */
export function empreinte(document: { content: readonly { type: string; props: Record<string, unknown> }[]; root: { props?: Record<string, unknown> } }): string {
  return JSON.stringify({
    content: document.content.map((bloc) => {
      const props = propsReduites(bloc.type, bloc.props ?? {});
      delete props.id;
      return [bloc.type, props];
    }),
    titre: typeof document.root?.props?.titre === "string" ? document.root.props.titre : null,
  });
}

/** Vrai si les données de l'éditeur diffèrent du dernier document enregistré (empreinte de référence). */
export function estModifie(donnees: DonneesEditeur, empreinteEnregistree: string): boolean {
  return empreinte(puckVersDocument(donnees)) !== empreinteEnregistree;
}

/** Libellé d'un type pour l'interface (le type brut s'il est inconnu, signalé comme tel). */
export function libelleBloc(type: string): string {
  return entreeRegistre(type)?.libelle ?? `Bloc inconnu (${type.slice(0, 40)})`;
}

/** Types ajoutables, dans l'ordre du registre. */
export const TYPES_AJOUTABLES = REGISTRE.map((e) => ({ type: e.type, libelle: e.libelle }));
