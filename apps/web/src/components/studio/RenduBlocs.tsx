import type { ReactNode } from "react";
import { estLienBanniereSur } from "@/lib/auth/redirection";
import type { Segment } from "@/lib/cms/texte-riche";
import { analyserParagraphe, entreeRegistre, estTypeAccueil, estUrlImageStudio, type BlocPage, type BlocSimple, type PageBlocs, type TypeAccueil } from "@/lib/studio/registre";
import { classesReglages } from "@/lib/studio/reglages";

/**
 * Rendu d'une page à blocs (Studio, palier 3), SANS Puck et sans accès aux données : il sert à la page publique (via
 * `RenduPage`, qui charge les restaurants) ET à l'aperçu de l'éditeur (bloc par bloc). Il ne reçoit qu'un document VALIDÉ
 * par `validerPage` et rend chaque bloc en éléments React : aucun HTML libre, aucun `dangerouslySetInnerHTML`, aucun
 * `style=` construit depuis des données (les réglages ne produisent que des noms de classes, voir `studio-blocs.css`).
 * Le seul h1 de la page est son titre (rendu par l'appelant) : les titres de blocs donnent h2, h3 ou h4. Ordre de lecture =
 * ordre des blocs ; sur mobile les colonnes s'empilent dans cet ordre.
 */

/** Lien externe : nouvel onglet, sans accès à la page d'origine (comme le texte riche). */
function attributsLien(href: string) {
  return href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" };
}

function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === "gras") return <strong key={i}>{s.valeur}</strong>;
        if (s.type === "saut") return <br key={i} />;
        if (s.type === "lien") {
          return (
            <a key={i} href={s.href} {...attributsLien(s.href)}>
              {s.libelle}
            </a>
          );
        }
        return <span key={i}>{s.valeur}</span>;
      })}
    </>
  );
}

