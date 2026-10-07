import { NOMS_COLONNES, REGISTRE, entreeRegistre, pageVide, type ChampBloc, type PageBlocs } from "./registre";
import { normaliserReglages } from "./reglages";

/**
 * Passage entre les données de l'éditeur visuel (Puck) et le document de page du registre (palier 3). Module PUR, sans
 * import de Puck : on décrit ici la forme utile des données de Puck (`content`, `root.props`), le reste est ignoré.
 *
 * Vers le serveur, on n'envoie que ce que le registre connaît : `{ content: [{ type, props }], root: { props } }`, chaque
 * bloc réduit aux propriétés de son schéma (plus l'identifiant `id`), dans l'ordre de ses champs ; `zones` et toute autre
 * clé ajoutée par Puck sont retirées (le schéma strict de la tâche 6 les refuserait). Un type inconnu est GARDÉ tel quel :
 * la validation le signalera avec son numéro au lieu de le faire disparaître sans rien dire.
 *
 * Tâche 8 : les blocs des colonnes sont des champs « slot » de Puck (liste de blocs dans les propriétés du bloc Colonnes) :
 * ils sont réduits de la même façon, récursivement. Un champ facultatif laissé vide (« ») et un réglage « Par défaut »
 * ne sont pas enregistrés.
 */

/** Forme minimale des données de Puck lues ici (aucune dépendance au paquet). */
export interface DonneesEditeur {
  content: { type: string; props: Record<string, unknown> }[];
  root: { props?: Record<string, unknown> };
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

/** Valeur d'un champ réduite à ce que le registre décrit (récursif : groupes, listes et colonnes). */
function reduireValeur(champ: ChampBloc, valeur: unknown, avecId: boolean): unknown {
  switch (champ.genre) {
    case "colonne":
      return Array.isArray(valeur) ? valeur.map((bloc) => reduireBloc(bloc, avecId)) : valeur;
    case "reglages":
    case "reglagesAccueil":
      return normaliserReglages(valeur);
    case "groupe":
      return estObjet(valeur) ? reduireChamps(champ.champs, valeur, false, avecId) : valeur;
    case "liste":
      return Array.isArray(valeur) ? valeur.map((element) => (estObjet(element) ? reduireChamps(champ.champs, element, false, avecId) : element)) : valeur;
    case "texte":
    case "texteLong":
      // Un champ facultatif laissé vide n'est pas enregistré.
      return champ.optionnel && valeur === "" ? undefined : valeur;
    case "taxonomie":
      return valeur === "" ? undefined : valeur;
    default:
      return valeur;
  }
}

function reduireChamps(champs: Record<string, ChampBloc>, props: Record<string, unknown>, garderId: boolean, avecId: boolean): Record<string, unknown> {
  const resultat: Record<string, unknown> = {};
  if (garderId && avecId && typeof props.id === "string") resultat.id = props.id;
  for (const [cle, champ] of Object.entries(champs)) {
    if (!Object.prototype.hasOwnProperty.call(props, cle)) continue;
    const valeur = reduireValeur(champ, props[cle], avecId);
    if (valeur !== undefined) resultat[cle] = valeur;
  }
  return resultat;
}

/** Propriétés d'un bloc réduites à son schéma : `id` d'abord (s'il existe), puis les champs du registre dans leur ordre. */
function propsReduites(type: string, props: Record<string, unknown>, avecId: boolean): Record<string, unknown> {
  const entree = entreeRegistre(type);
  if (!entree) {
    const copie = { ...props };
    if (!avecId) delete copie.id;
    return copie;
  }
  return reduireChamps(entree.champs as Record<string, ChampBloc>, props, true, avecId);
}

/** Propriétés d'un bloc de l'éditeur réduites au registre, sans identifiant (aperçu : valeurs à valider puis rendre). */
export function proprietesPourRendu(type: string, props: Record<string, unknown>): Record<string, unknown> {
  return propsReduites(type, props, false);
}

/** Bloc de l'éditeur -> bloc du document (les blocs des colonnes sont réduits de la même façon). */
function reduireBloc(bloc: unknown, avecId: boolean): unknown {
  if (!estObjet(bloc) || typeof bloc.type !== "string") return bloc;
  return { type: bloc.type, props: propsReduites(bloc.type, estObjet(bloc.props) ? bloc.props : {}, avecId) };
}

/** Données de l'éditeur -> document à valider puis enregistrer. */
export function puckVersDocument(donnees: DonneesEditeur): PageBlocs {
  const content = (Array.isArray(donnees.content) ? donnees.content : []).map((bloc) => reduireBloc(bloc, true));
  const titre = estObjet(donnees.root?.props) ? donnees.root.props.titre : undefined;
  // Le type exact est garanti par la validation qui suit (validerPage), jamais supposé ici.
  return { content, root: { props: typeof titre === "string" ? { titre } : {} } } as PageBlocs;
}

/**
 * Bloc du document -> bloc de l'éditeur : un identifiant est donné à chaque bloc qui n'en a pas (Puck retrouve un bloc par
 * son identifiant ; sans effet sur `estModifie` : l'empreinte ignore les identifiants), et les colonnes absentes sont
 * créées vides.
 */
function blocVersPuck(bloc: Record<string, unknown>): { type: string; props: Record<string, unknown> } {
  const type = bloc.type as string;
  const props: Record<string, unknown> = estObjet(bloc.props) ? { ...bloc.props } : {};
  if (typeof props.id !== "string" || props.id === "") props.id = `${type}-${globalThis.crypto.randomUUID()}`;
  if (type === "Colonnes") {
    for (const nom of NOMS_COLONNES) {
      const colonne = props[nom];
      props[nom] = Array.isArray(colonne)
        ? colonne.filter((enfant): enfant is Record<string, unknown> => estObjet(enfant) && typeof enfant.type === "string").map(blocVersPuck)
        : [];
    }
  }
  return { type, props };
}

/**
 * Document lu en base -> données initiales de l'éditeur. Un document illisible (pas d'objet, pas de liste de blocs)
 * donne une page vide : l'appelant affiche alors les erreurs de validation renvoyées par le serveur.
 */
export function documentVersPuck(document: unknown): DonneesEditeur {
  if (!estObjet(document) || !Array.isArray(document.content)) return pageVide() as DonneesEditeur;
  const content = document.content.filter((bloc): bloc is Record<string, unknown> => estObjet(bloc) && typeof bloc.type === "string").map(blocVersPuck);
  const racine = estObjet(document.root) && estObjet(document.root.props) ? { ...document.root.props } : {};
  return { content, root: { props: racine } };
}

/**
 * Empreinte d'un document pour savoir s'il a changé : sérialisation SANS les identifiants de blocs (l'éditeur en ajoute
 * à l'ouverture, ce n'est pas une modification), clés dans l'ordre du registre, colonnes comprises.
 */
export function empreinte(document: { content: readonly { type: string; props: Record<string, unknown> }[]; root: { props?: Record<string, unknown> } }): string {
  return JSON.stringify({
    content: document.content.map((bloc) => {
      const reduit = reduireBloc(bloc, false) as { type: string; props: Record<string, unknown> };
      return [reduit.type, reduit.props];
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
