import type { Metadata } from "next";
import { origineDuSite } from "@/lib/partage/origine";
import { BIBLIOTHEQUE_PHOTOS } from "@/lib/menu/bibliotheque-photos";
import { construireCredits } from "@/lib/menu/credits-photos";

export async function generateMetadata(): Promise<Metadata> {
  const origine = await origineDuSite();
  return {
    title: "Crédits des photos",
    description: "Les auteurs et les licences des photos de plats affichées sur Speedfood.",
    alternates: { canonical: `${origine}/credits-photos` },
  };
}

// Rendue à chaque requête : le cadre du site lit les interrupteurs de fonctionnalités et les réglages d'assistance.
export const dynamic = "force-dynamic";

/**
 * Crédits des photos de plats de la bibliothèque. Les photos sous licence Creative Commons (CC BY, CC BY-SA) exigent le nom de l'auteur, la licence et
 * un lien : elles sont toutes listées ici. La liste vient directement de la bibliothèque (`credits-photos.ts`), donc elle ne peut pas oublier une photo.
 * Les photos propres à un restaurant, publiées par lui, n'apparaissent pas ici : leur auteur est le restaurant.
 */
export default function CreditsPhotosPage() {
  const credits = construireCredits(BIBLIOTHEQUE_PHOTOS);
  const nombreLibres = credits.libres.reduce((total, l) => total + l.nombre, 0);
  return (
    <main className="pub-conteneur pub-rubrique">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">Crédits des photos</p>
        <h1 className="pub-titre pub-h1-page">
          Merci aux <span className="pub-surligne">photographes</span>
        </h1>
        <p className="pub-accueil-lead">
          Les photos de plats que vous voyez ici viennent de banques d&apos;images libres de droits, de Wikimedia Commons, de restaurants partenaires ou, pour
          certains plats, d&apos;images générées par ordinateur. Cette page nomme les auteurs quand leur licence l&apos;exige.
        </p>
      </div>

      <div className="conditions-corps">
        <section id="creative-commons" aria-labelledby="c-cc" className="pub-carte pub-carte-pad">
          <h2 id="c-cc" className="pub-titre pub-h3-page">Photos sous licence Creative Commons ({credits.obligatoires.length})</h2>
          <p>
            Ces photos sont publiées par leurs auteurs sous licence Creative Commons (CC BY ou CC BY-SA), qui autorise leur réutilisation à condition de citer
            l&apos;auteur et la licence. Chaque ligne indique le plat représenté, l&apos;auteur, la licence et la page d&apos;origine de la photo.
          </p>
          <ul className="pub-liste-simple">
            {credits.obligatoires.map((c) => (
              <li key={c.photoId}>
                <strong>{c.plat}</strong> : photo de {c.auteur},{" "}
                {c.urlLicence ? (
                  <a href={c.urlLicence} className="lien-texte" rel="noopener noreferrer" target="_blank">
                    {c.licence}
                  </a>
                ) : (
                  c.licence
                )}
                {c.page ? (
                  <>
                    {" "}
                    (
                    <a href={c.page} className="lien-texte" rel="noopener noreferrer" target="_blank">
                      page d&apos;origine
                    </a>
                    )
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section id="banques" aria-labelledby="c-banques" className="pub-carte pub-carte-pad">
          <h2 id="c-banques" className="pub-titre pub-h3-page">Banques d&apos;images libres de droits ({nombreLibres})</h2>
          <p>
            Ces photos viennent de banques dont la licence autorise l&apos;usage commercial sans obligation de crédit. Nous remercions tout de même leurs
            photographes.
          </p>
          <ul className="pub-liste-simple">
            {credits.libres.map((l) => (
              <li key={l.source}>
                <strong>{l.source}</strong> : {l.nombre} photos
                {l.source === "Pexels" ? (
                  <>
                    {" "}
                    (
                    <a href="https://www.pexels.com" className="lien-texte" rel="noopener noreferrer" target="_blank">
                      pexels.com
                    </a>
                    )
                  </>
                ) : null}
                {l.source === "Pixabay" ? (
                  <>
                    {" "}
                    (
                    <a href="https://pixabay.com" className="lien-texte" rel="noopener noreferrer" target="_blank">
                      pixabay.com
                    </a>
                    )
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section id="images-illustratives" aria-labelledby="c-ia" className="pub-carte pub-carte-pad">
          <h2 id="c-ia" className="pub-titre pub-h3-page">Images illustratives ({credits.imagesIa})</h2>
          <p>
            Pour certains plats, aucune photo libre de bonne qualité n&apos;était disponible : nous utilisons alors une image générée par ordinateur. Elle
            est signalée « image illustrative », ne montre pas le plat réellement servi et disparaît dès que le restaurant publie sa propre photo.
          </p>
        </section>

        <section id="restaurants" aria-labelledby="c-restos" className="pub-carte pub-carte-pad">
          <h2 id="c-restos" className="pub-titre pub-h3-page">Photos des restaurants</h2>
          <p>
            Quand un restaurant publie la photo de l&apos;un de ses plats, elle remplace toujours une photo de banque ou une image illustrative. Elle reste la
            propriété du restaurant.
          </p>
        </section>
      </div>
    </main>
  );
}