function Paragraphe({ texte }: { texte: string }) {
  return (
    <div className="sb-paragraphe">
      {analyserParagraphe(texte).map((b, i) => {
        if (b.type === "liste") {
          return (
            <ul key={i}>
              {b.elements.map((e, j) => (
                <li key={j}>
                  <Segments segments={e} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Segments segments={b.segments} />
          </p>
        );
      })}
    </div>
  );
}

/** Bouton : le lien a été validé avec la page ; revérifié ici par prudence (un lien refusé n'est jamais rendu). */
function LienBouton({ libelle, lien, variante }: { libelle: string; lien: string; variante: "principal" | "secondaire" }) {
  if (!estLienBanniereSur(lien)) return null;
  return (
    <p className="sb-bouton">
      <a className={`btn ${variante === "principal" ? "btn-primary" : "btn-secondary"}`} href={lien} {...attributsLien(lien)}>
        {libelle}
      </a>
    </p>
  );
}

type BlocDynamique = Extract<BlocPage, { type: "CarteRestaurant" | "ListeRestaurants" }>;

export interface OptionsRendu {
  /**
   * Accueil en blocs (page publique de `/`) : rendu d'une section d'accueil, fourni par la page. Les sections se posent
   * directement dans le `<main>` de l'accueil (sans conteneur `sb-page`), comme dans la page d'origine ; seuls les blocs
   * ordinaires voisins sont regroupés dans le conteneur de texte des pages à blocs. Absent : une note à la place (éditeur).
   */
  rendreAccueil?: (type: TypeAccueil) => ReactNode;
  /** Vrai pour l'accueil : la disposition ci-dessus (sections au premier niveau du `<main>`). */
  accueil?: boolean;
  /**
   * Rendu des blocs qui lisent des données à l'affichage (cartes et listes de restaurants), fourni par la page publique.
   * Renvoyer `null` : le bloc ne rend rien. Absent (aperçu de l'éditeur) : une note à la place.
   */
  rendreDynamique?: (bloc: BlocDynamique, index: number, niveauTitre: 2 | 3) => ReactNode;
  /** Aperçu de l'éditeur : un bloc réservé à un type d'écran reste visible (et signalé) pour pouvoir être modifié. */
  edition?: boolean;
}

const NOTES_EDITION: Record<string, string> = {
  mobile: "Ce bloc s'affiche seulement sur téléphone.",
  bureau: "Ce bloc s'affiche seulement sur ordinateur.",
};

/** Contenu d'un bloc, sans ses réglages ; `null` si le bloc ne rend rien. */
function corps(bloc: BlocPage | BlocSimple, index: number, niveauTitre: 2 | 3, options: OptionsRendu): ReactNode {
  switch (bloc.type) {
    case "Titre": {
      const Balise = `h${bloc.props.niveau}` as "h2" | "h3" | "h4";
      return <Balise className={`sb-titre${bloc.props.alignement === "centre" ? " sb-centre" : ""}`}>{bloc.props.texte}</Balise>;
    }
    case "Paragraphe":
      return <Paragraphe texte={bloc.props.texte} />;
    case "Citation":
      return (
        <blockquote className="sb-citation">
          <p>{bloc.props.texte}</p>
          {bloc.props.auteur ? <cite>{bloc.props.auteur}</cite> : null}
        </blockquote>
      );
    case "Image": {
      const p = bloc.props;
      // L'adresse a été validée avec la page ; revérifiée ici : une adresse hors du stockage Speedfood n'est jamais rendue.
      if (!estUrlImageStudio(p.src)) return null;
      return (
        <figure className="sb-image">
          <div className={`sb-image-cadre sb-ratio-${p.ratio} sb-ajust-${p.ajustement}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- image du stockage Speedfood, adresse validée par le schéma. */}
            <img src={p.src} alt={p.decorative === true ? "" : p.alt} loading="lazy" decoding="async" />
          </div>
          {p.legende ? <figcaption>{p.legende}</figcaption> : null}
        </figure>
      );
    }
    case "Colonnes": {
      const p = bloc.props;
      const colonnes = [p.colonne1 ?? [], p.colonne2 ?? [], p.colonne3 ?? []].slice(0, p.nombre);
      // Comportement sur téléphone : absent des documents antérieurs, vaut « empiler » (le CSS d'origine).
      const telephone = p.telephone && p.telephone !== "empiler" ? ` sb-tel-${p.telephone}` : "";
      return (
        <div className={`sb-colonnes sb-colonnes-${p.nombre} sb-ecart-${p.ecart}${telephone}`}>
          {colonnes.map((blocs, k) => (
            <div key={k} className="sb-colonne">
              {blocs.map((enfant, j) => (
                <Bloc key={j} bloc={enfant} index={j} niveauTitre={niveauTitre} options={{ edition: options.edition }} />
              ))}
            </div>
          ))}
        </div>
      );
    }
    case "Bouton":
      return <LienBouton libelle={bloc.props.libelle} lien={bloc.props.lien} variante={bloc.props.style} />;
    case "AppelAction":
      return (
        <div className="sb-cta">
          <h2 className="sb-titre">{bloc.props.titre}</h2>
          {bloc.props.texte ? <p className="sb-cta-texte">{bloc.props.texte}</p> : null}
          <LienBouton libelle={bloc.props.bouton.libelle} lien={bloc.props.bouton.lien} variante={bloc.props.bouton.style} />
        </div>
      );
    case "FAQ":
      return (
        <div className="sb-faq">
          {bloc.props.titre ? <h2 className="sb-titre">{bloc.props.titre}</h2> : null}
          {bloc.props.questions.map((q, i) => (
            <details key={i} className="sb-faq-item">
              <summary>{q.question}</summary>
              <div className="sb-faq-reponse">
                <Paragraphe texte={q.reponse} />
              </div>
            </details>
          ))}
        </div>
      );
    case "Separateur":
      return bloc.props.style === "trait" ? <hr className="sb-separateur" aria-hidden="true" /> : <div className="sb-separateur-vide" aria-hidden="true" />;
    case "Espace":
      return <div className={`sb-espace sb-espace-${bloc.props.hauteur}`} aria-hidden="true" />;
    case "AccueilAccroche":
    case "AccueilBandeau":
    case "AccueilRestaurants":
    case "AccueilQuartiers":
    case "AccueilEtapes":
    case "AccueilSuivi":
    case "AccueilPro":
      if (options.rendreAccueil) return options.rendreAccueil(bloc.type);
      return (
        <p className="se-bloc-dynamique">
          {entreeRegistre(bloc.type)?.libelle} : cette section s&apos;affiche sur la page d&apos;accueil publiée, avec les textes du site et les
          données du moment. Ses mots se modifient dans « Textes du site ».
        </p>
      );
    case "CarteRestaurant":
    case "ListeRestaurants":
      if (options.rendreDynamique) return options.rendreDynamique(bloc, index, niveauTitre);
      return (
        <p className="se-bloc-dynamique">
          {bloc.type === "CarteRestaurant"
            ? "Carte de restaurant : elle s'affiche sur la page publiée, avec les informations à jour du restaurant."
            : "Liste de restaurants : elle s'affiche sur la page publiée, avec les restaurants du moment."}{" "}
          Un restaurant non publié ou suspendu n&apos;apparaît jamais.
        </p>
      );
    default: {
      // Exhaustivité vérifiée à la compilation ; à l'exécution, un type inconnu ne rend rien (la validation l'a déjà refusé).
      const inconnu: never = bloc;
      void inconnu;
      return null;
    }
  }
}

/**
 * Conteneur des réglages d'un bloc, posé seulement quand un réglage existe : sans réglage, aucun conteneur (rendu identique à
 * celui d'avant les réglages). `edition` : un bloc réservé à un type d'écran reste visible, avec une note.
 */
export function EnveloppeBloc({ reglages, edition = false, children }: { reglages: BlocPage["props"]["reglages"]; edition?: boolean; children: ReactNode }) {
  const classes = classesReglages(reglages, edition);
  const ancre = reglages?.ancre;
  const note = edition && reglages?.visibilite && reglages.visibilite !== "tous" ? NOTES_EDITION[reglages.visibilite] : undefined;
  if (classes.length === 0 && !ancre && !note) return <>{children}</>;
  return (
    <div id={ancre} className={["sb-bloc", ...classes].join(" ")}>
      {children}
      {note ? <p className="se-note-visibilite">{note}</p> : null}
    </div>
  );
}

/**
 * Conteneur d'une section d'accueil sur la page publique : posé seulement si un réglage existe (espaces, visibilité, ancre) ;
 * sans réglage, la section est rendue telle quelle, comme dans la page d'origine. Classe propre (`sb-accueil-bloc`) : les
 * règles de `.sb-bloc` et de `.sb-page` ne s'appliquent pas aux sections, qui ont leur propre mise en page.
 */
function EnveloppeAccueil({ reglages, children }: { reglages: BlocPage["props"]["reglages"]; children: ReactNode }) {
  const classes = classesReglages(reglages);
  const ancre = reglages?.ancre;
  if (classes.length === 0 && !ancre) return <>{children}</>;
  return (
    <div id={ancre} className={["sb-accueil-bloc", ...classes].join(" ")}>
      {children}
    </div>
  );
}

function Bloc({ bloc, index, niveauTitre, options }: { bloc: BlocPage | BlocSimple; index: number; niveauTitre: 2 | 3; options: OptionsRendu }) {
  const contenu = corps(bloc, index, niveauTitre, options);
  if (contenu === null) return null;
  if (options.rendreAccueil && estTypeAccueil(bloc.type)) return <EnveloppeAccueil reglages={bloc.props.reglages}>{contenu}</EnveloppeAccueil>;
  return (
    <EnveloppeBloc reglages={bloc.props.reglages} edition={options.edition === true}>
      {contenu}
    </EnveloppeBloc>
  );
}

/** Vrai si le bloc ouvre un titre de section : les cartes qui suivent passent alors au niveau inférieur. */
function ouvreUneSection(bloc: BlocPage): boolean {
  switch (bloc.type) {
    case "Titre":
    case "AppelAction":
      return true;
    case "FAQ":
    case "ListeRestaurants":
      return !!bloc.props.titre;
    case "AccueilRestaurants":
    case "AccueilQuartiers":
    case "AccueilEtapes":
    case "AccueilSuivi":
    case "AccueilPro":
      return true;
    default:
      return false;
  }
}

export function RenduBlocs({ page, ...options }: { page: PageBlocs } & OptionsRendu) {
  // Niveau des titres de cartes : 2 tant qu'aucun titre de section n'a été posé avant, 3 ensuite.
  const niveaux: (2 | 3)[] = [];
  let sectionOuverte = false;
  for (const bloc of page.content) {
    niveaux.push(sectionOuverte ? 3 : 2);
    if (ouvreUneSection(bloc)) sectionOuverte = true;
  }
  const elements = page.content.map((bloc, i) => <Bloc key={i} bloc={bloc} index={i} niveauTitre={niveaux[i]} options={options} />);
  if (!options.accueil) return <div className="sb-page">{elements}</div>;

  // Accueil : les sections au premier niveau du <main> ; les blocs ordinaires consécutifs dans le conteneur de texte des pages à blocs.
  const sorties: ReactNode[] = [];
  let groupe: ReactNode[] = [];
  const viderGroupe = () => {
    if (groupe.length === 0) return;
    sorties.push(
      <div key={`texte-${sorties.length}`} className="pub-conteneur pub-rubrique">
        <div className="cms-page">
          <div className="sb-page">{groupe}</div>
        </div>
      </div>
    );
    groupe = [];
  };
  page.content.forEach((bloc, i) => {
    if (estTypeAccueil(bloc.type)) {
      viderGroupe();
      sorties.push(elements[i]);
    } else {
      groupe.push(elements[i]);
    }
  });
  viderGroupe();
  return <>{sorties}</>;
}

/** Un seul bloc (aperçu de l'éditeur : chaque bloc est rendu par Puck dans son propre cadre). */
export function RenduBloc({ bloc, edition = true }: { bloc: BlocPage | BlocSimple; edition?: boolean }) {
  return <Bloc bloc={bloc} index={0} niveauTitre={3} options={{ edition }} />;
}
