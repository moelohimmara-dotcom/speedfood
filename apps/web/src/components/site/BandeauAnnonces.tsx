import { lireBannieresPubliees } from "@/lib/cms/lecture";
import { estLienBanniereSur } from "@/lib/auth/redirection";

/** Bandeau d'annonces de l'accueil : les bannières publiées par l'équipe (3 au plus). Rien si aucune n'est publiée. */
export async function BandeauAnnonces() {
  const bannieres = await lireBannieresPubliees();
  if (bannieres.length === 0) return null;
  return (
    <section className="cms-annonces" aria-label="Annonces">
      <ul className="cms-annonces-liste">
        {bannieres.map((b) => {
          const lien = b.lien && estLienBanniereSur(b.lien) ? b.lien : null;
          const attrs = lien !== null && !lien.startsWith("/") ? { target: "_blank", rel: "noopener noreferrer" } : {};
          return (
            <li key={b.id} className="cms-annonce">
              <p className="cms-annonce-texte">
                {lien && !b.texte ? (
                  <a href={lien} {...attrs}>
                    <strong>{b.titre}</strong>
                  </a>
                ) : (
                  <strong>{b.titre}</strong>
                )}
                {b.texte ? <> {b.texte}</> : null}
                {lien && b.texte ? (
                  <>
                    {" "}
                    <a className="cms-annonce-lien" href={lien} {...attrs}>
                      En savoir plus
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
