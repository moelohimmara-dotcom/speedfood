import { analyserTexteRiche, type Bloc, type Segment } from "@/lib/cms/texte-riche";

/** Rend les segments en éléments React : tout texte est échappé par React, aucun HTML libre n'est injecté. */
function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === "gras") return <strong key={i}>{s.valeur}</strong>;
        if (s.type === "saut") return <br key={i} />;
        if (s.type === "lien") {
          const interne = s.href.startsWith("/");
          return (
            <a key={i} href={s.href} {...(interne ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
              {s.libelle}
            </a>
          );
        }
        return <span key={i}>{s.valeur}</span>;
      })}
    </>
  );
}

function BlocRendu({ bloc }: { bloc: Bloc }) {
  if (bloc.type === "titre") {
    // Le h1 de la page est le titre de la page : `#` donne un h2, `##` un h3.
    return bloc.niveau === 1 ? (
      <h2><Segments segments={bloc.segments} /></h2>
    ) : (
      <h3><Segments segments={bloc.segments} /></h3>
    );
  }
  if (bloc.type === "liste") {
    return (
      <ul>
        {bloc.elements.map((e, i) => (
          <li key={i}><Segments segments={e} /></li>
        ))}
      </ul>
    );
  }
  return <p><Segments segments={bloc.segments} /></p>;
}

export function TexteRiche({ contenu }: { contenu: string }) {
  const blocs = analyserTexteRiche(contenu);
  return (
    <div className="cms-texte">
      {blocs.map((b, i) => (
        <BlocRendu key={i} bloc={b} />
      ))}
    </div>
  );
}
