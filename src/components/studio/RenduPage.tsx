import { estLienBanniereSur } from "@/lib/auth/redirection";
import type { Segment } from "@/lib/cms/texte-riche";
import { analyserParagraphe, type BlocPage, type PageBlocs } from "@/lib/studio/registre";

/**
 * Rendu public d'une page à blocs (Studio, palier 3). Composant SERVEUR, sans Puck : son `Render` embarquerait l'éditeur
 * de texte riche dans le Worker (+356 Ko gzip, essai de la tâche 5). Il ne reçoit qu'une page VALIDÉE par `validerPage`
 * et rend chaque bloc en éléments React : aucun HTML libre, aucun `dangerouslySetInnerHTML`. Le seul h1 de la page est
 * son titre (rendu par l'appelant) : les blocs Titre donnent h2, h3 ou h4. Ordre de lecture = ordre des blocs.
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

function Bloc({ bloc }: { bloc: BlocPage }) {
  switch (bloc.type) {
    case "Titre": {
      const Balise = (`h${bloc.props.niveau}` as "h2" | "h3" | "h4");
      return <Balise className={`sb-titre${bloc.props.alignement === "centre" ? " sb-centre" : ""}`}>{bloc.props.texte}</Balise>;
    }
    case "Paragraphe":
      return <Paragraphe texte={bloc.props.texte} />;
    case "Bouton": {
      // Le lien a été validé avec la page ; revérifié ici par prudence (un lien refusé n'est jamais rendu).
      if (!estLienBanniereSur(bloc.props.lien)) return null;
      return (
        <p className="sb-bouton">
          <a
            className={`btn ${bloc.props.style === "principal" ? "btn-primary" : "btn-secondary"}`}
            href={bloc.props.lien}
            {...attributsLien(bloc.props.lien)}
          >
            {bloc.props.libelle}
          </a>
        </p>
      );
    }
    case "Separateur":
      return bloc.props.style === "trait" ? <hr className="sb-separateur" aria-hidden="true" /> : <div className="sb-separateur-vide" aria-hidden="true" />;
    case "Espace":
      return <div className={`sb-espace sb-espace-${bloc.props.hauteur}`} aria-hidden="true" />;
    default: {
      // Exhaustivité vérifiée à la compilation ; à l'exécution, un type inconnu ne rend rien (la validation l'a déjà refusé).
      const inconnu: never = bloc;
      void inconnu;
      return null;
    }
  }
}

export function RenduPage({ page }: { page: PageBlocs }) {
  return (
    <div className="sb-page">
      {page.content.map((bloc, i) => (
        <Bloc key={i} bloc={bloc} />
      ))}
    </div>
  );
}
